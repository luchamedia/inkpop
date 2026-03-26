# Phase 6: Site Dashboard To-Do List

## Context

After creating a site, the user lands on the site dashboard (`/dashboard/sites/:siteId`). We add a guided to-do checklist below the existing stats that helps them complete their site setup: create a post, configure a schedule, and customize the look.

**Depends on:** Phase 4 (site creation with new fields), Phase 5 (sidebar adaptation)

---

## Changes

### 6.1 Site Dashboard To-Do Component

**New file:** `src/components/dashboard/site-todo-list.tsx`

Server component (no `"use client"`) that receives site data and computes completion state.

```typescript
import Link from "next/link"
import { Check, FileText, Calendar, Palette } from "lucide-react"
import { RunAgentButton } from "@/components/agent/run-agent-button"

interface SiteTodoListProps {
  siteId: string
  hasAnyPosts: boolean
  hasSchedule: boolean  // true if posting_schedule was explicitly set (site has topic)
  creditBalance: number
}

interface TodoItem {
  id: string
  label: string
  description: string
  completed: boolean
  icon: React.ComponentType<{ className?: string }>
  action: React.ReactNode
}
```

**To-do items:**

| Item | Completed when | Action |
|------|---------------|--------|
| Create your first post | Site has any posts (drafts or published) | `RunAgentButton` + link to manual post creation |
| Set posting schedule | Site has `topic` field (created via new wizard) | Link to schedule config dialog |
| Customize the look | Never (placeholder) | "Coming soon" badge |

**Rendering:** Each item is a card with:
- Checkbox icon (green check if completed, empty circle if not)
- Label + description
- Action button/link (disabled or "Coming soon" for placeholder)

```tsx
export function SiteTodoList({ siteId, hasAnyPosts, hasSchedule, creditBalance }: SiteTodoListProps) {
  const todos: TodoItem[] = [
    {
      id: "create-post",
      label: "Create your first post",
      description: "Generate AI-powered blog posts from your sources, or write about a specific topic.",
      completed: hasAnyPosts,
      icon: FileText,
      action: hasAnyPosts ? (
        <Link href={`/dashboard/sites/${siteId}/posts`} className="text-sm text-primary hover:underline">
          View posts
        </Link>
      ) : (
        <div className="flex gap-2">
          <RunAgentButton siteId={siteId} creditBalance={creditBalance} size="sm" />
          <Link
            href={`/dashboard/sites/${siteId}/posts/new`}
            className="inline-flex items-center rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
          >
            Write manually
          </Link>
        </div>
      ),
    },
    {
      id: "set-schedule",
      label: "Set posting schedule",
      description: "Configure how often AI generates new posts for this site.",
      completed: hasSchedule,
      icon: Calendar,
      action: <ScheduleConfigLink siteId={siteId} />,
    },
    {
      id: "customize-look",
      label: "Customize the look",
      description: "Choose colors, layout, and branding for your blog.",
      completed: false,
      icon: Palette,
      action: (
        <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
          Coming soon
        </span>
      ),
    },
  ]

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold">Get started</h3>
      {todos.map((todo) => (
        <div
          key={todo.id}
          className={`flex items-start gap-4 rounded-lg border p-4 ${
            todo.completed ? "bg-muted/30" : ""
          }`}
        >
          <div className={`mt-0.5 ${todo.completed ? "text-green-600" : "text-muted-foreground"}`}>
            {todo.completed ? (
              <Check className="h-5 w-5" />
            ) : (
              <todo.icon className="h-5 w-5" />
            )}
          </div>
          <div className="flex-1 space-y-1">
            <p className={`text-sm font-medium ${todo.completed ? "line-through text-muted-foreground" : ""}`}>
              {todo.label}
            </p>
            <p className="text-xs text-muted-foreground">{todo.description}</p>
          </div>
          <div className="flex-shrink-0">{todo.action}</div>
        </div>
      ))}
    </div>
  )
}
```

### 6.2 Site Dashboard Page Integration

**File:** `src/app/dashboard/sites/[siteId]/page.tsx`

After the existing stats section, add the to-do list. Fetch additional data:

