import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api-helpers"
import { createServiceClient } from "@/lib/supabase/server"
import { getBalance, deductCredits, autoRenewCredits, type PackId } from "@/lib/credits"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ siteId: string }> }
) {
  return withAuth(async (user) => {
    const { siteId } = await params
    const supabase = createServiceClient()

    // Verify site ownership
    const { data: site } = await supabase
      .from("sites")
      .select("id")
      .eq("id", siteId)
      .eq("user_id", user.id)
      .single()

    if (!site) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    // Get active queue items + recent completed/failed (last 24h)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    const [{ data: active }, { data: recent }] = await Promise.all([
      supabase
        .from("generation_queue")
        .select("id, job_type, idea_id, topic, status, position, post_id, error_message, retry_count, created_at, started_at, completed_at")
        .eq("site_id", siteId)
        .in("status", ["queued", "processing"])
        .order("position", { ascending: true }),
      supabase
        .from("generation_queue")
        .select("id, job_type, idea_id, topic, status, position, post_id, error_message, retry_count, created_at, started_at, completed_at")
        .eq("site_id", siteId)
        .in("status", ["completed", "failed"])
        .gte("completed_at", oneDayAgo)
        .order("completed_at", { ascending: false })
        .limit(10),
    ])

    // For idea jobs, fetch the idea titles
    const allItems = [...(active || []), ...(recent || [])]
    const ideaIds = allItems
      .filter((item) => item.job_type === "idea" && item.idea_id)
      .map((item) => item.idea_id!)

    let ideaTitles: Record<string, string> = {}
    if (ideaIds.length > 0) {
      const { data: ideas } = await supabase
        .from("post_ideas")
        .select("id, title")
        .in("id", ideaIds)

      ideaTitles = (ideas || []).reduce(
        (acc, idea) => ({ ...acc, [idea.id]: idea.title }),
        {} as Record<string, string>
      )
    }

    // For completed jobs, fetch post titles
    const postIds = allItems
      .filter((item) => item.post_id)
      .map((item) => item.post_id!)

    let postTitles: Record<string, string> = {}
    if (postIds.length > 0) {
      const { data: posts } = await supabase
        .from("posts")
        .select("id, title")
        .in("id", postIds)

      postTitles = (posts || []).reduce(
        (acc, post) => ({ ...acc, [post.id]: post.title }),
        {} as Record<string, string>
      )
    }

    // Enrich items with display titles
    const enriched = allItems.map((item) => ({
      ...item,
      display_title:
        item.job_type === "idea" && item.idea_id
          ? ideaTitles[item.idea_id] || "Untitled idea"
          : item.job_type === "topic"
            ? item.topic || "Custom topic"
            : "Scheduled generation",
      post_title: item.post_id ? postTitles[item.post_id] || null : null,
    }))

    return NextResponse.json(enriched)
  })
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ siteId: string }> }
) {
  return withAuth(async (user) => {
    const { siteId } = await params
    const supabase = createServiceClient()

    // Verify site ownership
    const { data: site } = await supabase
      .from("sites")
      .select("id")
      .eq("id", siteId)
      .eq("user_id", user.id)
      .single()

    if (!site) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const body = await req.json()
    const { type, ideaId, topic } = body as {
      type: "idea" | "topic"
      ideaId?: string
      topic?: string
    }

    if (!type || !["idea", "topic"].includes(type)) {
      return NextResponse.json({ error: "Invalid job type" }, { status: 400 })
    }

    if (type === "idea" && !ideaId) {
      return NextResponse.json({ error: "ideaId required" }, { status: 400 })
    }

    if (type === "topic" && (!topic || typeof topic !== "string" || topic.length > 500)) {
      return NextResponse.json({ error: "Invalid topic" }, { status: 400 })
    }

    // For idea jobs, validate the idea exists and is active
    if (type === "idea") {
      const { data: idea } = await supabase
        .from("post_ideas")
        .select("id, status, expires_at")
        .eq("id", ideaId!)
        .eq("site_id", siteId)
        .single()

      if (!idea) {
        return NextResponse.json({ error: "Idea not found" }, { status: 404 })
      }

      if (idea.status !== "active") {
        return NextResponse.json({ error: "Idea already used or queued" }, { status: 400 })
      }

      if (new Date(idea.expires_at) < new Date()) {
        return NextResponse.json({ error: "Idea has expired" }, { status: 400 })
      }
    }

    // Reserve credit: deduct now
    let balance = await getBalance(user.id)
    if (balance <= 0) {
      if (user.auto_renew && user.auto_renew_pack && user.stripe_customer_id) {
        const renewal = await autoRenewCredits(
          user.id,
          user.stripe_customer_id,
          user.auto_renew_pack as PackId
        )
        if (renewal.success) {
          balance = renewal.newBalance!
        } else {
          return NextResponse.json(
            { error: "Insufficient credits", balance: 0 },
            { status: 402 }
          )
        }
      } else {
        return NextResponse.json(
          { error: "Insufficient credits", balance: 0 },
          { status: 402 }
        )
      }
    }

    const deduction = await deductCredits(user.id, 1, siteId)
    if (!deduction.success) {
      return NextResponse.json(
        { error: "Insufficient credits", balance: deduction.balance },
        { status: 402 }
      )
    }

    // Calculate position
    const { data: maxPos } = await supabase
      .from("generation_queue")
      .select("position")
      .eq("site_id", siteId)
      .in("status", ["queued", "processing"])
      .order("position", { ascending: false })
      .limit(1)

    const position = (maxPos && maxPos.length > 0 ? maxPos[0].position : 0) + 1

    // Mark idea as queued (so it can't be queued again)
    if (type === "idea") {
      await supabase
        .from("post_ideas")
        .update({ status: "queued" })
        .eq("id", ideaId!)
    }

    // Insert queue row
    const { data: queueItem } = await supabase
      .from("generation_queue")
      .insert({
        site_id: siteId,
        user_id: user.id,
        job_type: type,
        idea_id: type === "idea" ? ideaId : null,
        topic: type === "topic" ? topic : null,
        status: "queued",
        position,
        credits_reserved: 1,
      })
      .select("id, position")
      .single()

    // Fire-and-forget: trigger processing
    const processUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/queue/process`
    fetch(processUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.CRON_SECRET}`,
      },
      body: JSON.stringify({ siteId }),
    }).catch(() => {})

    return NextResponse.json({
      success: true,
      queueId: queueItem?.id,
      position,
      creditsRemaining: deduction.balance,
    })
  })
}
