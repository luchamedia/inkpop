import { NextResponse } from "next/server"
import { getAuthUser } from "@/lib/auth"
import { createServiceClient } from "@/lib/supabase/server"
import { generatePostForTopic } from "@/lib/mindstudio"
import { getBalance, deductCredits } from "@/lib/credits"

export const maxDuration = 120

export async function POST(req: Request) {
  try {
    const user = await getAuthUser()
    const supabase = createServiceClient()
    const { siteId, topic } = await req.json()

    if (!siteId || !topic || typeof topic !== "string" || topic.length > 500) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 })
    }

    // Check credits
    const balance = await getBalance(user.id)
    if (balance <= 0) {
      return NextResponse.json({ error: "Insufficient credits", balance: 0 }, { status: 402 })
    }

    // Verify ownership + fetch sources
    const { data: site } = await supabase
      .from("sites")
      .select("id, topic, description, topic_context, sources(*)")
      .eq("id", siteId)
      .eq("user_id", user.id)
      .single()

    if (!site) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const post = await generatePostForTopic(
      topic,
      site.sources || [],
      { topic: site.topic, description: site.description, topicContext: site.topic_context }
    )

    if (!post) {
      return NextResponse.json({ error: "Failed to generate" }, { status: 500 })
    }

    // Deduct 1 credit
    await deductCredits(user.id, 1, siteId)

    // Insert as draft
    const { data: inserted } = await supabase
      .from("posts")
      .insert({
        site_id: siteId,
        title: post.title,
        slug: post.slug,
        body: post.body,
        meta_description: post.meta_description || null,
        status: "draft",
      })
      .select("id")
      .single()

    return NextResponse.json({ postId: inserted?.id, title: post.title })
  } catch (error) {
    console.error("Generate post error:", error)
    return NextResponse.json({ error: "Failed to generate" }, { status: 500 })
  }
}
