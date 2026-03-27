import { createHash } from "crypto"
import { MindStudioAgent } from "@mindstudio-ai/agent"
import { type WritingPromptInputs, buildMetaPrompt } from "@/lib/writing-prompt"
import type { SupabaseClient } from "@supabase/supabase-js"

/** Static preamble injected into every blog generation prompt (universal rules) */
const STATIC_PREAMBLE = `You are an expert AI blog writer. Follow these rules for EVERY post:

## Role & Output Rules
- You write blog posts for the site described in the context below.
- Output MUST start with an H2 tag. Never use H1 — the CMS adds the title as H1.
- No preamble, no "In this article we'll explore…", no closing meta-commentary.
- No raw URLs inline — use anchor tags for any links.
- Do not include scraped navigation, bylines, or boilerplate from sources.

## Content Guidelines
- Target 2,500–5,000 words depending on topic depth.
- Structure: H2 for main sections, H3 for subsections, short paragraphs (2-4 sentences).
- Include a FAQ/AEO section at the end with 4–6 common questions and concise answers.
- Use bullet lists and numbered lists for scannable content.

## SEO & Linking
- Place the primary keyword in the first 100 words and in at least one H2.
- Use semantic keyword variations throughout — don't repeat the exact phrase unnaturally.

## Self-Check (run before output)
- [ ] Starts with H2, no H1 present
- [ ] Primary keyword in first 100 words and at least one H2
- [ ] FAQ section with 4-6 questions
- [ ] Minimum 2,500 words (target 2,500–5,000)
- [ ] No AI-giveaway phrases ("dive into", "game-changing", "in today's rapidly evolving landscape")`

const agent = new MindStudioAgent()

export interface SuggestedSource {
  type: "youtube" | "blog" | "webpage"
  url: string
  label: string
  reason: string
  confidence: "high" | "low"
}

interface SearchResult {
  title: string
  description: string
  url: string
}

const PAGE_QUERY_SUFFIXES = [
  "",
  "resources guides",
  "experts creators",
  "news updates",
]

const MAX_VALIDATION_SCRAPE = 4000

export async function suggestSources(
  keywords: string,
  existingUrls: string[] = [],
  page: number = 1
): Promise<SuggestedSource[]> {
  const suffix = PAGE_QUERY_SUFFIXES[(page - 1) % PAGE_QUERY_SUFFIXES.length]
  const query = suffix ? `${keywords} ${suffix}` : keywords

  // Step 1: Parallel search via Google + Perplexity
  const [googleRes, perplexityRes] = await Promise.all([
    agent
      .searchGoogle({
        query: `${query} blog OR youtube OR resource`,
        exportType: "json",
        numResults: 15,
      })
      .catch((err) => {
        console.error("Google search failed:", err)
        return { results: [] as SearchResult[] }
      }),
    agent
      .searchPerplexity({
        query: `best ${query} blogs, youtube channels, and resources to follow`,
        exportType: "json",
        numResults: 10,
      })
      .catch((err) => {
        console.error("Perplexity search failed:", err)
        return { results: [] as SearchResult[] }
      }),
  ])

  // Step 2: Merge and deduplicate by domain
  const allResults = [...(googleRes.results || []), ...(perplexityRes.results || [])]
  const existingDomains = new Set(existingUrls.map(domainOf).filter(Boolean))
  const seenDomains = new Set<string>()
  const deduped: SearchResult[] = []

  for (const result of allResults) {
    const domain = domainOf(result.url)
    if (!domain || existingDomains.has(domain) || seenDomains.has(domain)) continue
    seenDomains.add(domain)
    deduped.push(result)
  }

  if (deduped.length === 0) return []

  // Step 3: AI ranking — pick best 5-8 and classify
  const formattedResults = deduped
    .map((r, i) => `${i + 1}. [${r.title}](${r.url})\n   ${r.description}`)
    .join("\n")

  const { content: rankingContent } = await agent.generateText({
    message: buildSuggestPrompt(formattedResults, keywords, existingUrls),
    structuredOutputType: "json",
    structuredOutputExample: JSON.stringify({
      suggestions: [
        {
          type: "blog",
          url: "https://example.com",
          label: "Example Blog - Niche Topic",
          reason: "Authoritative blog covering this niche with weekly posts.",
        },
      ],
    }),
  })

  let ranked: { type: string; url: string; label: string; reason: string }[]
  try {
    const parsed = JSON.parse(rankingContent)
    ranked = parsed.suggestions || []
  } catch {
    console.error("Failed to parse suggest ranking:", rankingContent)
    return []
  }

  if (ranked.length === 0) return []

  // Step 4: Topical validation — scrape top candidates and verify relevance
  const toValidate = ranked.slice(0, 5)
  const scrapeResults = await Promise.all(
    toValidate.map((s) =>
      agent
        .scrapeUrl({
          url: s.url,
          pageOptions: {
            onlyMainContent: true,
            screenshot: false,
            waitFor: 0,
            replaceAllPathsWithAbsolutePaths: false,
            headers: {},
            removeTags: ["nav", "footer", "aside"],
            mobile: false,
          },
        })
        .catch(() => null)
    )
  )

  const scrapedSummaries = toValidate.map((s, i) => {
    const result = scrapeResults[i]
    if (!result) return `URL: ${s.url}\nContent: [could not scrape]`
    const text =
      typeof result.content === "string"
        ? result.content
        : Array.isArray(result.content)
          ? result.content.join("\n")
          : result.content?.text || ""
    return `URL: ${s.url}\nContent: ${text.slice(0, MAX_VALIDATION_SCRAPE)}`
  })

  const { content: validationContent } = await agent.generateText({
    message: buildValidationPrompt(scrapedSummaries.join("\n\n---\n\n"), keywords),
    structuredOutputType: "json",
    structuredOutputExample: JSON.stringify({
      validations: [{ url: "https://example.com", topical: true }],
    }),
  })

  const validatedUrls = new Set<string>()
  try {
    const parsed = JSON.parse(validationContent)
    for (const v of parsed.validations || []) {
      if (v.topical) validatedUrls.add(v.url)
    }
  } catch {
    // If validation parsing fails, treat all as high confidence
    for (const s of toValidate) validatedUrls.add(s.url)
  }

  return ranked.map((s) => ({
    type: (s.type === "youtube" || s.type === "blog" || s.type === "webpage"
      ? s.type
      : "webpage") as SuggestedSource["type"],
    url: s.url,
    label: s.label,
    reason: s.reason,
    confidence: validatedUrls.has(s.url) ? "high" as const : "low" as const,
  }))
}

function domainOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return null
  }
}

function buildSuggestPrompt(
  formattedResults: string,
  keywords: string,
  existingUrls: string[]
): string {
  return `You are a content source curator. Given the following search results for the topic "${keywords}", select the 5-8 best sources for an AI blog generation tool to scrape regularly.

Prioritize:
- Active blogs and YouTube channels that publish regularly
- Authoritative sources in the niche
- Diverse perspectives (not all from the same domain)

Classify each source:
- "youtube" — if the URL is a YouTube channel or playlist
- "blog" — if it's a blog, RSS feed, or publication
- "webpage" — for other web resources (product pages, documentation, wikis)

For each source provide:
- "type": the classification above
- "url": the exact URL from the search results
- "label": a short human-readable name (e.g. "Minimalist Baker - Vegan Recipes")
- "reason": one sentence explaining why this source is valuable

Exclude these URLs (already added): ${existingUrls.join(", ") || "none"}

SEARCH RESULTS:
${formattedResults}

Return a JSON object with a "suggestions" array.`
}

function buildValidationPrompt(
  scrapedContent: string,
  keywords: string
): string {
  return `You are evaluating whether web sources are topically relevant to "${keywords}".

For each source below, determine if its actual content consistently covers topics related to "${keywords}". A source is topical if its main content is regularly about this subject — not just a single mention.

SCRAPED CONTENT:
${scrapedContent}

For each URL, return { "url": "...", "topical": true/false }.
Return a JSON object with a "validations" array.`
}

// --- Topic Brief ---

export interface TopicBrief {
  description: string
  audience: string
  contentGoals: string
}

export async function generateTopicBrief(topic: string): Promise<TopicBrief> {
  const { content } = await agent.generateText({
    message: `You are helping someone set up an AI-powered blog. They said their blog is about: "${topic}"

Based on this topic, generate a blog brief with three sections:
1. "description" — A 2-3 sentence description of what this blog covers and its unique angle.
2. "audience" — A 1-2 sentence description of the target readers.
3. "contentGoals" — A 1-2 sentence description of the type of content and value it provides.

Write in second person ("your blog", "your readers"). Be specific and opinionated — make strong assumptions based on the topic. The user can edit afterward.

Return a JSON object.`,
    structuredOutputType: "json",
    structuredOutputExample: JSON.stringify({
      description:
        "Your blog covers practical sustainable living strategies for people in urban apartments. It focuses on small-space composting, energy reduction, and zero-waste cooking.",
      audience:
        "Urban millennials and Gen Z renters who want to live more sustainably but feel limited by apartment living.",
      contentGoals:
        "Actionable how-to guides, product reviews, and weekly challenges that make sustainable habits feel achievable.",
    }),
  })

  try {
    return JSON.parse(content)
  } catch {
    return {
      description: `A blog about ${topic}.`,
      audience: "People interested in this topic.",
      contentGoals: "Informative articles and guides.",
    }
  }
}

export async function refineTopicBrief(
  brief: TopicBrief,
  instruction: string
): Promise<TopicBrief> {
  const { content } = await agent.generateText({
    message: `You are helping someone refine their blog brief. Here is the current brief:

Description: ${brief.description}
Audience: ${brief.audience}
Content Goals: ${brief.contentGoals}

The user wants to make this change: "${instruction}"

Update the brief according to the user's instruction. Keep the same structure and tone. Only change what the user asked for.

Return a JSON object with "description", "audience", and "contentGoals" fields.`,
    structuredOutputType: "json",
    structuredOutputExample: JSON.stringify({
      description: "Updated description...",
      audience: "Updated audience...",
      contentGoals: "Updated content goals...",
    }),
  })

  try {
    return JSON.parse(content)
  } catch {
    return brief
  }
}

// --- Company Website Scan ---

export interface CompanyScanResult {
  companyName: string
  description: string
  audience: string
  suggestedTopic: string
  keywords: string[]
}

export async function scanCompanyWebsite(
  url: string
): Promise<CompanyScanResult> {
  const scrapeResult = await agent.scrapeUrl({
    url,
    pageOptions: {
      onlyMainContent: true,
      screenshot: false,
      waitFor: 0,
      replaceAllPathsWithAbsolutePaths: false,
      headers: {},
      removeTags: ["nav", "footer", "aside"],
      mobile: false,
    },
  })

  const text =
    typeof scrapeResult.content === "string"
      ? scrapeResult.content
      : Array.isArray(scrapeResult.content)
        ? scrapeResult.content.join("\n")
        : scrapeResult.content?.text || ""

  const truncated = text.slice(0, 8000)

  const { content } = await agent.generateText({
    message: `Analyze this company website content and extract key information for setting up a blog.

WEBSITE CONTENT:
${truncated}

Return a JSON object with:
- "companyName": the company or brand name
- "description": 2-3 sentences about what the company does
- "audience": who their customers/audience are
- "suggestedTopic": a clear blog topic suggestion based on their business
- "keywords": array of 5-8 relevant keywords for blog content

Return a JSON object.`,
    structuredOutputType: "json",
    structuredOutputExample: JSON.stringify({
      companyName: "Acme Corp",
      description:
        "Acme Corp provides sustainable packaging solutions for e-commerce businesses.",
      audience: "E-commerce store owners and sustainability-focused brands",
      suggestedTopic:
        "Sustainable packaging and eco-friendly e-commerce practices",
      keywords: [
        "sustainable packaging",
        "eco-friendly shipping",
        "green e-commerce",
      ],
    }),
  })

  try {
    return JSON.parse(content)
  } catch {
    return {
      companyName: "",
      description: "",
      audience: "",
      suggestedTopic: "",
      keywords: [],
    }
  }
}

