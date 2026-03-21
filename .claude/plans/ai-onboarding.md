# Plan: AI-Assisted Onboarding

## Context

The current onboarding is a 3-step wizard (name site → add sources → subscribe). We're redesigning it as a 4-step AI-assisted flow that helps users set up better sites faster. Payment is removed from onboarding (handled separately by the pricing tiers plan).

## New Flow
Dashboard → welcome CTA → click "Create your first site" → 4-step wizard:

1. **Content & Vibe** — pick category, describe vibe in plain English, AI drafts site description
2. **Sources of Truth** — AI recommends sources based on description, user can add manually too
3. **Posting Schedule** — pick daily / 3x week / weekly
4. **Name Your Site** — AI suggests names, or type your own. Subdomain auto-generated.

Site is created at the end of step 4 (all data accumulated, single POST).

---

## Steps

### 1. Database migration (SQL in Supabase)
```sql
ALTER TABLE sites ADD COLUMN description text;
ALTER TABLE sites ADD COLUMN category text;
ALTER TABLE sites ADD COLUMN vibe text;
ALTER TABLE sites ADD COLUMN posting_schedule text DEFAULT 'daily';
```

### 2. New AI API endpoints
All use the MindStudio SDK (`agent.generateText()` with structured JSON output) — this is the **only** AI provider for this project. No OpenAI, Anthropic, or other LLM SDKs.

- **`POST /api/ai/describe-site`** — `{ category, vibe }` → AI returns `{ description }` (2-3 sentence site description)
- **`POST /api/ai/recommend-sources`** — `{ description, category }` → AI returns `{ sources: [{ type, url, label }] }` (3-5 recommendations)
- **`POST /api/ai/suggest-names`** — `{ description, category }` → AI returns `{ names: string[] }` (5 catchy names)

Files: `src/app/api/ai/describe-site/route.ts`, `src/app/api/ai/recommend-sources/route.ts`, `src/app/api/ai/suggest-names/route.ts`

### 3. Update existing API
- **`src/app/api/sites/route.ts`** — accept new fields in POST body: `description`, `category`, `vibe`, `posting_schedule`

### 4. New onboarding components
- **`src/components/onboarding/step-vibe.tsx`** — category grid (clickable chips) + vibe textarea + "Generate description" button + description preview/edit
- **`src/components/onboarding/step-sources.tsx`** (rewrite) — "Sources of Truth" header with explanation + AI recommend button + manual add form + combined source list (max 5)
- **`src/components/onboarding/step-schedule.tsx`** — 3 selectable cards: Daily, 3x/week, Weekly
- **`src/components/onboarding/step-name.tsx`** — AI name suggestions as clickable chips + manual name/subdomain input with availability check

### 5. Wizard rewrite
**`src/components/onboarding/onboarding-wizard.tsx`** — 4 steps, accumulates `WizardData` object, creates site + sources on final step. Remove `isSubscribed` prop.

### 6. Dashboard landing
**`src/app/dashboard/page.tsx`** — if no sites, render welcome card with CTA instead of auto-redirecting to onboarding.

### 7. Update blog generation prompt
**`src/lib/mindstudio.ts`**:
- `generatePosts()` accepts optional `siteContext: { description, category, vibe }`
- `buildPrompt()` prepends site context block when available
- Callers updated: `/api/agent/run` and `/api/cron/daily-run` fetch + pass site context

### 8. Posting schedule in cron
**`src/app/api/cron/daily-run/route.ts`**:
- Add `posting_schedule` to the sites select query
- Add `shouldRunToday(schedule)` helper: daily=always, 3x-week=Mon/Wed/Fri, weekly=Monday
- Skip sites where schedule says not today

### 9. Cleanup
- Delete old `step-site.tsx` and `step-subscribe.tsx`

---

## Verification
1. `pnpm build` passes
2. Dashboard shows welcome CTA for new users (no auto-redirect)
3. Step 1: pick category + describe vibe → AI generates description
4. Step 2: AI recommends sources → user can accept/reject + add manual ones
5. Step 3: pick schedule → stored on site
6. Step 4: AI suggests names → subdomain availability check works → site created
7. Agent run uses site context in prompt → posts match site vibe
8. Cron respects posting schedule (daily runs, weekly skips non-Monday)

## Key Files
- `src/app/api/ai/describe-site/route.ts` (new)
- `src/app/api/ai/recommend-sources/route.ts` (new)
- `src/app/api/ai/suggest-names/route.ts` (new)
- `src/app/api/sites/route.ts`
- `src/app/api/agent/run/route.ts`
- `src/app/api/cron/daily-run/route.ts`
- `src/lib/mindstudio.ts`
- `src/app/dashboard/page.tsx`
- `src/app/dashboard/onboarding/page.tsx`
- `src/components/onboarding/onboarding-wizard.tsx`
- `src/components/onboarding/step-vibe.tsx` (new)
- `src/components/onboarding/step-sources.tsx` (rewrite)
- `src/components/onboarding/step-schedule.tsx` (new)
- `src/components/onboarding/step-name.tsx` (new)
- `src/components/onboarding/step-site.tsx` (delete)
- `src/components/onboarding/step-subscribe.tsx` (delete)

## Dependency
This plan assumes the pricing tiers plan (`.claude/plans/pricing-tiers.md`) is implemented first, specifically:
- Dashboard layout subscription gate is already removed (free users can access dashboard)
- `isSubscribed` logic is already gone from onboarding