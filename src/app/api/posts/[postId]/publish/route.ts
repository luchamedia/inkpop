import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { withAuth } from "@/lib/api-helpers"
import { createServiceClient } from "@/lib/supabase/server"

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  return withAuth(async (user) => {
    const { postId } = await params
    const supabase = createServiceClient()

    // Verify ownership
    const { data: post } = await supabase
      .from("posts")
      .select("*, sites!inner(user_id, subdomain)")
      .eq("id", postId)
      .single()

    if (!post || post.sites.user_id !== user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const { data: updated, error } = await supabase
      .from("posts")
      .update({
        status: "published",
        published_at: new Date().toISOString(),
      })
      .eq("id", postId)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Revalidate blog cache so the post appears immediately
    if (post.sites.subdomain) {
      revalidatePath(`/blog/${post.sites.subdomain}`, "layout")
    }

    return NextResponse.json(updated)
  })
}
