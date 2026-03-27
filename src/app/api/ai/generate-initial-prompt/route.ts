import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api-helpers"
import { createServiceClient } from "@/lib/supabase/server"
import { MindStudioAgent } from "@mindstudio-ai/agent"

export const maxDuration = 60

const agent = new MindStudioAgent()

export async function POST(req: Request) {
  return withAuth(async (user) => {
    const supabase = createServiceClient()
    const { siteId } = await req.json()

    // Fetch site with all available context
    const { data: site } = await supabase
      .from("sites")
      .select("id, topic, description, topic_context, writing_prompt_inputs, writing_prompt")
      .eq("id", siteId)
      .eq("user_id", user.id)
      .single()

    if (!site) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    // Don't regenerate if prompt already exists
    if (site.writing_prompt) {
      return NextResponse.json({ prompt: site.writing_prompt })
    }

    // Build context from existing site data
    const parts: string[] = []
    if (site.topic) parts.push(`Blog topic: ${site.topic}`)
    if (site.description) parts.push(`Description: ${site.description}`)

    const topicCtx = site.topic_context as Array<{ question: string; answer: string }> | null
    if (topicCtx?.length) {
      parts.push("Additional context:")
      for (const qa of topicCtx) {
        parts.push(`- ${qa.question}: ${qa.answer}`)
      }
    }

    const inputs = site.writing_prompt_inputs as Record<string, unknown> | null
    if (inputs) {
      if (inputs.companyName) parts.push(`Company: ${inputs.companyName}`)
      if (inputs.whatYouDo) parts.push(`What they do: ${inputs.whatYouDo}`)
      if (inputs.industry) parts.push(`Industry: ${inputs.industry}`)
      if (inputs.differentiator) parts.push(`Differentiator: ${inputs.differentiator}`)
      if (inputs.audienceRole) parts.push(`Audience: ${inputs.audienceRole}`)
      if (inputs.audienceKnowledge) parts.push(`Audience expertise: ${inputs.audienceKnowledge}`)
      if (inputs.audienceProblems) parts.push(`Audience problems: ${inputs.audienceProblems}`)
      if (inputs.voiceTraits && Array.isArray(inputs.voiceTraits)) parts.push(`Voice traits: ${(inputs.voiceTraits as string[]).join(", ")}`)
      if (inputs.formality) parts.push(`Formality (1-5): ${inputs.formality}`)
      if (inputs.humor) parts.push(`Humor level: ${inputs.humor}`)
      if (inputs.bannedPhrases) parts.push(`Banned phrases: ${inputs.bannedPhrases}`)
      if (inputs.hardRules) parts.push(`Style rules: ${inputs.hardRules}`)
    }

    const siteInfo = parts.join("\n")

    const genPrompt = `You are creating a writing prompt for an AI blog writer. This prompt will be used as instructions every time the AI generates a blog post.

SITE INFORMATION:
${siteInfo || "Topic: General blog (no specific topic provided)"}

Write a comprehensive but concise writing prompt (under 2000 characters) that covers:
- What the blog is about and its perspective/angle
- Target audience and their expertise level (infer if not provided)
- Preferred tone and voice style
- Content structure preferences
- Any rules or constraints

Write it as direct instructions to the AI writer using imperative/second person ("Write in a...", "Target...", "Always...").
Use markdown formatting with headers and bullet points.
Be specific and actionable — every sentence should guide the AI's writing.
Do NOT include SEO rules, word count targets, or formatting rules (H2/H3 usage) — those are handled separately.

Return ONLY the prompt text, no JSON wrapper.`

    const { content } = await agent.generateText({
      message: genPrompt,
    })

    // Clean up — remove any markdown code block wrappers the AI might add
    const prompt = content.replace(/^```(?:markdown)?\n?/, "").replace(/\n?```$/, "").trim()

    // Save prompt and create first version
    await supabase
      .from("sites")
      .update({
        writing_prompt: prompt,
        context_files: {
          versions: [{
            prompt,
            summary: "Initial prompt generated from site topic",
            created_at: new Date().toISOString(),
          }],
        },
      })
      .eq("id", siteId)

    return NextResponse.json({ prompt })
  })
}