// --- Site Name Suggestions ---

export async function suggestSiteNames(
  topic: string,
  topicContext: Array<{ question: string; answer: string }>
): Promise<string[]> {
  const contextStr =
    topicContext.length > 0
      ? `\n\nAdditional context:\n${topicContext.map((qa) => `Q: ${qa.question}\nA: ${qa.answer}`).join("\n")}`
      : ""

  const { content } = await agent.generateText({
    message: `Generate 5 creative, memorable blog names for a blog about: "${topic}"${contextStr}

Requirements:
- Short (1-3 words each)
- Catchy and brandable
- Easy to spell and remember
- Work well as a subdomain (e.g., name.inkpop.net)

Return a JSON object with a "names" array of 5 strings.`,
    structuredOutputType: "json",
    structuredOutputExample: JSON.stringify({
      names: [
        "Pixel Pantry",
        "Code Canvas",
        "Green Thread",
        "Data Drift",
        "Neon Notes",
      ],
    }),
  })

  try {
    const parsed = JSON.parse(content)
    return parsed.names || []
  } catch {
    return []
  }
}

// --- Single Post from Topic ---

export interface SiteContext {
  topic?: string
  description?: string
  topicContext?: Array<{ question: string; answer: string }>
  writingPrompt?: string
}

export async function generatePostForTopic(
  userTopic: string,
  sources: { type: string; url: string }[],
  siteContext?: SiteContext
): Promise<GeneratedPost | null> {
  // Scrape sources for context (limit to 5)
  const scrapeResults = await Promise.all(
    sources.slice(0, 5).map((source) =>
      agent
        .scrapeUrl({
          url: source.url,
          pageOptions: {
            onlyMainContent: true,
            screenshot: false,
            waitFor: 0,
            replaceAllPathsWithAbsolutePaths: false,
            headers: {},
            removeTags: ["nav", "footer", "aside"],
            mobile: false,
          },
        })
        .catch(() => null)
    )
  )

  const scrapedContent = scrapeResults
    .map((result) => {
      if (!result) return ""
      const text =
        typeof result.content === "string"
          ? result.content
          : Array.isArray(result.content)
            ? result.content.join("\n")
            : result.content?.text || ""
      return text.slice(0, 6000)
    })
    .filter(Boolean)
    .join("\n\n---\n\n")

  let topicPrompt: string

  if (siteContext?.writingPrompt) {
    // Priority 1: Custom writing prompt with STATIC_PREAMBLE
    topicPrompt = `${STATIC_PREAMBLE}

---
SITE-SPECIFIC INSTRUCTIONS:
---

${siteContext.writingPrompt}

---

Write ONE blog post specifically about: "${userTopic}"

SOURCE CONTENT (use as background research):
${scrapedContent || "[No sources available]"}

---

Return a JSON object with these 4 fields:
- "title": Compelling, keyword-rich title (50-70 chars)
- "slug": URL-friendly slug (lowercase, hyphens)
- "body": Full blog post in HTML format (use h2, h3, p, ul, li, strong, em). Minimum 2,500 words.
- "meta_description": SEO meta description (140-155 chars)`
  } else {
    // Priority 2: Topic context fallback
    const contextBlock = siteContext?.topic
      ? `SITE CONTEXT:\nTopic: ${siteContext.topic}\n${siteContext.description ? `Description: ${siteContext.description}\n` : ""}${
          siteContext.topicContext
            ? `Background:\n${siteContext.topicContext.map((qa) => `Q: ${qa.question}\nA: ${qa.answer}`).join("\n")}\n`
            : ""
        }\n`
      : ""

    topicPrompt = `${contextBlock}You are an expert SEO blog writer. Write ONE blog post about: "${userTopic}"

Use the following source content as background research and inspiration (but the post should specifically be about the requested topic):

SOURCE CONTENT:
${scrapedContent || "[No sources available]"}

The post must have:
- "title": A compelling, keyword-rich title (50-70 chars)
- "slug": URL-friendly slug (lowercase, hyphens)
- "body": Full blog post in HTML format (use h2, h3, p, ul, li, strong, em). Minimum 2,500 words.
- "meta_description": SEO meta description (140-155 chars)

Return a JSON object with these 4 fields.`
  }

  const { content } = await agent.generateText({
    message: topicPrompt,
    structuredOutputType: "json",
    structuredOutputExample: JSON.stringify({
      title: "Example Post Title",
      slug: "example-post-title",
      body: "<h2>Section</h2><p>Content...</p>",
      meta_description: "Brief description for SEO.",
    }),
  })

  try {
    return JSON.parse(content)
  } catch {
    console.error("Failed to parse topic post:", content)
    return null
  }
}

// --- Blog Post Generation ---

export interface GeneratedPost {
  title: string
  slug: string
  body: string
  meta_description: string
}

const MAX_CONTENT_LENGTH = 12000 // ~3000 words, avoid token limits

