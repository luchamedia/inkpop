import type { SupabaseClient } from "@supabase/supabase-js"
import { MIN_SCRAPE_LENGTH } from "./scraping"
import { scanSourceForChanges } from "./scraping"
import { extractLearnings } from "./ideation"
import { ideateArticles } from "./ideation"
import { writeArticle } from "./generation"
import type {
  SiteContext,
  Learning,
  ScanResult,
  GeneratedPost,
  ArticleIdea,
  WorkflowResult,
  WorkflowOptions,
} from "./types"

/**
 * Orchestrate the full generation workflow for a site:
 * scan sources → extract learnings → ideate articles → write top N posts.
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
