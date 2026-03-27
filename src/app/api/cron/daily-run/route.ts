import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"
import { runGenerationWorkflow } from "@/lib/mindstudio"
import { deductCredits, autoRenewCredits, type PackId } from "@/lib/credits"

export const maxDuration = 300

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = createServiceClient()

  // Fetch sites where user has credits OR auto-renew enabled
  const { data: sites } = await supabase
    .from("sites")
    .select("id, user_id, topic, description, topic_context, writing_prompt, context_files, posting_schedule, posts_per_period, auto_publish, sources(id, type, url), users!inner(id, credit_balance, auto_renew, auto_renew_pack, stripe_customer_id)")
    .or("credit_balance.gt.0,auto_renew.eq.true", { referencedTable: "users" })

  let postsCreated = 0
  let ideasCreated = 0
  const errors: string[] = []
  const skippedUsers = new Set<string>()

  for (const site of (sites || []).filter(
    (s) => s.sources && s.sources.length > 0 && shouldRunToday(s.posting_schedule)
  )) {
    if (skippedUsers.has(site.user_id)) continue

    try {
      // Insert generation run record
      const { data: run } = await supabase
        .from("generation_runs")
        .insert({
          site_id: site.id,
          user_id: site.user_id,
          status: "running",
        })
        .select("id")
        .single()

      const runId = run?.id

      // Run the smart workflow
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
        supabase
      )

      // Update generation run with scan/learning counts
      if (runId) {
        await supabase
          .from("generation_runs")
          .update({
            sources_scanned: result.scanned,
            new_content_found: result.newContentFound,
            learnings_extracted: result.learningsExtracted,
            ideas_generated: result.ideasGenerated,
          })
          .eq("id", runId)
      }

      // If skipped (no content, no learnings), mark and move on
      if (result.status === "skipped") {
        if (runId) {
          await supabase
            .from("generation_runs")
            .update({ status: "skipped", completed_at: new Date().toISOString() })
            .eq("id", runId)
        }
        continue
      }

      // Deduct credits for posts actually written
      if (result.postsWritten.length > 0) {
        const deduction = await deductCredits(site.user_id, result.postsWritten.length, site.id)
        if (!deduction.success) {
          // Attempt auto-renew
          const userData = site.users as unknown as {
            auto_renew: boolean
            auto_renew_pack: string | null
            stripe_customer_id: string | null
          }
          if (userData.auto_renew && userData.auto_renew_pack && userData.stripe_customer_id) {
            const renewal = await autoRenewCredits(
              site.user_id,
              userData.stripe_customer_id,
              userData.auto_renew_pack as PackId
            )
            if (renewal.success) {
              const retry = await deductCredits(site.user_id, result.postsWritten.length, site.id)
              if (!retry.success) {
                skippedUsers.add(site.user_id)
                if (runId) {
                  await supabase
                    .from("generation_runs")
                    .update({ status: "failed", completed_at: new Date().toISOString() })
                    .eq("id", runId)
                }
                continue
              }
            } else {
              skippedUsers.add(site.user_id)
              if (runId) {
                await supabase
                  .from("generation_runs")
                  .update({ status: "failed", completed_at: new Date().toISOString() })
                  .eq("id", runId)
              }
              continue
            }
          } else {
            skippedUsers.add(site.user_id)
            if (runId) {
              await supabase
                .from("generation_runs")
                .update({ status: "failed", completed_at: new Date().toISOString() })
                .eq("id", runId)
            }
            continue
          }
        }

        if (runId) {
          await supabase
            .from("generation_runs")
            .update({ credit_deducted: true })
            .eq("id", runId)
        }
      }

      // Store remaining ideas (not written) in post_ideas
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

      // Also store the written ideas as 'used'
      const usedIdeaIds: string[] = []
      for (const idea of result.writtenIdeas) {
        const { data: ideaRow } = await supabase
          .from("post_ideas")
          .insert({
            site_id: site.id,
            generation_run_id: runId,
            title: idea.title,
            angle: idea.angle,
            key_learnings: idea.keyLearnings,
            meta_description: idea.description || null,
            keywords: idea.keywords || [],
            slug: idea.slug || null,
            status: "used",
            expires_at: expiresAt.toISOString(),
          })
          .select("id")
          .single()
        if (ideaRow) usedIdeaIds.push(ideaRow.id)
      }

      // Insert written posts
      const autoPublish = site.auto_publish === true
      for (let i = 0; i < result.postsWritten.length; i++) {
        const post = result.postsWritten[i]
        await supabase.from("posts").insert({
          site_id: site.id,
          title: post.title,
          slug: post.slug,
          body: post.body,
          meta_description: post.meta_description || null,
          status: autoPublish ? "published" : "draft",
          published_at: autoPublish ? new Date().toISOString() : null,
          generation_run_id: runId,
          idea_id: usedIdeaIds[i] || null,
        })
      }

      postsCreated += result.postsWritten.length
      ideasCreated += result.remainingIdeas.length

      // Finalize the generation run
      if (runId) {
        await supabase
          .from("generation_runs")
          .update({
            posts_generated: result.postsWritten.length,
            status: "completed",
            completed_at: new Date().toISOString(),
          })
          .eq("id", runId)
      }
    } catch (error) {
      console.error(`Cron failed for site ${site.id}:`, error)
      errors.push(site.id)
    }
  }

  return NextResponse.json({
    processed: (sites || []).length,
    postsCreated,
    ideasCreated,
    errors: errors.length,
  })
}

function shouldRunToday(schedule: string | null): boolean {
  if (!schedule) return true
  const day = new Date().getUTCDay()
  switch (schedule) {
    case "daily":
      return true
    case "weekly":
      return day === 1
    case "custom":
      return true
    default:
      return true
  }
}
