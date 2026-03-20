import { MindStudioAgent } from "@mindstudio-ai/agent"

const agent = new MindStudioAgent()

export interface GeneratedPost {
  title: string
  slug: string
  body: string
  meta_description: string
}

const MAX_CONTENT_LENGTH = 12000 // ~3000 words, avoid token limits

export async function generatePosts(
  sources: { type: string; url: string }[]
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
    message: buildPrompt(scrapedContent),
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

function buildPrompt(scrapedContent: string): string {
  return `You are an expert SEO blog writer. Based on the following source content, generate 1-3 unique, high-quality blog posts optimized for search engines.

Each post must have:
- "title": A compelling, keyword-rich title (50-70 chars)
- "slug": URL-friendly slug derived from the title (lowercase, hyphens, no special chars)
- "body": Full blog post in HTML format (use <h2>, <h3>, <p>, <ul>, <li>, <strong>, <em> tags). Minimum 800 words.
- "meta_description": SEO meta description (140-155 chars)

Return a JSON object with a "posts" array.

SOURCE CONTENT:
${scrapedContent}`
}
