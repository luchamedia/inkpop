# Key Flows

## Account & Dashboard
- **Account setup:** Post-signup, if `users.name` is null → `/dashboard/setup` collects display name → redirects to `/new-site`. PATCH `/api/users/setup` saves the name.
- **Dashboard routing:** `/dashboard` → no name? `/dashboard/setup` → no sites? `/new-site` → has sites? `/dashboard/sites`
- **New site wizard:** `/new-site` — 2-step flow (topic brief with AI chat → AI-suggested names + subdomain). Sources are added post-creation via the dashboard Sources tab. Components in `src/components/new-site/`.

## Sources & Suggestions
- **Source suggestions:** Persisted in `source_suggestions` table. Auto-generated on site creation (fire-and-forget). Manual refresh via POST `/api/sites/[siteId]/suggestions`. Uses SEO/AEO-optimized AI query generation → 3 parallel searches → AI ranking → persisted with 14-day expiry. GET/PATCH/POST endpoints at `/api/sites/[siteId]/suggestions` for load/dismiss/refresh. Legacy endpoint POST `/api/ai/suggest-sources` still works (accepts optional `siteId` for context).

## Billing & Credits
- **Buy credits:** POST `/api/checkout` with `{ pack }` → Stripe Checkout (one-time payment, saves card via `setup_future_usage`) → webhook adds credits
- **Auto-renew:** Users opt in via `/dashboard/billing` toggle + pack selection. When credits hit 0, the system charges the saved card off-session via `autoRenewCredits()` in `src/lib/credits.ts`. Works in both manual agent runs and cron.
- **Stripe webhook:** `checkout.session.completed` → reads metadata (pack, credits) → calls `addCredits()`. Uses `req.text()` for raw body (signature verification).
- **Monthly free credits:** 5 credits/month, no stacking. Dual triggers: (1) cron at midnight UTC on 1st (`/api/cron/monthly-credits`), (2) login-check fallback in dashboard layout. New users get 5 credits immediately on signup.

## Content Generation
- **Agent run:** POST `/api/agent/run` → checks credit balance (attempts auto-renew if enabled and balance is 0, 402 if still insufficient) → `generatePosts()` → deducts credits → inserts draft posts → returns `{ success, postsCreated, creditsUsed, creditsRemaining }`
- **Publish:** POST `/api/posts/[postId]/publish` sets status=published, published_at=now
- **Cron (daily):** GET `/api/cron/daily-run` with `Authorization: Bearer CRON_SECRET` → for each site with credits/auto-renew: runs `runGenerationWorkflow()` with `skipWriting` (scan → extract → ideate) → stores remaining ideas in `post_ideas` → inserts queue jobs for top N ideas (reserves credits) → queue processor writes posts asynchronously

## Queue System
- **Generate from idea (queued):** POST `/api/sites/[siteId]/queue` with `{ type: "idea", ideaId }` → reserves 1 credit → inserts queue job → fire-and-forget triggers `POST /api/queue/process` → processor calls `writeArticle()` → inserts post (respects `auto_publish`)
- **Generate from topic (queued):** POST `/api/sites/[siteId]/queue` with `{ type: "topic", topic }` → same flow as above but calls `generatePostForTopic()`
- **Queue processing:** `POST /api/queue/process` → claims next job atomically via `claim_next_queue_job()` RPC → generates post → self-chains to next job. Safety net: `GET /api/cron/process-queue` runs every 2 min
- **Cancel queued job:** DELETE `/api/sites/[siteId]/queue/[queueId]` → refunds credit → restores idea to active if applicable

## Ideas
- **Generate from idea (legacy):** POST `/api/sites/[siteId]/ideas/[ideaId]/generate` → still works for direct generation (not queued)
- **Ideas:** GET `/api/sites/[siteId]/ideas` → returns active, non-expired ideas for a site. Ideas expire after 14 days.

## Cron Jobs
- **Cron (daily):** GET `/api/cron/daily-run` — scans sources, extracts learnings, ideates, queues top ideas
- **Cron (monthly):** GET `/api/cron/monthly-credits` — grants free credits to all eligible users
- **Cron (queue safety net):** GET `/api/cron/process-queue` — every 2 min, kicks stale queue processing
