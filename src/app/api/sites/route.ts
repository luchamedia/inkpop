import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api-helpers"
import { createServiceClient } from "@/lib/supabase/server"
import { generateAndPersistSuggestions } from "@/lib/ai/suggestions"

export async function GET() {
  return withAuth(async (user) => {
    const supabase = createServiceClient()

    const { data: sites } = await supabase
      .from("sites")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })

    return NextResponse.json(sites || [])
  })
}

export async function POST(req: Request) {
  return withAuth(async (user) => {
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

    // Fire-and-forget: generate initial source suggestions if site has a topic
    if (site.topic) {
      generateAndPersistSuggestions(site.id, {
        id: site.id,
        topic: site.topic,
        description: site.description,
        category: site.category,
        topic_context: site.topic_context,
      }).catch((err) => console.error("Initial suggestion generation failed:", err))
    }

    return NextResponse.json(site)
  })
}
