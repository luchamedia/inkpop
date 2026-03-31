# AI Content Generation

Located in `src/lib/mindstudio.ts`. Uses the `@mindstudio-ai/agent` SDK directly (no remote agent, no polling).

## Generation Workflow v2 (daily cron)

1. `scanSourceForChanges(source, supabase)` — branches by source type: YouTube sources fetch channel videos + transcripts via `fetchYoutubeChannel`/`fetchYoutubeCaptions`, blog sources try RSS/Atom feed parsing first (with 48h lookback) then fall back to scraping, webpage sources use standard `scrapeUrl`. SHA-256 hashes content, compares to `sources.last_content_hash` to detect new content
2. `extractLearnings(scrapedContent[], siteContext)` — extracts 3-8 key learnings per source (facts, trends, techniques) as structured JSON
3. `ideateArticles(learnings, siteContext, existingTitles, count=20)` — generates ~20 article ideas based on accumulated learnings (last 30 days), avoiding duplicate topics
4. `writeArticle(idea, learnings, siteContext)` — writes a full blog post from an idea, with Google web search for current facts
5. `runGenerationWorkflow(site, supabase)` — orchestrates the full pipeline: scan → extract → ideate → write top N → return remaining ideas
6. Ideas are stored in `post_ideas` with a 2-week shelf life. Users can generate posts from ideas on demand.

## Legacy Functions (still used for manual generation)

- `generatePosts(sources, siteContext?)` — scrape all → generate → return `GeneratedPost[]`
- `generatePostForTopic(topic, sources, siteContext?)` — generates a single post on a specific topic
- `suggestSources(keywords, existingUrls, page, siteContext?)` — AI-powered source discovery: generates SEO/AEO-optimized search queries from site context → 3 parallel searches (Google+Perplexity) → dedup → AI ranking → returns `SuggestedSource[]`
