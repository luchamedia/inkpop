# Phase 4: `/new-site` Wizard

## Context

The core of the new onboarding: a 4-step wizard at `/new-site` that guides users through creating a site with AI assistance. Lives outside `/dashboard` for a clean, focused experience with a minimal layout (just logo + progress bar).

**Depends on:** Phase 1 (DB migrations), Phase 3 (account setup redirects to `/new-site`)

---

## Route Structure

```
src/app/new-site/
  layout.tsx              — minimal layout (logo + progress indicator, no sidebar)
  page.tsx                — server component, auth check, renders wizard

src/components/new-site/
  new-site-wizard.tsx     — client component, orchestrates 4 steps
  step-topic.tsx          — topic input + AI conversational chat
  step-sources.tsx        — wraps SourceSuggestions, up to 10 sources
  step-schedule.tsx       — frequency config cards
  step-name.tsx           — AI name suggestions + subdomain check
```

---

## Data Model

```typescript
interface WizardData {
  // Step 1: Topic
  topic: string
  topicContext: Array<{ question: string; answer: string }>
  companyUrl?: string

  // Step 2: Sources
  sources: Array<{ type: string; url: string; label?: string }>

  // Step 3: Schedule
  postingSchedule: "daily" | "weekly" | "custom"
  postsPerPeriod: number

  // Step 4: Name
  name: string
  subdomain: string
}
```

Site is created ONLY at the end of step 4 — a single `POST /api/sites` with all accumulated data, followed by sequential `POST /api/sites/:siteId/sources` for each source. This avoids orphaned partial sites.

---

## Step 1: Topic Definition (`step-topic.tsx`)

### Two Entry Paths

User sees two cards/buttons to choose their path:

**Path A: "I have a topic in mind"**
1. Textarea: "What is your blog about?" (max 500 chars)
2. User submits → `POST /api/ai/topic-questions`
3. API returns 2-3 follow-up questions
4. **Conversational chat UI:**
   - Questions shown one at a time in a message-bubble style
   - User types answer in input field, presses Enter or "Next"
   - Previous Q&A pairs remain visible above (scrollable)
   - After all questions answered: "That's everything!" message
5. Summary card: AI-generated 2-3 sentence description based on topic + answers
6. User can edit the summary or click "Looks good, continue"
7. Data saved: `topic`, `topicContext` (array of Q&A), derived `description`

**Path B: "I have a company website"**
1. URL input: "Enter your company or website URL"
2. Submit → `POST /api/ai/scan-company`
3. Loading state: "Scanning your website..."
4. API scrapes the URL and extracts: company name, what they do, audience, suggested topic
5. Display card: "Here's what we found:" with editable fields
6. User confirms or edits → continue
7. Data saved: `companyUrl`, `topic` (from extracted data), `topicContext` (from scan results), `description`

### Chat UI Design Notes

The chat is NOT a full real-time streaming interface. It's a linear Q&A flow:
- Display: message bubbles (system = left/gray, user = right/primary)
- Input: single text input at the bottom
- No back-and-forth — questions are predetermined from the initial API call
- Animation: new messages slide in with a brief delay for natural feel
- Minimum answer length: 10 chars (encourage thoughtful answers)

### New API: `POST /api/ai/topic-questions`

**New file:** `src/app/api/ai/topic-questions/route.ts`

```typescript
import { NextResponse } from "next/server"
import { getAuthUser } from "@/lib/auth"
import { generateTopicQuestions } from "@/lib/mindstudio"

export const maxDuration = 30

export async function POST(req: Request) {
  try {
    await getAuthUser()
    const { topic } = await req.json()

    if (!topic || typeof topic !== "string" || topic.length > 500) {
      return NextResponse.json({ error: "Invalid topic" }, { status: 400 })
    }

    const questions = await generateTopicQuestions(topic.trim())
    return NextResponse.json({ questions })
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}
```

### New function in `src/lib/mindstudio.ts`: `generateTopicQuestions()`

```typescript
export async function generateTopicQuestions(topic: string): Promise<string[]> {
  const { content } = await agent.generateText({
    message: `You are helping someone set up an AI-powered blog. They said their blog is about: "${topic}"

Generate exactly 3 focused follow-up questions to help clarify:
1. Their specific niche or angle within this topic
2. Their target audience (who are they writing for?)
3. Their content goals (what value do they want to provide?)

Keep questions conversational and friendly. Each question should be 1-2 sentences.

Return a JSON object with a "questions" array of strings.`,
    structuredOutputType: "json",
    structuredOutputExample: JSON.stringify({
      questions: [
        "What specific aspect of cooking are you most passionate about?",
        "Who do you imagine reading your blog?",
        "What kind of posts would you love to write?"
      ]
    }),
  })

  try {
    const parsed = JSON.parse(content)
    return parsed.questions || []
  } catch {
    return [
      "What specific angle or niche within this topic interests you most?",
      "Who is your target audience?",
      "What kind of content do you want to create?"
    ]
  }
}
```

