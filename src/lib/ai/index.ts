// Barrel export — all AI module functionality re-exported from a single entry point.
// Consumers can import from "@/lib/ai" or continue using "@/lib/mindstudio" (shim).

export type {
  SuggestedSource,
  SuggestedSourceRow,
  SearchResult,
  TopicBrief,
  CompanyScanResult,
  SiteContext,
  GeneratedPost,
  Learning,
  ArticleIdea,
  ScanResult,
  WorkflowResult,
  WorkflowOptions,
  RssFeedItem,
} from "./types"

export {
  suggestSources,
  generateTopicBrief,
  refineTopicBrief,
  scanCompanyWebsite,
  suggestSiteNames,
} from "./onboarding"

export {
  scanSourceForChanges,
} from "./scraping"

export {
  generatePostForTopic,
  generatePosts,
  generateWritingPrompt,
  writeArticle,
  STATIC_PREAMBLE,
} from "./generation"

export {
  extractLearnings,
  ideateArticles,
} from "./ideation"

export {
  runGenerationWorkflow,
} from "./workflow"

export {
  generateAndPersistSuggestions,
} from "./suggestions"
