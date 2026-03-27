import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api-helpers"
import { createServiceClient } from "@/lib/supabase/server"
import { generateAndPersistSuggestions } from "@/lib/ai/suggestions"

export const maxDuration = 90

async function verifySiteOwnership(siteId: string, userId: string) {
  const supabase = createServiceClient()
  const { data: site } = await supabase
    .from("sites")
    .select("id, topic, description, category, topic_context")
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
    const { data: suggestions } = await supabase
      .from("source_suggestions")
      .select("*")
      .eq("site_id", siteId)
      .eq("status", "active")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })

    const rows = suggestions || []
    return NextResponse.json({ suggestions: rows, count: rows.length })
  })
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ siteId: string }> }
) {
  return withAuth(async (user) => {
    const { siteId } = await params
    const site = await verifySiteOwnership(siteId, user.id)
    if (!site) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const body = await req.json()
    const { suggestionId, status } = body

    if (!suggestionId || !["dismissed", "accepted"].includes(status)) {
      return NextResponse.json(
        { error: "suggestionId and status (dismissed|accepted) required" },
        { status: 400 }
      )
    }

    const supabase = createServiceClient()
    await supabase
      .from("source_suggestions")
      .update({ status })
      .eq("id", suggestionId)
      .eq("site_id", siteId)

    return NextResponse.json({ success: true })
  })
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ siteId: string }> }
) {
  return withAuth(async (user) => {
    const { siteId } = await params
    const site = await verifySiteOwnership(siteId, user.id)
    if (!site) return NextResponse.json({ error: "Not found" }, { status: 404 })

    if (!site.topic) {
      return NextResponse.json(
        { error: "Set a topic first so we can find relevant sources" },
        { status: 400 }
      )
    }

    const suggestions = await generateAndPersistSuggestions(siteId, site)
    return NextResponse.json({ suggestions, count: suggestions.length })
  })
}