### New API: `POST /api/ai/scan-company`

**New file:** `src/app/api/ai/scan-company/route.ts`

```typescript
import { NextResponse } from "next/server"
import { getAuthUser } from "@/lib/auth"
import { scanCompanyWebsite } from "@/lib/mindstudio"

export const maxDuration = 30

export async function POST(req: Request) {
  try {
    await getAuthUser()
    const { url } = await req.json()

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "URL is required" }, { status: 400 })
    }

    // Security: only allow HTTPS URLs, reject internal/localhost
    let parsed: URL
    try {
      parsed = new URL(url)
    } catch {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 })
    }

    if (parsed.protocol !== "https:") {
      return NextResponse.json({ error: "Only HTTPS URLs are allowed" }, { status: 400 })
    }

    const hostname = parsed.hostname.toLowerCase()
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname.startsWith("192.168.") ||
      hostname.startsWith("10.") ||
      hostname.endsWith(".local")
    ) {
      return NextResponse.json({ error: "Internal URLs not allowed" }, { status: 400 })
    }

    const result = await scanCompanyWebsite(url)
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}
```

### New function in `src/lib/mindstudio.ts`: `scanCompanyWebsite()`

```typescript
export interface CompanyScanResult {
  companyName: string
  description: string
  audience: string
  suggestedTopic: string
  keywords: string[]
}

export async function scanCompanyWebsite(url: string): Promise<CompanyScanResult> {
  // Scrape the company website
  const scrapeResult = await agent.scrapeUrl({
    url,
    pageOptions: {
      onlyMainContent: true,
      screenshot: false,
      waitFor: 0,
      replaceAllPathsWithAbsolutePaths: false,
      headers: {},
      removeTags: ["nav", "footer", "aside"],
      mobile: false,
    },
  })

  const text = typeof scrapeResult.content === "string"
    ? scrapeResult.content
    : Array.isArray(scrapeResult.content)
      ? scrapeResult.content.join("\n")
      : scrapeResult.content?.text || ""

  const truncated = text.slice(0, 8000)

  // Extract company info via AI
  const { content } = await agent.generateText({
    message: `Analyze this company website content and extract key information for setting up a blog.

WEBSITE CONTENT:
${truncated}

Return a JSON object with:
- "companyName": the company or brand name
- "description": 2-3 sentences about what the company does
- "audience": who their customers/audience are
- "suggestedTopic": a clear blog topic suggestion based on their business
- "keywords": array of 5-8 relevant keywords for blog content

Return a JSON object.`,
    structuredOutputType: "json",
    structuredOutputExample: JSON.stringify({
      companyName: "Acme Corp",
      description: "Acme Corp provides sustainable packaging solutions for e-commerce businesses.",
      audience: "E-commerce store owners and sustainability-focused brands",
      suggestedTopic: "Sustainable packaging and eco-friendly e-commerce practices",
      keywords: ["sustainable packaging", "eco-friendly shipping", "green e-commerce"]
    }),
  })

  try {
    return JSON.parse(content)
  } catch {
    return {
      companyName: "",
      description: "",
      audience: "",
      suggestedTopic: "",
      keywords: [],
    }
  }
}
```

---

## Step 2: Sources (`step-sources.tsx`)

Thin wrapper around the existing `SourceSuggestions` component (`src/components/sources/source-suggestions.tsx`).

### Key changes from current onboarding:
1. **Source cap: 10** (not 5) — use `SOURCE_LIMIT` from `@/lib/credits`
2. **Pre-populated search query:** Pass `topic` from step 1 as `initialQuery` prop
3. **Auto-trigger search on mount** when `initialQuery` is provided

### Modify `SourceSuggestions` component

**File:** `src/components/sources/source-suggestions.tsx`

Add `initialQuery?: string` prop:

```typescript
interface SourceSuggestionsProps {
  onAccept: (source: { type: string; url: string; label: string }) => void
  existingUrls: string[]
  remainingSlots: number
  initialQuery?: string  // NEW: pre-populate and auto-search
}
```

Add `useEffect` to auto-search when `initialQuery` is provided:

```typescript
useEffect(() => {
  if (initialQuery && !hasSearched) {
    setQuery(initialQuery)
    // Delay slightly to avoid race with mount
    const timer = setTimeout(() => search(1), 300)
    return () => clearTimeout(timer)
  }
}, [initialQuery]) // eslint-disable-line react-hooks/exhaustive-deps
```

### New wrapper component

**New file:** `src/components/new-site/step-sources.tsx`

