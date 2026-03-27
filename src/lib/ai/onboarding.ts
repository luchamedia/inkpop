import { agent, domainOf, extractScrapedText, SCRAPE_OPTIONS } from "./agent"
import type { SuggestedSource, SiteContext, TopicBrief, CompanyScanResult, SearchResult } from "./types"

// Domains that are never good scraping targets for blog generation
const BLOCKED_DOMAINS = new Set([
  "facebook.com", "twitter.com", "x.com", "instagram.com",
  "linkedin.com", "tiktok.com", "pinterest.com", "reddit.com",
  "amazon.com", "wikipedia.org", "threads.net", "quora.com",
])

// Fallback search templates when no site context is available
const FALLBACK_STRATEGIES: Array<{
  google: (q: string) => string
  perplexity: (q: string) => string
  googleNews: (q: string) => string
}> = [
  {
    google: (q) => `${q} blog OR youtube channel OR newsletter`,
    perplexity: (q) => `best ${q} blogs, youtube channels, newsletters, and expert resources to follow in 2026`,
    googleNews: (q) => `${q} industry blog OR publication OR podcast`,
  },
  {
    google: (q) => `${q} resources guides tutorials experts`,
    perplexity: (q) => `top ${q} content creators, thought leaders, and educational resources`,
    googleNews: (q) => `${q} expert commentary OR analysis site`,
  },
  {
    google: (q) => `${q} news updates trends community`,
    perplexity: (q) => `${q} news sites, community blogs, and trend publications worth following`,
    googleNews: (q) => `${q} newsletter OR substack OR medium publication`,
  },
  {
    google: (q) => `${q} podcast OR video series OR course site`,
    perplexity: (q) => `${q} educational content, podcasts, video series, and niche publications`,
    googleNews: (q) => `${q} review site OR comparison OR roundup blog`,
  },
]

/**
 * Generate SEO/AEO-optimized search queries using site context.
 * Returns 6-8 queries designed to find the best content sources.
 */
async function generateSearchQueries(
  keywords: string,
  siteContext: SiteContext
): Promise<string[]> {
  const contextParts: string[] = [`Topic: ${keywords}`]
  if (siteContext.description) contextParts.push(`Description: ${siteContext.description}`)
  if (siteContext.topicContext?.length) {
    const qa = siteContext.topicContext.map((q) => `Q: ${q.question}\nA: ${q.answer}`).join("\n")
    contextParts.push(`Additional context:\n${qa}`)
  }

  const { content } = await agent.generateText({
    message: `You are an SEO and AEO (Answer Engine Optimization) strategist. Generate 6-8 search queries to find the best content sources (blogs, YouTube channels, newsletters, podcasts, publications) for a blog about this topic.

BLOG CONTEXT:
${contextParts.join("\n")}

Generate search queries optimized to discover:
1. **SEO authority sources** — who ranks on page 1 for key terms in this niche?
2. **AEO citation sources** — who do AI assistants (ChatGPT, Perplexity, Google AI Overview) cite when answering questions about this topic?
3. **Content creators** — YouTube channels, podcasters, and newsletter authors in this niche
4. **Niche publications** — Substacks, Medium publications, industry blogs
5. **Long-tail variations** — specific sub-topics and angles within the main topic

Each query should be a real search engine query (not a description). Mix Google-style keyword queries with natural-language Perplexity-style questions.

Return a JSON object with a "queries" array of 6-8 strings.`,
    structuredOutputType: "json",
    structuredOutputExample: JSON.stringify({
      queries: [
        "sustainable packaging blog newsletter 2026",
        "best YouTube channels about eco-friendly ecommerce",
        "who are the leading experts in sustainable packaging",
        "green shipping practices industry publication",
        "sustainable packaging substack OR medium",
        "eco-friendly packaging podcast OR video series",
      ],
    }),
  })

  try {
    const parsed = JSON.parse(content)
    return Array.isArray(parsed.queries) ? parsed.queries.filter((q: unknown) => typeof q === "string" && q.length > 0) : []
  } catch {
    console.error("Failed to parse search queries:", content)
    return []
  }
}

