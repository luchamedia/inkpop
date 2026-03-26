import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"
import { generatePosts } from "@/lib/mindstudio"
import { deductCredits, autoRenewCredits, type PackId } from "@/lib/credits"

export const maxDuration = 300

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = createServiceClient()

  // Process sites where user has credits OR has auto-renew enabled
  const { data: sites } = await supabase
    .from("sites")
    .select("id, user_id, topic, description, topic_context, writing_prompt, posting_schedule, sources(*), users!inner(id, credit_balance, auto_renew, auto_renew_pack, stripe_customer_id)")
    .or("credit_balance.gt.0,auto_renew.eq.true", { referencedTable: "users" })

  let postsCreated = 0
  const errors: string[] = []
  const skippedUsers = new Set<string>()

  for (const site of (sites || []).filter(
    (s) => s.sources && s.sources.length > 0 && shouldRunToday(s.posting_schedule)
  )) {
    // Skip if this user already ran out of credits during this cron run
    if (skippedUsers.has(site.user_id)) continue

    try {
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

      // Deduct credits — attempt auto-renew if insufficient
      const deduction = await deductCredits(site.user_id, posts.length, site.id)
      if (!deduction.success) {
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
            // Retry deduction after renewal
            const retry = await deductCredits(site.user_id, posts.length, site.id)
            if (!retry.success) {
              skippedUsers.add(site.user_id)
              continue
            }
          } else {
            skippedUsers.add(site.user_id)
            continue
          }
        } else {
          skippedUsers.add(site.user_id)
          continue
        }
      }

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

function shouldRunToday(schedule: string | null): boolean {
  if (!schedule) return true // backward compat: null = always run
  const day = new Date().getUTCDay() // 0=Sun, 1=Mon, ...
  switch (schedule) {
    case "daily":
      return true
    case "weekly":
      return day === 1 // Monday
    case "custom":
      return true // custom frequency sites run daily, posts_per_period controls volume
    default:
      return true
  }
}
