# Phase 7: Generation Context + Cron Scheduling

## Context

Now that sites have topic/description/context from the new wizard (Phase 4), we wire this data into the blog generation prompt so AI-generated posts are more relevant. We also add per-site posting schedule filtering to the daily cron.

**Depends on:** Phase 1 (DB columns), Phase 4 (sites created with topic data), Phase 6 (`SiteContext` interface and `generatePostForTopic` already defined)

---

## Changes

### 7.1 Extend `generatePosts()` with site context

**File:** `src/lib/mindstudio.ts`

#### Add `SiteContext` interface (if not already added in Phase 6)

```typescript
export interface SiteContext {
  topic?: string | null
  description?: string | null
  topicContext?: Array<{ question: string; answer: string }> | null
}
```

#### Modify `generatePosts()` signature

**Current (line 232-234):**
```typescript
export async function generatePosts(
  sources: { type: string; url: string }[]
): Promise<GeneratedPost[]> {
```

**New:**
```typescript
export async function generatePosts(
  sources: { type: string; url: string }[],
  siteContext?: SiteContext
): Promise<GeneratedPost[]> {
```

#### Modify `buildPrompt()` to include site context

**Current (line 298-311):**
```typescript
function buildPrompt(scrapedContent: string): string {
  return `You are an expert SEO blog writer. Based on the following source content, generate 1-3 unique, high-quality blog posts optimized for search engines.
  ...`
}
```

**New:**
```typescript
function buildPrompt(scrapedContent: string, ctx?: SiteContext): string {
  let contextBlock = ""
  if (ctx?.topic) {
    contextBlock += `SITE CONTEXT:\n`
    contextBlock += `Topic: ${ctx.topic}\n`
    if (ctx.description) contextBlock += `Description: ${ctx.description}\n`
    if (ctx.topicContext && ctx.topicContext.length > 0) {
      contextBlock += `Background:\n`
      for (const qa of ctx.topicContext) {
        contextBlock += `Q: ${qa.question}\nA: ${qa.answer}\n`
      }
    }
    contextBlock += `\nUse this context to ensure all posts are relevant to the site's topic and audience.\n\n`
  }

  return `${contextBlock}You are an expert SEO blog writer. Based on the following source content, generate 1-3 unique, high-quality blog posts optimized for search engines.

Each post must have:
- "title": A compelling, keyword-rich title (50-70 chars)
- "slug": URL-friendly slug derived from the title (lowercase, hyphens, no special chars)
- "body": Full blog post in HTML format (use <h2>, <h3>, <p>, <ul>, <li>, <strong>, <em> tags). Minimum 800 words.
- "meta_description": SEO meta description (140-155 chars)

Return a JSON object with a "posts" array.

SOURCE CONTENT:
${scrapedContent}`
}
```

**Update the call in `generatePosts()`:** Pass `siteContext` to `buildPrompt`:
```typescript
// Line 274 (current): buildPrompt(scrapedContent)
// New: buildPrompt(scrapedContent, siteContext)
```

### 7.2 Update `/api/agent/run` to pass site context

**File:** `src/app/api/agent/run/route.ts`

**Current site query (line 42-47):**
```typescript
const { data: site } = await supabase
  .from("sites")
  .select("id, sources(*)")
  .eq("id", siteId)
  .eq("user_id", user.id)
  .single()
```

**New:**
```typescript
const { data: site } = await supabase
  .from("sites")
  .select("id, topic, description, topic_context, sources(*)")
  .eq("id", siteId)
  .eq("user_id", user.id)
  .single()
```

**Current generatePosts call (line 60-65):**
```typescript
const posts = await generatePosts(
  site.sources.map((s: { type: string; url: string }) => ({
    type: s.type,
    url: s.url,
  }))
)
```

**New:**
```typescript
const posts = await generatePosts(
  site.sources.map((s: { type: string; url: string }) => ({
    type: s.type,
    url: s.url,
  })),
  {
    topic: site.topic,
    description: site.description,
    topicContext: site.topic_context,
  }
)
```

### 7.3 Update `/api/cron/daily-run` with context + schedule filtering

**File:** `src/app/api/cron/daily-run/route.ts`

#### Add schedule helper

```typescript
function shouldRunToday(schedule: string | null): boolean {
  if (!schedule) return true // backward compat: null = always run
  const day = new Date().getUTCDay() // 0=Sun, 1=Mon, ...
  switch (schedule) {
    case "daily":
      return true
    case "weekly":
      return day === 1 // Monday
    case "custom":
      return true // custom frequency sites run daily, posts_per_period controls volume
    default:
      return true
  }
}
```

#### Update site query to include new columns

**Current (line 17-20):**
```typescript
const { data: sites } = await supabase
  .from("sites")
  .select("id, user_id, sources(*), users!inner(id, credit_balance, auto_renew, auto_renew_pack, stripe_customer_id)")
  .or("credit_balance.gt.0,auto_renew.eq.true", { referencedTable: "users" })
```

**New:**
```typescript
const { data: sites } = await supabase
  .from("sites")
  .select("id, user_id, topic, description, topic_context, posting_schedule, sources(*), users!inner(id, credit_balance, auto_renew, auto_renew_pack, stripe_customer_id)")
  .or("credit_balance.gt.0,auto_renew.eq.true", { referencedTable: "users" })
```

#### Add schedule filter in the loop

**Current (line 26-28):**
```typescript
for (const site of (sites || []).filter(
  (s) => s.sources && s.sources.length > 0
)) {
```

**New:**
```typescript
for (const site of (sites || []).filter(
  (s) => s.sources && s.sources.length > 0 && shouldRunToday(s.posting_schedule)
)) {
```

#### Pass site context to generatePosts

**Current (line 33-38):**
```typescript
const posts = await generatePosts(
  site.sources.map((s: { type: string; url: string }) => ({
    type: s.type,
    url: s.url,
  }))
)
```

**New:**
```typescript
const posts = await generatePosts(
  site.sources.map((s: { type: string; url: string }) => ({
    type: s.type,
    url: s.url,
  })),
  {
    topic: site.topic,
    description: site.description,
    topicContext: site.topic_context,
  }
)
```

---

## Backward Compatibility

- Existing sites without `topic`/`description`/`topic_context`: `SiteContext` fields will be null → `buildPrompt()` skips the context block entirely → behavior unchanged
- Existing sites without `posting_schedule`: column default is `'weekly'` but for existing sites with null, `shouldRunToday(null)` returns `true` → they still run daily as before
- No breaking changes for existing users

---

## Security Considerations

- No new API routes or endpoints
- Site context data is read from the database (server-side only) and passed to MindStudio SDK
- No user input reaches these code paths (context comes from DB, originally validated at creation time)

---

## Verification

1. `pnpm build` passes
2. Run agent for a site WITH topic context → verify generated posts reference the topic/audience
3. Run agent for a site WITHOUT topic context → verify it still works (no context block in prompt)
4. Cron: site with `weekly` schedule → only runs on Monday
5. Cron: site with `daily` schedule → runs every day
6. Cron: site with `null` schedule (existing) → runs every day (backward compat)
7. Check Supabase logs: posts table entries should reflect topic-relevant content

---

## Files Modified

| File | Action |
|------|--------|
| `src/lib/mindstudio.ts` | Add `SiteContext` interface, extend `generatePosts()` + `buildPrompt()` |
| `src/app/api/agent/run/route.ts` | Extend site query + pass context to `generatePosts()` |
| `src/app/api/cron/daily-run/route.ts` | Add `shouldRunToday()`, extend query, filter by schedule, pass context |
