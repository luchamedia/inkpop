import { MindStudioAgent } from "@mindstudio-ai/agent"

export const agent = new MindStudioAgent()

// --- Shared constants ---

export const SCRAPE_OPTIONS = {
  onlyMainContent: true,
  screenshot: false,
  waitFor: 0,
  replaceAllPathsWithAbsolutePaths: false,
  headers: {},
  removeTags: ["nav", "footer", "aside"] as string[],
  mobile: false,
}

export const MAX_CONTENT_LENGTH = 12000
export const MAX_LEARNING_SCRAPE = 6000
export const MAX_VALIDATION_SCRAPE = 4000
export const MIN_SCRAPE_LENGTH = 200

// --- Shared helpers ---

/**
 * Extract text from a MindStudio scrape result, handling all possible shapes.
 * This pattern was previously duplicated 6+ times across the codebase.
 */
export function extractScrapedText(result: { content?: unknown } | null | undefined): string {
  if (!result) return ""
  const content = result.content
  if (typeof content === "string") return content
  if (Array.isArray(content)) return content.join("\n")
  if (content && typeof content === "object" && "text" in content) {
    return (content as { text: string }).text || ""
  }
  return ""
}

export function domainOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return null
  }
}