```typescript
// Existing: site data query
// Add: post count check
const { count: postCount } = await supabase
  .from("posts")
  .select("*", { count: "exact", head: true })
  .eq("site_id", siteId)

// In JSX, after stats grid:
<SiteTodoList
  siteId={siteId}
  hasAnyPosts={(postCount ?? 0) > 0}
  hasSchedule={!!site.topic}
  creditBalance={dbUser.credit_balance}
/>
```

### 6.3 Post Creation from Topic

**New file:** `src/app/api/ai/generate-post-for-topic/route.ts`

Generates a single blog post about a specific user-provided topic, incorporating the site's sources for context.

```typescript
import { NextResponse } from "next/server"
import { getAuthUser } from "@/lib/auth"
import { createServiceClient } from "@/lib/supabase/server"
import { generatePostForTopic } from "@/lib/mindstudio"
import { getBalance, deductCredits } from "@/lib/credits"

export const maxDuration = 120

export async function POST(req: Request) {
  try {
    const user = await getAuthUser()
    const supabase = createServiceClient()
    const { siteId, topic } = await req.json()

    if (!siteId || !topic || typeof topic !== "string" || topic.length > 500) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 })
    }

    // Check credits
    const balance = await getBalance(user.id)
    if (balance <= 0) {
      return NextResponse.json({ error: "Insufficient credits", balance: 0 }, { status: 402 })
    }

    // Verify ownership + fetch sources
    const { data: site } = await supabase
      .from("sites")
      .select("id, topic, description, topic_context, sources(*)")
      .eq("id", siteId)
      .eq("user_id", user.id)
      .single()

    if (!site) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const post = await generatePostForTopic(
      topic,
      site.sources || [],
      { topic: site.topic, description: site.description, topicContext: site.topic_context }
    )

    if (!post) {
      return NextResponse.json({ error: "Failed to generate" }, { status: 500 })
    }

    // Deduct 1 credit
    await deductCredits(user.id, 1, siteId)

    // Insert as draft
    const { data: inserted } = await supabase
      .from("posts")
      .insert({
        site_id: siteId,
        title: post.title,
        slug: post.slug,
        body: post.body,
        meta_description: post.meta_description || null,
        status: "draft",
      })
      .select("id")
      .single()

    return NextResponse.json({ postId: inserted?.id, title: post.title })
  } catch (error) {
    console.error("Generate post error:", error)
    return NextResponse.json({ error: "Failed to generate" }, { status: 500 })
  }
}
```

### New function in `src/lib/mindstudio.ts`: `generatePostForTopic()`

```typescript
export async function generatePostForTopic(
  userTopic: string,
  sources: { type: string; url: string }[],
  siteContext?: SiteContext
): Promise<GeneratedPost | null> {
  // Scrape sources for context (same pattern as generatePosts)
  const scrapeResults = await Promise.all(
    sources.slice(0, 5).map((source) =>
      agent.scrapeUrl({
        url: source.url,
        pageOptions: {
          onlyMainContent: true,
          screenshot: false,
          waitFor: 0,
          replaceAllPathsWithAbsolutePaths: false,
          headers: {},
          removeTags: ["nav", "footer", "aside"],
          mobile: false,
        },
      }).catch(() => null)
    )
  )

  const scrapedContent = scrapeResults
    .map((result, i) => {
      if (!result) return ""
      const text = typeof result.content === "string"
        ? result.content
        : Array.isArray(result.content)
          ? result.content.join("\n")
          : result.content?.text || ""
      return text.slice(0, 6000)
    })
    .filter(Boolean)
    .join("\n\n---\n\n")

  const contextBlock = siteContext?.topic
    ? `SITE CONTEXT:\nTopic: ${siteContext.topic}\n${siteContext.description ? `Description: ${siteContext.description}\n` : ""}${
        siteContext.topicContext
          ? `Background:\n${siteContext.topicContext.map((qa: { question: string; answer: string }) => `Q: ${qa.question}\nA: ${qa.answer}`).join("\n")}\n`
          : ""
      }\n`
    : ""

  const { content } = await agent.generateText({
    message: `${contextBlock}You are an expert SEO blog writer. Write ONE blog post about: "${userTopic}"

