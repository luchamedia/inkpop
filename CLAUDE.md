# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

inkpop is a multi-tenant SaaS that auto-generates SEO blog posts using MindStudio AI. Users sign up free via Clerk, buy post credits via Stripe (usage-based), configure data sources (URLs to scrape), and get a hosted subdomain blog at `*.inkpop.net`. Unlimited sites, up to 15 sources per site.

**Live:** https://inkpop.net | **Repo:** github.com/luchamedia/inkpop

## Commands

- `pnpm dev` — Start development server on localhost:3000
- `pnpm build` — Production build (runs `next build`)
- `pnpm lint` — Run ESLint
- `pnpm start` — Start production server
- `pnpm dlx shadcn@latest add <component>` — Add a shadcn/ui component

## Tech Stack

- **Framework:** Next.js 16 (App Router only, no Pages Router)
- **Auth:** Clerk v7 (`@clerk/nextjs@7`)
- **Database:** Supabase (Postgres) via `@supabase/supabase-js`
- **Billing:** Stripe
- **AI:** MindStudio SDK (`@mindstudio-ai/agent`) — scrapeUrl + generateText, runs locally (no remote agent)
- **UI:** shadcn/ui + Tailwind CSS (HSL CSS variables, `cn()` from `src/lib/utils.ts`)
- **Package Manager:** pnpm
- **Deployment:** Vercel (with Vercel Cron for daily agent runs + monthly credit grants)
- **Path alias:** `@/*` maps to `./src/*`

## Architecture

### Middleware (`src/middleware.ts`)
Single middleware handles both subdomain detection and Clerk auth:
1. Extracts subdomain from `host` header (handles both `acme.localhost:3000` dev and `acme.inkpop.net` prod)
2. If subdomain found → rewrites to `/blog/[subdomain]/...` (public, no auth)
3. Otherwise → Clerk auth protects non-public routes

### Supabase Clients
- **`src/lib/supabase/server.ts`** — `createServiceClient()` uses service role key. Used in all API routes and server components. Bypasses RLS.
- **`src/lib/supabase/client.ts`** — `createBrowserClient()` uses anon key (stub for future use).
- All DB access in MVP goes through API routes with service role key. No RLS configured.

### Auth Pattern
- `src/lib/auth.ts` → `getAuthUser()` calls Clerk `await auth()`, then queries Supabase for the DB user row (returns `id`, `clerk_id`, `email`, `subscription_status`, `credit_balance`)
- All `params` and `searchParams` in pages/layouts/routes are `Promise` types and must be awaited
- Every API route that accesses user-scoped resources calls `getAuthUser()` then verifies ownership (e.g., `site.user_id === dbUser.id`)
- Nested resource ownership: posts are verified through `posts → sites → users` chain

### Dashboard Layout (`src/app/dashboard/layout.tsx`)
Server component that:
1. Checks Clerk auth
2. Upserts user row on every load (idempotent post-auth sync)
3. Redirect chain: no name → `/setup`, no sites → `/new-site`
4. Grants monthly free credits if due (login-check fallback)
5. Passes `credit_balance` to sidebar
6. Renders sidebar (`src/components/dashboard/sidebar.tsx`) + content
No subscription gate — all authenticated users access the dashboard freely.

### AI Content Generation (`src/lib/mindstudio.ts`)
Uses the `@mindstudio-ai/agent` SDK directly (no remote agent, no polling):

**Generation Workflow v2 (daily cron):**
1. `scanSourceForChanges(source, supabase)` — branches by source type: YouTube sources fetch channel videos + transcripts via `fetchYoutubeChannel`/`fetchYoutubeCaptions`, blog sources try RSS/Atom feed parsing first (with 48h lookback) then fall back to scraping, webpage sources use standard `scrapeUrl`. SHA-256 hashes content, compares to last `source_snapshots` row to detect new content
2. `extractLearnings(scrapedContent[], siteContext)` — extracts 3-8 key learnings per source (facts, trends, techniques) as structured JSON
3. `ideateArticles(learnings, siteContext, existingTitles, count=20)` — generates ~20 article ideas based on accumulated learnings (last 30 days), avoiding duplicate topics
4. `writeArticle(idea, learnings, siteContext)` — writes a full blog post from an idea, with Google web search for current facts
5. `runGenerationWorkflow(site, supabase)` — orchestrates the full pipeline: scan → extract → ideate → write top N → return remaining ideas
6. Ideas are stored in `post_ideas` with a 2-week shelf life. Users can generate posts from ideas on demand.