export async function generatePosts(
  sources: { type: string; url: string }[],
  siteContext?: SiteContext
): Promise<GeneratedPost[]> {
  // Step 1: Scrape all sources in parallel
  const scrapeResults = await Promise.all(
    sources.map((source) =>
      agent
        .scrapeUrl({
          url: source.url,
          pageOptions: {
            onlyMainContent: true,
            screenshot: false,
            waitFor: 0,
            replaceAllPathsWithAbsolutePaths: false,
            headers: {},
            removeTags: ["nav", "footer", "aside"],
            mobile: false,
          },
        })
        .catch((err) => {
          console.error(`Failed to scrape ${source.url}:`, err)
          return null
        })
    )
  )

  // Collect scraped content
  const scrapedContent = scrapeResults
    .map((result, i) => {
      if (!result) return `--- Source: ${sources[i].url} ---\n[Failed to scrape]`
      const text =
        typeof result.content === "string"
          ? result.content
          : Array.isArray(result.content)
            ? result.content.join("\n")
            : result.content?.text || ""
      const truncated = text.slice(0, MAX_CONTENT_LENGTH)
      return `--- Source: ${sources[i].url} ---\n${truncated}`
    })
    .join("\n\n")

  // Step 2: Generate blog posts from scraped content
  const { content } = await agent.generateText({
    message: buildPrompt(scrapedContent, siteContext),
    structuredOutputType: "json",
    structuredOutputExample: JSON.stringify({
      posts: [
        {
          title: "Example Post Title",
          slug: "example-post-title",
          body: "<h2>Section</h2><p>Content here...</p>",
          meta_description: "A brief 155-char description for SEO.",
        },
      ],
    }),
  })

  try {
    const parsed = JSON.parse(content)
    return parsed.posts || []
  } catch {
    console.error("Failed to parse generateText response:", content)
    return []
  }
}

function buildPrompt(scrapedContent: string, ctx?: SiteContext): string {
  if (ctx?.writingPrompt) {
    return `${STATIC_PREAMBLE}

---
SITE-SPECIFIC INSTRUCTIONS:
---

${ctx.writingPrompt}

---
SOURCE CONTENT (use this as research material for the blog posts):
---

${scrapedContent}

---

Generate 1-3 blog posts based on the source content above, following all guidelines.

Return a JSON object with a "posts" array. Each post must have:
- "title": Compelling, keyword-rich title (50-70 chars)
- "slug": URL-friendly slug (lowercase, hyphens, no special chars)
- "body": Full blog post in HTML format (use h2, h3, p, ul, li, strong, em tags). Minimum 2,500 words.
- "meta_description": SEO meta description (140-155 chars)`
  }

  // Fallback: topic context (no writing prompt)
  let contextBlock = ""
  if (ctx?.topic) {
    contextBlock += `SITE CONTEXT:\nTopic: ${ctx.topic}\n`
    if (ctx.description) contextBlock += `Description: ${ctx.description}\n`
    if (ctx.topicContext && ctx.topicContext.length > 0) {
      contextBlock += `Background:\n`
      for (const qa of ctx.topicContext) {
        contextBlock += `Q: ${qa.question}\nA: ${qa.answer}\n`
      }
    }
    contextBlock += `\nUse this context to ensure all posts are relevant to the site's topic and audience.\n\n`
  }

  return `${contextBlock}You are an expert SEO blog writer. Based on the following source content, generate 1-3 unique, high-quality blog posts optimized for search engines.

Each post must have:
- "title": A compelling, keyword-rich title (50-70 chars)
- "slug": URL-friendly slug derived from the title (lowercase, hyphens, no special chars)
- "body": Full blog post in HTML format (use <h2>, <h3>, <p>, <ul>, <li>, <strong>, <em> tags). Minimum 2,500 words.
- "meta_description": SEO meta description (140-155 chars)

Return a JSON object with a "posts" array.

SOURCE CONTENT:
${scrapedContent}`
}

// --- Writing Prompt Generation ---

export async function generateWritingPrompt(
  inputs: WritingPromptInputs
): Promise<string> {
  const { content } = await agent.generateText({
    message: buildMetaPrompt(inputs),
  })

  return content
}

// =============================================================================
// Generation Workflow v2 — scan, extract, ideate, write, orchestrate
// =============================================================================

export interface Learning {
  topic: string
  insight: string
  relevance: "high" | "medium" | "low"
}

export interface ArticleIdea {
  title: string
  angle: string
  keyLearnings: string[]
  description?: string   // meta description, 120-160 chars
  keywords?: string[]    // SEO keywords
  slug?: string          // URL-friendly slug
}

export interface ScanResult {
  sourceId: string
  url: string
  hasNewContent: boolean
  scrapedText: string
  contentHash: string
}

export interface WorkflowResult {
  status: "completed" | "skipped" | "failed"
  scanned: number
  newContentFound: number
  learningsExtracted: number
  ideasGenerated: number
  postsWritten: GeneratedPost[]
  /** Ideas that were NOT written (to be stored in post_ideas) */
  remainingIdeas: ArticleIdea[]
  /** Ideas that WERE written (to link posts to ideas) */
  writtenIdeas: ArticleIdea[]
  error?: string
}

const SCRAPE_OPTIONS = {
  onlyMainContent: true,
  screenshot: false,
  waitFor: 0,
  replaceAllPathsWithAbsolutePaths: false,
  headers: {},
  removeTags: ["nav", "footer", "aside"] as string[],
  mobile: false,
}

const MAX_LEARNING_SCRAPE = 6000
const MIN_SCRAPE_LENGTH = 200

/**
 * Detect if a URL is a YouTube channel/playlist/video URL.
 */
function isYoutubeUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "")
    return host === "youtube.com" || host === "youtu.be" || host === "m.youtube.com"
  } catch {
    return false
  }
}

/**
 * Fetch content from a YouTube source by retrieving recent videos and their transcripts.
 * Returns a combined text of video titles, descriptions, and transcripts.
 */
