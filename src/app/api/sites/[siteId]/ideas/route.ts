import { NextResponse } from "next/server"
import { getAuthUser } from "@/lib/auth"
import { createServiceClient } from "@/lib/supabase/server"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ siteId: string }> }
) {
  try {
    const { siteId } = await params
    const user = await getAuthUser()
    const supabase = createServiceClient()

    // Verify site ownership
    const { data: site } = await supabase
      .from("sites")
      .select("id")
      .eq("id", siteId)
      .eq("user_id", user.id)
      .single()

    if (!site) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    // Return active, non-expired ideas
    const { data: ideas } = await supabase
      .from("post_ideas")
      .select("id, title, angle, key_learnings, meta_description, keywords, slug, expires_at, created_at")
      .eq("site_id", siteId)
      .eq("status", "active")
      .gte("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })

    return NextResponse.json(ideas || [])
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}
