export interface WritingPromptInputs {
  // Company Info
  companyName?: string
  whatYouDo?: string
  industry?: string
  differentiator?: string
  avoidTopics?: string

  // Audience
  audienceRole?: string
  audienceKnowledge?: string
  audienceProblems?: string

  // Voice & Tone
  voiceTraits?: string[]
  voiceAvoid?: string[]
  formality?: number
  humor?: string
  hardRules?: string

  // Language Rules
  bannedPhrases?: string
  preferredJargon?: string
  avoidedJargon?: string
  customerWord?: string

  // Examples
  goodExamples?: string
  badExamples?: string
  admiredWriter?: string
  additionalNotes?: string
}

export function buildMetaPrompt(inputs: WritingPromptInputs): string {
  const sections: string[] = []

  sections.push(`You are a senior brand strategist and copywriting expert. Using the company information below, generate a comprehensive AI blog writer system prompt.

The output should be a complete, well-structured document that any AI writer could use as a system prompt to write on-brand blog posts. Include ALL of the following sections:

1. **Role & Output Rules** — Define the AI's role (blog writer for this company). Include hard formatting rules: output must start with H2, never use H1, no preamble, no closing meta-commentary, no raw URLs inline, no scraped navigation/bylines.

2. **About the Company** — Company context the AI needs when writing. What the company does, what makes it different, who uses it. The AI should weave in natural mentions of the company where relevant — not force them.

3. **Content Guidelines** — Target word count (2,500-5,000 depending on topic depth), structure (H2 for main sections, H3 for subsections, short paragraphs), article type guidance (how-tos, comparisons, lists, etc.), company bridge section requirements, FAQ/AEO section with 4-6 common questions.

4. **SEO & Linking** — Keyword density guidance, primary keyword placement rules, semantic variation usage, internal linking (3-5 contextual links), external linking (1-2 authoritative sources).

5. **Writing Style** — Specific tone rules derived from the brand voice. Be direct and prescriptive. Include numbered do's and don'ts.

6. **Banned Words & Phrases** — Combine user-specified banned phrases with standard AI-giveaway phrases (e.g., "let's dive in", "game-changing", "in today's rapidly evolving landscape", "paradigm shift", "unlock potential").

7. **Self-Check Checklist** — A verification list the AI should run before outputting (formatting, keyword placement, company mention, FAQ section, link counts, word count).

---

IMPORTANT: The output should be the system prompt text ONLY. Do not wrap it in code blocks or add any meta-commentary. Write it as if it will be used directly as-is.`)

  // Company info
  const companyLines: string[] = []
  if (inputs.companyName) companyLines.push(`Company name: ${inputs.companyName}`)
  if (inputs.whatYouDo) companyLines.push(`What they do: ${inputs.whatYouDo}`)
  if (inputs.industry) companyLines.push(`Industry: ${inputs.industry}`)
  if (inputs.differentiator) companyLines.push(`Differentiator: ${inputs.differentiator}`)
  if (inputs.avoidTopics) companyLines.push(`Topics/competitors to never mention: ${inputs.avoidTopics}`)
  if (companyLines.length > 0) {
    sections.push(`\n**Company Information:**\n${companyLines.join("\n")}`)
  }

  // Audience
  const audienceLines: string[] = []
  if (inputs.audienceRole) audienceLines.push(`Target readers: ${inputs.audienceRole}`)
  if (inputs.audienceKnowledge) audienceLines.push(`Reader familiarity: ${inputs.audienceKnowledge}`)
  if (inputs.audienceProblems) audienceLines.push(`Problems they face: ${inputs.audienceProblems}`)
  if (audienceLines.length > 0) {
    sections.push(`\n**Target Audience:**\n${audienceLines.join("\n")}`)
  }

  // Voice & Tone
  const voiceLines: string[] = []
  if (inputs.voiceTraits?.length) voiceLines.push(`Brand voice traits: ${inputs.voiceTraits.join(", ")}`)
  if (inputs.voiceAvoid?.length) voiceLines.push(`Voice is NOT: ${inputs.voiceAvoid.join(", ")}`)
  if (inputs.formality !== undefined) {
    const labels = ["Very casual", "Casual", "Balanced", "Formal", "Very formal"]
    voiceLines.push(`Formality: ${inputs.formality}/5 (${labels[inputs.formality - 1] || "Balanced"})`)
  }
  if (inputs.humor) voiceLines.push(`Humor: ${inputs.humor}`)
  if (inputs.hardRules) voiceLines.push(`Hard style rules: ${inputs.hardRules}`)
  if (voiceLines.length > 0) {
    sections.push(`\n**Voice & Tone:**\n${voiceLines.join("\n")}`)
  }

  // Language rules
  const langLines: string[] = []
  if (inputs.bannedPhrases) langLines.push(`Banned words/phrases:\n${inputs.bannedPhrases}`)
  if (inputs.preferredJargon) langLines.push(`Industry terms to use: ${inputs.preferredJargon}`)
  if (inputs.avoidedJargon) langLines.push(`Jargon to avoid: ${inputs.avoidedJargon}`)
  if (inputs.customerWord) langLines.push(`Call customers: "${inputs.customerWord}"`)
  if (langLines.length > 0) {
    sections.push(`\n**Language Rules:**\n${langLines.join("\n")}`)
  }

  // Examples
  const exampleLines: string[] = []
  if (inputs.goodExamples) exampleLines.push(`Content they love:\n${inputs.goodExamples}`)
  if (inputs.badExamples) exampleLines.push(`Content they dislike:\n${inputs.badExamples}`)
  if (inputs.admiredWriter) exampleLines.push(`Admired writers/brands: ${inputs.admiredWriter}`)
  if (inputs.additionalNotes) exampleLines.push(`Additional notes: ${inputs.additionalNotes}`)
  if (exampleLines.length > 0) {
    sections.push(`\n**Examples & References:**\n${exampleLines.join("\n")}`)
  }

  sections.push(`\n---\n\nGenerate the system prompt now. Be specific and actionable — not vague ("be professional") but concrete ("use short sentences, avoid passive voice, lead with the benefit"). The output should read like a real internal brand document.`)

  return sections.join("\n")
}
