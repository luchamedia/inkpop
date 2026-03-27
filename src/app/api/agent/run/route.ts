import { NextResponse } from "next/server"
import { getAuthUser } from "@/lib/auth"
import { createServiceClient } from "@/lib/supabase/server"
import { generatePosts } from "@/lib/mindstudio"
import { getBalance, deductCredits, autoRenewCredits, type PackId } from "@/lib/credits"

export const maxDuration = 120

export async function POST(req: Request) {
  try {
    const user = await getAuthUser()
    const supabase = createServiceClient()
    const { siteId } = await req.json()

    // Check credit balance before expensive AI call
    let balance = await getBalance(user.id)
    if (balance <= 0) {
      // Attempt auto-renew if enabled
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
            { error: "Insufficient credits", auto_renew_failed: renewal.error, balance: 0 },
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

    // Verify ownership
    const { data: site } = await supabase
      .from("sites")
      .select("id, topic, description, topic_context, writing_prompt, context_files, sources(*)")
      .eq("id", siteId)
      .eq("user_id", user.id)
      .single()

    if (!site) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    if (!site.sources || site.sources.length === 0) {
      return NextResponse.json(
        { error: "No sources configured" },
        { status: 400 }
      )
    }

    const posts = await generatePosts(
      site.sources.map((s: { type: string; url: string }) => ({
        type: s.type,
        url: s.url,
      })),
      {
        topic: site.topic,
        description: site.description,
        topicContext: site.topic_context,
        writingPrompt: site.writing_prompt,
      }
    )

    // Deduct credits based on actual posts generated
    const deduction = await deductCredits(user.id, posts.length, siteId)

    for (const post of posts) {
      await supabase.from("posts").insert({
        site_id: siteId,
        title: post.title,
        slug: post.slug,
        body: post.body,
        meta_description: post.meta_description || null,
        status: "draft",
      })
    }

    return NextResponse.json({
      success: true,
      postsCreated: posts.length,
      creditsUsed: posts.length,
      creditsRemaining: deduction.balance,
    })
  } catch (error) {
    console.error("Agent run error:", error)
    return NextResponse.json(
      { error: "Failed to generate content" },
      { status: 500 }
    )
  }
}