**Legacy functions (still used for manual generation):**
- `generatePosts(sources, siteContext?)` — scrape all → generate → return `GeneratedPost[]`
- `generatePostForTopic(topic, sources, siteContext?)` — generates a single post on a specific topic
- `suggestSources(keywords, existingUrls, page, siteContext?)` — AI-powered source discovery: generates SEO/AEO-optimized search queries from site context → 3 parallel searches (Google+Perplexity) → dedup → AI ranking → returns `SuggestedSource[]`

### Component Patterns
- **Server components** for data fetching (dashboard pages query Supabase directly)
- **Client components** (`"use client"`) for interactivity (onboarding wizard, post editor)
- New site wizard (`src/components/new-site/new-site-wizard.tsx`): 2-step flow — `StepTopic` (AI topic brief with follow-up questions) → `StepName` (AI-suggested names + subdomain). Sources are managed post-creation in the dashboard Sources tab.
- Setup progress (`src/components/site-dashboard/setup-progress.tsx`): auto-dismissing onboarding cards on site overview — tracks sources, prompt, schedule, payments, first post, first publish
- `RunAgentButton` (`src/components/agent/run-agent-button.tsx`): checks `creditBalance` prop — shows "Buy Credits" if 0, otherwise triggers generation via POST to `/api/agent/run`
- Subdomain availability: debounced (500ms) POST to `/api/sites` with `checkSubdomain: true`

### Credit System (`src/lib/credits.ts`)
Usage-based billing via pre-purchased credit packs (10/$5, 50/$22.50, 100/$40). One credit = one blog post.
- `CREDIT_PACKS` — pack config with Stripe price IDs and `priceInCents`
- `getBalance(userId)` — read credit balance
- `addCredits(userId, credits, referenceId, type?)` — atomic increment via Supabase RPC + transaction log (type defaults to `"purchase"`)
- `deductCredits(userId, postCount, siteId)` — atomic conditional deduction (prevents overdraw) + transaction log
- `autoRenewCredits(userId, stripeCustomerId, packId)` — charges saved card off-session, adds credits on success (type `"auto_renew"`)
- `FREE_MONTHLY_CREDITS = 5` — monthly free tier (use it or lose it, no stacking)
- `isMonthlyGrantDue(grantedAt)` — checks if grant is due (different calendar month)
- `grantMonthlyCredits(userId)` — atomic `GREATEST(balance, 5)` via `set_free_credit_floor` RPC + transaction log
- `SOURCE_LIMIT = 15` — max sources per site
- Checkout uses `setup_future_usage: "off_session"` to save payment methods for auto-renew

