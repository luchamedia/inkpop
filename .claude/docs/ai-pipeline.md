# AI Pipeline Reference

Complete operations manual for inkpop's AI content generation system. Use this to find, understand, and edit any prompt or pipeline component.

---

## Table of Contents

1. [Pipeline Overview](#1-pipeline-overview)
2. [Prompt Catalog](#2-prompt-catalog)
3. [Data Flow](#3-data-flow)
4. [Scheduling & Queue](#4-scheduling--queue)
5. [Credit System](#5-credit-system)

---

## 1. Pipeline Overview

inkpop has **3 distinct AI pipelines** that share underlying components:

### Pipeline A: Scheduled Generation (daily cron)

```
Vercel Cron (6 AM UTC daily)
    │
    ▼
┌─────────────────────────────────┐
│  /api/cron/daily-run            │
│  For each eligible site:        │
│    1. Scan sources for changes  │──▶ scraping.ts
│    2. Extract learnings         │──▶ ideation.ts (extractLearnings)
│    3. Ideate 20 articles        │──▶ ideation.ts (ideateArticles)
│    4. Queue top N for writing   │──▶ generation_queue table
│    5. Store rest as ideas       │──▶ post_ideas table
└───────────┬─────────────────────┘
            │ fire-and-forget
            ▼
┌─────────────────────────────────┐
│  /api/queue/process             │
│  For each queued job:           │
│    1. Claim job atomically      │──▶ RPC claim_next_queue_job
│    2. Write full article        │──▶ generation.ts (writeArticle)
│    3. Insert post in DB         │──▶ posts table
│    4. Self-chain to next job    │
└─────────────────────────────────┘
```

### Pipeline B: Manual Generation (user-triggered)

```
User clicks "Generate" button
    │
    ▼
┌─────────────────────────────────┐
│  /api/agent/run                 │
│  OR /api/ai/generate-post-for-topic
│    1. Scrape source URLs        │──▶ agent.scrapeUrl()
│    2. Generate 1-3 posts        │──▶ generation.ts (generatePosts or generatePostForTopic)
│    3. Insert posts, deduct $    │──▶ posts table + credits
└─────────────────────────────────┘
```

### Pipeline C: Interactive AI (user-triggered, real-time)

```
Onboarding wizard / Dashboard
    │
    ├──▶ /api/ai/topic-questions      ──▶ onboarding.ts (generateTopicBrief / refineTopicBrief)
    ├──▶ /api/ai/scan-company          ──▶ onboarding.ts (scanCompanyWebsite)
    ├──▶ /api/ai/suggest-names         ──▶ onboarding.ts (suggestSiteNames)
    ├──▶ /api/ai/suggest-sources       ──▶ onboarding.ts (suggestSources)
    ├──▶ /api/ai/generate-writing-prompt ──▶ generation.ts (generateWritingPrompt)
    ├──▶ /api/ai/generate-initial-prompt ──▶ direct agent.generateText() in route
    └──▶ /api/ai/context-chat          ──▶ direct agent.generateText() in route
```

### Shared Components

All pipelines use the same `MindStudioAgent` instance from `src/lib/ai/agent.ts`:

| SDK Method | Used By | Purpose |
|------------|---------|---------|
| `agent.generateText()` | All prompts | LLM text/JSON generation |
| `agent.scrapeUrl()` | scraping.ts, generation.ts, context-chat | Extract web page content |
| `agent.searchGoogle()` | generation.ts, onboarding.ts | Google search results |
| `agent.searchPerplexity()` | onboarding.ts | Perplexity search results |
| `agent.fetchYoutubeChannel()` | scraping.ts | YouTube channel video list |
| `agent.fetchYoutubeVideo()` | scraping.ts | YouTube video metadata |
| `agent.fetchYoutubeCaptions()` | scraping.ts | Video transcripts |
| `agent.httpRequest()` | scraping.ts | Raw HTTP (for RSS feeds) |

---

## 2. Prompt Catalog

Every AI prompt in the system, with exact text and editing guidance.

---

### 2.1 STATIC_PREAMBLE — Shared Writing Rules

**File:** `src/lib/ai/generation.ts:6-30`
**Used by:** `generatePostForTopic()`, `generatePosts()`, `writeArticle()` (when site has a `writingPrompt`)
**Purpose:** Base rules prepended to every post-generation prompt

<details>
<summary>Full prompt text</summary>

```
You are an expert AI blog writer. Follow these rules for EVERY post:

## Role & Output Rules
- You write blog posts for the site described in the context below.
- Output MUST start with an H2 tag. Never use H1 — the CMS adds the title as H1.
- No preamble, no "In this article we'll explore…", no closing meta-commentary.
- No raw URLs inline — use anchor tags for any links.
- Do not include scraped navigation, bylines, or boilerplate from sources.

## Content Guidelines
- Target 2,500–5,000 words depending on topic depth.
- Structure: H2 for main sections, H3 for subsections, short paragraphs (2-4 sentences).
- Include a FAQ/AEO section at the end with 4–6 common questions and concise answers.
- Use bullet lists and numbered lists for scannable content.

## SEO & Linking
- Place the primary keyword in the first 100 words and in at least one H2.
- Use semantic keyword variations throughout — don't repeat the exact phrase unnaturally.

## Self-Check (run before output)
- [ ] Starts with H2, no H1 present
- [ ] Primary keyword in first 100 words and at least one H2
- [ ] FAQ section with 4-6 questions
- [ ] Minimum 2,500 words (target 2,500–5,000)
- [ ] No AI-giveaway phrases ("dive into", "game-changing", "in today's rapidly evolving landscape")
```

</details>

**Inputs:** None (static text)
**Editing tips:**
- This is the foundation for ALL generated posts. Changes here affect every article.
- Add/remove banned phrases in the Self-Check section.
- Adjust word count targets in Content Guidelines.
- The FAQ/AEO section count (4-6) can be changed here.

---

### 2.2 generatePosts() — Multi-Post Generation

**File:** `src/lib/ai/generation.ts:32-84` (the `buildPrompt` function)
**Called by:** `/api/agent/run`
**Purpose:** Generate 1-3 blog posts from scraped source content

**There are two prompt paths:**

**Path A — When site has a `writingPrompt` (lines 33-57):**
```
{STATIC_PREAMBLE}

---
SITE-SPECIFIC INSTRUCTIONS:
---

{site.writingPrompt}

---
SOURCE CONTENT (use this as research material for the blog posts):
---

{scrapedContent}

---

Generate 1-3 blog posts based on the source content above, following all guidelines.

Return a JSON object with a "posts" array. Each post must have:
- "title": Compelling, keyword-rich title (50-70 chars)
- "slug": URL-friendly slug (lowercase, hyphens, no special chars)
- "body": Full blog post in HTML format (use h2, h3, p, ul, li, strong, em tags). Minimum 2,500 words.
- "meta_description": SEO meta description (140-155 chars)
```

**Path B — When no writingPrompt (lines 59-84):**
```
SITE CONTEXT:
Topic: {site.topic}
Description: {site.description}
Background:
Q: {question}
A: {answer}
...

Use this context to ensure all posts are relevant to the site's topic and audience.

You are an expert SEO blog writer. Based on the following source content, generate 1-3 unique, high-quality blog posts optimized for search engines.

[same JSON output format]

SOURCE CONTENT:
{scrapedContent}
```

**Inputs:**
- `scrapedContent` — Concatenated text from all sources (each truncated to 12,000 chars)
- `siteContext.writingPrompt` — Custom writing instructions (if set)
- `siteContext.topic`, `.description`, `.topicContext` — Site metadata

**Output:** JSON `{ posts: [{ title, slug, body, meta_description }] }`

**Editing tips:**
- Path A is the "production" path for sites that completed onboarding. Edit `STATIC_PREAMBLE` for formatting rules and the `writingPrompt` (per-site, stored in DB) for content direction.
- Path B is the fallback for sites without a writing prompt. Less polished output.
- The "1-3 posts" instruction means the AI decides how many. To force a specific count, change to "Generate exactly N blog posts."

---

### 2.3 generatePostForTopic() — Single Topic Post

**File:** `src/lib/ai/generation.ts:86-174`
**Called by:** `/api/ai/generate-post-for-topic`, `/api/queue/process` (topic jobs)
**Purpose:** Generate exactly 1 blog post on a user-specified topic

**Path A — With writingPrompt (lines 109-131):**
```
{STATIC_PREAMBLE}

---
SITE-SPECIFIC INSTRUCTIONS:
---

{siteContext.writingPrompt}

---

Write ONE blog post specifically about: "{userTopic}"

SOURCE CONTENT (use as background research):
{scrapedContent}

---

Return a JSON object with these 4 fields:
- "title": Compelling, keyword-rich title (50-70 chars)
- "slug": URL-friendly slug (lowercase, hyphens)
- "body": Full blog post in HTML format. Minimum 2,500 words.
- "meta_description": SEO meta description (140-155 chars)
```

**Path B — Without writingPrompt (lines 132-154):** Same structure but with inline site context block instead of STATIC_PREAMBLE.

**Inputs:**
- `userTopic` — The specific topic string
- `sources` — Up to 5 URLs scraped for background (each truncated to 6,000 chars)
- `siteContext` — Same as 2.2

**Output:** JSON `{ title, slug, body, meta_description }`

---

### 2.4 writeArticle() — Full Article from Idea + Learnings

**File:** `src/lib/ai/generation.ts:237-339`
**Called by:** `/api/queue/process` (idea/scheduled jobs), `workflow.ts` (direct writing)
**Purpose:** Write a complete article from an `ArticleIdea`, enriched with learnings and web search

**This is the main production article writer.** It's called by the queue system for scheduled posts.

**Path A — With writingPrompt (lines 264-291):**
```
{STATIC_PREAMBLE}

---
SITE-SPECIFIC INSTRUCTIONS:
---

{siteContext.writingPrompt}

---

ARTICLE ASSIGNMENT:
Title: "{idea.title}"
Angle: {idea.angle}

KEY LEARNINGS (incorporate into the article):
- {learning.topic}: {learning.insight}
...

WEB SEARCH RESULTS (use for current facts/stats):
- {result.title}: {result.description} ({result.url})
...

---

Write ONE blog post following the assignment above and all guidelines in the system prompt.

Return a JSON object with:
- "title": The final title (may refine for SEO)
- "slug": URL-friendly slug (lowercase, hyphens)
- "body": Full blog post in HTML format. Minimum 2,500 words.
- "meta_description": SEO meta description (140-155 chars)
```

**Path B — Without writingPrompt (lines 292-317):** Simplified version with inline SEO rules.

**Inputs:**
- `idea` — `{ title, angle, keyLearnings[], description, keywords[], slug }`
- `relevantLearnings` — Learning objects matched to the idea's `keyLearnings`
- `siteContext` — Same as above
- Web search results (from `agent.searchGoogle()` for the idea's title, 5 results)

**Output:** JSON `{ title, slug, body, meta_description }`

**Post-processing (lines 331-334):**
- If the idea already has a `slug`, it overrides the AI-generated one
- If the idea has a `description`, it overrides `meta_description`

**Editing tips:**
- This is where most articles come from (scheduled generation). Focus edits here for quality improvements.
- The web search enrichment (lines 243-256) adds current facts. If articles feel dated, check if `searchGoogle` is returning good results.
- The learning matching logic (lines 258-260) is simple string matching. If articles don't incorporate the right learnings, the match logic in `workflow.ts:173-176` may need tuning.

---

### 2.5 generateWritingPrompt() — Meta-Prompt Builder

**File:** `src/lib/ai/generation.ts:224-232` (function) + `src/lib/writing-prompt.ts:34-116` (prompt builder)
**Called by:** `/api/ai/generate-writing-prompt`
**Purpose:** Generate a comprehensive writing prompt from company/brand information

The actual prompt is built by `buildMetaPrompt()` in `src/lib/writing-prompt.ts`. It's a long structured prompt:

<details>
<summary>Full meta-prompt template (src/lib/writing-prompt.ts:37-57)</summary>

```
You are a senior brand strategist and copywriting expert. Using the company information below, generate a comprehensive AI blog writer system prompt.

The output should be a complete, well-structured document that any AI writer could use as a system prompt to write on-brand blog posts. Include ALL of the following sections:

1. **Role & Output Rules** — Define the AI's role. Include hard formatting rules: output must start with H2, never use H1, no preamble, no closing meta-commentary, no raw URLs inline, no scraped navigation/bylines.

2. **About the Company** — Company context the AI needs when writing. What the company does, what makes it different, who uses it. The AI should weave in natural mentions of the company where relevant — not force them.

3. **Content Guidelines** — Target word count (2,500-5,000), structure (H2/H3, short paragraphs), article type guidance, company bridge section requirements, FAQ/AEO section with 4-6 questions.

4. **SEO & Linking** — Keyword density guidance, primary keyword placement rules, semantic variation usage, internal linking (3-5), external linking (1-2).

5. **Writing Style** — Specific tone rules derived from the brand voice. Be direct and prescriptive. Include numbered do's and don'ts.

6. **Banned Words & Phrases** — Combine user-specified banned phrases with standard AI-giveaway phrases.

7. **Self-Check Checklist** — A verification list the AI should run before outputting.

---

IMPORTANT: The output should be the system prompt text ONLY. Do not wrap it in code blocks or add any meta-commentary.
```

</details>

Then it appends structured sections from `WritingPromptInputs`:
- Company Info (name, what they do, industry, differentiator, avoid topics)
- Target Audience (role, knowledge level, problems)
- Voice & Tone (traits, formality 1-5, humor, hard rules)
- Language Rules (banned phrases, preferred/avoided jargon, customer word)
- Examples & References (good/bad examples, admired writers, notes)

**Inputs:** `WritingPromptInputs` (see `src/lib/writing-prompt.ts:1-31`)
**Output:** Plain text writing prompt (not JSON)

**Editing tips:**
- The 7-section structure (lines 39-56) defines what every auto-generated writing prompt contains. Add or remove sections here.
- The "AI-giveaway phrases" list in section 6 references STATIC_PREAMBLE's list — keep them in sync.

---

### 2.6 extractLearnings() — Insight Extraction

**File:** `src/lib/ai/ideation.ts:7-62`
**Called by:** `workflow.ts` (step 2)
**Purpose:** Extract 3-8 key learnings per source from newly scraped content

```
You are analyzing web content to extract key learnings and insights related to "{siteContext.topic}".

For each source, extract 3-8 key learnings. Focus on:
- New facts, statistics, or data points
- Emerging trends or shifts in the space
- Practical techniques, tools, or methods
- Notable opinions or perspectives
- Breaking news or recent developments

Each learning should be self-contained — detailed enough to inspire a blog post on its own.

SOURCE CONTENT:
--- Source: {url} ---
{text (truncated to 6,000 chars per source)}
...

Return a JSON object with a "sources" array. Each entry has:
- "sourceId": the source identifier
- "learnings": array of { "topic": string, "insight": string (1-3 sentences), "relevance": "high" | "medium" | "low" }
```

**Inputs:**
- `scrapedContent[]` — Array of `{ sourceId, url, text }` from scanning step
- `siteContext.topic` — Used to focus extraction

**Output:** JSON `{ sources: [{ sourceId, learnings: [{ topic, insight, relevance }] }] }`
**Stored in:** `source_learnings` table (kept 30 days, then cleaned up by weekly cron)

**Editing tips:**
- The 5 focus areas (facts, trends, techniques, opinions, news) shape what gets extracted. Reorder or change these to shift what the pipeline pays attention to.
- "3-8 key learnings" per source — lower for fewer but higher-quality insights, raise for more coverage.
- Each source is truncated to `MAX_LEARNING_SCRAPE` (6,000 chars). Increase in `agent.ts` if sources are being cut off.

---

### 2.7 ideateArticles() — Article Idea Generation

**File:** `src/lib/ai/ideation.ts:68-163`
**Called by:** `workflow.ts` (step 6)
**Purpose:** Generate exactly 20 SEO/AEO-optimized article ideas from accumulated learnings

<details>
<summary>Full prompt text</summary>

```
You are an expert SEO and AEO (Answer Engine Optimization) content strategist for a blog about "{siteContext.topic}".
Blog description: {siteContext.description}

Your job is to generate blog post ideas that will drive organic search traffic and appear as answers in AI-powered search engines and assistants.

---

## Your Task

Given input data about recent learnings from monitored sources, generate a JSON array of exactly {count} blog post ideas. Each blog post object must include:

- "title" — Optimized for SEO with clear, searchable phrasing. (50-70 chars)
- "description" — Meta description STRICTLY between 120–160 characters. Count carefully. Under 120 or over 160 = invalid.
- "keywords" — Array of 2-4 SEO-related keywords or phrases.
- "slug" — URL-friendly slug. Lowercase, hyphenated, no special characters.
- "angle" — 1-2 sentence editorial angle explaining what makes this post unique and valuable.
- "keyLearnings" — Array of 1-3 learning topics that should inform this post.

---

## Content Strategy Rules

1. **Variety of intent.** Mix informational ("What is X"), comparative ("X vs Y"), transactional ("Best X for Y"), and instructional ("How to X").
2. **SEO-first titles.** Titles should contain the keywords people actually search for.
3. **AEO optimization.** Descriptions should directly answer a question someone might ask an AI assistant.
4. **Description length is non-negotiable.** Every description MUST be 120–160 characters. Hard requirement.
5. **No fluff.** Every article must have a clear, distinct angle.
6. **Slug format.** Strictly kebab-case. Concise but descriptive.
7. **Priority ordering.** Most timely and impactful first.

---

## Input Data

<new_content_to_analyze>
1. [high] AI Code Review: New study shows automated code review reduces review time by 40%.
...
</new_content_to_analyze>

<previous_articles>
- Existing Title 1
- Existing Title 2
...
</previous_articles>

New articles must be different from previous_articles. Same subject is fine with a genuinely new angle.

---

## Output Format

Return a JSON object with an "ideas" array containing exactly {count} items.
```

</details>

**Inputs:**
- `recentLearnings[]` — All learnings from last 30 days (from `source_learnings` table)
- `siteContext` — Topic, description
- `existingTitles[]` — Titles from last 90 days of posts + active ideas (dedup)
- `count` — Default 20

**Output:** JSON `{ ideas: [{ title, description, keywords[], slug, angle, keyLearnings[] }] }`
**Stored in:** `post_ideas` table (14-day expiry)

**Editing tips:**
- The 7 "Content Strategy Rules" directly control idea quality. Rule 1 (variety of intent) ensures a mix of article types.
- Rule 4 (description length 120-160 chars) is enforced verbally. The AI sometimes violates this — no programmatic validation.
- The `count` parameter (default 20) can be changed. More ideas = more variety but slower generation.
- `keyLearnings` in the output links ideas back to source insights. This is used later to match relevant learnings when writing.

---

### 2.8 generateTopicBrief() — Onboarding Topic Brief

**File:** `src/lib/ai/onboarding.ts:243-275`
**Called by:** `/api/ai/topic-questions`
**Purpose:** Generate initial blog brief from a topic string during onboarding

```
You are helping someone set up an AI-powered blog. They said their blog is about: "{topic}"

Based on this topic, generate a blog brief with three sections:
1. "description" — A 2-3 sentence description of what this blog covers and its unique angle.
2. "audience" — A 1-2 sentence description of the target readers.
3. "contentGoals" — A 1-2 sentence description of the type of content and value it provides.

Write in second person ("your blog", "your readers"). Be specific and opinionated — make strong assumptions based on the topic. The user can edit afterward.

Return a JSON object.
```

**Inputs:** `topic` — User-entered blog topic string
**Output:** JSON `{ description, audience, contentGoals }`

---

### 2.9 refineTopicBrief() — Brief Refinement

**File:** `src/lib/ai/onboarding.ts:277-306`
**Called by:** `/api/ai/topic-questions`
**Purpose:** Update an existing blog brief based on user feedback

```
You are helping someone refine their blog brief. Here is the current brief:

Description: {brief.description}
Audience: {brief.audience}
Content Goals: {brief.contentGoals}

The user wants to make this change: "{instruction}"

Update the brief according to the user's instruction. Keep the same structure and tone. Only change what the user asked for.

Return a JSON object with "description", "audience", and "contentGoals" fields.
```

**Inputs:**
- `brief` — Current `TopicBrief` object
- `instruction` — User's change request text

**Output:** JSON `{ description, audience, contentGoals }`

---

### 2.10 scanCompanyWebsite() — Company Website Scanner

**File:** `src/lib/ai/onboarding.ts:308-360`
**Called by:** `/api/ai/scan-company`
**Purpose:** Scrape a company website and extract blog-relevant info

```
Analyze this company website content and extract key information for setting up a blog.

WEBSITE CONTENT:
{truncated to 8,000 chars}

Return a JSON object with:
- "companyName": the company or brand name
- "description": 2-3 sentences about what the company does
- "audience": who their customers/audience are
- "suggestedTopic": a clear blog topic suggestion based on their business
- "keywords": array of 5-8 relevant keywords for blog content
```

**Inputs:** Scraped website text (via `agent.scrapeUrl()`, truncated to 8,000 chars)
**Output:** JSON `{ companyName, description, audience, suggestedTopic, keywords[] }`

---

### 2.11 suggestSiteNames() — Blog Name Generator

**File:** `src/lib/ai/onboarding.ts:362-399`
**Called by:** `/api/ai/suggest-names`
**Purpose:** Generate 5 creative blog name suggestions

```
Generate 5 creative, memorable blog names for a blog about: "{topic}"

Additional context:
Q: {question}
A: {answer}
...

Requirements:
- Short (1-3 words each)
- Catchy and brandable
- Easy to spell and remember
- Work well as a subdomain (e.g., name.inkpop.net)

Return a JSON object with a "names" array of 5 strings.
```

**Inputs:** `topic` + `topicContext[]` (Q&A pairs from onboarding)
**Output:** JSON `{ names: [string, string, string, string, string] }`

---

### 2.12 generateSearchQueries() — Source Discovery Queries

**File:** `src/lib/ai/onboarding.ts:43-90`
**Called by:** `suggestSources()` (internal)
**Purpose:** Generate 6-8 optimized search queries to find content sources

```
You are an SEO and AEO strategist. Generate 6-8 search queries to find the best content sources (blogs, YouTube channels, newsletters, podcasts, publications) for a blog about this topic.

BLOG CONTEXT:
Topic: {keywords}
Description: {siteContext.description}
Additional context:
Q: {question}
A: {answer}

Generate search queries optimized to discover:
1. **SEO authority sources** — who ranks on page 1 for key terms?
2. **AEO citation sources** — who do AI assistants cite?
3. **Content creators** — YouTube channels, podcasters, newsletter authors
4. **Niche publications** — Substacks, Medium publications, industry blogs
5. **Long-tail variations** — specific sub-topics and angles

Each query should be a real search engine query. Mix Google-style keyword queries with natural-language Perplexity-style questions.

Return a JSON object with a "queries" array of 6-8 strings.
```

**Inputs:** `keywords` + `siteContext` (description, topicContext)
**Output:** JSON `{ queries: [string] }`

**Editing tips:**
- The 5 discovery categories shape what kinds of sources get found. Add/remove categories to change the source mix.
- If queries are too broad, add more specificity instructions.

---

### 2.13 suggestSources() — Source Ranking & Classification

**File:** `src/lib/ai/onboarding.ts:179-208` (the ranking prompt)
**Called by:** `/api/ai/suggest-sources`
**Purpose:** Rank and classify search results into recommended content sources

```
You are a content source curator. Given the following search results for the topic "{keywords}", select the 10-15 best sources for an AI blog generation tool to scrape regularly.

Be GENEROUS — include any source that could provide useful content. More is better. Only exclude sources that are clearly irrelevant.

Prioritize:
- Active blogs and YouTube channels that publish regularly
- Authoritative sources in the niche
- Diverse perspectives (mix of big and small publishers)
- Newsletters, Substacks, and niche publications
- Educational content (courses, tutorials, guides)

Classify each source:
- "youtube" — YouTube channel, playlist, or video
- "blog" — blog, RSS feed, newsletter, or publication
- "webpage" — other web resources

For each source provide:
- "type": the classification above
- "url": the exact URL from the search results
- "label": a short human-readable name
- "reason": one sentence explaining why this source is valuable

Exclude these URLs (already added): {existingUrls}

SEARCH RESULTS:
{formattedResults}

Return a JSON object with a "suggestions" array. Include 10-15 sources.
```

**Inputs:**
- Search results from 3 parallel searches (Google, Perplexity, Google News)
- `keywords` — Topic keywords
- `existingUrls` — URLs already added as sources

**Output:** JSON `{ suggestions: [{ type, url, label, reason }] }`

**Editing tips:**
- "Be GENEROUS" instruction was added to avoid overly aggressive filtering. Remove if suggestions are too low-quality.
- The 10-15 count can be adjusted. The UI shows all of them with accept/dismiss actions.

---

### 2.14 Generate Initial Prompt — Auto-Generate on First Load

**File:** `src/app/api/ai/generate-initial-prompt/route.ts:63-80`
**Called by:** Dashboard context tab (auto-triggers if site has no writing prompt)
**Purpose:** Create a first-draft writing prompt from site metadata

```
You are creating a writing prompt for an AI blog writer. This prompt will be used as instructions every time the AI generates a blog post.

SITE INFORMATION:
Blog topic: {site.topic}
Description: {site.description}
Additional context:
- {qa.question}: {qa.answer}
Company: {inputs.companyName}
What they do: {inputs.whatYouDo}
Industry: {inputs.industry}
Differentiator: {inputs.differentiator}
Audience: {inputs.audienceRole}
Audience expertise: {inputs.audienceKnowledge}
Audience problems: {inputs.audienceProblems}
Voice traits: {inputs.voiceTraits}
Formality (1-5): {inputs.formality}
Humor level: {inputs.humor}
Banned phrases: {inputs.bannedPhrases}
Style rules: {inputs.hardRules}

Write a comprehensive but concise writing prompt (under 2000 characters) that covers:
- What the blog is about and its perspective/angle
- Target audience and their expertise level
- Preferred tone and voice style
- Content structure preferences
- Any rules or constraints

Write it as direct instructions to the AI writer ("Write in a...", "Target...", "Always...").
Use markdown formatting with headers and bullet points.
Be specific and actionable.
Do NOT include SEO rules, word count targets, or formatting rules — those are handled separately.

Return ONLY the prompt text, no JSON wrapper.
```

**Inputs:** Site metadata from DB (`topic`, `description`, `topic_context`, `writing_prompt_inputs`)
**Output:** Plain text prompt (saved to `sites.writing_prompt`)

**Editing tips:**
- "Under 2000 characters" keeps prompts concise. Increase if prompts feel too thin.
- "Do NOT include SEO rules" is important — STATIC_PREAMBLE handles those. Removing this line would cause duplication.

---

### 2.15 Context Chat — Interactive Prompt Editor

**File:** `src/app/api/ai/context-chat/route.ts:104-154`
**Called by:** Dashboard prompt editor chat interface
**Purpose:** Conversational AI that helps users edit their writing prompt

<details>
<summary>Full system prompt (lines 104-137)</summary>

```
You are a writing prompt editor for inkpop, an AI blog platform. The user has a writing prompt that controls how their blog posts are generated by AI. Your job is to help them improve it.

CURRENT WRITING PROMPT:
---
{currentPrompt}
---

{scanContext — scraped website content if URL detected in message}

## What You Can Do
- Analyze the prompt and suggest specific, actionable improvements
- Rewrite the prompt or sections of it based on user requests
- Add new sections (audience, tone, structure, SEO rules, content types, etc.)
- Incorporate information from scraped websites into the prompt
- Answer questions about what makes a good writing prompt

## Rules
- When you make changes, return the COMPLETE updated prompt in "updatedPrompt"
- Keep prompts under 3000 characters — be concise and actionable
- Write as direct instructions to an AI blog writer (second person)
- Use markdown formatting for readability
- Every sentence should give actionable guidance — no fluff
- If no prompt changes needed, omit "updatedPrompt"
- Include a short "changeSummary" (under 60 chars)

## Good Prompt Sections
- **Topic & niche**: What the blog is about, its angle/perspective
- **Audience**: Who reads it, their expertise level
- **Voice & tone**: Formality, humor, personality
- **Content types**: Post formats (how-tos, comparisons, listicles)
- **Structure**: Word count, section patterns, formatting
- **Rules**: Banned phrases, terminology, things to always/never do
```

</details>

**Inputs:**
- `currentPrompt` — The site's current writing prompt
- `chatHistory` — Last 10 messages of conversation
- `message` — User's latest message
- URL scanning: If message contains a URL, it's scraped and injected as `scanContext`

**Output:** JSON `{ reply, updatedPrompt?, changeSummary? }`

**Side effects:** If `updatedPrompt` is returned, auto-saves to `sites.writing_prompt` and creates a version entry in `sites.context_files.versions[]` (max 20 versions kept).

**Editing tips:**
- The "3000 characters" limit in Rules keeps prompts from bloating. Adjust if needed.
- "Good Prompt Sections" guides the AI on what to suggest adding. Add sections here to expand what gets recommended.
- The SSRF protection (lines 49-68) blocks private/internal URLs.

---

## 3. Data Flow

### 3.1 The SiteContext Object

Every generation prompt receives a `SiteContext` that enriches the output. It's assembled from DB columns:

```typescript
interface SiteContext {
  topic?: string           // sites.topic — "Sustainable Packaging"
  description?: string     // sites.description — "A blog about eco-friendly..."
  topicContext?: Array<{   // sites.topic_context — Q&A from onboarding
    question: string
    answer: string
  }>
  writingPrompt?: string   // sites.writing_prompt — The full custom prompt
}
```

**Flow:** `sites` table → assembled in `workflow.ts:36-41` or API routes → passed to every generation function.

**Key rule:** When `writingPrompt` exists, it replaces the generic prompt path with `STATIC_PREAMBLE + writingPrompt`. Sites without a writing prompt get a simpler, less customized prompt.

### 3.2 Source Scanning & Change Detection

```
Source URL
    │
    ▼
scraping.ts:scanSourceForChanges()
    │
    ├── YouTube → fetchYoutubeChannel() → fetchYoutubeVideo() + fetchYoutubeCaptions()
    ├── Blog    → fetchRssFeed() first, fallback to scrapeUrl()
    └── Webpage → scrapeUrl()
    │
    ▼
SHA-256 hash of content
    │
    ├── Hash matches DB → hasNewContent: false (skip)
    └── Hash differs    → hasNewContent: true  (process)
    │
    ▼
Update sources.last_content_hash + sources.last_scraped_at
```

**Constants (from `agent.ts`):**
- `MAX_CONTENT_LENGTH` = 12,000 chars (for post generation scraping)
- `MAX_LEARNING_SCRAPE` = 6,000 chars (for learning extraction)
- `MIN_SCRAPE_LENGTH` = 200 chars (skip if less than this)

### 3.3 End-to-End Scheduled Generation

```
Cron daily-run
    │
    ▼
For each site (where user.credit_balance > 0 OR auto_renew = true):
    │
    ▼
[1] Scan sources → ScanResult[]
    │ (scraping.ts, writes sources.last_content_hash)
    ▼
[2] Extract learnings from new content → Learning[]
    │ (ideation.ts:extractLearnings, writes source_learnings table)
    ▼
[3] Load all learnings from last 30 days
    │ (reads source_learnings table)
    ▼
[4] Skip check: no new content AND no recent learnings → return "skipped"
    │
    ▼
[5] Load existing titles (90 days posts + active ideas)
    │ (reads posts + post_ideas tables)
    ▼
[6] Ideate 20 articles
    │ (ideation.ts:ideateArticles)
    ▼
[7] Split: first N ideas → queue for writing, rest → store as ideas
    │ (N = site.posts_per_period, default 1)
    │
    ├── Ideas for writing:
    │   ├── Insert into post_ideas (status: "active" → "queued")
    │   ├── Deduct 1 credit per idea (atomic RPC)
    │   ├── Insert into generation_queue (job_type: "scheduled")
    │   └── Fire-and-forget trigger /api/queue/process
    │
    └── Remaining ideas:
        └── Insert into post_ideas (status: "active", expires in 14 days)
```

### 3.4 Database Tables Involved

| Table | Read By | Written By |
|-------|---------|------------|
| `sites` | All pipelines (context) | context-chat, generate-initial-prompt (writing_prompt) |
| `sources` | scraping.ts (last_content_hash) | scraping.ts (hash + timestamp) |
| `source_learnings` | workflow.ts, queue/process | workflow.ts (from extractLearnings) |
| `post_ideas` | workflow.ts, queue/process, daily-run | daily-run, ideas/scan (insert), queue/process (status updates) |
| `generation_queue` | queue/process, process-queue cron | daily-run (insert), queue/process (claim/update) |
| `posts` | workflow.ts (title dedup) | queue/process, agent/run (insert) |
| `users` | daily-run (credits, auto-renew) | monthly-credits, credits.ts (balance) |
| `credit_transactions` | — | credits.ts (via RPC, immutable log) |
| `source_suggestions` | dashboard UI | suggestions.ts (insert), cleanup cron (delete) |

---

## 4. Scheduling & Queue

### 4.1 Cron Jobs

**Config:** `vercel.json`

| Job | Schedule | Route | Purpose |
|-----|----------|-------|---------|
| Daily Run | `0 6 * * *` (6 AM UTC daily) | `/api/cron/daily-run` | Scan → learn → ideate → queue |
| Process Queue | `*/2 * * * *` (every 2 min) | `/api/cron/process-queue` | Safety net for stuck jobs |
| Monthly Credits | `0 0 1 * *` (1st of month) | `/api/cron/monthly-credits` | Grant 5 free credits |
| Cleanup | `0 3 * * 0` (Sundays 3 AM) | `/api/cron/cleanup` | Expire ideas, purge old data |

All cron endpoints require `Authorization: Bearer {CRON_SECRET}`.

### 4.2 Posting Schedule

**DB Column:** `sites.posting_schedule` — controls which days the cron runs ideation for a site.

```typescript
// daily-run/route.ts:189-202
function shouldRunToday(schedule: string | null): boolean {
  if (!schedule) return true
  const day = new Date().getUTCDay()
  switch (schedule) {
    case "daily":   return true
    case "weekly":  return day === 1  // Monday only
    case "custom":  return true       // treated as daily
    default:        return true
  }
}
```

**DB Column:** `sites.posts_per_period` — how many ideas to queue for writing per run (default 1).

### 4.3 Queue Lifecycle

```
Job created (daily-run)
    │
    ▼
status: "queued"  ←──────────────────┐
    │                                 │
    ▼                                 │ retry (if retry_count < 3)
claim_next_queue_job() RPC            │
    │                                 │
    ▼                                 │
status: "processing"                  │
    │                                 │
    ├── Success ──▶ status: "completed" (post_id set)
    │
    └── Failure ──┤
                  ├── retry_count < 2 ──▶ status: "queued" (retry_count++)  ─┘
                  └── retry_count >= 2 ──▶ status: "failed" + credit refund
```

**Stale detection:** Jobs stuck in "processing" for > 5 minutes are reset by both:
- The queue processor itself (at start of each run)
- The process-queue cron (every 2 minutes)

**Self-chaining:** After completing a job, the processor triggers itself for the next job via fire-and-forget `fetch()`.

### 4.4 Cleanup Schedule

Weekly cleanup (`/api/cron/cleanup`) handles:
- Delete `source_learnings` older than 30 days
- Expire `post_ideas` with `status: "active"` past `expires_at`
- Delete `source_suggestions` expired more than 7 days
- Delete completed/failed `generation_queue` jobs older than 30 days

---

## 5. Credit System

### 5.1 When Credits Are Deducted

Credits are deducted **at queue time** (when the job is created in daily-run), NOT at generation time. This means:
- Credit is reserved before the article is written
- If generation fails after 3 retries, the credit is refunded

### 5.2 Atomic Operations

All credit operations use Supabase RPC functions that run as single Postgres transactions:

| RPC | Used By | What It Does |
|-----|---------|--------------|
| `deduct_credit_with_log` | daily-run, agent/run | Deduct N credits if balance >= N, log transaction. Returns null if insufficient. |
| `add_credit_with_log` | Stripe webhook, auto-renew, refunds | Add N credits, log transaction. Returns new balance. |
| `set_free_credit_floor` | monthly-credits, login-check | Set balance to GREATEST(current, 5). Only logs if balance actually increased. |
| `claim_next_queue_job` | queue/process | Atomically claim next queued job (FOR UPDATE SKIP LOCKED). |

### 5.3 Auto-Renew Flow

```
deductCredits() returns { success: false }
    │
    ▼
Check user.auto_renew === true AND user.stripe_customer_id exists
    │
    ▼
autoRenewCredits(userId, stripeCustomerId, packId)
    │
    ├── Get saved payment method from Stripe
    ├── Create PaymentIntent (off-session, confirm: true)
    ├── On success: addCredits() → retry deduction
    └── On failure: skip user for rest of this cron run
```

### 5.4 Monthly Free Credits

- **Amount:** 5 credits/month (no stacking — `GREATEST(balance, 5)`)
- **Primary:** `/api/cron/monthly-credits` on 1st of month
- **Fallback:** Dashboard layout checks `isMonthlyGrantDue()` on every load
- **Tracking:** `users.monthly_credits_granted_at` prevents double-granting

### 5.5 Transaction Types

| Type | When | Logged By |
|------|------|-----------|
| `purchase` | Stripe checkout completed | Stripe webhook |
| `generation` | Credit deducted for queued post | daily-run, agent/run |
| `auto_renew` | Auto-renewed via saved card | autoRenewCredits() |
| `queue_refund` | Job failed after retries | queue/process, process-queue cron |
| `free_monthly` | Monthly grant | monthly-credits cron, login-check |

### 5.6 Credit Packs

| Pack | Credits | Price | Per Post |
|------|---------|-------|----------|
| `pack_10` (Starter) | 10 | $5.00 | $0.50 |
| `pack_50` (Standard) | 50 | $22.50 | $0.45 (10% off) |
| `pack_100` (Bulk) | 100 | $40.00 | $0.40 (20% off) |

Defined in `src/lib/credits.ts:4-28`.
