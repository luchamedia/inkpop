import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api-helpers"
import { createServiceClient } from "@/lib/supabase/server"

async function verifySiteOwnership(siteId: string, userId: string) {
  const supabase = createServiceClient()
  const { data: site } = await supabase
    .from("sites")
    .select("id")
    .eq("id", siteId)
    .eq("user_id", userId)
    .single()
  return site
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ siteId: string }> }
) {
  return withAuth(async (user) => {
    const { siteId } = await params
    const site = await verifySiteOwnership(siteId, user.id)
    if (!site) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const supabase = createServiceClient()
    const { data: sources } = await supabase
      .from("sources")
      .select("*")
      .eq("site_id", siteId)
      .order("created_at", { ascending: true })

    return NextResponse.json(sources || [])
  })
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ siteId: string }> }
) {
  return withAuth(async (user) => {
    const { siteId } = await params
    const site = await verifySiteOwnership(siteId, user.id)
    if (!site) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const supabase = createServiceClient()
    const body = await req.json()

    // Check 10-source limit
    const { count } = await supabase
      .from("sources")
      .select("*", { count: "exact", head: true })
      .eq("site_id", siteId)

    if ((count || 0) >= 10) {
      return NextResponse.json(
        { error: "Maximum 10 sources per site" },
        { status: 400 }
      )
    }

    const { data: source, error } = await supabase
      .from("sources")
      .insert({
        site_id: siteId,
        type: body.type,
        url: body.url,
        label: body.label || null,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(source)
  })
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ siteId: string }> }
) {
  return withAuth(async (user) => {
    const { siteId } = await params
    const site = await verifySiteOwnership(siteId, user.id)
    if (!site) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const supabase = createServiceClient()
    const { searchParams } = new URL(req.url)
    const sourceId = searchParams.get("sourceId")

    if (!sourceId) {
      return NextResponse.json({ error: "sourceId required" }, { status: 400 })
    }

    await supabase
      .from("sources")
      .delete()
      .eq("id", sourceId)
      .eq("site_id", siteId)

    return NextResponse.json({ success: true })
  })
}
