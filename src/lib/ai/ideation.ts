import { agent, MAX_LEARNING_SCRAPE } from "./agent"
import type { SiteContext, Learning, ArticleIdea } from "./types"

/**
 * Extract key learnings from newly scraped content.
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
 * Generate ~20 article ideas based on accumulated learnings.
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
