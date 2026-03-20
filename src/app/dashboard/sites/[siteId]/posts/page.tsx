import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { createServiceClient } from "@/lib/supabase/server"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PostCard } from "@/components/posts/post-card"
import { RunAgentButton } from "@/components/agent/run-agent-button"

export default async function PostsPage({
  params,
}: {
  params: { siteId: string }
}) {
  const { userId } = auth()
  if (!userId) redirect("/sign-in")

  const supabase = createServiceClient()

  const { data: dbUser } = await supabase
    .from("users")
    .select("id")
    .eq("clerk_id", userId)
    .single()

  if (!dbUser) redirect("/sign-in")

  // Verify ownership
  const { data: site } = await supabase
    .from("sites")
    .select("id, name")
    .eq("id", params.siteId)
    .eq("user_id", dbUser.id)
    .single()

  if (!site) redirect("/dashboard/sites")

  const { data: drafts } = await supabase
    .from("posts")
    .select("*")
    .eq("site_id", params.siteId)
    .eq("status", "draft")
    .order("created_at", { ascending: false })

  const { data: published } = await supabase
    .from("posts")
    .select("*")
    .eq("site_id", params.siteId)
    .eq("status", "published")
    .order("published_at", { ascending: false })

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Content Inbox</h1>
        <RunAgentButton siteId={params.siteId} />
      </div>

      <Tabs defaultValue="drafts">
        <TabsList>
          <TabsTrigger value="drafts">
            Drafts ({drafts?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="published">
            Published ({published?.length || 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="drafts" className="mt-4">
          {!drafts || drafts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No drafts yet. Click &quot;Run Agent&quot; to generate content.
            </p>
          ) : (
            <div className="grid gap-3">
              {drafts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  siteId={params.siteId}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="published" className="mt-4">
          {!published || published.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No published posts yet.
            </p>
          ) : (
            <div className="grid gap-3">
              {published.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  siteId={params.siteId}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
