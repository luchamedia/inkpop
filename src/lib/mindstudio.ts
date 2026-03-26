import { MindStudioAgent } from "@mindstudio-ai/agent"
import { type WritingPromptInputs, buildMetaPrompt } from "@/lib/writing-prompt"

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
    topicPrompt = `${siteContext.writingPrompt}

---

Write ONE blog post specifically about: "${userTopic}"

SOURCE CONTENT (use as background research):
${scrapedContent || "[No sources available]"}

---

Return a JSON object with these 4 fields:
- "title": Compelling, keyword-rich title (50-70 chars)
- "slug": URL-friendly slug (lowercase, hyphens)
- "body": Full blog post in HTML format (use h2, h3, p, ul, li, strong, em). Minimum 800 words.
- "meta_description": SEO meta description (140-155 chars)`
  } else {
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
- "body": Full blog post in HTML format (use h2, h3, p, ul, li, strong, em). Minimum 800 words.
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
  // If site has a custom writing prompt, use it as the system prompt
  if (ctx?.writingPrompt) {
    return `${ctx.writingPrompt}

---

SOURCE CONTENT (use this as research material for the blog posts):
${scrapedContent}

---

Generate 1-3 blog posts based on the source content above, following all guidelines in the system prompt.

Return a JSON object with a "posts" array. Each post must have:
- "title": Compelling, keyword-rich title (50-70 chars)
- "slug": URL-friendly slug (lowercase, hyphens, no special chars)
- "body": Full blog post in HTML format (use h2, h3, p, ul, li, strong, em tags). Minimum 800 words.
- "meta_description": SEO meta description (140-155 chars)`
  }

  // Fallback: generic prompt for sites without a custom writing prompt
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
- "body": Full blog post in HTML format (use <h2>, <h3>, <p>, <ul>, <li>, <strong>, <em> tags). Minimum 800 words.
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