async function fetchYoutubeContent(url: string): Promise<string> {
  // Try to fetch as a channel first
  let videoUrls: string[] = []
  try {
    const { channel } = await agent.fetchYoutubeChannel({ channelUrl: url })
    // Extract video URLs from channel data
    const channelData = channel as Record<string, unknown>
    const videos = (channelData.videos || channelData.recentVideos || []) as Array<Record<string, string>>
    videoUrls = videos
      .slice(0, 5)
      .map((v) => v.url || v.videoUrl || v.link || "")
      .filter(Boolean)
  } catch {
    // If channel fetch fails, treat the URL as a single video
    videoUrls = [url]
  }

  if (videoUrls.length === 0) {
    // Fallback: treat the URL itself as a video
    videoUrls = [url]
  }

  // Fetch metadata and captions for each video in parallel
  const videoResults = await Promise.allSettled(
    videoUrls.map(async (videoUrl) => {
      const [metaResult, captionResult] = await Promise.allSettled([
        agent.fetchYoutubeVideo({ videoUrl }),
        agent.fetchYoutubeCaptions({ videoUrl, exportType: "text", language: "en" }),
      ])

      const meta = metaResult.status === "fulfilled"
        ? metaResult.value.video as Record<string, unknown>
        : null
      const captions = captionResult.status === "fulfilled"
        ? captionResult.value.transcripts as Array<{ text: string; start: number }> | undefined
        : null

      const title = (meta?.title as string) || ""
      const description = (meta?.description as string) || ""
      const transcript = captions
        ? captions.map((t) => t.text).join(" ")
        : ""

      return `--- Video: ${title || videoUrl} ---\n${description ? `Description: ${description}\n` : ""}${transcript ? `Transcript: ${transcript}` : "[No captions available]"}`
    })
  )

  return videoResults
    .filter((r): r is PromiseFulfilledResult<string> => r.status === "fulfilled")
    .map((r) => r.value)
    .join("\n\n")
}

interface RssFeedItem {
  title: string
  link: string
  description: string
  pubDate: string | null
}

/**
 * Fetch and parse an RSS/Atom feed. Returns individual items with title, link,
 * description, and publish date. Falls back to null if the URL is not a valid feed.
 */
async function fetchRssFeed(url: string): Promise<RssFeedItem[] | null> {
  let xml: string
  try {
    const response = await agent.httpRequest({
      url,
      method: "GET",
      headers: { "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml" },
      queryParams: {},
      body: "",
      bodyItems: {},
      contentType: "none",
      customContentType: "",
    })
    xml = typeof response === "string" ? response : (response as unknown as Record<string, unknown>).body as string || ""
  } catch {
    return null
  }

  if (!xml) return null

  // Quick check: is this RSS or Atom XML?
  const isRss = xml.includes("<rss") || xml.includes("<channel>")
  const isAtom = xml.includes("<feed") && xml.includes("xmlns=\"http://www.w3.org/2005/Atom\"")
  if (!isRss && !isAtom) return null

  const items: RssFeedItem[] = []

  if (isRss) {
    // Parse RSS <item> elements
    const itemRegex = /<item>([\s\S]*?)<\/item>/gi
    let match
    while ((match = itemRegex.exec(xml)) !== null) {
      const itemXml = match[1]
      items.push({
        title: extractTag(itemXml, "title"),
        link: extractTag(itemXml, "link"),
        description: stripHtml(extractTag(itemXml, "description")),
        pubDate: extractTag(itemXml, "pubDate") || null,
      })
    }
  } else {
    // Parse Atom <entry> elements
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/gi
    let match
    while ((match = entryRegex.exec(xml)) !== null) {
      const entryXml = match[1]
      const link = entryXml.match(/<link[^>]*href=["']([^"']*)["'][^>]*\/?>/)
      items.push({
        title: extractTag(entryXml, "title"),
        link: link ? link[1] : extractTag(entryXml, "link"),
        description: stripHtml(extractTag(entryXml, "summary") || extractTag(entryXml, "content")),
        pubDate: extractTag(entryXml, "published") || extractTag(entryXml, "updated") || null,
      })
    }
  }

  return items.length > 0 ? items : null
}

