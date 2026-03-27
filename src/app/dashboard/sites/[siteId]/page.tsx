import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { createServiceClient } from "@/lib/supabase/server"
import { SiteDashboard } from "@/components/site-dashboard/site-dashboard"

export default async function SiteDetailPage({
  params,
}: {
  params: Promise<{ siteId: string }>
}) {
  const { siteId } = await params
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")

  const supabase = createServiceClient()

  const { data: dbUser } = await supabase
    .from("users")
    .select("id, credit_balance, stripe_customer_id")
    .eq("clerk_id", userId)
    .single()

  if (!dbUser) redirect("/sign-in")

  const { data: site } = await supabase
    .from("sites")
    .select("*, sources(*)")
    .eq("id", siteId)
    .eq("user_id", dbUser.id)
    .single()

  if (!site) redirect("/dashboard/sites")

  const { data: drafts } = await supabase
    .from("posts")
    .select("*")
    .eq("site_id", site.id)
    .eq("status", "draft")
    .order("created_at", { ascending: false })

  const { data: published } = await supabase
    .from("posts")
    .select("*")
    .eq("site_id", site.id)
    .eq("status", "published")
    .order("published_at", { ascending: false })

  return (
    <SiteDashboard
      site={{
        id: site.id,
        name: site.name,
        subdomain: site.subdomain,
        topic: site.topic,
        topic_context: site.topic_context,
        description: site.description,
        category: site.category,
        posting_schedule: site.posting_schedule,
        posts_per_period: site.posts_per_period,
        writing_prompt: site.writing_prompt,
        writing_prompt_inputs: site.writing_prompt_inputs,
        context_files: site.context_files,
        auto_publish: site.auto_publish ?? true,
        schedule_confirmed: site.schedule_confirmed ?? false,
        sources: site.sources || [],
      }}
      drafts={drafts || []}
      published={published || []}
      creditBalance={dbUser.credit_balance ?? 0}
      hasPaymentMethod={!!dbUser.stripe_customer_id}
    />
  )
}
