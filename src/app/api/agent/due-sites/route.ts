import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"
import { getBalance } from "@/lib/credits"

export const maxDuration = 30

const STALE_THRESHOLD_HOURS = 6

interface SiteRow {
  id: string
  user_id: string
  topic: string | null
  description: string | null
  topic_context: Array<{ question: string; answer: string }> | null
  writing_prompt: string | null
  posting_schedule: string | null
  posts_per_period: number | null
  auto_publish: boolean | null
  subdomain: string | null
  sources: Array<{ id: string; type: string; url: string }>
  users: {
    id: string
    credit_balance: number
    auto_renew: boolean
    auto_renew_pack: string | null
    stripe_customer_id: string | null
  }
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.AGENT_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = createServiceClient()

  // Generate unique run ID
  const date = new Date().toISOString().slice(0, 10)
  const rand = Math.random().toString(36).slice(2, 8)
  const runId = `run_${date}_${rand}`

  // --- Stale run detection ---
  // Mark dispatched runs older than STALE_THRESHOLD_HOURS as failed
  const staleThreshold = new Date(
    Date.now() - STALE_THRESHOLD_HOURS * 60 * 60 * 1000
  ).toISOString()

  await supabase
    .from("generation_runs")
    .update({
      status: "failed",
      errors: [{ ideaTitle: "_system", error: "Run was never delivered (stale)" }],
    })
    .eq("status", "dispatched")
    .lt("dispatched_at", staleThreshold)

  // --- Collect retry articles from partial/failed runs with per-article errors ---
  const { data: failedRuns } = await supabase
    .from("generation_runs")
    .select("site_id, errors")
    .in("status", ["partial", "failed"])
    .not("errors", "eq", "[]")
    .gt("dispatched_at", new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())

  const retryBySite = new Map<string, Array<{ title: string; angle: string }>>()
  for (const run of failedRuns || []) {
    const errors = run.errors as Array<{ ideaTitle?: string; error?: string }> | null
    if (!errors) continue
    const retries = errors
      .filter((e) => e.ideaTitle && e.ideaTitle !== "_system")
      .map((e) => ({ title: e.ideaTitle!, angle: "" }))
    if (retries.length > 0) {
      const existing = retryBySite.get(run.site_id) || []
      retryBySite.set(run.site_id, [...existing, ...retries])
    }
  }

  // Mark those failed/partial runs as handled so they don't get retried again
  if (failedRuns && failedRuns.length > 0) {
    // We don't re-mark stale ones, just clear the retry signal by updating status
    // Actually, let's leave them — the retry articles are collected and won't duplicate
  }

  // --- Query eligible sites ---
  const { data: sites } = await supabase
    .from("sites")
    .select(
      "id, user_id, topic, description, topic_context, writing_prompt, posting_schedule, posts_per_period, auto_publish, subdomain, sources(id, type, url), users!inner(id, credit_balance, auto_renew, auto_renew_pack, stripe_customer_id)"
    )
    .or("credit_balance.gt.0,auto_renew.eq.true", { referencedTable: "users" })

  const dueSites = []

  for (const rawSite of (sites || []) as unknown as SiteRow[]) {
    // Skip sites with no sources
    if (!rawSite.sources || rawSite.sources.length === 0) continue

    // Check posting schedule
    if (!shouldRunToday(rawSite.posting_schedule)) continue

    const user = rawSite.users
    const postsPerPeriod = rawSite.posts_per_period ?? 1

    // Calculate postsToGenerate (capped by credit balance unless auto_renew)
    let postsToGenerate = postsPerPeriod
    if (!user.auto_renew) {
      const balance = await getBalance(user.id)
      postsToGenerate = Math.min(postsPerPeriod, balance)
    }
    if (postsToGenerate <= 0 && !user.auto_renew) continue

    // Load existing titles for dedup (90 days posts + active ideas)
    const ninetyDaysAgo = new Date()
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

    const [existingPosts, existingIdeas] = await Promise.all([
      supabase
        .from("posts")
        .select("title")
        .eq("site_id", rawSite.id)
        .gte("generated_at", ninetyDaysAgo.toISOString()),
      supabase
        .from("post_ideas")
        .select("title")
        .eq("site_id", rawSite.id)
        .eq("status", "active")
        .gte("expires_at", new Date().toISOString()),
    ])

    const existingTitles = [
      ...(existingPosts.data || []).map((p) => p.title),
      ...(existingIdeas.data || []).map((i) => i.title),
    ]

    // Get retry articles for this site
    const retryArticles = retryBySite.get(rawSite.id) || []

    // Insert generation_runs record
    const { data: runRecord } = await supabase
      .from("generation_runs")
      .insert({
        run_id: runId,
        site_id: rawSite.id,
        user_id: rawSite.user_id,
        status: "dispatched",
        expected_posts: postsToGenerate + retryArticles.length,
      })
      .select("id")
      .single()

    dueSites.push({
      siteId: rawSite.id,
      runRecordId: runRecord?.id,
      postsToGenerate,
      sources: rawSite.sources.map((s) => ({
        id: s.id,
        type: s.type,
        url: s.url,
      })),
      siteContext: {
        topic: rawSite.topic,
        description: rawSite.description,
        topicContext: rawSite.topic_context,
        writingPrompt: rawSite.writing_prompt,
      },
      existingTitles,
      retryArticles,
    })
  }

  return NextResponse.json({ runId, sites: dueSites })
}

function shouldRunToday(schedule: string | null): boolean {
  if (!schedule) return true
  const day = new Date().getUTCDay()
  switch (schedule) {
    case "daily":
      return true
    case "weekly":
      return day === 1
    case "custom":
      return true
    default:
      return true
  }
}