```typescript
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SourceSuggestions } from "@/components/sources/source-suggestions"
import { SOURCE_LIMIT } from "@/lib/credits"
import { X } from "lucide-react"

interface StepSourcesProps {
  topic: string
  sources: Array<{ type: string; url: string; label?: string }>
  onUpdate: (sources: Array<{ type: string; url: string; label?: string }>) => void
  onNext: () => void
  onBack: () => void
}

export function StepSources({ topic, sources, onUpdate, onNext, onBack }: StepSourcesProps) {
  // ... manages sources list, delegates to SourceSuggestions + manual add
  // Same pattern as current step-sources.tsx but with SOURCE_LIMIT (10)
  // and initialQuery={topic}
}
```

---

## Step 3: Posting Schedule (`step-schedule.tsx`)

**New file:** `src/components/new-site/step-schedule.tsx`

Three selectable cards + frequency input:

```
┌─────────┐  ┌─────────┐  ┌─────────┐
│  Daily  │  │ Weekly  │  │ Custom  │
│         │  │ (rec.)  │  │         │
└─────────┘  └─────────┘  └─────────┘

Posts per [period]: [1] ↑↓

Estimated: 1 post/week
Free tier: 5 free credits/month — at this pace, lasts ~5 weeks
Recommendation: For best SEO results, 5-20 posts/day
```

**Props:**
```typescript
interface StepScheduleProps {
  schedule: "daily" | "weekly" | "custom"
  postsPerPeriod: number
  onUpdate: (schedule: string, postsPerPeriod: number) => void
  onNext: () => void
  onBack: () => void
}
```

**Computed values (client-side):**
- `postsPerWeek` = schedule === "daily" ? postsPerPeriod * 7 : schedule === "weekly" ? postsPerPeriod : postsPerPeriod
- `weeksOfFreeCredits` = Math.floor(5 / postsPerWeek) (5 = FREE_MONTHLY_CREDITS)
- Show this as: "At this pace, your free credits will last ~X weeks"

**Default:** `weekly`, `1` post per week.

---

## Step 4: Name Your Site (`step-name.tsx`)

**New file:** `src/components/new-site/step-name.tsx`

### AI Name Suggestions

On mount (or when topic data is available), call `POST /api/ai/suggest-names` to get 5 name suggestions.

Display as clickable chips. When selected:
- Auto-populates the name input
- Auto-generates a subdomain slug (same logic as existing `step-site.tsx` lines 49-56)

### Manual Input

- Name input (text field)
- Subdomain input (auto-generated from name, editable)
- Debounced (500ms) subdomain availability check via `POST /api/sites` with `{ checkSubdomain: true }` (reuse exact pattern from `step-site.tsx` lines 23-46)
- Reserved subdomains blocked: `["www", "app", "api", "mail", "admin", "blog", "help", "support"]`

### New API: `POST /api/ai/suggest-names`

**New file:** `src/app/api/ai/suggest-names/route.ts`

```typescript
import { NextResponse } from "next/server"
import { getAuthUser } from "@/lib/auth"
import { suggestSiteNames } from "@/lib/mindstudio"

export const maxDuration = 30

export async function POST(req: Request) {
  try {
    await getAuthUser()
    const { topic, topicContext } = await req.json()

    if (!topic || typeof topic !== "string" || topic.length > 500) {
      return NextResponse.json({ error: "Invalid topic" }, { status: 400 })
    }

    const names = await suggestSiteNames(topic, topicContext || [])
    return NextResponse.json({ names })
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}
```

### New function in `src/lib/mindstudio.ts`: `suggestSiteNames()`

```typescript
export async function suggestSiteNames(
  topic: string,
  topicContext: Array<{ question: string; answer: string }>
): Promise<string[]> {
  const contextStr = topicContext.length > 0
    ? `\n\nAdditional context:\n${topicContext.map(qa => `Q: ${qa.question}\nA: ${qa.answer}`).join("\n")}`
    : ""

  const { content } = await agent.generateText({
    message: `Generate 5 creative, memorable blog names for a blog about: "${topic}"${contextStr}

Requirements:
- Short (1-3 words each)
- Catchy and brandable
- Easy to spell and remember
- Work well as a subdomain (e.g., name.inkpop.net)

Return a JSON object with a "names" array of 5 strings.`,
    structuredOutputType: "json",
    structuredOutputExample: JSON.stringify({
      names: ["Pixel Pantry", "Code Canvas", "Green Thread", "Data Drift", "Neon Notes"]
    }),
  })

  try {
    const parsed = JSON.parse(content)
    return parsed.names || []
  } catch {
    return []
  }
}
```

---

## Wizard Orchestrator (`new-site-wizard.tsx`)

**New file:** `src/components/new-site/new-site-wizard.tsx`

Client component that manages:
- `step` state (1-4)
- `wizardData` state (accumulated across steps)
- Progress bar showing current step
- Back/Next navigation

