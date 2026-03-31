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

## Detailed Documentation

These files contain detailed reference information. Read them on-demand when working on related features:

| Topic | File | When to read |
|-------|------|-------------|
| Database schema & RPC functions | `.claude/docs/database.md` | Any DB work, migrations, queries |
| Key flows (auth, billing, generation) | `.claude/docs/flows.md` | Understanding user journeys, debugging flows |
| AI content generation pipeline | `.claude/docs/ai-generation.md` | Working on `src/lib/mindstudio.ts` or generation |
| Generation queue system | `.claude/docs/queue.md` | Queue processing, job lifecycle |
| Credit system | `.claude/docs/credits.md` | Billing, credits, Stripe integration |
| Route structure | `.claude/docs/routes.md` | Adding routes, understanding URL structure |
| Component patterns | `.claude/docs/components.md` | Building UI, understanding component conventions |

## Subagent Usage

**You MUST use specialized subagents for all code tasks.** Act as an orchestrator — delegate, don't execute directly. See `.claude/rules/orchestration.md` for the full protocol.

### Generators (one at a time, never parallel)
| Agent | Use for |
|-------|---------|
| `frontend-dev` | Next.js pages, React components, shadcn/ui, Tailwind, blog theme |
| `api-dev` | API routes, Supabase queries, auth middleware, Stripe, cron jobs |
| `seo-specialist` | Blog SEO, meta tags, structured data, sitemaps, Open Graph |
| `perf-optimizer` | Bundle size, caching/ISR, DB query optimization, Core Web Vitals |

### Evaluators (run in parallel after generation)
| Agent | Use for |
|-------|---------|
| `qa-tester` | **Always** — build, lint, logic review, test validation |
| `security-auditor` | API changes, auth, data handling |
| `content-reviewer` | User-facing text, AI-generated content quality |
| `code-reviewer` | Code quality, style guide adherence |
| `code-simplifier` | Simplify overly complex code |
| `silent-failure-hunter` | Error handling, catch blocks, fallback logic |
| `type-design-analyzer` | New type definitions |

### Research & Planning
| Agent | Use for |
|-------|---------|
| `Explore` | Codebase exploration, finding files, understanding patterns |
| `Plan` | Architecture decisions, implementation strategy |
| `general-purpose` | Multi-step research, complex searches |

### Workflow Quick Reference
| Task | Generator → Evaluators |
|------|----------------------|
| Frontend UI | `frontend-dev` → `qa-tester` + `security-auditor` + `content-reviewer` |
| API route | `api-dev` → `qa-tester` + `security-auditor` |
| Full-stack | `api-dev` first, then `frontend-dev` → `qa-tester` + `security-auditor` + `content-reviewer` |
| Blog/SEO | `seo-specialist` → `qa-tester` + `content-reviewer` + `seo-specialist` |
| Bug fix | appropriate generator → `qa-tester` |
| Refactor | appropriate generator → `qa-tester` + `code-reviewer` |

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
