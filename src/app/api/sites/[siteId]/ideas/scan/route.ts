import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api-helpers"
import { createServiceClient } from "@/lib/supabase/server"
import { runGenerationWorkflow } from "@/lib/mindstudio"

export const maxDuration = 120

const MAX_SCANS_PER_DAY = 3

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ siteId: string }> }
) {
  return withAuth(async (user) => {
    const { siteId } = await params
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

    // Rate limit: count source_learnings created for this site today
    const todayStart = new Date()
    todayStart.setUTCHours(0, 0, 0, 0)

    const { count } = await supabase
      .from("source_learnings")
      .select("id", { count: "exact", head: true })
      .eq("site_id", siteId)
      .gte("created_at", todayStart.toISOString())

    const scansToday = count ?? 0
    if (scansToday >= MAX_SCANS_PER_DAY) {
      return NextResponse.json(
        { error: "Daily scan limit reached (3/day)", scansRemaining: 0 },
        { status: 429 }
      )
    }

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
        title: idea.title,
        angle: idea.angle,
        key_learnings: idea.keyLearnings,
        meta_description: idea.description || null,
        keywords: idea.keywords || [],
        slug: idea.slug || null,
        expires_at: expiresAt.toISOString(),
      })
    }

    return NextResponse.json({
      ideasGenerated: result.ideasGenerated,
      newContentFound: result.newContentFound,
      learningsExtracted: result.learningsExtracted,
      scansRemaining: MAX_SCANS_PER_DAY - scansToday - 1,
    })
  })
}
