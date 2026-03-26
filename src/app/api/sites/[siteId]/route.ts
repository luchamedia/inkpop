import { NextResponse } from "next/server"
import { getAuthUser } from "@/lib/auth"
import { createServiceClient } from "@/lib/supabase/server"

export async function GET(
  _req: Request,
  { params }: { params: { siteId: string } }
) {
  try {
    const user = await getAuthUser()
    const supabase = createServiceClient()

    const { data: site } = await supabase
      .from("sites")
      .select("*, sources(*)")
      .eq("id", params.siteId)
      .eq("user_id", user.id)
      .single()

    if (!site) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    return NextResponse.json(site)
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: { siteId: string } }
) {
  try {
    const user = await getAuthUser()
    const supabase = createServiceClient()

    // Verify ownership
    const { data: site } = await supabase
      .from("sites")
      .select("id")
      .eq("id", params.siteId)
      .eq("user_id", user.id)
      .single()

    if (!site) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const { error } = await supabase
      .from("sites")
      .delete()
      .eq("id", params.siteId)

    if (error) {
      return NextResponse.json({ error: "Failed to delete site" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: { siteId: string } }
) {
  try {
    const user = await getAuthUser()
    const supabase = createServiceClient()

    // Verify ownership
    const { data: site } = await supabase
      .from("sites")
      .select("id")
      .eq("id", params.siteId)
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
    if (body.posts_per_period && Number.isInteger(body.posts_per_period) && body.posts_per_period > 0 && body.posts_per_period <= 50) {
      updates.posts_per_period = body.posts_per_period
    }
    if (body.name && typeof body.name === "string") {
      updates.name = body.name.slice(0, 100)
    }
    if (body.writing_prompt !== undefined) {
      updates.writing_prompt = typeof body.writing_prompt === "string" ? body.writing_prompt : null
    }
    if (body.writing_prompt_inputs !== undefined) {
      updates.writing_prompt_inputs = typeof body.writing_prompt_inputs === "object" ? body.writing_prompt_inputs : null
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 })
    }

    const { data: updated } = await supabase
      .from("sites")
      .update(updates)
      .eq("id", params.siteId)
      .select()
      .single()

    return NextResponse.json(updated)
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}