/** Extract text content from an XML tag. */
function extractTag(xml: string, tag: string): string {
  const cdataMatch = xml.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`, "i"))
  if (cdataMatch) return cdataMatch[1].trim()
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"))
  return match ? match[1].trim() : ""
}

/** Strip HTML tags from a string. */
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
}

/**
 * Fetch RSS feed content for a blog source. Returns a structured text combining
 * recent feed items and their scraped full content.
 */
async function fetchRssContent(url: string, lookbackHours: number = 48): Promise<string | null> {
  const feedItems = await fetchRssFeed(url)
  if (!feedItems) return null

  // Filter by publish date if available
  const cutoff = new Date(Date.now() - lookbackHours * 60 * 60 * 1000)
  const recentItems = feedItems.filter((item) => {
    if (!item.pubDate) return true // Include items without dates
    try {
      return new Date(item.pubDate) >= cutoff
    } catch {
      return true
    }
  }).slice(0, 10) // Cap at 10 items

  if (recentItems.length === 0) return null

  // Scrape full content for the top 5 most recent items
  const toScrape = recentItems.slice(0, 5).filter((item) => item.link)
  const scrapeResults = await Promise.allSettled(
    toScrape.map((item) =>
      agent.scrapeUrl({ url: item.link, pageOptions: SCRAPE_OPTIONS })
    )
  )

  const sections = recentItems.map((item, i) => {
    let fullText = ""
    if (i < toScrape.length) {
      const result = scrapeResults[i]
      if (result.status === "fulfilled" && result.value) {
        const content = result.value.content
        fullText = typeof content === "string"
          ? content
          : Array.isArray(content)
            ? content.join("\n")
            : (content as unknown as Record<string, string>)?.text || ""
        fullText = fullText.slice(0, MAX_LEARNING_SCRAPE)
      }
    }

    return `--- Item: ${item.title} ---\n${item.pubDate ? `Published: ${item.pubDate}\n` : ""}${item.description ? `Summary: ${item.description}\n` : ""}${fullText ? `Full content: ${fullText}` : ""}`
  })

  return sections.join("\n\n")
}

/**
 * 2a. Scrape a source and compare content hash to detect new content.
 * Branches by source type: YouTube sources use transcript extraction,
 * blog sources try RSS feed parsing first, all others use web scraping.
 */
export async function scanSourceForChanges(
  source: { id: string; type: string; url: string },
  supabase: SupabaseClient
): Promise<ScanResult> {
  let text: string

  if (source.type === "youtube" || isYoutubeUrl(source.url)) {
    // YouTube source: fetch channel videos + transcripts
    text = await fetchYoutubeContent(source.url)
  } else if (source.type === "blog") {
    // Blog source: try RSS feed parsing first, fall back to web scraping
    const rssContent = await fetchRssContent(source.url)
    if (rssContent) {
      text = rssContent
    } else {
      const scrapeResult = await agent.scrapeUrl({
        url: source.url,
        pageOptions: SCRAPE_OPTIONS,
      })
      text =
        typeof scrapeResult.content === "string"
          ? scrapeResult.content
          : Array.isArray(scrapeResult.content)
            ? scrapeResult.content.join("\n")
            : scrapeResult.content?.text || ""
    }
  } else {
    // Webpage source: standard web scraping
    const scrapeResult = await agent.scrapeUrl({
      url: source.url,
      pageOptions: SCRAPE_OPTIONS,
    })

    text =
      typeof scrapeResult.content === "string"
        ? scrapeResult.content
        : Array.isArray(scrapeResult.content)
          ? scrapeResult.content.join("\n")
          : scrapeResult.content?.text || ""
  }

  const contentHash = createHash("sha256").update(text).digest("hex")

  // Compare to most recent snapshot
  const { data: lastSnapshot } = await supabase
    .from("source_snapshots")
    .select("content_hash")
    .eq("source_id", source.id)
    .order("scraped_at", { ascending: false })
    .limit(1)
    .single()

  const hasNewContent = !lastSnapshot || lastSnapshot.content_hash !== contentHash

  // Always insert a new snapshot (updates the scraped_at timestamp)
  await supabase.from("source_snapshots").insert({
    source_id: source.id,
    content_hash: contentHash,
    content_preview: text.slice(0, 500),
  })

  return {
    sourceId: source.id,
    url: source.url,
    hasNewContent,
    scrapedText: text,
    contentHash,
  }
}

/**
 * 2b. Extract key learnings from newly scraped content.
 */
export async function extractLearnings(
  scrapedContent: { sourceId: string; url: string; text: string }[],
  siteContext: SiteContext
): Promise<{ sourceId: string; learnings: Learning[] }[]> {
  const combinedContent = scrapedContent
    .map((s) => `--- Source: ${s.url} ---\n${s.text.slice(0, MAX_LEARNING_SCRAPE)}`)
    .join("\n\n")

  const topicLine = siteContext.topic ? ` related to "${siteContext.topic}"` : ""

  const { content } = await agent.generateText({
    message: `You are analyzing web content to extract key learnings and insights${topicLine}.

For each source, extract 3-8 key learnings. Focus on:
- New facts, statistics, or data points
- Emerging trends or shifts in the space
- Practical techniques, tools, or methods
- Notable opinions or perspectives
- Breaking news or recent developments

Each learning should be self-contained — detailed enough to inspire a blog post on its own.

SOURCE CONTENT:
${combinedContent}

Return a JSON object with a "sources" array. Each entry has:
- "sourceId": the source identifier
- "learnings": array of { "topic": string, "insight": string (1-3 sentences), "relevance": "high" | "medium" | "low" }`,
    structuredOutputType: "json",
    structuredOutputExample: JSON.stringify({
      sources: [
        {
          sourceId: "abc-123",
          learnings: [
            {
              topic: "AI Code Review",
              insight: "New study shows automated code review reduces review time by 40% while catching 15% more bugs.",
              relevance: "high",
            },
          ],
        },
      ],
    }),
  })

  try {
    const parsed = JSON.parse(content)
    return (parsed.sources || []).map((s: { sourceId: string; learnings: Learning[] }) => ({
      sourceId: s.sourceId,
      learnings: (s.learnings || []).slice(0, 8),
    }))
  } catch {
    console.error("Failed to parse learnings:", content)
    return []
  }
}

/**
 * 2c. Generate ~20 article ideas based on accumulated learnings.
 * Uses an SEO/AEO-optimized ideation prompt that produces rich metadata.
 */
export async function ideateArticles(
  recentLearnings: Learning[],
  siteContext: SiteContext,
  existingTitles: string[],
  count: number = 20
): Promise<ArticleIdea[]> {
  const learningsSummary = recentLearnings
    .map((l, i) => `${i + 1}. [${l.relevance}] ${l.topic}: ${l.insight}`)
    .join("\n")

  const topicLine = siteContext.topic ? `about "${siteContext.topic}"` : ""
  const descLine = siteContext.description ? `\nBlog description: ${siteContext.description}` : ""

  const existingBlock =
    existingTitles.length > 0
      ? `<previous_articles>\n${existingTitles.map((t) => `- ${t}`).join("\n")}\n</previous_articles>`
      : "<previous_articles>\nNone yet.\n</previous_articles>"

  const { content } = await agent.generateText({
    message: `You are an expert SEO and AEO (Answer Engine Optimization) content strategist for a blog ${topicLine}.${descLine}

Your job is to generate blog post ideas that will drive organic search traffic and appear as answers in AI-powered search engines and assistants.

---

## Your Task

Given input data about recent learnings from monitored sources, generate a JSON array of exactly ${count} blog post ideas. Each blog post object must include:

- "title" — The title of the blog post. Optimized for SEO with clear, searchable phrasing. (50-70 chars)
- "description" — A meta description that is STRICTLY between 120–160 characters (including spaces). Count carefully. Descriptions under 120 or over 160 characters are invalid and must be rewritten.
- "keywords" — Array of 2-4 SEO-related keywords or phrases relevant to the article.
- "slug" — A URL-friendly slug derived from the title. Lowercase, hyphenated, no special characters.
- "angle" — 1-2 sentence editorial angle explaining what makes this post unique and valuable.
- "keyLearnings" — Array of 1-3 learning topics (from the input data) that should inform this post.

---

## Content Strategy Rules

1. **Variety of intent.** Mix informational ("What is X"), comparative ("X vs Y"), transactional ("Best X for Y"), and instructional ("How to X") content across the batch.
2. **SEO-first titles.** Titles should contain the keywords people actually search for. Prioritize clarity over cleverness.
3. **AEO optimization.** Descriptions should directly answer a question someone might ask an AI assistant. Think: "If someone asked Claude or ChatGPT about this, would this article be cited?"
4. **Description length is non-negotiable.** Every description MUST be 120–160 characters (including spaces). Count before finalizing. Under 120 → expand. Over 160 → trim. Hard requirement.
5. **No fluff.** Every article must have a clear, distinct angle. No two articles should cover the same topic from the same perspective.
6. **Slug format.** Strictly kebab-case. Lowercase, hyphen-separated, no special characters, no trailing or consecutive hyphens. Keep concise but descriptive.
7. **Priority ordering.** Order ideas by priority — most timely and impactful first.

---

## Input Data

<new_content_to_analyze>
${learningsSummary || "No recent learnings available."}
</new_content_to_analyze>

${existingBlock}

New articles must be different from anything in previous_articles. Covering the same subject is fine — but only with a genuinely new angle not already covered.

---

## Output Format

Return a JSON object with an "ideas" array containing exactly ${count} items.`,
    structuredOutputType: "json",
    structuredOutputExample: JSON.stringify({
      ideas: [
        {
          title: "How AI Code Review Tools Cut Review Time by 40%",
          description: "New research shows AI code review reduces review time by 40% while catching more bugs. Learn how to adopt these tools in your workflow.",
          keywords: ["AI code review", "developer productivity", "automation"],
          slug: "ai-code-review-tools-cut-review-time",
          angle: "Deep dive into the latest study results, with practical recommendations for teams considering adoption.",
          keyLearnings: ["AI Code Review", "Developer Productivity"],
        },
      ],
    }),
  })

  try {
    const parsed = JSON.parse(content)
    const ideas = (parsed.ideas || []).slice(0, count)
    // Ensure all fields have defaults for robustness
    return ideas.map((idea: Record<string, unknown>) => ({
      title: (idea.title as string) || "Untitled",
      angle: (idea.angle as string) || "",
      keyLearnings: (idea.keyLearnings as string[]) || [],
      description: (idea.description as string) || "",
      keywords: (idea.keywords as string[]) || [],
      slug: (idea.slug as string) || "",
    }))
  } catch {
    console.error("Failed to parse article ideas:", content)
    return []
  }
}

/**
 * 2d. Write a full blog post from an article idea, with web search for current facts.
 */
export async function writeArticle(
  idea: ArticleIdea,
  relevantLearnings: Learning[],
  siteContext: SiteContext
): Promise<GeneratedPost | null> {
  // Web search for current facts and statistics
  let searchContext = ""
  try {
    const searchResult = await agent.searchGoogle({
      query: idea.title,
      exportType: "json",
      numResults: 5,
    })
    if (searchResult.results && searchResult.results.length > 0) {
      searchContext = `\n\nWEB SEARCH RESULTS (use for current facts/stats):\n${searchResult.results
        .map((r: SearchResult) => `- ${r.title}: ${r.description} (${r.url})`)
        .join("\n")}`
    }
  } catch (err) {
    console.error("Web search failed for article:", err)
  }

  const learningsContext = relevantLearnings
    .map((l) => `- ${l.topic}: ${l.insight}`)
    .join("\n")

  // Build the writing prompt using the same priority system as existing code
  let writePrompt: string

  if (siteContext.writingPrompt) {
    writePrompt = `${STATIC_PREAMBLE}

---
SITE-SPECIFIC INSTRUCTIONS:
---

${siteContext.writingPrompt}

---

ARTICLE ASSIGNMENT:
Title: "${idea.title}"
Angle: ${idea.angle}

KEY LEARNINGS (incorporate into the article):
${learningsContext}
${searchContext}

---

Write ONE blog post following the assignment above and all guidelines in the system prompt.

Return a JSON object with:
- "title": The final title (may refine for SEO)
- "slug": URL-friendly slug (lowercase, hyphens)
- "body": Full blog post in HTML format (use h2, h3, p, ul, li, strong, em). Minimum 2,500 words.
- "meta_description": SEO meta description (140-155 chars)`
  } else {
    // Fallback: generic prompt with site context
    const topicLine = siteContext.topic ? `\nSite topic: ${siteContext.topic}` : ""
    const descLine = siteContext.description ? `\nSite description: ${siteContext.description}` : ""

    writePrompt = `You are an expert SEO blog writer.${topicLine}${descLine}

ARTICLE ASSIGNMENT:
Title: "${idea.title}"
Angle: ${idea.angle}

KEY LEARNINGS (incorporate into the article):
${learningsContext}
${searchContext}

Write ONE complete, high-quality blog post based on the assignment above. The post should:
- Be optimized for search engines
- Include the primary keyword in the first 100 words and at least one H2
- Have a FAQ section with 4-6 questions at the end
- Be minimum 2,500 words

Return a JSON object with:
- "title": Compelling, keyword-rich title (50-70 chars)
- "slug": URL-friendly slug (lowercase, hyphens)
- "body": Full blog post in HTML format (use h2, h3, p, ul, li, strong, em).
- "meta_description": SEO meta description (140-155 chars)`
  }

  const { content } = await agent.generateText({
    message: writePrompt,
    structuredOutputType: "json",
    structuredOutputExample: JSON.stringify({
      title: "Example Post Title",
      slug: "example-post-title",
      body: "<h2>Section</h2><p>Content...</p>",
      meta_description: "Brief description for SEO.",
    }),
  })

  try {
    const post: GeneratedPost = JSON.parse(content)
    // Use pre-filled slug and meta_description from idea if available
    if (idea.slug) post.slug = idea.slug
    if (idea.description) post.meta_description = idea.description
    return post
  } catch {
    console.error("Failed to parse written article:", content)
    return null
  }
}

export interface WorkflowOptions {
  /** Skip writeArticle step — return all ideas as remainingIdeas, postsWritten empty. */
  skipWriting?: boolean
}

/**
 * 2e. Orchestrate the full generation workflow for a site.
 */
export async function runGenerationWorkflow(
  site: {
    id: string
    user_id: string
    topic: string | null
    description: string | null
    topic_context: Array<{ question: string; answer: string }> | null
    writing_prompt: string | null
    context_files: Record<string, unknown> | null
    posts_per_period: number | null
    sources: Array<{ id: string; type: string; url: string }>
  },
  supabase: SupabaseClient,
  options?: WorkflowOptions
): Promise<WorkflowResult> {
  const siteContext: SiteContext = {
    topic: site.topic ?? undefined,
    description: site.description ?? undefined,
    topicContext: site.topic_context ?? undefined,
    writingPrompt: site.writing_prompt ?? undefined,
  }

  const postsPerPeriod = site.posts_per_period ?? 1

  // Step 1: Scan all sources for changes in parallel
  const scanResults = await Promise.all(
    site.sources.map((source) =>
      scanSourceForChanges(source, supabase).catch((err) => {
        console.error(`Failed to scan source ${source.url}:`, err)
        return null
      })
    )
  )

  const validScans = scanResults.filter((r): r is ScanResult => r !== null)
  const newContentScans = validScans.filter(
    (r) => r.hasNewContent && r.scrapedText.length >= MIN_SCRAPE_LENGTH
  )

  // Step 2: Extract learnings from new content
  let newLearnings: Learning[] = []
  if (newContentScans.length > 0) {
    const extracted = await extractLearnings(
      newContentScans.map((s) => ({
        sourceId: s.sourceId,
        url: s.url,
        text: s.scrapedText,
      })),
      siteContext
    )

    // Store learnings in the database
    for (const entry of extracted) {
      if (entry.learnings.length > 0) {
        await supabase.from("source_learnings").insert({
          site_id: site.id,
          source_id: entry.sourceId,
          learnings: entry.learnings,
        })
      }
      newLearnings.push(...entry.learnings)
    }
  }

  // Step 3: Load accumulated learnings (last 30 days)
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const { data: recentLearningRows } = await supabase
    .from("source_learnings")
    .select("learnings")
    .eq("site_id", site.id)
    .gte("created_at", thirtyDaysAgo.toISOString())
    .order("created_at", { ascending: false })

  const allRecentLearnings: Learning[] = (recentLearningRows || []).flatMap(
    (row) => row.learnings as Learning[]
  )

  // Step 4: Skip check — no new content AND no recent learnings
  if (newContentScans.length === 0 && allRecentLearnings.length === 0) {
    return {
      status: "skipped",
      scanned: validScans.length,
      newContentFound: 0,
      learningsExtracted: 0,
      ideasGenerated: 0,
      postsWritten: [],
      remainingIdeas: [],
      writtenIdeas: [],
    }
  }

  // Step 5: Load existing titles to avoid duplicates
  const ninetyDaysAgo = new Date()
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

  const [existingPosts, existingIdeas] = await Promise.all([
    supabase
      .from("posts")
      .select("title")
      .eq("site_id", site.id)
      .gte("generated_at", ninetyDaysAgo.toISOString()),
    supabase
      .from("post_ideas")
      .select("title")
      .eq("site_id", site.id)
      .eq("status", "active")
      .gte("expires_at", new Date().toISOString()),
  ])

  const existingTitles = [
    ...(existingPosts.data || []).map((p) => p.title),
    ...(existingIdeas.data || []).map((i) => i.title),
  ]

  // Step 6: Ideate ~20 article ideas
  const ideas = await ideateArticles(allRecentLearnings, siteContext, existingTitles, 20)

  if (ideas.length === 0) {
    return {
      status: "completed",
      scanned: validScans.length,
      newContentFound: newContentScans.length,
      learningsExtracted: newLearnings.length,
      ideasGenerated: 0,
      postsWritten: [],
      remainingIdeas: [],
      writtenIdeas: [],
    }
  }

  // Step 7: If skipWriting, return all ideas without writing posts
  if (options?.skipWriting) {
    return {
      status: "completed",
      scanned: validScans.length,
      newContentFound: newContentScans.length,
      learningsExtracted: newLearnings.length,
      ideasGenerated: ideas.length,
      postsWritten: [],
      remainingIdeas: ideas,
      writtenIdeas: [],
    }
  }

  // Step 8: Write the top N posts (sequentially to avoid rate limits)
  const toWrite = ideas.slice(0, postsPerPeriod)
  const remaining = ideas.slice(postsPerPeriod)
  const writtenPosts: GeneratedPost[] = []
  const writtenIdeas: ArticleIdea[] = []

  for (const idea of toWrite) {
    // Find learnings relevant to this idea's key topics
    const relevant = allRecentLearnings.filter((l) =>
      idea.keyLearnings.some(
        (kl) => l.topic.toLowerCase().includes(kl.toLowerCase()) || kl.toLowerCase().includes(l.topic.toLowerCase())
      )
    )

    const post = await writeArticle(
      idea,
      relevant.length > 0 ? relevant : allRecentLearnings.slice(0, 5),
      siteContext
    )

    if (post) {
      writtenPosts.push(post)
      writtenIdeas.push(idea)
    }
  }

  return {
    status: "completed",
    scanned: validScans.length,
    newContentFound: newContentScans.length,
    learningsExtracted: newLearnings.length,
    ideasGenerated: ideas.length,
    postsWritten: writtenPosts,
    remainingIdeas: remaining,
    writtenIdeas: writtenIdeas,
  }
}
