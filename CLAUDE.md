# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AutoPub is a multi-tenant SaaS that wraps a MindStudio AI agent to auto-generate SEO blog posts. Users sign up via Clerk, pay via Stripe ($49/mo), configure data sources, and get a hosted subdomain blog. See [PRD.md](PRD.md) for full requirements.

## Commands

- `pnpm dev` — Start development server on localhost:3000
- `pnpm build` — Production build (runs `next build`)
- `pnpm lint` — Run ESLint
- `pnpm start` — Start production server
- `pnpm dlx shadcn@latest add <component>` — Add a shadcn/ui component

## Tech Stack

- **Framework:** Next.js 14 (App Router only, no Pages Router)
- **Auth:** Clerk v5 (`@clerk/nextjs@5`)
- **Database:** Supabase (Postgres) via `@supabase/supabase-js`
- **Billing:** Stripe
- **AI Agent:** MindStudio API
- **UI:** shadcn/ui + Tailwind CSS (HSL CSS variables, `cn()` from `src/lib/utils.ts`)
- **Package Manager:** pnpm
- **Deployment:** Vercel (with Vercel Cron for daily agent runs)
- **Path alias:** `@/*` maps to `./src/*`

## Architecture

### Middleware (`src/middleware.ts`)
Single middleware handles both subdomain detection and Clerk auth:
1. Extracts subdomain from `host` header (handles both `acme.localhost:3000` dev and `acme.autopub.com` prod)
2. If subdomain found → rewrites to `/blog/[subdomain]/...` (public, no auth)
3. Otherwise → Clerk auth protects non-public routes

### Supabase Clients
- **`src/lib/supabase/server.ts`** — `createServiceClient()` uses service role key. Used in all API routes and server components. Bypasses RLS.
- **`src/lib/supabase/client.ts`** — `createBrowserClient()` uses anon key (stub for future use).
- All DB access in MVP goes through API routes with service role key. No RLS configured.

### Auth Pattern
- `src/lib/auth.ts` → `getAuthUser()` calls Clerk `auth()`, then queries Supabase for the DB user row (returns `id`, `clerk_id`, `email`, `subscription_status`)
- Every API route that accesses user-scoped resources calls `getAuthUser()` then verifies ownership (e.g., `site.user_id === dbUser.id`)
- Nested resource ownership: posts are verified through `posts → sites → users` chain

### Dashboard Layout (`src/app/dashboard/layout.tsx`)
Server component that:
1. Checks Clerk auth
2. Upserts user row on every load (idempotent post-auth sync)
3. Renders sidebar (`src/components/dashboard/sidebar.tsx`) + content

### Component Patterns
- **Server components** for data fetching (dashboard pages query Supabase directly)
- **Client components** (`"use client"`) for interactivity (onboarding wizard, agent polling, post editor)
- Onboarding wizard (`src/app/dashboard/onboarding/page.tsx`): parent manages step state, renders `StepSite` → `StepSources` → `StepSubscribe` child components
- `RunAgentButton` (`src/components/agent/run-agent-button.tsx`): triggers agent run, then polls status every 5s via `setInterval`
- Subdomain availability: debounced (500ms) POST to `/api/sites` with `checkSubdomain: true`

### Key Flows
- **Onboarding:** 3-step wizard (name site → add sources → Stripe checkout)
- **Agent run:** POST `/api/agent/run` → MindStudio API (`src/lib/mindstudio.ts`) → poll `/api/agent/status/[jobId]` every 5s → draft posts created
- **Publish:** POST `/api/posts/[postId]/publish` sets status=published, published_at=now
- **Stripe webhook:** `checkout.session.completed` → set active; `customer.subscription.deleted` → set canceled. Uses `req.text()` for raw body (signature verification).
- **Cron:** GET `/api/cron/daily-run` with `Authorization: Bearer CRON_SECRET` → triggers agent for all active-subscription sites

### Route Structure
- Public: `/`, `/subscribe`, `/sign-in`, `/sign-up`
- Dashboard: `/dashboard/**` (auth-protected)
- Blog: `/blog/[subdomain]/**` (public, served via subdomain rewrite)
- API: `/api/checkout`, `/api/webhooks/stripe`, `/api/agent/**`, `/api/posts/**`, `/api/sites/**`, `/api/cron/daily-run`

## Database

4 tables: `users`, `sites`, `sources`, `posts`. Schema defined in PRD.md Section 3. Tables must be created manually in Supabase SQL editor.

## Environment Variables

All env vars are in `.env.local` (gitignored). Required keys: Clerk, Supabase, Stripe, MindStudio, NEXT_PUBLIC_APP_URL, CRON_SECRET. See `.env.local` for the full list.

## ESLint

Underscore-prefixed args (`_req`, `_params`) are allowed as unused. Configured in `.eslintrc.json`.