### Key Flows
- **Account setup:** Post-signup, if `users.name` is null → `/dashboard/setup` collects display name → redirects to `/new-site`. PATCH `/api/users/setup` saves the name.
- **Dashboard routing:** `/dashboard` → no name? `/dashboard/setup` → no sites? `/new-site` → has sites? `/dashboard/sites`
- **New site wizard:** `/new-site` — 2-step flow (topic brief with AI chat → AI-suggested names + subdomain). Sources are added post-creation via the dashboard Sources tab. Components in `src/components/new-site/`.
- **Source suggestions:** Persisted in `source_suggestions` table. Auto-generated on site creation (fire-and-forget). Manual refresh via POST `/api/sites/[siteId]/suggestions`. Uses SEO/AEO-optimized AI query generation → 3 parallel searches → AI ranking → persisted with 14-day expiry. GET/PATCH/POST endpoints at `/api/sites/[siteId]/suggestions` for load/dismiss/refresh. Legacy endpoint POST `/api/ai/suggest-sources` still works (accepts optional `siteId` for context).
- **Buy credits:** POST `/api/checkout` with `{ pack }` → Stripe Checkout (one-time payment, saves card via `setup_future_usage`) → webhook adds credits
- **Auto-renew:** Users opt in via `/dashboard/billing` toggle + pack selection. When credits hit 0, the system charges the saved card off-session via `autoRenewCredits()` in `src/lib/credits.ts`. Works in both manual agent runs and cron.
- **Agent run:** POST `/api/agent/run` → checks credit balance (attempts auto-renew if enabled and balance is 0, 402 if still insufficient) → `generatePosts()` → deducts credits → inserts draft posts → returns `{ success, postsCreated, creditsUsed, creditsRemaining }`
- **Publish:** POST `/api/posts/[postId]/publish` sets status=published, published_at=now
- **Stripe webhook:** `checkout.session.completed` → reads metadata (pack, credits) → calls `addCredits()`. Uses `req.text()` for raw body (signature verification).
- **Monthly free credits:** 5 credits/month, no stacking. Dual triggers: (1) cron at midnight UTC on 1st (`/api/cron/monthly-credits`), (2) login-check fallback in dashboard layout. New users get 5 credits immediately on signup.
- **Cron (daily):** GET `/api/cron/daily-run` with `Authorization: Bearer CRON_SECRET` → for each site with credits/auto-renew: runs `runGenerationWorkflow()` (scan sources for new content → extract learnings → ideate ~20 ideas → write top N posts) → stores remaining ideas in `post_ideas` (2-week TTL) → if `auto_publish` is true, posts are published automatically; otherwise saved as drafts → deducts credits per post written
- **Generate from idea:** POST `/api/sites/[siteId]/ideas/[ideaId]/generate` → loads idea metadata → calls `writeArticle()` → deducts 1 credit → inserts post (respects `auto_publish` setting)
- **Ideas:** GET `/api/sites/[siteId]/ideas` → returns active, non-expired ideas for a site. Ideas expire after 14 days.
- **Cron (monthly):** GET `/api/cron/monthly-credits` with `Authorization: Bearer CRON_SECRET` → grants free credits to all eligible users

### Route Structure
- Public: `/`, `/sign-in`, `/sign-up` (`/subscribe` redirects to `/dashboard/top-up`)
- Standalone: `/setup` (post-signup name collection), `/new-site` (site creation wizard) — auth-protected, no dashboard layout
- Dashboard: `/dashboard/**` (auth-protected, includes `/dashboard/billing`, `/dashboard/top-up`)
- Blog: `/blog/[subdomain]/**` (public, served via subdomain rewrite)
- API: `/api/checkout`, `/api/webhooks/stripe`, `/api/agent/run`, `/api/ai/suggest-sources`, `/api/ai/topic-questions`, `/api/ai/scan-company`, `/api/ai/suggest-names`, `/api/ai/generate-post-for-topic`, `/api/billing/auto-renew`, `/api/users/setup`, `/api/posts/**`, `/api/sites/**`, `/api/sites/[siteId]/ideas`, `/api/sites/[siteId]/ideas/[ideaId]/generate`, `/api/sites/[siteId]/suggestions`, `/api/cron/daily-run`, `/api/cron/monthly-credits`

## Database

10 tables, created manually in Supabase SQL Editor. No RLS — ownership enforced in application code.