Use the following source content as background research and inspiration (but the post should specifically be about the requested topic):

SOURCE CONTENT:
${scrapedContent || "[No sources available]"}

The post must have:
- "title": A compelling, keyword-rich title (50-70 chars)
- "slug": URL-friendly slug (lowercase, hyphens)
- "body": Full blog post in HTML format (use h2, h3, p, ul, li, strong, em). Minimum 800 words.
- "meta_description": SEO meta description (140-155 chars)

Return a JSON object with these 4 fields.`,
    structuredOutputType: "json",
    structuredOutputExample: JSON.stringify({
      title: "Example Post Title",
      slug: "example-post-title",
      body: "<h2>Section</h2><p>Content...</p>",
      meta_description: "Brief description for SEO."
    }),
  })

  try {
    return JSON.parse(content)
  } catch {
    console.error("Failed to parse topic post:", content)
    return null
  }
}
```

### 6.4 Schedule Config Card

**New file:** `src/components/dashboard/schedule-config-card.tsx`

Client component — a mini version of `step-schedule.tsx` that can be used inline on the site dashboard.

```typescript
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"

interface ScheduleConfigCardProps {
  siteId: string
  currentSchedule: string
  currentPostsPerPeriod: number
}
```

On save, PATCHes the site via the new PATCH endpoint.

### 6.5 Site PATCH endpoint

**New file:** `src/app/api/sites/[siteId]/route.ts`

```typescript
import { NextResponse } from "next/server"
import { getAuthUser } from "@/lib/auth"
import { createServiceClient } from "@/lib/supabase/server"

export async function PATCH(
  req: Request,
  { params }: { params: { siteId: string } }
) {
  try {
    const user = await getAuthUser()
    const supabase = createServiceClient()

    // Verify ownership
    const { data: site } = await supabase
      .from("sites")
      .select("id")
      .eq("id", params.siteId)
      .eq("user_id", user.id)
      .single()

    if (!site) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const body = await req.json()

    // Whitelist updateable fields
    const updates: Record<string, unknown> = {}
    if (body.posting_schedule && ["daily", "weekly", "custom"].includes(body.posting_schedule)) {
      updates.posting_schedule = body.posting_schedule
    }
    if (body.posts_per_period && Number.isInteger(body.posts_per_period) && body.posts_per_period > 0 && body.posts_per_period <= 50) {
      updates.posts_per_period = body.posts_per_period
    }
    if (body.name && typeof body.name === "string") {
      updates.name = body.name.slice(0, 100)
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 })
    }

    const { data: updated } = await supabase
      .from("sites")
      .update(updates)
      .eq("id", params.siteId)
      .select()
      .single()

    return NextResponse.json(updated)
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}
```

---

## Security Considerations

- `PATCH /api/sites/[siteId]` verifies ownership via `user_id` match before updating
- Field whitelist prevents updating arbitrary columns
- `posts_per_period` validated as integer between 1-50
- `posting_schedule` validated against allowed values
- `generatePostForTopic` — topic input length-limited to 500 chars
- Credit check before AI call (402 if insufficient)

---

## Verification

1. `pnpm build` passes
2. New site → site dashboard shows 3 to-do items (all incomplete)
3. "Create your first post" → click `RunAgentButton` → generates posts → to-do marked complete
4. "Set posting schedule" → opens config → save → to-do marked complete
5. "Customize the look" → shows "Coming soon" badge
6. Topic-specific post: enter topic → generates single post → 1 credit deducted → draft created

---

## Files Modified/Created

| File | Action |
|------|--------|
| `src/components/dashboard/site-todo-list.tsx` | New — to-do checklist component |
| `src/app/dashboard/sites/[siteId]/page.tsx` | Add to-do section with data fetching |
| `src/app/api/ai/generate-post-for-topic/route.ts` | New — single post from topic |
| `src/lib/mindstudio.ts` | Add `generatePostForTopic()`, `SiteContext` interface |
| `src/components/dashboard/schedule-config-card.tsx` | New — inline schedule editor |
| `src/app/api/sites/[siteId]/route.ts` | New — PATCH handler for site updates |
