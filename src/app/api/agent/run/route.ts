import { NextResponse } from "next/server"
import { getAuthUser } from "@/lib/auth"
import { createServiceClient } from "@/lib/supabase/server"
import { generatePosts } from "@/lib/mindstudio"

export const maxDuration = 120

export async function POST(req: Request) {
  try {
    const user = await getAuthUser()
    const supabase = createServiceClient()
    const { siteId } = await req.json()

    // Verify ownership
    const { data: site } = await supabase
      .from("sites")
      .select("id, sources(*)")
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
      }))
    )

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

    return NextResponse.json({ success: true, postsCreated: posts.length })
  } catch (error) {
    console.error("Agent run error:", error)
    return NextResponse.json(
      { error: "Failed to generate content" },
      { status: 500 }
    )
  }
}
