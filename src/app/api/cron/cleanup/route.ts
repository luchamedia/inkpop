import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"

export const maxDuration = 60

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = createServiceClient()

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const thirtyDaysAgoISO = thirtyDaysAgo.toISOString()

  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const sevenDaysAgoISO = sevenDaysAgo.toISOString()

  // 1. Delete source_learnings older than 30 days
  const { count: learningsPurged } = await supabase
    .from("source_learnings")
    .delete({ count: "exact" })
    .lt("created_at", thirtyDaysAgoISO)

  // 2. Expire active post_ideas past their expiration date
  const { count: ideasExpired } = await supabase
    .from("post_ideas")
    .update({ status: "expired" }, { count: "exact" })
    .eq("status", "active")
    .lt("expires_at", new Date().toISOString())

  // 3. Delete source_suggestions expired more than 7 days ago
  const { count: suggestionsPurged } = await supabase
    .from("source_suggestions")
    .delete({ count: "exact" })
    .lt("expires_at", sevenDaysAgoISO)

  // 4. Delete completed/failed queue jobs older than 30 days (legacy)
  const { count: queuePurged } = await supabase
    .from("generation_queue")
    .delete({ count: "exact" })
    .in("status", ["completed", "failed"])
    .lt("completed_at", thirtyDaysAgoISO)

  // 5. Delete completed/failed generation_runs older than 30 days
  const { count: runsPurged } = await supabase
    .from("generation_runs")
    .delete({ count: "exact" })
    .in("status", ["completed", "partial", "failed"])
    .lt("delivered_at", thirtyDaysAgoISO)

  return NextResponse.json({
    learningsPurged: learningsPurged ?? 0,
    ideasExpired: ideasExpired ?? 0,
    suggestionsPurged: suggestionsPurged ?? 0,
    queuePurged: queuePurged ?? 0,
    runsPurged: runsPurged ?? 0,
  })
}
