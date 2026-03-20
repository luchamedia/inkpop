import { NextResponse } from "next/server"
import { getAuthUser } from "@/lib/auth"
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
  { params }: { params: { siteId: string } }
) {
  try {
    const user = await getAuthUser()
    const site = await verifySiteOwnership(params.siteId, user.id)
    if (!site) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const supabase = createServiceClient()
    const { data: sources } = await supabase
      .from("sources")
      .select("*")
      .eq("site_id", params.siteId)
      .order("created_at", { ascending: true })

    return NextResponse.json(sources || [])
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}

export async function POST(
  req: Request,
  { params }: { params: { siteId: string } }
) {
  try {
    const user = await getAuthUser()
    const site = await verifySiteOwnership(params.siteId, user.id)
    if (!site) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const supabase = createServiceClient()
    const body = await req.json()

    // Check 5-source limit
    const { count } = await supabase
      .from("sources")
      .select("*", { count: "exact", head: true })
      .eq("site_id", params.siteId)

    if ((count || 0) >= 5) {
      return NextResponse.json(
        { error: "Maximum 5 sources per site" },
        { status: 400 }
      )
    }

    const { data: source, error } = await supabase
      .from("sources")
      .insert({
        site_id: params.siteId,
        type: body.type,
        url: body.url,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(source)
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { siteId: string } }
) {
  try {
    const user = await getAuthUser()
    const site = await verifySiteOwnership(params.siteId, user.id)
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
      .eq("site_id", params.siteId)

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}
