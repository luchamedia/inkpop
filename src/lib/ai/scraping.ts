import { createHash } from "crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { agent, extractScrapedText, SCRAPE_OPTIONS, MAX_LEARNING_SCRAPE, MIN_SCRAPE_LENGTH } from "./agent"
import type { ScanResult, RssFeedItem } from "./types"

export { MIN_SCRAPE_LENGTH }

function isYoutubeUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "")
    return host === "youtube.com" || host === "youtu.be" || host === "m.youtube.com"
  } catch {
    return false
  }
}

async function fetchYoutubeContent(url: string): Promise<string> {
  let videoUrls: string[] = []
  try {
    const { channel } = await agent.fetchYoutubeChannel({ channelUrl: url })
    const channelData = channel as Record<string, unknown>
    const videos = (channelData.videos || channelData.recentVideos || []) as Array<Record<string, string>>
    videoUrls = videos
      .slice(0, 5)
      .map((v) => v.url || v.videoUrl || v.link || "")
      .filter(Boolean)
  } catch {
    videoUrls = [url]
  }

  if (videoUrls.length === 0) {
    videoUrls = [url]
  }

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

function extractTag(xml: string, tag: string): string {
  const cdataMatch = xml.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`, "i"))
  if (cdataMatch) return cdataMatch[1].trim()
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"))
  return match ? match[1].trim() : ""
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
}

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

  const isRss = xml.includes("<rss") || xml.includes("<channel>")
  const isAtom = xml.includes("<feed") && xml.includes("xmlns=\"http://www.w3.org/2005/Atom\"")
  if (!isRss && !isAtom) return null

  const items: RssFeedItem[] = []

  if (isRss) {
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

async function fetchRssContent(url: string, lookbackHours: number = 48): Promise<string | null> {
  const feedItems = await fetchRssFeed(url)
  if (!feedItems) return null

  const cutoff = new Date(Date.now() - lookbackHours * 60 * 60 * 1000)
  const recentItems = feedItems.filter((item) => {
    if (!item.pubDate) return true
    try {
      return new Date(item.pubDate) >= cutoff
    } catch {
      return true
    }
  }).slice(0, 10)

  if (recentItems.length === 0) return null

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
        fullText = extractScrapedText(result.value).slice(0, MAX_LEARNING_SCRAPE)
      }
    }

    return `--- Item: ${item.title} ---\n${item.pubDate ? `Published: ${item.pubDate}\n` : ""}${item.description ? `Summary: ${item.description}\n` : ""}${fullText ? `Full content: ${fullText}` : ""}`
  })

  return sections.join("\n\n")
}

/**
 * Scrape a source and compare content hash to detect new content.
 * Branches by source type: YouTube sources use transcript extraction,
 * blog sources try RSS feed parsing first, all others use web scraping.
 */
export async function scanSourceForChanges(
  source: { id: string; type: string; url: string },
  supabase: SupabaseClient
): Promise<ScanResult> {
  let text: string

  if (source.type === "youtube" || isYoutubeUrl(source.url)) {
    text = await fetchYoutubeContent(source.url)
  } else if (source.type === "blog") {
    const rssContent = await fetchRssContent(source.url)
    if (rssContent) {
      text = rssContent
    } else {
      const scrapeResult = await agent.scrapeUrl({
        url: source.url,
        pageOptions: SCRAPE_OPTIONS,
      })
      text = extractScrapedText(scrapeResult)
    }
  } else {
    const scrapeResult = await agent.scrapeUrl({
      url: source.url,
      pageOptions: SCRAPE_OPTIONS,
    })
    text = extractScrapedText(scrapeResult)
  }

  const contentHash = createHash("sha256").update(text).digest("hex")

  const { data: currentSource } = await supabase
    .from("sources")
    .select("last_content_hash")
    .eq("id", source.id)
    .single()

  const hasNewContent = !currentSource || currentSource.last_content_hash !== contentHash

  await supabase
    .from("sources")
    .update({
      last_content_hash: contentHash,
      last_scraped_at: new Date().toISOString(),
    })
    .eq("id", source.id)

  return {
    sourceId: source.id,
    url: source.url,
    hasNewContent,
    scrapedText: text,
    contentHash,
  }
}
