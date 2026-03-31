# Route Structure

## Public
- `/`, `/sign-in`, `/sign-up` (`/subscribe` redirects to `/dashboard/top-up`)

## Standalone (auth-protected, no dashboard layout)
- `/setup` — post-signup name collection
- `/new-site` — site creation wizard

## Dashboard (auth-protected)
- `/dashboard/**` (includes `/dashboard/billing`, `/dashboard/top-up`)

## Blog (public, served via subdomain rewrite)
- `/blog/[subdomain]/**`

## API Routes
- `/api/checkout` — Stripe checkout session creation
- `/api/webhooks/stripe` — Stripe webhook handler
- `/api/agent/run` — manual post generation
- `/api/ai/suggest-sources` — AI source discovery (legacy)
- `/api/ai/topic-questions` — AI topic refinement chat
- `/api/ai/scan-company` — AI company website scanning
- `/api/ai/suggest-names` — AI site name suggestions
- `/api/ai/generate-post-for-topic` — single topic generation
- `/api/billing/auto-renew` — auto-renew toggle
- `/api/users/setup` — save user display name
- `/api/posts/**` — post CRUD + publish
- `/api/sites/**` — site CRUD + sources
- `/api/sites/[siteId]/ideas` — list active ideas
- `/api/sites/[siteId]/ideas/[ideaId]/generate` — generate from idea (legacy)
- `/api/sites/[siteId]/queue` — add queue jobs
- `/api/sites/[siteId]/queue/[queueId]` — cancel queue job
- `/api/queue/process` — queue processor
- `/api/sites/[siteId]/suggestions` — source suggestions CRUD
- `/api/cron/daily-run` — daily generation cron
- `/api/cron/monthly-credits` — monthly credit grant cron
- `/api/cron/process-queue` — queue safety net cron
