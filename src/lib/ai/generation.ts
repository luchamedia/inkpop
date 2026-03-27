import { agent, extractScrapedText, MAX_CONTENT_LENGTH, SCRAPE_OPTIONS } from "./agent"
import { buildMetaPrompt } from "@/lib/writing-prompt"
import type { WritingPromptInputs } from "@/lib/writing-prompt"
import type { SiteContext, GeneratedPost, ArticleIdea, Learning, SearchResult } from "./types"

export const STATIC_PREAMBLE = `You are an expert AI blog writer. Follow these rules for EVERY post:

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

export async function generatePostForTopic(
  userTopic: string,
  sources: { type: string; url: string }[],
  siteContext?: SiteContext
): Promise<GeneratedPost | null> {
  const scrapeResults = await Promise.all(
    sources.slice(0, 5).map((source) =>
      agent
        .scrapeUrl({ url: source.url, pageOptions: SCRAPE_OPTIONS })
        .catch(() => null)
    )
  )

  const scrapedContent = scrapeResults
    .map((result) => {
      if (!result) return ""
      return extractScrapedText(result).slice(0, 6000)
    })
    .filter(Boolean)
    .join("\n\n---\n\n")

  let topicPrompt: string

  if (siteContext?.writingPrompt) {
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

export async function generatePosts(
  sources: { type: string; url: string }[],
  siteContext?: SiteContext
): Promise<GeneratedPost[]> {
  const scrapeResults = await Promise.all(
    sources.map((source) =>
      agent
        .scrapeUrl({ url: source.url, pageOptions: SCRAPE_OPTIONS })
        .catch((err) => {
          console.error(`Failed to scrape ${source.url}:`, err)
          return null
        })
    )
  )

  const scrapedContent = scrapeResults
    .map((result, i) => {
      if (!result) return `--- Source: ${sources[i].url} ---\n[Failed to scrape]`
      const text = extractScrapedText(result)
      const truncated = text.slice(0, MAX_CONTENT_LENGTH)
      return `--- Source: ${sources[i].url} ---\n${truncated}`
    })
    .join("\n\n")

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

export async function generateWritingPrompt(
  inputs: WritingPromptInputs
): Promise<string> {
  const { content } = await agent.generateText({
    message: buildMetaPrompt(inputs),
  })

  return content
}

/**
 * Write a full blog post from an article idea, with web search for current facts.
 */
export async function writeArticle(
  idea: ArticleIdea,
  relevantLearnings: Learning[],
  siteContext: SiteContext
): Promise<GeneratedPost | null> {
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
    if (idea.slug) post.slug = idea.slug
    if (idea.description) post.meta_description = idea.description
    return post
  } catch {
    console.error("Failed to parse written article:", content)
    return null
  }
}
