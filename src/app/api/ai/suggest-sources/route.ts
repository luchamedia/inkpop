import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api-helpers"
import { callWorkflow } from "@/lib/ai/agent-client"
import { createServiceClient } from "@/lib/supabase/server"

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

      // Build site context if siteId provided
      let siteDescription = ""
      let topicContextStr = "[]"
      if (body.siteId) {
        const supabase = createServiceClient()
        const { data: site } = await supabase
          .from("sites")
          .select("topic, description, category, topic_context")
          .eq("id", body.siteId)
          .single()

        if (site?.topic) {
          siteDescription = site.description || ""
          topicContextStr = JSON.stringify(
            Array.isArray(site.topic_context) ? site.topic_context : []
          )
        }
      }

      const result = await callWorkflow<{
        suggestions: Array<{ type: string; url: string; label: string; reason: string }>
      }>("suggest-sources", {
        keywords,
        siteDescription,
        topicContext: topicContextStr,
        existingUrls: existingUrls.join(", "),
        page,
      })

      return NextResponse.json({ suggestions: result.suggestions })
    } catch (err) {
      console.error("Source suggestion failed:", err)
      return NextResponse.json({ suggestions: [], message: "Could not search at this time" })
    }
  })
}