### Final submission (after step 4):

```typescript
async function handleComplete() {
  setSubmitting(true)

  // 1. Create the site
  const res = await fetch("/api/sites", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: wizardData.name,
      subdomain: wizardData.subdomain,
      topic: wizardData.topic,
      topic_context: wizardData.topicContext,
      description: wizardData.description,
      posting_schedule: wizardData.postingSchedule,
      posts_per_period: wizardData.postsPerPeriod,
    }),
  })
  const site = await res.json()

  if (!site.id) {
    // Handle error
    setSubmitting(false)
    return
  }

  // 2. Add sources sequentially
  for (const source of wizardData.sources) {
    await fetch(`/api/sites/${site.id}/sources`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(source),
    })
  }

  // 3. Redirect to site dashboard
  router.push(`/dashboard/sites/${site.id}`)
}
```

### Steps array:
```typescript
const steps = [
  { number: 1, label: "Define your topic" },
  { number: 2, label: "Add sources" },
  { number: 3, label: "Set schedule" },
  { number: 4, label: "Name your site" },
]
```

---

## Minimal Layout

**New file:** `src/app/new-site/layout.tsx`

```typescript
export default function NewSiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b px-6 py-4">
        <span className="text-xl font-bold">inkpop</span>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-8">
        {children}
      </main>
    </div>
  )
}
```

**Page:** `src/app/new-site/page.tsx`

```typescript
import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { NewSiteWizard } from "@/components/new-site/new-site-wizard"

export default async function NewSitePage() {
  const { userId } = auth()
  if (!userId) redirect("/sign-in")
  return <NewSiteWizard />
}
```

---

## Update Sites API

**File:** `src/app/api/sites/route.ts`

Modify the POST handler to accept new fields (line 39-46):

```typescript
const { data: site, error } = await supabase
  .from("sites")
  .insert({
    user_id: user.id,
    name: body.name,
    subdomain: body.subdomain,
    topic: body.topic || null,
    topic_context: body.topicContext || null,
    description: body.description || null,
    category: body.category || null,
    posting_schedule: body.posting_schedule || "weekly",
    posts_per_period: body.posts_per_period || 1,
  })
  .select()
  .single()
```

---

## Middleware Check

**File:** `src/middleware.ts`

Verify that `/new-site` is NOT in the public routes list. Since Clerk middleware protects all non-public routes by default, `/new-site` will be auth-protected automatically. No changes needed unless `/new-site` is accidentally listed as public.

---

## Security Considerations

- `/api/ai/scan-company` — HTTPS-only URLs, rejects localhost/internal IPs (SSRF prevention)
- `/api/ai/topic-questions` — input length-limited to 500 chars
- `/api/ai/suggest-names` — input length-limited to 500 chars
- All new API routes use `getAuthUser()` as first operation
- Site creation still validates subdomain uniqueness server-side
- `topic_context` stored as jsonb — no injection risk via Supabase parameterized queries

---

## Verification

1. `pnpm build` passes
2. Navigate to `/new-site` → see 4-step wizard
3. Step 1 Path A: enter topic → AI returns questions → answer in chat UI → summary displayed
4. Step 1 Path B: enter company URL → AI scrapes → shows extracted info
5. Step 2: search auto-triggers with topic → accept sources → up to 10
6. Step 3: select schedule → see estimates → continue
7. Step 4: AI suggests names → select one → subdomain availability check → create site
8. Site created with all fields populated → redirected to `/dashboard/sites/:siteId`
9. Verify site row in Supabase has `topic`, `topic_context`, `posting_schedule`, etc.

---

## Files Modified/Created

| File | Action |
|------|--------|
| `src/app/new-site/layout.tsx` | New — minimal layout |
| `src/app/new-site/page.tsx` | New — auth check + render wizard |
| `src/components/new-site/new-site-wizard.tsx` | New — 4-step orchestrator |
| `src/components/new-site/step-topic.tsx` | New — topic input + AI chat |
| `src/components/new-site/step-sources.tsx` | New — wraps SourceSuggestions |
| `src/components/new-site/step-schedule.tsx` | New — frequency config |
| `src/components/new-site/step-name.tsx` | New — AI names + subdomain |
| `src/app/api/ai/topic-questions/route.ts` | New — generates follow-up questions |
| `src/app/api/ai/scan-company/route.ts` | New — scrapes company website |
| `src/app/api/ai/suggest-names/route.ts` | New — suggests site names |
| `src/lib/mindstudio.ts` | Add `generateTopicQuestions()`, `scanCompanyWebsite()`, `suggestSiteNames()` |
| `src/components/sources/source-suggestions.tsx` | Add `initialQuery` prop + auto-search |
| `src/app/api/sites/route.ts` | Accept new fields in POST |
