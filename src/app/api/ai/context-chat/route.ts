import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api-helpers"
import { createServiceClient } from "@/lib/supabase/server"
import { callWorkflow } from "@/lib/ai/agent-client"
import { agent, extractScrapedText, SCRAPE_OPTIONS } from "@/lib/ai/agent"

export const maxDuration = 60

interface ChatMessage {
  role: "user" | "assistant"
  content: string
}

interface ChatRequest {
  siteId: string
  message: string
  currentPrompt: string
  chatHistory: ChatMessage[]
}

interface PromptVersion {
  prompt: string
  summary: string
  created_at: string
}

export async function POST(req: Request) {
  return withAuth(async (user) => {
    const supabase = createServiceClient()
    const body: ChatRequest = await req.json()

    // Verify site ownership
    const { data: site } = await supabase
      .from("sites")
      .select("id, context_files")
      .eq("id", body.siteId)
      .eq("user_id", user.id)
      .single()

    if (!site) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    // Handle website scan if message contains a URL
    let scanContext = ""
    const urlMatch = body.message.match(/https?:\/\/[^\s]+/)
    if (urlMatch) {
      // SSRF protection: block private/internal URLs
      try {
        const parsed = new URL(urlMatch[0])
        const hostname = parsed.hostname.toLowerCase()
        const blockedPatterns = [
          /^localhost$/,
          /^127\./,
          /^10\./,
          /^172\.(1[6-9]|2\d|3[01])\./,
          /^192\.168\./,
          /^0\./,
          /^169\.254\./,
          /^::1$/,
          /^fc00:/,
          /^fe80:/,
          /\.local$/,
          /\.internal$/,
        ]
        if (blockedPatterns.some((p) => p.test(hostname))) {
          scanContext = "\n\n[Cannot scan internal or private URLs.]"
        }
      } catch {
        scanContext = "\n\n[Invalid URL provided.]"
      }
      if (!scanContext) try {
        const scrapeResult = await agent.scrapeUrl({
          url: urlMatch[0],
          pageOptions: SCRAPE_OPTIONS,
        })
        const text = extractScrapedText(scrapeResult)
        scanContext = `\n\nSCRAPED WEBSITE CONTENT (from ${urlMatch[0]}):\n${text.slice(0, 8000)}`
      } catch {
        scanContext = "\n\n[Website scan failed — could not access that URL.]"
      }
    }

    // Build conversation history
    const conversationHistory = body.chatHistory
      .slice(-10)
      .map((msg) => `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}`)
      .join("\n\n")

    const response = await callWorkflow<{ reply: string; updatedPrompt?: string; changeSummary?: string }>(
      "context-chat",
      {
        currentPrompt: body.currentPrompt,
        conversationHistory,
        userMessage: body.message,
        scanContext,
      }
    )

    // Auto-save prompt and version if updated
    if (response.updatedPrompt) {
      // Save the new prompt
      const meta = (site.context_files as { versions?: PromptVersion[] } | null) || {}
      const versions = meta.versions || []

      // Add new version (keep last 20)
      versions.push({
        prompt: response.updatedPrompt,
        summary: response.changeSummary || "Updated via chat",
        created_at: new Date().toISOString(),
      })
      if (versions.length > 20) versions.splice(0, versions.length - 20)

      await supabase
        .from("sites")
        .update({
          writing_prompt: response.updatedPrompt,
          context_files: { versions },
        })
        .eq("id", body.siteId)
    }

    return NextResponse.json(response)
  })
}
