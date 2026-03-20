import { NextResponse } from "next/server"
import { getAuthUser } from "@/lib/auth"
import { createServiceClient } from "@/lib/supabase/server"

export async function POST(
  _req: Request,
  { params }: { params: { postId: string } }
) {
  try {
    const user = await getAuthUser()
    const supabase = createServiceClient()

    // Verify ownership
    const { data: post } = await supabase
      .from("posts")
      .select("*, sites!inner(user_id)")
      .eq("id", params.postId)
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
      .eq("id", params.postId)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(updated)
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}
