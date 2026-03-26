# Phase 8: Cleanup + Documentation

## Context

Final phase: remove deprecated files, add redirects for backward compatibility, and update all documentation to reflect the new onboarding system.

**Depends on:** All previous phases complete

---

## Changes

### 8.1 Delete deprecated files

| File | Reason |
|------|--------|
| `src/components/onboarding/step-site.tsx` | Replaced by `src/components/new-site/step-name.tsx` |
| `src/components/onboarding/step-subscribe.tsx` | Already deleted (per git status), confirm removal |

### 8.2 Redirect old onboarding route

**File:** `src/app/dashboard/onboarding/page.tsx`

Replace current content with a redirect to `/new-site`:

```typescript
import { redirect } from "next/navigation"

export default function OnboardingPage() {
  redirect("/new-site")
}
```

This preserves backward compatibility for any bookmarks or cached URLs.

### 8.3 Update `CLAUDE.md`

Updates needed in these sections:

**Database section** — add new columns:
```sql
-- In users table:
name text,
monthly_credits_granted_at timestamptz

-- In sites table:
topic text,
topic_context jsonb,
description text,
category text,
posting_schedule text DEFAULT 'weekly',
posts_per_period integer DEFAULT 1
```

Add new RPC:
```sql
CREATE OR REPLACE FUNCTION set_free_credit_floor(user_id_input uuid, floor_amount integer)
RETURNS integer AS ...
```

**Route Structure section** — add:
- `/new-site` — site creation wizard (auth-protected, minimal layout)
- `/dashboard/setup` — post-signup name collection
- `/dashboard/billing` — credit management + auto-renew

**API routes** — add:
- `POST /api/ai/topic-questions` — AI follow-up questions for topic refinement
- `POST /api/ai/scan-company` — scrape company website for blog topic extraction
- `POST /api/ai/suggest-names` — AI-generated site name suggestions
- `POST /api/ai/generate-post-for-topic` — single post generation from specific topic
- `PATCH /api/sites/[siteId]` — update site settings (schedule, name)
- `PATCH /api/users/setup` — update user display name
- `GET /api/cron/monthly-credits` — monthly free credit grant

**Key Flows section** — update/add:
- **Onboarding flow:** sign up → email verification → enter name → create site (topic chat → sources → schedule → name) → site dashboard with to-do
- **Monthly free credits:** 5 credits/month, no stacking, granted via cron (1st of month) + login-check fallback
- **Posting schedule:** per-site config (daily/weekly/custom), cron filters by schedule

**Credit System section** — add:
- `FREE_MONTHLY_CREDITS = 5` — monthly free tier constant
- `grantMonthlyCredits(userId)` — atomic credit floor grant
- `isMonthlyGrantDue(grantedAt)` — check if monthly grant is due

**Component Patterns section** — add:
- New site wizard: `src/components/new-site/` — 4-step wizard, topic chat UI, schedule config
- Site to-do list: `src/components/dashboard/site-todo-list.tsx` — guided setup checklist

### 8.4 Update `.env.example`

No new env vars needed (all AI uses existing `MINDSTUDIO_API_KEY`, cron uses `CRON_SECRET`). Verify no stale entries.

### 8.5 Update `vercel.json`

Verify both cron entries are present:
```json
{
  "crons": [
    { "path": "/api/cron/daily-run", "schedule": "0 6 * * *" },
    { "path": "/api/cron/monthly-credits", "schedule": "0 0 1 * *" }
  ]
}
```

### 8.6 Update `.claude/plans/TODO.md`

Mark all AI-Assisted Onboarding items as complete. Add any new items discovered during implementation. Update the plan reference to point to this onboarding plan directory.

### 8.7 Update `.claude/plans/ai-onboarding.md`

Replace content with a note:

```markdown
# AI-Assisted Onboarding (ARCHIVED)

This plan has been superseded by the revamped onboarding system.
See `.claude/plans/onboarding/` for the current plan.
```

### 8.8 Update auto-memory

**File:** `/Users/luischavez/.claude/projects/-Users-luischavez-Documents-CodeJunk---inkpop/memory/MEMORY.md`

Update:
- **Key Decisions:** Add monthly free credits (5/month, no stacking), per-site posting schedules, `/new-site` wizard flow
- **AI Generation Flow:** Note `SiteContext` parameter, `generatePostForTopic()` function
- **Key Conventions:** Note conversational AI topic refinement, company website scanning

---

## Verification

1. `pnpm build` passes
2. `pnpm lint` passes
3. Navigate to `/dashboard/onboarding` → redirected to `/new-site`
4. Full end-to-end: sign up → name → create site → sources → schedule → name → site dashboard → create post → publish
5. All docs accurate: cross-reference `CLAUDE.md` routes, DB schema, flows against actual code
6. No stale references to old onboarding flow in any docs

---

## Files Modified/Deleted

| File | Action |
|------|--------|
| `src/components/onboarding/step-site.tsx` | Delete |
| `src/app/dashboard/onboarding/page.tsx` | Replace with redirect to `/new-site` |
| `CLAUDE.md` | Update DB, routes, flows, credit system, components |
| `.env.example` | Verify (no changes expected) |
| `vercel.json` | Verify cron entries |
| `.claude/plans/TODO.md` | Mark onboarding items complete |
| `.claude/plans/ai-onboarding.md` | Archive with pointer to new plans |
| `MEMORY.md` | Update key decisions and flows |
