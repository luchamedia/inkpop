import { createServiceClient } from "@/lib/supabase/server"
import { suggestSources } from "./onboarding"
import { fetchUrlMetadata } from "@/lib/url-utils"
import type { SiteContext, SuggestedSourceRow } from "./types"

interface SiteRow {
  id: string
  topic: string | null
  description: string | null
  category: string | null
  topic_context: Record<string, unknown> | null
}

function buildSiteContext(site: SiteRow): SiteContext {
  const ctx: SiteContext = {}
  if (site.topic) ctx.topic = site.topic
  if (site.description) ctx.description = site.description
  if (site.topic_context && Array.isArray(site.topic_context)) {
    ctx.topicContext = site.topic_context as Array<{ question: string; answer: string }>
  }
  return ctx
}

/**
 * Generate source suggestions and persist them to the database.
 * Used by both site creation (fire-and-forget) and the refresh button.
 */
export async function generateAndPersistSuggestions(
  siteId: string,
  site: SiteRow
): Promise<SuggestedSourceRow[]> {
  const supabase = createServiceClient()

  // Get existing source URLs and active suggestion URLs to exclude
  const [{ data: sources }, { data: existingSuggestions }] = await Promise.all([
    supabase.from("sources").select("url").eq("site_id", siteId),
    supabase
      .from("source_suggestions")
      .select("url")
      .eq("site_id", siteId)
      .in("status", ["active", "accepted"])
      .gt("expires_at", new Date().toISOString()),
  ])

  const existingUrls = [
    ...(sources || []).map((s) => s.url),
    ...(existingSuggestions || []).map((s) => s.url),
  ]

  const siteContext = buildSiteContext(site)
  const keywords = site.topic || ""

  const suggestions = await suggestSources(keywords, existingUrls, 1, siteContext)

  if (suggestions.length === 0) return []

  // Fetch metadata for all suggestions in parallel
  const metadataResults = await Promise.all(
    suggestions.map((s) =>
      fetchUrlMetadata(s.url).catch(() => ({
        meta_title: null,
        meta_description: null,
        favicon_url: null,
        og_image_url: null,
      }))
    )
  )

  // Insert into database with 14-day expiry
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 14)

  const rows = suggestions.map((s, i) => ({
    site_id: siteId,
    type: s.type,
    url: s.url,
    label: s.label,
    reason: s.reason,
    status: "active" as const,
    meta_title: metadataResults[i].meta_title,
    meta_description: metadataResults[i].meta_description,
    favicon_url: metadataResults[i].favicon_url,
    og_image_url: metadataResults[i].og_image_url,
    expires_at: expiresAt.toISOString(),
  }))

  const { data: inserted, error } = await supabase
    .from("source_suggestions")
    .insert(rows)
    .select()

  if (error) {
    console.error("Failed to persist suggestions:", error)
    return []
  }

  return (inserted || []) as SuggestedSourceRow[]
}
