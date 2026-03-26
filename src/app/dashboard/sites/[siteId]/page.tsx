import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { createServiceClient } from "@/lib/supabase/server"
import { FileText, Link2, ExternalLink } from "lucide-react"
import { SiteTodoList } from "@/components/dashboard/site-todo-list"
import { DeleteSiteButton } from "@/components/dashboard/delete-site-button"
import { WritingPromptCard } from "@/components/dashboard/writing-prompt-card"

export default async function SiteDetailPage({
  params,
}: {
  params: { siteId: string }
}) {
  const { userId } = auth()
  if (!userId) redirect("/sign-in")

  const supabase = createServiceClient()

  const { data: dbUser } = await supabase
    .from("users")
    .select("id, credit_balance")
    .eq("clerk_id", userId)
    .single()

  if (!dbUser) redirect("/sign-in")

  const { data: site } = await supabase
    .from("sites")
    .select("*, sources(*)")
    .eq("id", params.siteId)
    .eq("user_id", dbUser.id)
    .single()

  if (!site) redirect("/dashboard/sites")

  const { count: draftCount } = await supabase
    .from("posts")
    .select("*", { count: "exact", head: true })
    .eq("site_id", site.id)
    .eq("status", "draft")

  const { count: publishedCount } = await supabase
    .from("posts")
    .select("*", { count: "exact", head: true })
    .eq("site_id", site.id)
    .eq("status", "published")

  const totalPosts = (draftCount || 0) + (publishedCount || 0)

  return (
    <div>
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="font-serif text-3xl font-semibold tracking-tight">{site.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            <a
              href={`https://${site.subdomain}.inkpop.net`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
            >
              {site.subdomain}.inkpop.net
              <ExternalLink className="ml-1 inline h-3 w-3" />
            </a>
          </p>
        </div>
        <DeleteSiteButton siteId={site.id} siteName={site.name} />
      </div>

      <div className="flex gap-8 mb-10 pb-8 border-b border-border">
        <Link href={`/dashboard/sites/${site.id}/sources`} className="group">
          <p className="text-2xl font-semibold">{site.sources?.length || 0}</p>
          <p className="text-xs text-muted-foreground uppercase tracking-wide mt-0.5 flex items-center gap-1">
            <Link2 className="h-3 w-3" />
            Sources
          </p>
        </Link>
        <Link href={`/dashboard/sites/${site.id}/posts`} className="group">
          <p className="text-2xl font-semibold">{draftCount || 0}</p>
          <p className="text-xs text-muted-foreground uppercase tracking-wide mt-0.5 flex items-center gap-1">
            <FileText className="h-3 w-3" />
            Drafts
          </p>
        </Link>
        <div>
          <p className="text-2xl font-semibold">{publishedCount || 0}</p>
          <p className="text-xs text-muted-foreground uppercase tracking-wide mt-0.5">Published</p>
        </div>
      </div>

      <WritingPromptCard
        siteId={site.id}
        writingPrompt={site.writing_prompt}
        writingPromptInputs={site.writing_prompt_inputs}
      />

      <div className="mt-8">
        <SiteTodoList
          siteId={site.id}
          hasAnyPosts={totalPosts > 0}
          hasSchedule={!!site.topic}
          creditBalance={dbUser.credit_balance ?? 0}
          currentSchedule={site.posting_schedule || "weekly"}
          currentPostsPerPeriod={site.posts_per_period || 1}
        />
      </div>
    </div>
  )
}
