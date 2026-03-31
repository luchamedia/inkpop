import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { createServiceClient } from "@/lib/supabase/server"
import { writeArticle, generatePostForTopic } from "@/lib/mindstudio"
import { addCredits } from "@/lib/credits"
import type { Learning, SiteContext } from "@/lib/mindstudio"

export const maxDuration = 300

const STALE_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes

export async function POST(req: Request) {
  // Auth: accept either CRON_SECRET or a valid user session (fire-and-forget calls use CRON_SECRET)
  const authHeader = req.headers.get("authorization")
  const isCronAuth = authHeader === `Bearer ${process.env.CRON_SECRET}`

  if (!isCronAuth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { siteId } = await req.json()
  if (!siteId) {
    return NextResponse.json({ error: "siteId required" }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Clean up stale processing jobs (stuck > 5 min)
  const staleThreshold = new Date(Date.now() - STALE_TIMEOUT_MS).toISOString()
  const { data: staleJobs } = await supabase
    .from("generation_queue")
    .select("id, user_id, site_id, retry_count, credits_reserved")
    .eq("site_id", siteId)
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
      // Refund credit
      await addCredits(stale.user_id, stale.credits_reserved, stale.id, "queue_refund")
      await supabase
        .from("generation_queue")
        .update({ credits_refunded: true })
        .eq("id", stale.id)
    }
  }

  // Check if there's already an active (non-stale) processing job for this site
  const { data: activeJobs } = await supabase
    .from("generation_queue")
    .select("id")
    .eq("site_id", siteId)
    .eq("status", "processing")
    .limit(1)

  if (activeJobs && activeJobs.length > 0) {
    return NextResponse.json({ skip: true, reason: "already processing" })
  }

  // Claim the next queued job atomically
  const { data: claimed } = await supabase.rpc("claim_next_queue_job", {
    site_id_input: siteId,
  })

  const job = Array.isArray(claimed) ? claimed[0] : claimed
  if (!job) {
    return NextResponse.json({ empty: true })
  }

  try {
    let postId: string | null = null

    // Load site context (needed for all job types)
    const { data: site } = await supabase
      .from("sites")
      .select("id, user_id, topic, description, topic_context, writing_prompt, context_files, auto_publish, subdomain, sources(*)")
      .eq("id", siteId)
      .single()

    if (!site) {
      throw new Error("Site not found")
    }

    const siteContext: SiteContext = {
      topic: site.topic ?? undefined,
      description: site.description ?? undefined,
      topicContext: site.topic_context ?? undefined,
      writingPrompt: site.writing_prompt ?? undefined,
    }

    const autoPublish = site.auto_publish === true

    if (job.job_type === "idea" || job.job_type === "scheduled") {
      postId = await processIdeaJob(job, site, siteContext, autoPublish, supabase)
    } else if (job.job_type === "topic") {
      postId = await processTopicJob(job, site, siteContext, autoPublish, supabase)
    }

    // Revalidate blog cache so published posts appear immediately
    if (autoPublish && postId && site.subdomain) {
      revalidatePath(`/blog/${site.subdomain}`, "layout")
    }

    // Mark job as completed
    await supabase
      .from("generation_queue")
      .update({
        status: "completed",
        post_id: postId,
        completed_at: new Date().toISOString(),
      })
      .eq("id", job.id)

    // Self-chain: check for more queued items and trigger processing
    await triggerNextJob(siteId, req.url)

    return NextResponse.json({ success: true, jobId: job.id, postId })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error"

    if (job.retry_count < 2) {
      // Retry: put back in queue
      await supabase
        .from("generation_queue")
        .update({
          status: "queued",
          retry_count: job.retry_count + 1,
          error_message: message,
          started_at: null,
        })
        .eq("id", job.id)

      // Self-chain to retry
      await triggerNextJob(siteId, req.url)
    } else {
      // Final failure: mark failed and refund
      await supabase
        .from("generation_queue")
        .update({
          status: "failed",
          error_message: message,
          completed_at: new Date().toISOString(),
        })
        .eq("id", job.id)

      await addCredits(job.user_id, job.credits_reserved, job.id, "queue_refund")
      await supabase
        .from("generation_queue")
        .update({ credits_refunded: true })
        .eq("id", job.id)
    }

    return NextResponse.json({ error: message, jobId: job.id }, { status: 500 })
  }
}

async function processIdeaJob(
  job: { idea_id: string | null },
  site: { id: string; auto_publish: boolean | null },
  siteContext: SiteContext,
  autoPublish: boolean,
  supabase: ReturnType<typeof createServiceClient>
): Promise<string | null> {
  if (!job.idea_id) throw new Error("No idea_id for idea job")

  const { data: idea } = await supabase
    .from("post_ideas")
    .select("id, title, angle, key_learnings, meta_description, keywords, slug, status, expires_at")
    .eq("id", job.idea_id)
    .eq("site_id", site.id)
    .single()

  if (!idea) throw new Error("Idea not found")

  // Load recent learnings for context
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const { data: learningRows } = await supabase
    .from("source_learnings")
    .select("learnings")
    .eq("site_id", site.id)
    .gte("created_at", thirtyDaysAgo.toISOString())
    .order("created_at", { ascending: false })
    .limit(10)

  const allLearnings: Learning[] = (learningRows || []).flatMap(
    (row) => row.learnings as Learning[]
  )

  const keyTopics = (idea.key_learnings as string[]) || []
  const relevant = allLearnings.filter((l) =>
    keyTopics.some(
      (kl) =>
        l.topic.toLowerCase().includes(kl.toLowerCase()) ||
        kl.toLowerCase().includes(l.topic.toLowerCase())
    )
  )

  const post = await writeArticle(
    {
      title: idea.title,
      angle: idea.angle,
      keyLearnings: keyTopics,
      description: idea.meta_description || "",
      keywords: (idea.keywords as string[]) || [],
      slug: idea.slug || "",
    },
    relevant.length > 0 ? relevant : allLearnings.slice(0, 5),
    siteContext
  )

  if (!post) throw new Error("writeArticle returned null")

  // Mark idea as used
  await supabase
    .from("post_ideas")
    .update({ status: "used" })
    .eq("id", idea.id)

  // Insert the post
  const { data: newPost } = await supabase
    .from("posts")
    .insert({
      site_id: site.id,
      title: post.title,
      slug: post.slug,
      body: post.body,
      meta_description: post.meta_description || null,
      status: autoPublish ? "published" : "draft",
      published_at: autoPublish ? new Date().toISOString() : null,
      idea_id: idea.id,
    })
    .select("id")
    .single()

  return newPost?.id ?? null
}

async function processTopicJob(
  job: { topic: string | null },
  site: { id: string; sources?: Array<{ id: string; type: string; url: string; label: string | null }>; auto_publish: boolean | null },
  siteContext: SiteContext,
  autoPublish: boolean,
  supabase: ReturnType<typeof createServiceClient>
): Promise<string | null> {
  if (!job.topic) throw new Error("No topic for topic job")

  const post = await generatePostForTopic(
    job.topic,
    site.sources || [],
    siteContext
  )

  if (!post) throw new Error("generatePostForTopic returned null")

  const { data: newPost } = await supabase
    .from("posts")
    .insert({
      site_id: site.id,
      title: post.title,
      slug: post.slug,
      body: post.body,
      meta_description: post.meta_description || null,
      status: autoPublish ? "published" : "draft",
      published_at: autoPublish ? new Date().toISOString() : null,
    })
    .select("id")
    .single()

  return newPost?.id ?? null
}

async function triggerNextJob(siteId: string, requestUrl: string) {
  const processUrl = new URL("/api/queue/process", requestUrl).toString()
  try {
    fetch(processUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.CRON_SECRET}`,
      },
      body: JSON.stringify({ siteId }),
    }).catch(() => {}) // fire-and-forget
  } catch {
    // Ignore — cron safety net will pick it up
  }
}
