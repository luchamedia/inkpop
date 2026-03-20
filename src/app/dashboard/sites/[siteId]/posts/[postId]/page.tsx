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
  params: { siteId: string; postId: string }
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

  // Verify ownership through site
  const { data: site } = await supabase
    .from("sites")
    .select("id")
    .eq("id", params.siteId)
    .eq("user_id", dbUser.id)
    .single()

  if (!site) redirect("/dashboard/sites")

  const { data: post } = await supabase
    .from("posts")
    .select("*")
    .eq("id", params.postId)
    .eq("site_id", params.siteId)
    .single()

  if (!post) redirect(`/dashboard/sites/${params.siteId}/posts`)

  return (
    <div>
      <Button asChild variant="ghost" className="mb-4">
        <Link href={`/dashboard/sites/${params.siteId}/posts`}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to posts
        </Link>
      </Button>

      <PostEditor post={post} />
    </div>
  )
}
