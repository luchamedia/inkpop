/**
 * Utilities for parsing, detecting, and manipulating prompt sections.
 * Sections are markdown ## headings within the writing prompt.
 */

export interface SectionQuestion {
  id: string
  label: string
  type: "choice" | "text"
  options?: string[] // for "choice" type
  placeholder?: string // for "text" type
}

export interface SuggestedSection {
  id: string
  heading: string
  description: string
  questions: SectionQuestion[]
  matchKeywords: string[]
  isCustom?: boolean
}

export interface ParsedSection {
  heading: string // empty string for preamble (content before first heading)
  content: string
}

/** Canonical prompt sections users can add via the section builder. */
export const SUGGESTED_SECTIONS: SuggestedSection[] = [
  {
    id: "topic",
    heading: "About This Blog",
    description: "What the blog covers and its angle",
    questions: [
      {
        id: "niche",
        label: "What's the main topic or niche?",
        type: "text",
        placeholder: "e.g., Celebrity gossip, B2B marketing, Home cooking…",
      },
      {
        id: "angle",
        label: "What makes your perspective unique?",
        type: "choice",
        options: [
          "Insider/expert knowledge",
          "Opinionated hot takes",
          "Beginner-friendly explainers",
          "Data-driven analysis",
          "Personal experience & stories",
          "Industry news commentary",
        ],
      },
      {
        id: "goal",
        label: "What's the blog's main goal?",
        type: "choice",
        options: [
          "Drive organic traffic (SEO)",
          "Build brand authority",
          "Educate customers",
          "Entertain readers",
          "Generate leads",
          "Build community",
        ],
      },
    ],
    matchKeywords: ["about", "blog", "topic", "niche", "overview", "mission"],
  },
  {
    id: "audience",
    heading: "Target Audience",
    description: "Who reads it and what they care about",
    questions: [
      {
        id: "who",
        label: "Who are you writing for?",
        type: "text",
        placeholder: "e.g., Marketing managers at mid-size SaaS companies…",
      },
      {
        id: "knowledge",
        label: "How much do they already know?",
        type: "choice",
        options: [
          "Complete beginners",
          "Some familiarity",
          "Intermediate — know the basics",
          "Advanced — deep domain knowledge",
          "Mixed levels",
        ],
      },
      {
        id: "motivation",
        label: "Why are they reading?",
        type: "choice",
        options: [
          "Solve a specific problem",
          "Stay up to date",
          "Learn new skills",
          "Entertainment / curiosity",
          "Make a buying decision",
          "Professional development",
        ],
      },
    ],
    matchKeywords: [
      "audience",
      "reader",
      "target",
      "who we write",
      "demographic",
    ],
  },
  {
    id: "voice",
    heading: "Tone & Voice",
    description: "How posts should sound",
    questions: [
      {
        id: "formality",
        label: "How formal should the writing be?",
        type: "choice",
        options: [
          "Very casual — like texting a friend",
          "Conversational — friendly but polished",
          "Professional — clear and direct",
          "Formal — authoritative and measured",
        ],
      },
      {
        id: "personality",
        label: "Pick the traits that fit your brand",
        type: "choice",
        options: [
          "Witty & playful",
          "Warm & encouraging",
          "Bold & opinionated",
          "Calm & trustworthy",
          "Energetic & enthusiastic",
          "Dry & matter-of-fact",
        ],
      },
      {
        id: "avoid",
        label: "Anything the tone should avoid?",
        type: "text",
        placeholder: "e.g., No sarcasm, no corporate jargon, no clickbait…",
      },
    ],
    matchKeywords: [
      "tone",
      "voice",
      "style",
      "personality",
      "writing style",
      "formality",
    ],
  },
  {
    id: "structure",
    heading: "Content Structure",
    description: "Post length and formatting rules",
    questions: [
      {
        id: "length",
        label: "How long should posts be?",
        type: "choice",
        options: [
          "Short — 500-800 words",
          "Medium — 1,000-1,500 words",
          "Long-form — 2,000-3,000 words",
          "Deep dives — 3,000+ words",
          "Varies by topic",
        ],
      },
      {
        id: "format",
        label: "Preferred structure?",
        type: "choice",
        options: [
          "Intro → sections → conclusion",
          "Problem → solution → action steps",
          "Story → analysis → takeaways",
          "List-based (numbered or bulleted)",
          "Q&A / FAQ format",
          "No strict structure — flexible",
        ],
      },
      {
        id: "extras",
        label: "Any required elements?",
        type: "choice",
        options: [
          "TL;DR at the top",
          "FAQ section at the end",
          "Key takeaways box",
          "Call to action in every post",
          "Table of contents for long posts",
          "None — keep it simple",
        ],
      },
    ],
    matchKeywords: [
      "structure",
      "format",
      "length",
      "word count",
      "layout",
      "organization",
    ],
  },
  {
    id: "content-types",
    heading: "Content Types",
    description: "Post formats to generate",
    questions: [
      {
        id: "types",
        label: "What types of posts should AI generate?",
        type: "choice",
        options: [
          "How-to guides & tutorials",
          "Listicles & roundups",
          "Comparisons & vs. posts",
          "News commentary & analysis",
          "Opinion pieces & hot takes",
          "Case studies & examples",
          "Beginner guides & explainers",
        ],
      },
      {
        id: "frequency",
        label: "Should it mix formats or stick to one?",
        type: "choice",
        options: [
          "Mix it up — variety is key",
          "Mostly one type with occasional variety",
          "Stick to a consistent format",
        ],
      },
    ],
    matchKeywords: [
      "content type",
      "format",
      "article type",
      "post type",
      "kinds of post",
    ],
  },
  {
    id: "seo",
    heading: "SEO & Headlines",
    description: "Title rules and keyword guidance",
    questions: [
      {
        id: "headline-style",
        label: "What headline style works for your audience?",
        type: "choice",
        options: [
          "Direct & clear (\"How to Fix X\")",
          "Numbered lists (\"7 Ways to…\")",
          "Question-based (\"Is X Worth It?\")",
          "Bold claims (\"X Is Dead. Here's Why.\")",
          "Curiosity hooks (\"What Nobody Tells You About X\")",
          "Mix of styles",
        ],
      },
      {
        id: "keywords",
        label: "Any target keywords or topics?",
        type: "text",
        placeholder: "e.g., SaaS marketing, content strategy, SEO tools…",
      },
    ],
    matchKeywords: [
      "seo",
      "headline",
      "keyword",
      "title",
      "search",
      "linking",
      "discoverability",
    ],
  },
  {
    id: "rules",
    heading: "Rules & Constraints",
    description: "Banned phrases, off-limits topics",
    questions: [
      {
        id: "banned",
        label: "Any words or phrases to ban?",
        type: "text",
        placeholder:
          "e.g., \"game-changing\", \"let's dive in\", \"in today's world\"…",
      },
      {
        id: "off-limits",
        label: "Topics or competitors to never mention?",
        type: "text",
        placeholder: "e.g., Never mention CompetitorX, avoid political topics…",
      },
      {
        id: "hard-rules",
        label: "Any hard rules?",
        type: "choice",
        options: [
          "Never use passive voice",
          "Always include a CTA",
          "No first-person (\"I\", \"we\")",
          "Cite sources for all claims",
          "No questions in headings",
          "Keep paragraphs under 3 sentences",
        ],
      },
    ],
    matchKeywords: [
      "rule",
      "constraint",
      "banned",
      "avoid",
      "never",
      "always",
      "guideline",
      "do not",
    ],
  },
]

