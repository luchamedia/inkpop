import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api-helpers"
import { suggestSources } from "@/lib/mindstudio"
import { createServiceClient } from "@/lib/supabase/server"
import type { SiteContext } from "@/lib/ai"

export const maxDuration = 90

export async function POST(req: Request) {
  return withAuth(async () => {
    try {
      const body = await req.json()
      const keywords = typeof body.keywords === "string" ? body.keywords.trim() : ""

      if (!keywords || keywords.length > 200) {
        return NextResponse.json(
          { error: "keywords is required (max 200 characters)" },
          { status: 400 }
        )
      }

      const existingUrls = Array.isArray(body.existingUrls) ? body.existingUrls : []
      const page = typeof body.page === "number" && body.page >= 1 ? body.page : 1

      // Build SiteContext if siteId provided
      let siteContext: SiteContext | undefined
      if (body.siteId) {
        const supabase = createServiceClient()
        const { data: site } = await supabase
          .from("sites")
          .select("topic, description, category, topic_context")
          .eq("id", body.siteId)
          .single()

        if (site?.topic) {
          siteContext = {
            topic: site.topic,
            description: site.description || undefined,
            topicContext: Array.isArray(site.topic_context)
              ? (site.topic_context as Array<{ question: string; answer: string }>)
              : undefined,
          }
        }
      }

      const suggestions = await suggestSources(keywords, existingUrls, page, siteContext)

      return NextResponse.json({ suggestions })
    } catch (err) {
      console.error("Source suggestion failed:", err)
      return NextResponse.json({ suggestions: [], message: "Could not search at this time" })
    }
  })
}
