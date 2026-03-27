import { NextResponse } from "next/server"
import { getAuthUser } from "@/lib/auth"
import { createServiceClient } from "@/lib/supabase/server"
import { runGenerationWorkflow } from "@/lib/mindstudio"

export const maxDuration = 120

const MAX_SCANS_PER_DAY = 3

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ siteId: string }> }
) {
  try {
    const { siteId } = await params
    const user = await getAuthUser()
    const supabase = createServiceClient()

    // Verify site ownership and load site with sources
    const { data: site } = await supabase
      .from("sites")
      .select("id, user_id, topic, description, topic_context, writing_prompt, context_files, posts_per_period, sources(id, type, url)")
      .eq("id", siteId)
      .eq("user_id", user.id)
      .single()

    if (!site) {
      return NextResponse.json({ error: "Site not found" }, { status: 404 })
    }

    if (!site.sources || site.sources.length === 0) {
      return NextResponse.json({ error: "No sources configured" }, { status: 400 })
    }

    // Rate limit: count generation_runs for this site today
    const todayStart = new Date()
    todayStart.setUTCHours(0, 0, 0, 0)

    const { count } = await supabase
      .from("generation_runs")
      .select("id", { count: "exact", head: true })
      .eq("site_id", siteId)
      .gte("started_at", todayStart.toISOString())

    const scansToday = count ?? 0
    if (scansToday >= MAX_SCANS_PER_DAY) {
      return NextResponse.json(
        { error: "Daily scan limit reached (3/day)", scansRemaining: 0 },
        { status: 429 }
      )
    }

    // Insert generation run record
    const { data: run } = await supabase
      .from("generation_runs")
      .insert({
        site_id: site.id,
        user_id: user.id,
        status: "running",
      })
      .select("id")
      .single()

    const runId = run?.id

    // Run workflow with skipWriting — ideation only, no credits consumed
    const result = await runGenerationWorkflow(
      {
        id: site.id,
        user_id: site.user_id,
        topic: site.topic,
        description: site.description,
        topic_context: site.topic_context,
        writing_prompt: site.writing_prompt,
        context_files: site.context_files,
        posts_per_period: site.posts_per_period,
        sources: site.sources.map((s: { id: string; type: string; url: string }) => ({
          id: s.id,
          type: s.type,
          url: s.url,
        })),
      },
      supabase,
      { skipWriting: true }
    )

    // Store all ideas in post_ideas
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 14)

    for (const idea of result.remainingIdeas) {
      await supabase.from("post_ideas").insert({
        site_id: site.id,
        generation_run_id: runId,
        title: idea.title,
        angle: idea.angle,
        key_learnings: idea.keyLearnings,
        meta_description: idea.description || null,
        keywords: idea.keywords || [],
        slug: idea.slug || null,
        expires_at: expiresAt.toISOString(),
      })
    }

    // Finalize generation run
    if (runId) {
      await supabase
        .from("generation_runs")
        .update({
          sources_scanned: result.scanned,
          new_content_found: result.newContentFound,
          learnings_extracted: result.learningsExtracted,
          ideas_generated: result.ideasGenerated,
          posts_generated: 0,
          credit_deducted: false,
          status: result.status === "skipped" ? "skipped" : "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", runId)
    }

    return NextResponse.json({
      ideasGenerated: result.ideasGenerated,
      newContentFound: result.newContentFound,
      learningsExtracted: result.learningsExtracted,
      scansRemaining: MAX_SCANS_PER_DAY - scansToday - 1,
    })
  } catch (error) {
    console.error("Ideas scan error:", error)
    return NextResponse.json(
      { error: "Failed to scan sources" },
      { status: 500 }
    )
  }
}
