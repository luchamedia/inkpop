import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"
import { generatePosts } from "@/lib/mindstudio"

export const maxDuration = 300

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = createServiceClient()

  const { data: sites } = await supabase
    .from("sites")
    .select("id, sources(*), users!inner(subscription_status)")
    .eq("users.subscription_status", "active")

  let postsCreated = 0
  const errors: string[] = []

  for (const site of (sites || []).filter(
    (s) => s.sources && s.sources.length > 0
  )) {
    try {
      const posts = await generatePosts(
        site.sources.map((s: { type: string; url: string }) => ({
          type: s.type,
          url: s.url,
        }))
      )

      for (const post of posts) {
        await supabase.from("posts").insert({
          site_id: site.id,
          title: post.title,
          slug: post.slug,
          body: post.body,
          meta_description: post.meta_description || null,
          status: "draft",
        })
      }

      postsCreated += posts.length
    } catch (error) {
      console.error(`Cron failed for site ${site.id}:`, error)
      errors.push(site.id)
    }
  }

  return NextResponse.json({
    processed: (sites || []).length,
    postsCreated,
    errors: errors.length,
  })
}