/** Split a markdown prompt into sections by ## headings. */
export function parsePromptSections(markdown: string): ParsedSection[] {
  if (!markdown.trim()) return []

  const lines = markdown.split("\n")
  const sections: ParsedSection[] = []
  let currentHeading = ""
  let currentLines: string[] = []

  for (const line of lines) {
    const headingMatch = line.match(/^## (.+)$/)
    if (headingMatch) {
      const content = currentLines.join("\n").trim()
      if (currentHeading || content) {
        sections.push({ heading: currentHeading, content })
      }
      currentHeading = headingMatch[1].trim()
      currentLines = []
    } else {
      currentLines.push(line)
    }
  }

  const content = currentLines.join("\n").trim()
  if (currentHeading || content) {
    sections.push({ heading: currentHeading, content })
  }

  return sections
}

/** Normalize a heading for fuzzy comparison. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
}

/** Match a parsed heading to a suggested section ID, or null. */
export function matchSectionToSuggested(heading: string): string | null {
  const norm = normalize(heading)
  for (const section of SUGGESTED_SECTIONS) {
    for (const keyword of section.matchKeywords) {
      if (norm.includes(keyword.toLowerCase())) {
        return section.id
      }
    }
  }
  return null
}

/** Return a Set of suggested section IDs that exist in the prompt. */
export function detectExistingSections(markdown: string): Set<string> {
  const parsed = parsePromptSections(markdown)
  const found = new Set<string>()
  for (const section of parsed) {
    if (!section.heading) continue
    const id = matchSectionToSuggested(section.heading)
    if (id) found.add(id)
  }
  return found
}

/** Get the content of a specific section by suggested section ID. */
export function getSectionContent(
  markdown: string,
  sectionId: string
): string | null {
  const parsed = parsePromptSections(markdown)
  for (const section of parsed) {
    if (!section.heading) continue
    const id = matchSectionToSuggested(section.heading)
    if (id === sectionId) return section.content
  }
  return null
}

/** Build a summary of questionnaire answers for the AI prompt. */
export function buildAnswerSummary(
  section: SuggestedSection,
  answers: Record<string, string>
): string {
  const lines: string[] = []
  for (const q of section.questions) {
    const answer = answers[q.id]
    if (answer?.trim()) {
      lines.push(`${q.label}\n→ ${answer}`)
    }
  }
  return lines.join("\n\n")
}
