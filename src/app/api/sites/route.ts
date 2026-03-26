import { NextResponse } from "next/server"
import { getAuthUser } from "@/lib/auth"
import { createServiceClient } from "@/lib/supabase/server"

export async function GET() {
  try {
    const user = await getAuthUser()
    const supabase = createServiceClient()

    const { data: sites } = await supabase
      .from("sites")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })

    return NextResponse.json(sites || [])
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}

export async function POST(req: Request) {
  try {
    const user = await getAuthUser()
    const supabase = createServiceClient()
    const body = await req.json()

    // Check subdomain availability
    if (body.checkSubdomain) {
      const { data: existing } = await supabase
        .from("sites")
        .select("id")
        .eq("subdomain", body.subdomain)
        .single()

      return NextResponse.json({ available: !existing })
    }

    const { data: site, error } = await supabase
      .from("sites")
      .insert({
        user_id: user.id,
        name: body.name,
        subdomain: body.subdomain,
        topic: body.topic || null,
        topic_context: body.topic_context || null,
        description: body.description || null,
        category: body.category || null,
        posting_schedule: body.posting_schedule || "weekly",
        posts_per_period: body.posts_per_period || 1,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(site)
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}