export async function suggestSources(
  keywords: string,
  existingUrls: string[] = [],
  page: number = 1,
  siteContext?: SiteContext
): Promise<SuggestedSource[]> {
  // Determine search queries: AI-generated (if context available) or fallback templates
  let queries: string[]

  if (siteContext?.topic && (siteContext.description || siteContext.topicContext?.length)) {
    const aiQueries = await generateSearchQueries(keywords, siteContext)
    if (aiQueries.length >= 3) {
      // Pick 3 queries for this page, cycling through
      const offset = ((page - 1) * 3) % aiQueries.length
      queries = [
        aiQueries[offset % aiQueries.length],
        aiQueries[(offset + 1) % aiQueries.length],
        aiQueries[(offset + 2) % aiQueries.length],
      ]
    } else {
      // AI query generation failed or returned too few, use fallback
      const strategy = FALLBACK_STRATEGIES[(page - 1) % FALLBACK_STRATEGIES.length]
      queries = [strategy.google(keywords), strategy.perplexity(keywords), strategy.googleNews(keywords)]
    }
  } else {
    const strategy = FALLBACK_STRATEGIES[(page - 1) % FALLBACK_STRATEGIES.length]
    queries = [strategy.google(keywords), strategy.perplexity(keywords), strategy.googleNews(keywords)]
  }

  // Run 3 searches in parallel with the selected queries
  const [googleRes, perplexityRes, googleNewsRes] = await Promise.all([
    agent
      .searchGoogle({ query: queries[0], exportType: "json", numResults: 20 })
      .catch((err) => {
        console.error("Google search failed:", err)
        return { results: [] as SearchResult[] }
      }),
    agent
      .searchPerplexity({ query: queries[1], exportType: "json", numResults: 15 })
      .catch((err) => {
        console.error("Perplexity search failed:", err)
        return { results: [] as SearchResult[] }
      }),
    agent
      .searchGoogle({ query: queries[2], exportType: "json", numResults: 15 })
      .catch((err) => {
        console.error("Google news search failed:", err)
        return { results: [] as SearchResult[] }
      }),
  ])

  // Merge all results — deduplicate by full normalized URL (not just domain)
  const allResults = [
    ...(googleRes.results || []),
    ...(perplexityRes.results || []),
    ...(googleNewsRes.results || []),
  ]
  const existingDomains = new Set(existingUrls.map(domainOf).filter(Boolean))
  const seenUrls = new Set<string>()
  const domainCounts = new Map<string, number>()
  const deduped: SearchResult[] = []

  for (const result of allResults) {
    if (!result.url) continue
    const domain = domainOf(result.url)
    if (!domain || existingDomains.has(domain)) continue
    if (BLOCKED_DOMAINS.has(domain)) continue

    const normalizedUrl = result.url.replace(/\/+$/, "").toLowerCase()
    if (seenUrls.has(normalizedUrl)) continue
    seenUrls.add(normalizedUrl)

    // Allow up to 2 URLs per domain
    const count = domainCounts.get(domain) || 0
    if (count >= 2) continue
    domainCounts.set(domain, count + 1)

    deduped.push(result)
  }

  if (deduped.length === 0) return []

  // AI ranking — pick the best 10-15 and classify
  const formattedResults = deduped
    .map((r, i) => `${i + 1}. [${r.title}](${r.url})\n   ${r.description || "No description"}`)
    .join("\n")

  const { content: rankingContent } = await agent.generateText({
    message: `You are a content source curator. Given the following search results for the topic "${keywords}", select the 10-15 best sources for an AI blog generation tool to scrape regularly.

Be GENEROUS — include any source that could provide useful content. More is better. Only exclude sources that are clearly irrelevant to the topic.

Prioritize:
- Active blogs and YouTube channels that publish regularly
- Authoritative sources in the niche
- Diverse perspectives (mix of big and small publishers)
- Newsletters, Substacks, and niche publications
- Educational content (courses, tutorials, guides)

Classify each source:
- "youtube" — if the URL is a YouTube channel, playlist, or video
- "blog" — if it's a blog, RSS feed, newsletter, or publication
- "webpage" — for other web resources (product pages, documentation, wikis)

For each source provide:
- "type": the classification above
- "url": the exact URL from the search results
- "label": a short human-readable name (e.g. "Minimalist Baker - Vegan Recipes")
- "reason": one sentence explaining why this source is valuable

Exclude these URLs (already added): ${existingUrls.join(", ") || "none"}

SEARCH RESULTS:
${formattedResults}

Return a JSON object with a "suggestions" array. Include 10-15 sources.`,
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

  return ranked.map((s) => ({
    type: (s.type === "youtube" || s.type === "blog" || s.type === "webpage"
      ? s.type
      : "webpage") as SuggestedSource["type"],
    url: s.url,
    label: s.label,
    reason: s.reason,
    confidence: "high" as const,
  }))
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

export async function scanCompanyWebsite(
  url: string
): Promise<CompanyScanResult> {
  const scrapeResult = await agent.scrapeUrl({
    url,
    pageOptions: SCRAPE_OPTIONS,
  })

  const text = extractScrapedText(scrapeResult)
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
