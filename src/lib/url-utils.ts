/**
 * URL utilities for source management: validation, normalization,
 * type detection, and metadata fetching.
 */

export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === "http:" || parsed.protocol === "https:"
  } catch {
    return false
  }
}

export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url)
    const hostname = parsed.hostname.replace(/^www\./, "").toLowerCase()
    const pathname = parsed.pathname.replace(/\/+$/, "")
    return `${hostname}${pathname}`
  } catch {
    return url.toLowerCase()
  }
}

export function detectSourceType(url: string): "youtube" | "blog" | "webpage" {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase()
    if (
      host === "youtube.com" ||
      host === "youtu.be" ||
      host === "m.youtube.com"
    ) {
      return "youtube"
    }
    // Known blog/RSS platforms
    if (
      host.includes("medium.com") ||
      host.includes("substack.com") ||
      host.includes("wordpress.com") ||
      host.includes("blogspot.com") ||
      host.includes("ghost.io") ||
      host.includes("hashnode.dev") ||
      host.includes("dev.to")
    ) {
      return "blog"
    }
    return "webpage"
  } catch {
    return "webpage"
  }
}

export interface UrlMetadata {
  meta_title: string | null
  meta_description: string | null
  favicon_url: string | null
  og_image_url: string | null
}

export async function fetchUrlMetadata(url: string): Promise<UrlMetadata> {
  const empty: UrlMetadata = {
    meta_title: null,
    meta_description: null,
    favicon_url: null,
    og_image_url: null,
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; InkpopBot/1.0; +https://inkpop.net)",
        Accept: "text/html",
      },
      redirect: "follow",
    })
    clearTimeout(timeout)

    if (!res.ok) return empty

    // Only read the first ~50KB to find <head> content
    const reader = res.body?.getReader()
    if (!reader) return empty

    let html = ""
    const decoder = new TextDecoder()
    while (html.length < 50000) {
      const { done, value } = await reader.read()
      if (done) break
      html += decoder.decode(value, { stream: true })
      // Stop once we've passed </head>
      if (html.includes("</head>")) break
    }
    reader.cancel()

    const origin = new URL(url).origin

    // Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i)
    const meta_title = titleMatch
      ? decodeHtmlEntities(titleMatch[1].trim()).slice(0, 200)
      : null

    // Extract meta description
    const descMatch = html.match(
      /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i
    ) || html.match(
      /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i
    )
    const meta_description = descMatch
      ? decodeHtmlEntities(descMatch[1].trim()).slice(0, 500)
      : null

    // Extract favicon
    const iconMatch = html.match(
      /<link[^>]+rel=["'](?:icon|shortcut icon)["'][^>]+href=["']([^"']*)["']/i
    ) || html.match(
      /<link[^>]+href=["']([^"']*)["'][^>]+rel=["'](?:icon|shortcut icon)["']/i
    )
    let favicon_url: string | null = null
    if (iconMatch) {
      const href = iconMatch[1]
      favicon_url = href.startsWith("http")
        ? href
        : href.startsWith("//")
          ? `https:${href}`
          : `${origin}${href.startsWith("/") ? "" : "/"}${href}`
    } else {
      // Fallback to /favicon.ico
      favicon_url = `${origin}/favicon.ico`
    }

    // Extract og:image
    const ogImageMatch = html.match(
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']*)["']/i
    ) || html.match(
      /<meta[^>]+content=["']([^"']*)["'][^>]+property=["']og:image["']/i
    )
    let og_image_url: string | null = null
    if (ogImageMatch) {
      const href = ogImageMatch[1]
      og_image_url = href.startsWith("http")
        ? href
        : href.startsWith("//")
          ? `https:${href}`
          : `${origin}${href.startsWith("/") ? "" : "/"}${href}`
    }

    return { meta_title, meta_description, favicon_url, og_image_url }
  } catch {
    return empty
  }
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(Number(num)))
}
