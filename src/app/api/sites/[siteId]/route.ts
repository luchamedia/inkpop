import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api-helpers"
import { createServiceClient } from "@/lib/supabase/server"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ siteId: string }> }
) {
  return withAuth(async (user) => {
    const { siteId } = await params
    const supabase = createServiceClient()

    const { data: site } = await supabase
      .from("sites")
      .select("*, sources(*)")
      .eq("id", siteId)
      .eq("user_id", user.id)
      .single()

    if (!site) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    return NextResponse.json(site)
  })
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ siteId: string }> }
) {
  return withAuth(async (user) => {
    const { siteId } = await params
    const supabase = createServiceClient()

    // Verify ownership
    const { data: site } = await supabase
      .from("sites")
      .select("id")
      .eq("id", siteId)
      .eq("user_id", user.id)
      .single()

    if (!site) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const { error } = await supabase
      .from("sites")
      .delete()
      .eq("id", siteId)

    if (error) {
      return NextResponse.json({ error: "Failed to delete site" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  })
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ siteId: string }> }
) {
  return withAuth(async (user) => {
    const { siteId } = await params
    const supabase = createServiceClient()

    // Verify ownership
    const { data: site } = await supabase
      .from("sites")
      .select("id")
      .eq("id", siteId)
      .eq("user_id", user.id)
      .single()

    if (!site) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const body = await req.json()

    // Whitelist updateable fields
    const updates: Record<string, unknown> = {}
    if (body.posting_schedule && ["daily", "weekly", "custom"].includes(body.posting_schedule)) {
      updates.posting_schedule = body.posting_schedule
    }
    if (body.posts_per_period && Number.isInteger(body.posts_per_period) && body.posts_per_period > 0 && body.posts_per_period <= 100) {
      updates.posts_per_period = body.posts_per_period
    }
    if (body.name && typeof body.name === "string") {
      updates.name = body.name.slice(0, 100)
    }
    if (body.topic !== undefined) {
      updates.topic = typeof body.topic === "string" ? body.topic.slice(0, 500) : null
    }
    if (body.description !== undefined) {
      updates.description = typeof body.description === "string" ? body.description.slice(0, 1000) : null
    }
    if (body.category !== undefined) {
      updates.category = typeof body.category === "string" ? body.category.slice(0, 100) : null
    }
    if (body.topic_context !== undefined) {
      updates.topic_context = typeof body.topic_context === "object" ? body.topic_context : null
    }
    if (body.writing_prompt !== undefined) {
      updates.writing_prompt = typeof body.writing_prompt === "string" ? body.writing_prompt : null
    }
    if (body.writing_prompt_inputs !== undefined) {
      updates.writing_prompt_inputs = typeof body.writing_prompt_inputs === "object" ? body.writing_prompt_inputs : null
    }
    if (body.context_files !== undefined) {
      updates.context_files = typeof body.context_files === "object" && body.context_files !== null ? body.context_files : {}
    }
    if (body.auto_publish !== undefined) {
      updates.auto_publish = body.auto_publish === true
    }
    if (body.schedule_confirmed !== undefined) {
      updates.schedule_confirmed = body.schedule_confirmed === true
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 })
    }

    const { data: updated } = await supabase
      .from("sites")
      .update(updates)
      .eq("id", siteId)
      .select()
      .single()

    return NextResponse.json(updated)
  })
}
