import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api-helpers"
import { createServiceClient } from "@/lib/supabase/server"
import { callWorkflow } from "@/lib/ai/agent-client"
import { getBalance, deductCredits, autoRenewCredits, type PackId } from "@/lib/credits"

interface Learning {
  topic: string
  insight: string
  relevance: "high" | "medium" | "low"
}

export const maxDuration = 120

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ siteId: string; ideaId: string }> }
) {
  return withAuth(async (user) => {
    const { siteId, ideaId } = await params
    const supabase = createServiceClient()

    // Check credits
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

    // Verify site ownership and load site context
    const { data: site } = await supabase
      .from("sites")
      .select("id, user_id, topic, description, topic_context, writing_prompt, context_files, auto_publish")
      .eq("id", siteId)
      .eq("user_id", user.id)
      .single()

    if (!site) {
      return NextResponse.json({ error: "Site not found" }, { status: 404 })
    }

    // Load the idea
    const { data: idea } = await supabase
      .from("post_ideas")
      .select("id, title, angle, key_learnings, meta_description, keywords, slug, status, expires_at")
      .eq("id", ideaId)
      .eq("site_id", siteId)
      .single()

    if (!idea) {
      return NextResponse.json({ error: "Idea not found" }, { status: 404 })
    }

    if (idea.status !== "active") {
      return NextResponse.json({ error: "Idea already used" }, { status: 400 })
    }

    if (new Date(idea.expires_at) < new Date()) {
      return NextResponse.json({ error: "Idea has expired" }, { status: 400 })
    }

    // Load recent learnings for context
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const { data: learningRows } = await supabase
      .from("source_learnings")
      .select("learnings")
      .eq("site_id", siteId)
      .gte("created_at", thirtyDaysAgo.toISOString())
      .order("created_at", { ascending: false })
      .limit(10)

    const allLearnings: Learning[] = (learningRows || []).flatMap(
      (row) => row.learnings as Learning[]
    )

    // Filter to relevant learnings based on idea's key topics
    const keyTopics = (idea.key_learnings as string[]) || []
    const relevant = allLearnings.filter((l) =>
      keyTopics.some(
        (kl) => l.topic.toLowerCase().includes(kl.toLowerCase()) || kl.toLowerCase().includes(l.topic.toLowerCase())
      )
    )

    const learningsForPrompt = (relevant.length > 0 ? relevant : allLearnings.slice(0, 5))
      .map((l) => `- ${l.topic}: ${l.insight}`)
      .join("\n")

    const post = await callWorkflow<{ title: string; slug: string; body: string; meta_description: string }>(
      "write-article",
      {
        ideaTitle: idea.title,
        ideaAngle: idea.angle,
        learningsContext: learningsForPrompt,
        writingPrompt: site.writing_prompt || "",
        siteTopic: site.topic || "",
        siteDescription: site.description || "",
      }
    )

    if (!post) {
      return NextResponse.json({ error: "Failed to generate post" }, { status: 500 })
    }

    // Apply idea metadata overrides
    if (idea.slug) post.slug = idea.slug
    if (idea.meta_description) post.meta_description = idea.meta_description

    // Deduct 1 credit
    const deduction = await deductCredits(user.id, 1, siteId)

    // Mark idea as used
    await supabase
      .from("post_ideas")
      .update({ status: "used" })
      .eq("id", ideaId)

    // Insert the post
    const autoPublish = site.auto_publish === true
    const { data: newPost } = await supabase
      .from("posts")
      .insert({
        site_id: siteId,
        title: post.title,
        slug: post.slug,
        body: post.body,
        meta_description: post.meta_description || null,
        status: autoPublish ? "published" : "draft",
        published_at: autoPublish ? new Date().toISOString() : null,
        idea_id: ideaId,
      })
      .select("id")
      .single()

    return NextResponse.json({
      success: true,
      postId: newPost?.id,
      creditsRemaining: deduction.balance,
    })
  })
}
