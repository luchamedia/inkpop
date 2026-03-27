export interface SuggestedSource {
  type: "youtube" | "blog" | "webpage"
  url: string
  label: string
  reason: string
  confidence: "high" | "low"
}

export interface SearchResult {
  title: string
  description: string
  url: string
}

export interface TopicBrief {
  description: string
  audience: string
  contentGoals: string
}

export interface CompanyScanResult {
  companyName: string
  description: string
  audience: string
  suggestedTopic: string
  keywords: string[]
}

export interface SiteContext {
  topic?: string
  description?: string
  topicContext?: Array<{ question: string; answer: string }>
  writingPrompt?: string
}

export interface GeneratedPost {
  title: string
  slug: string
  body: string
  meta_description: string
}

export interface Learning {
  topic: string
  insight: string
  relevance: "high" | "medium" | "low"
}

export interface ArticleIdea {
  title: string
  angle: string
  keyLearnings: string[]
  description?: string
  keywords?: string[]
  slug?: string
}

export interface ScanResult {
  sourceId: string
  url: string
  hasNewContent: boolean
  scrapedText: string
  contentHash: string
}

export interface WorkflowResult {
  status: "completed" | "skipped" | "failed"
  scanned: number
  newContentFound: number
  learningsExtracted: number
  ideasGenerated: number
  postsWritten: GeneratedPost[]
  /** Ideas that were NOT written (to be stored in post_ideas) */
  remainingIdeas: ArticleIdea[]
  /** Ideas that WERE written (to link posts to ideas) */
  writtenIdeas: ArticleIdea[]
  error?: string
}

export interface WorkflowOptions {
  /** Skip writeArticle step — return all ideas as remainingIdeas, postsWritten empty. */
  skipWriting?: boolean
}

export interface RssFeedItem {
  title: string
  link: string
  description: string
  pubDate: string | null
}
