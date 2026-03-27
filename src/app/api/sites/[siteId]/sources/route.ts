import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api-helpers"
import { createServiceClient } from "@/lib/supabase/server"
import { isValidUrl, normalizeUrl, detectSourceType, fetchUrlMetadata } from "@/lib/url-utils"

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

    // Backfill metadata for sources missing og_image_url (newly added column)
    const results = sources || []
    const stale = results.filter((s) => s.og_image_url === null)
    if (stale.length > 0) {
      const filled = await Promise.all(
        stale.map(async (s) => {
          const meta = await fetchUrlMetadata(s.url).catch(() => ({
            meta_title: null,
            meta_description: null,
            favicon_url: null,
            og_image_url: null,
          }))
          await supabase
            .from("sources")
            .update({
              meta_title: meta.meta_title || s.meta_title,
              meta_description: meta.meta_description || s.meta_description,
              favicon_url: meta.favicon_url || s.favicon_url,
              og_image_url: meta.og_image_url || "",
            })
            .eq("id", s.id)
          return {
            ...s,
            meta_title: meta.meta_title || s.meta_title,
            meta_description: meta.meta_description || s.meta_description,
            favicon_url: meta.favicon_url || s.favicon_url,
            og_image_url: meta.og_image_url || "",
          }
        })
      )
      const filledMap = new Map(filled.map((s) => [s.id, s]))
      return NextResponse.json(
        results.map((s) => filledMap.get(s.id) || s)
      )
    }

    return NextResponse.json(results)
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
    const url = typeof body.url === "string" ? body.url.trim() : ""

    // Validate URL
    if (!url || !isValidUrl(url)) {
      return NextResponse.json(
        { error: "Please enter a valid URL (must start with http:// or https://)" },
        { status: 400 }
      )
    }

    // Auto-detect type if not provided
    const type = body.type || detectSourceType(url)

    // Check source limit
    const { count } = await supabase
      .from("sources")
      .select("*", { count: "exact", head: true })
      .eq("site_id", siteId)

    if ((count || 0) >= 15) {
      return NextResponse.json(
        { error: "Maximum 15 sources per site" },
        { status: 400 }
      )
    }

    // Check for duplicate URL
    const normalized = normalizeUrl(url)
    const { data: existing } = await supabase
      .from("sources")
      .select("url")
      .eq("site_id", siteId)

    const isDuplicate = (existing || []).some(
      (s) => normalizeUrl(s.url) === normalized
    )
    if (isDuplicate) {
      return NextResponse.json(
        { error: "This URL is already added" },
        { status: 400 }
      )
    }

    // Fetch metadata before inserting so the response includes it
    const meta = await fetchUrlMetadata(url).catch(() => ({
      meta_title: null,
      meta_description: null,
      favicon_url: null,
      og_image_url: null,
    }))

    // Insert the source with metadata
    const { data: source, error } = await supabase
      .from("sources")
      .insert({
        site_id: siteId,
        type,
        url,
        label: body.label || null,
        meta_title: meta.meta_title,
        meta_description: meta.meta_description,
        favicon_url: meta.favicon_url,
        og_image_url: meta.og_image_url,
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
