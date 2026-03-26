# Master Plan: Revamped Onboarding System

## Context

The current onboarding is a 2-step wizard inside `/dashboard/onboarding` (name site → add sources). We're replacing it with a full new-user journey: post-signup account setup → dedicated `/new-site` wizard with AI conversational topic refinement → site dashboard with guided to-do list. This also introduces a monthly free tier (5 credits/month) and per-site posting schedules.

**Replaces:** `.claude/plans/ai-onboarding.md` (old 4-step wizard plan)

---

## Phases & Sub-Plans

Each phase has its own detailed plan document. Phases are ordered by dependency — each is independently deployable.

| Phase | Feature | Plan File | Status |
|-------|---------|-----------|--------|
| 1 | Database Migrations | `01-db-migrations.md` | Done |
| 2 | Monthly Free Credits | `02-free-credits.md` | Done |
| 3 | Post-Signup Account Setup | `03-account-setup.md` | Done |
| 4 | `/new-site` Wizard | `04-new-site-wizard.md` | Done |
| 5 | Adaptive Sidebar | `05-adaptive-sidebar.md` | Pending |
| 6 | Site Dashboard To-Do List | `06-site-todo.md` | Pending |
| 7 | Generation Context + Cron Scheduling | `07-generation-context.md` | Pending |
| 8 | Cleanup + Documentation | `08-cleanup.md` | Pending |

---

## Phase Summaries

### Phase 1: Database Migrations
Add columns to `users` (`name`, `monthly_credits_granted_at`) and `sites` (`topic`, `topic_context`, `description`, `category`, `posting_schedule`, `posts_per_period`). New RPC function `set_free_credit_floor` for atomic monthly credit grants. Update `getAuthUser()` select.

### Phase 2: Monthly Free Credits (5/month, no stacking)
Auto-grant 5 credits monthly using `GREATEST(balance, 5)` semantics — if balance < 5, set to 5; if >= 5, leave it. Dual triggers: monthly cron + login-check fallback. New `grantMonthlyCredits()` in `credits.ts`. Billing page updated with free tier info.

### Phase 3: Post-Signup Account Setup
Enable Clerk built-in email verification (dashboard config). Add name collection gate: if `users.name` is null, redirect to `/dashboard/setup` where user enters display name. After setup, CTA directs to `/new-site`. Dashboard landing page (`/dashboard`) redirects new users to `/new-site` instead of `/dashboard/onboarding`.

### Phase 4: `/new-site` Wizard (largest phase)
Four-step wizard at `/new-site` (outside dashboard, minimal layout):
1. **Topic Definition** — two paths: (a) enter topic → AI generates 2-3 follow-up questions via conversational chat UI → user answers → context refined, or (b) enter company URL → AI scrapes and extracts topic/audience
2. **Sources of Truth** — reuses existing `SourceSuggestions` component, pre-populated with topic, up to 10 sources
3. **Posting Schedule** — frequency cards (daily/weekly/custom) + posts-per-period input, free tier info
4. **Name Your Site** — AI suggests 5 names as clickable chips, subdomain auto-generated with availability check

Site created at the end (single POST with all accumulated data). Three new AI API endpoints, all using MindStudio SDK.

### Phase 5: Adaptive Sidebar
Sidebar always visible but changes based on state. No sites: logo, account, help, credit balance, "Create a site" CTA. Has sites: full nav (Sites, Dashboard, Billing) + credit balance.

### Phase 6: Site Dashboard To-Do List
After site creation, site dashboard shows a guided checklist:
- **Create your first post** — scan sources & suggest (reuse `RunAgentButton`) OR enter specific topic (new endpoint)
- **Set posting schedule** — inline schedule config card, PATCHes site
- **Customize the look** — placeholder "Coming soon" (future: AI-assisted design tokens)

New components for to-do list, post creation dialog, schedule config card. New API routes for topic-specific post generation and site PATCH.

### Phase 7: Generation Context + Cron Scheduling
Extend `generatePosts()` to accept `SiteContext` (topic, description, topicContext) and prepend to prompt. Update `/api/agent/run` and `/api/cron/daily-run` to fetch and pass site context. Add `shouldRunToday(schedule)` helper to cron for per-site schedule filtering. Null schedules default to daily (backward compat).

### Phase 8: Cleanup + Documentation
Delete old `step-site.tsx`. Redirect `/dashboard/onboarding` → `/new-site`. Update `CLAUDE.md`, `.env.example`, `vercel.json`, `TODO.md`, `README.md`.

---

## Future (out of scope, noted for later)

- **AI Blog Post Generation Agent** — user has a MindStudio agent to recreate using the SDK; will walk through when ready
- **Customize the Look** — AI-assisted design tokens, layout selection, share images
- **Site Dashboard Tabs** — to be designed separately
- **Clerk v5 → v7 upgrade** — Clerk dashboard shows "Client Trust Status" update requiring @clerk/nextjs v7+. Currently on v5. Major breaking change (auth APIs, middleware, components). Do after Phase 8 when stable.

---

## Dependency Graph

```
Phase 1 (DB) ──────────────────┐
                                ↓
Phase 2 (Free Credits) ────────┤
                                ↓
Phase 3 (Account Setup) ───────┤
                                ↓
Phase 4 (/new-site Wizard) ────┤
                                ↓
Phase 5 (Sidebar) ─────────────┤
                                ↓
Phase 6 (Site To-Do) ──────────┤
                                ↓
Phase 7 (Context + Cron) ──────┤
                                ↓
Phase 8 (Cleanup + Docs) ──────┘
```
