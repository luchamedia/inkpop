import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"
import { addCredits } from "@/lib/credits"

export const maxDuration = 60

const STALE_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = createServiceClient()

  // 1. Clean up stale processing jobs (stuck > 5 min)
  const staleThreshold = new Date(Date.now() - STALE_TIMEOUT_MS).toISOString()
  const { data: staleJobs } = await supabase
    .from("generation_queue")
    .select("id, user_id, site_id, retry_count, credits_reserved")
    .eq("status", "processing")
    .lt("started_at", staleThreshold)

  for (const stale of staleJobs || []) {
    if (stale.retry_count < 3) {
      await supabase
        .from("generation_queue")
        .update({
          status: "queued",
          retry_count: stale.retry_count + 1,
          error_message: "Processing timed out — retrying",
          started_at: null,
        })
        .eq("id", stale.id)
    } else {
      await supabase
        .from("generation_queue")
        .update({
          status: "failed",
          error_message: "Processing timed out after 3 retries",
          completed_at: new Date().toISOString(),
        })
        .eq("id", stale.id)
      await addCredits(stale.user_id, stale.credits_reserved, stale.id, "queue_refund")
      await supabase
        .from("generation_queue")
        .update({ credits_refunded: true })
        .eq("id", stale.id)
    }
  }

  // 2. Find sites with queued items and no active (non-stale) processor
  const { data: pendingSites } = await supabase
    .from("generation_queue")
    .select("site_id")
    .eq("status", "queued")

  if (!pendingSites || pendingSites.length === 0) {
    return NextResponse.json({ triggered: 0, staleCleanup: staleJobs?.length ?? 0 })
  }

  // Deduplicate site IDs
  const siteIds = [...new Set(pendingSites.map((r) => r.site_id))]

  // Check which sites already have an active processor
  const { data: activeSites } = await supabase
    .from("generation_queue")
    .select("site_id")
    .eq("status", "processing")

  const activeSiteIds = new Set((activeSites || []).map((r) => r.site_id))
  const sitesToTrigger = siteIds.filter((id) => !activeSiteIds.has(id))

  // 3. Fire-and-forget process calls for each site needing processing
  const processUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/queue/process`
  for (const siteId of sitesToTrigger) {
    fetch(processUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.CRON_SECRET}`,
      },
      body: JSON.stringify({ siteId }),
    }).catch(() => {})
  }

  return NextResponse.json({
    triggered: sitesToTrigger.length,
    staleCleanup: staleJobs?.length ?? 0,
  })
}