```sql
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_id text UNIQUE NOT NULL,
  email text NOT NULL,
  name text,
  stripe_customer_id text,
  subscription_status text DEFAULT 'inactive',
  credit_balance integer DEFAULT 0 NOT NULL,
  auto_renew boolean DEFAULT false,
  auto_renew_pack text DEFAULT null,
  monthly_credits_granted_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  subdomain text UNIQUE NOT NULL,
  topic text,
  topic_context jsonb,
  description text,
  category text,
  posting_schedule text DEFAULT 'weekly',
  posts_per_period integer DEFAULT 1,
  auto_publish boolean DEFAULT true,
  schedule_confirmed boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid REFERENCES sites(id) ON DELETE CASCADE,
  type text NOT NULL,
  url text NOT NULL,
  label text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid REFERENCES sites(id) ON DELETE CASCADE,
  title text NOT NULL,
  slug text NOT NULL,
  body text NOT NULL,
  meta_description text,
  status text DEFAULT 'draft',
  generated_at timestamptz DEFAULT now(),
  published_at timestamptz,
  generation_run_id uuid REFERENCES generation_runs(id) ON DELETE SET NULL,
  idea_id uuid REFERENCES post_ideas(id) ON DELETE SET NULL
);

CREATE TABLE source_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid REFERENCES sources(id) ON DELETE CASCADE NOT NULL,
  content_hash text NOT NULL,
  content_preview text,
  scraped_at timestamptz DEFAULT now()
);

CREATE TABLE source_learnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid REFERENCES sites(id) ON DELETE CASCADE NOT NULL,
  source_id uuid REFERENCES sources(id) ON DELETE SET NULL,
  learnings jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE generation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid REFERENCES sites(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  sources_scanned integer DEFAULT 0,
  new_content_found integer DEFAULT 0,
  learnings_extracted integer DEFAULT 0,
  ideas_generated integer DEFAULT 0,
  posts_generated integer DEFAULT 0,
  credit_deducted boolean DEFAULT false,
  status text DEFAULT 'running',
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE post_ideas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid REFERENCES sites(id) ON DELETE CASCADE NOT NULL,
  generation_run_id uuid REFERENCES generation_runs(id) ON DELETE SET NULL,
  title text NOT NULL,
  angle text NOT NULL,
  key_learnings jsonb NOT NULL,
  status text DEFAULT 'active',
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE credit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  amount integer NOT NULL,
  balance_after integer NOT NULL,
  type text NOT NULL,
  reference_id text,
  site_id uuid REFERENCES sites(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE source_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid REFERENCES sites(id) ON DELETE CASCADE NOT NULL,
  type text NOT NULL,
  url text NOT NULL,
  label text NOT NULL,
  reason text,
  status text DEFAULT 'active',    -- active | dismissed | accepted
  search_query text,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);
```

### Supabase RPC Functions (required for atomic credit operations)
```sql
-- Atomic credit increment
CREATE OR REPLACE FUNCTION increment_credit_balance(user_id_input uuid, amount integer)
RETURNS integer AS $$
  UPDATE users SET credit_balance = credit_balance + amount
  WHERE id = user_id_input
  RETURNING credit_balance;
$$ LANGUAGE sql;

-- Atomic conditional credit deduction (prevents overdraw)
CREATE OR REPLACE FUNCTION deduct_credit_balance(user_id_input uuid, amount integer)
RETURNS integer AS $$
  UPDATE users SET credit_balance = credit_balance - amount
  WHERE id = user_id_input AND credit_balance >= amount
  RETURNING credit_balance;
$$ LANGUAGE sql;

-- Monthly free credit floor (no stacking: GREATEST(balance, floor))
CREATE OR REPLACE FUNCTION set_free_credit_floor(user_id_input uuid, floor_amount integer)
RETURNS integer AS $$
  UPDATE users
  SET credit_balance = GREATEST(credit_balance, floor_amount),
      monthly_credits_granted_at = now()
  WHERE id = user_id_input
  RETURNING credit_balance;
$$ LANGUAGE sql;
```

## Environment Variables

All env vars are in `.env.local` (gitignored). Required:

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk frontend auth |
| `CLERK_SECRET_KEY` | Clerk backend auth |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role (bypasses RLS) |
| `STRIPE_SECRET_KEY` | Stripe backend |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signature verification |
| `NEXT_PUBLIC_STRIPE_PRICE_10` | Stripe price ID for 10-credit pack ($5) |
| `NEXT_PUBLIC_STRIPE_PRICE_50` | Stripe price ID for 50-credit pack ($22.50) |
| `NEXT_PUBLIC_STRIPE_PRICE_100` | Stripe price ID for 100-credit pack ($40) |
| `MINDSTUDIO_API_KEY` | MindStudio SDK (scraping + text generation) |
| `NEXT_PUBLIC_APP_URL` | Base URL (`http://localhost:3000` or `https://inkpop.net`) |
| `CRON_SECRET` | Bearer token for cron endpoint |

See `.env.example` for the template.

## ESLint

Underscore-prefixed args (`_req`, `_params`) are allowed as unused. Configured in `eslint.config.mjs` (ESLint 9 flat config).
