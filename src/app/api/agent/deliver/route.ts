import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { createServiceClient } from "@/lib/supabase/server"
import { deductCredits, autoRenewCredits, type PackId } from "@/lib/credits"

export const maxDuration = 60

interface DeliverRequest {
  runId: string
  siteId: string
  runRecordId: string
  learnings: Array<{
    sourceId: string
    learnings: Array<{ topic: string; insight: string; relevance: string }>
  }>
  ideas: Array<{
    title: string
    angle: string
    keyLearnings: string[]
    description?: string
    keywords?: string[]
    slug?: string
  }>
  posts: Array<{
    title: string
    slug: string
    body: string
    meta_description: string
    ideaTitle?: string
  }>
  errors: Array<{
    ideaTitle: string
    error: string
  }>
}

export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.AGENT_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body: DeliverRequest = await req.json()
  const { runId, siteId, runRecordId, learnings, ideas, posts, errors } = body

  const supabase = createServiceClient()

  // Validate run record exists and is dispatched
  const { data: runRecord } = await supabase
    .from("generation_runs")
    .select("id, site_id, user_id, status")
    .eq("id", runRecordId)
    .single()

  if (!runRecord) {
    return NextResponse.json({ error: "Run record not found" }, { status: 404 })
  }

  if (runRecord.status !== "dispatched") {
    return NextResponse.json(
      { error: `Run already ${runRecord.status}` },
      { status: 409 }
    )
  }

  if (runRecord.site_id !== siteId) {
    return NextResponse.json({ error: "Site mismatch" }, { status: 400 })
  }

  const userId = runRecord.user_id

  // Load site for auto_publish and subdomain
  const { data: site } = await supabase
    .from("sites")
    .select("auto_publish, subdomain")
    .eq("id", siteId)
    .single()

  const autoPublish = site?.auto_publish === true

  // Load user for auto-renew
  const { data: user } = await supabase
    .from("users")
    .select("auto_renew, auto_renew_pack, stripe_customer_id")
    .eq("id", userId)
    .single()

  // --- Write source_learnings ---
  for (const entry of learnings) {
    if (entry.learnings.length > 0) {
      await supabase.from("source_learnings").insert({
        site_id: siteId,
        source_id: entry.sourceId,
        learnings: entry.learnings,
      })
    }
  }

  // --- Write post_ideas (all ideas, 14-day expiry) ---
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 14)

  const writtenTitles = new Set(posts.map((p) => p.ideaTitle || p.title))
  const ideaIdByTitle = new Map<string, string>()

  for (const idea of ideas) {
    const isWritten = writtenTitles.has(idea.title)
    const { data: ideaRow } = await supabase
      .from("post_ideas")
      .insert({
        site_id: siteId,
        title: idea.title,
        angle: idea.angle,
        key_learnings: idea.keyLearnings,
        meta_description: idea.description || null,
        keywords: idea.keywords || [],
        slug: idea.slug || null,
        status: isWritten ? "used" : "active",
        expires_at: expiresAt.toISOString(),
      })
      .select("id")
      .single()

    if (ideaRow) {
      ideaIdByTitle.set(idea.title, ideaRow.id)
    }
  }

  // --- Write posts with credit deduction ---
  let postsCreated = 0
  let creditsDeducted = 0
  const deliveryErrors: Array<{ ideaTitle: string; error: string }> = [...errors]
  let userSkipped = false

  for (const post of posts) {
    if (userSkipped) {
      deliveryErrors.push({
        ideaTitle: post.ideaTitle || post.title,
        error: "Insufficient credits — skipped",
      })
      continue
    }

    // Deduct 1 credit
    const deduction = await deductCredits(userId, 1, siteId)
    if (!deduction.success) {
      // Attempt auto-renew
      if (user?.auto_renew && user.auto_renew_pack && user.stripe_customer_id) {
        const renewal = await autoRenewCredits(
          userId,
          user.stripe_customer_id,
          user.auto_renew_pack as PackId
        )
        if (renewal.success) {
          const retry = await deductCredits(userId, 1, siteId)
          if (!retry.success) {
            userSkipped = true
            deliveryErrors.push({
              ideaTitle: post.ideaTitle || post.title,
              error: "Insufficient credits after auto-renew",
            })
            continue
          }
        } else {
          userSkipped = true
          deliveryErrors.push({
            ideaTitle: post.ideaTitle || post.title,
            error: `Auto-renew failed: ${renewal.error}`,
          })
          continue
        }
      } else {
        userSkipped = true
        deliveryErrors.push({
          ideaTitle: post.ideaTitle || post.title,
          error: "Insufficient credits",
        })
        continue
      }
    }

    creditsDeducted++

    // Find matching idea ID
    const ideaId = ideaIdByTitle.get(post.ideaTitle || post.title) || null

    // Insert post
    await supabase.from("posts").insert({
      site_id: siteId,
      title: post.title,
      slug: post.slug,
      body: post.body,
      meta_description: post.meta_description || null,
      status: autoPublish ? "published" : "draft",
      published_at: autoPublish ? new Date().toISOString() : null,
      idea_id: ideaId,
    })

    postsCreated++
  }

  // Revalidate blog cache if any posts were auto-published
  if (autoPublish && postsCreated > 0 && site?.subdomain) {
    revalidatePath(`/blog/${site.subdomain}`, "layout")
  }

  // --- Update generation_runs record ---
  const hasErrors = deliveryErrors.length > 0
  const status =
    postsCreated === 0 && posts.length > 0
      ? "failed"
      : hasErrors
        ? "partial"
        : "completed"

  await supabase
    .from("generation_runs")
    .update({
      status,
      delivered_posts: postsCreated,
      errors: deliveryErrors,
      delivered_at: new Date().toISOString(),
    })
    .eq("id", runRecordId)

  return NextResponse.json({
    success: true,
    runId,
    postsCreated,
    creditsDeducted,
    errors: deliveryErrors,
  })
}
