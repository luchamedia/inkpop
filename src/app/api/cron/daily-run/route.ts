import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"
import { triggerAgentRun, getJobStatus } from "@/lib/mindstudio"

const MAX_POLL_ATTEMPTS = 60 // 5 minutes at 5s intervals
const POLL_INTERVAL_MS = 5000

async function pollAndPersistPosts(jobId: string, siteId: string) {
  const supabase = createServiceClient()

  for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
    const data = await getJobStatus(jobId)

    if (data.status === "complete" || data.status === "completed") {
      const posts = data.result?.posts || data.posts || []
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
      return posts.length
    }

    if (data.status === "failed" || data.status === "error") {
      throw new Error(`Agent job ${jobId} failed`)
    }
  }

  throw new Error(`Agent job ${jobId} timed out`)
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = createServiceClient()

  // Find all sites belonging to active subscribers
  const { data: sites } = await supabase
    .from("sites")
    .select("id, sources(*), users!inner(subscription_status)")
    .eq("users.subscription_status", "active")

  let triggered = 0
  let postsCreated = 0

  // Process sites concurrently
  const results = await Promise.allSettled(
    (sites || [])
      .filter((site) => site.sources && site.sources.length > 0)
      .map(async (site) => {
        const { jobId } = await triggerAgentRun(
          site.id,
          site.sources.map((s: { type: string; url: string }) => ({
            type: s.type,
            url: s.url,
          }))
        )
        triggered++
        return pollAndPersistPosts(jobId, site.id)
      })
  )

  for (const result of results) {
    if (result.status === "fulfilled") {
      postsCreated += result.value
    } else {
      console.error("Cron agent run failed:", result.reason)
    }
  }

  return NextResponse.json({ triggered, postsCreated })
}
