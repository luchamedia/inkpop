import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api-helpers"
import { createServiceClient } from "@/lib/supabase/server"

async function verifyPostOwnership(postId: string, userId: string) {
  const supabase = createServiceClient()
  const { data: post } = await supabase
    .from("posts")
    .select("*, sites!inner(user_id)")
    .eq("id", postId)
    .single()

  if (!post || post.sites.user_id !== userId) return null
  return post
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  return withAuth(async (user) => {
    const { postId } = await params
    const post = await verifyPostOwnership(postId, user.id)

    if (!post) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    return NextResponse.json(post)
  })
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  return withAuth(async (user) => {
    const { postId } = await params
    const post = await verifyPostOwnership(postId, user.id)

    if (!post) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const supabase = createServiceClient()
    const body = await req.json()

    const updates: Record<string, string> = {}
    if (body.title && typeof body.title === "string") {
      updates.title = body.title.slice(0, 200)
    }
    if (body.body && typeof body.body === "string") {
      updates.body = body.body.slice(0, 100_000)
    }
    if (body.meta_description && typeof body.meta_description === "string") {
      updates.meta_description = body.meta_description.slice(0, 160)
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 })
    }

    const { data: updated, error } = await supabase
      .from("posts")
      .update(updates)
      .eq("id", postId)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(updated)
  })
}
