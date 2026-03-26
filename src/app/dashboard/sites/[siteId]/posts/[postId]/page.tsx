import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { createServiceClient } from "@/lib/supabase/server"
import { PostEditor } from "@/components/posts/post-editor"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"

export default async function PostPage({
  params,
}: {
  params: Promise<{ siteId: string; postId: string }>
}) {
  const { siteId, postId } = await params
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")

  const supabase = createServiceClient()

  const { data: dbUser } = await supabase
    .from("users")
    .select("id")
    .eq("clerk_id", userId)
    .single()

  if (!dbUser) redirect("/sign-in")

  // Verify ownership through site
  const { data: site } = await supabase
    .from("sites")
    .select("id")
    .eq("id", siteId)
    .eq("user_id", dbUser.id)
    .single()

  if (!site) redirect("/dashboard/sites")

  const { data: post } = await supabase
    .from("posts")
    .select("*")
    .eq("id", postId)
    .eq("site_id", siteId)
    .single()

  if (!post) redirect(`/dashboard/sites/${siteId}/posts`)

  return (
    <div>
      <Button asChild variant="ghost" className="mb-4">
        <Link href={`/dashboard/sites/${siteId}/posts`}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to posts
        </Link>
      </Button>

      <PostEditor post={post} />
    </div>
  )
}
