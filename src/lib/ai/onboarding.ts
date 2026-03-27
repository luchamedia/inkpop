import { agent, domainOf, extractScrapedText, MAX_VALIDATION_SCRAPE, SCRAPE_OPTIONS } from "./agent"
import type { SuggestedSource, TopicBrief, CompanyScanResult, SearchResult } from "./types"

const PAGE_QUERY_SUFFIXES = [
  "",
  "resources guides",
  "experts creators",
  "news updates",
]

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
        .scrapeUrl({ url: s.url, pageOptions: SCRAPE_OPTIONS })
        .catch(() => null)
    )
  )

  const scrapedSummaries = toValidate.map((s, i) => {
    const result = scrapeResults[i]
    if (!result) return `URL: ${s.url}\nContent: [could not scrape]`
    const text = extractScrapedText(result)
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
