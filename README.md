# inkpop

Auto-generate SEO blog posts for any website. Sign up, add your data sources, and get a hosted blog at `yoursite.inkpop.net`.

**Live:** [inkpop.net](https://inkpop.net)

## How It Works

1. **Sign up** via Clerk authentication
2. **Create a site** — pick a subdomain (e.g., `acme.inkpop.net`)
3. **Add data sources** — URLs to websites you want blog content about
4. **Subscribe** — $49/mo via Stripe
5. **Generate content** — MindStudio AI scrapes your sources and writes SEO-optimized blog posts
6. **Review & publish** — edit drafts in the dashboard, publish when ready
7. **Automatic daily runs** — cron generates new content daily for active subscribers

## Tech Stack

- **Next.js 14** (App Router) — framework
- **Clerk** — authentication
- **Supabase** — Postgres database
- **Stripe** — billing ($49/mo subscription)
- **MindStudio SDK** — AI content generation (web scraping + text generation)
- **shadcn/ui + Tailwind CSS** — UI components
- **Vercel** — hosting + cron jobs

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm
- Accounts: [Clerk](https://clerk.com), [Supabase](https://supabase.com), [Stripe](https://stripe.com), [MindStudio](https://mindstudio.ai)

### Setup

1. Clone the repo:
   ```bash
   git clone https://github.com/luchamedia/inkpop.git
   cd inkpop
   pnpm install
   ```

2. Copy `.env.example` to `.env.local` and fill in your keys:
   ```bash
   cp .env.example .env.local
   ```

3. Create the database tables in Supabase SQL Editor (see the Database section in `CLAUDE.md` for the full schema).

4. Start the dev server:
   ```bash
   pnpm dev
   ```

5. Open [http://localhost:3000](http://localhost:3000)

### Full Setup Guide

See [`CLAUDE.md`](CLAUDE.md) for the database schema and architecture details, and [`.claude/plans/TODO.md`](.claude/plans/TODO.md) for the project checklist.

## Architecture

```
User → Clerk Auth → Dashboard
                      ├── Create Site (subdomain)
                      ├── Add Sources (URLs)
                      ├── Subscribe (Stripe $49/mo)
                      └── Run Agent
                            ├── scrapeUrl() — fetches source content
                            ├── generateText() — AI writes blog posts
                            └── Insert drafts → Supabase

Subdomain Blog → middleware rewrites → /blog/[subdomain]/...
Cron (daily) → generates posts for all active subscribers
Stripe Webhook → manages subscription status
```

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── agent/run/         # POST — generate blog posts
│   │   ├── checkout/          # POST — create Stripe session
│   │   ├── cron/daily-run/    # GET — daily content generation
│   │   ├── posts/             # CRUD for blog posts
│   │   ├── sites/             # CRUD for sites + sources
│   │   └── webhooks/stripe/   # Stripe webhook handler
│   ├── blog/[subdomain]/      # Public blog pages
│   ├── dashboard/             # Auth-protected dashboard
│   └── sign-in, sign-up/     # Clerk auth pages
├── components/
│   ├── agent/                 # RunAgentButton
│   ├── dashboard/             # Sidebar, layout components
│   └── ui/                    # shadcn/ui components
├── lib/
│   ├── auth.ts                # getAuthUser() — Clerk + Supabase
│   ├── mindstudio.ts          # generatePosts() — scrape + AI generate
│   ├── stripe.ts              # Stripe client
│   └── supabase/              # Supabase clients (server + browser)
└── middleware.ts               # Subdomain detection + Clerk auth
```

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start dev server (localhost:3000) |
| `pnpm build` | Production build |
| `pnpm lint` | Run ESLint |
| `pnpm start` | Start production server |
