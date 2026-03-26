# inkpop — Project TODO

## In Progress

### Credit Pack Billing — Remaining
- [x] Run DB migration (credit_balance column, credit_transactions table, RPC functions)
- [x] Create Stripe product "inkpop Post Credits" with 3 one-time prices ($5, $22.50, $40)
- [x] Add `NEXT_PUBLIC_STRIPE_PRICE_10/50/100` to `.env.local`
- [x] Remove `NEXT_PUBLIC_STRIPE_PRICE_ID` from `.env.local`
- [x] Add `NEXT_PUBLIC_STRIPE_PRICE_10/50/100` to Vercel env vars
- [x] Remove `NEXT_PUBLIC_STRIPE_PRICE_ID` from Vercel env vars
- [x] Update Stripe webhook to only listen for `checkout.session.completed`
- [x] Delete `src/components/onboarding/step-subscribe.tsx` (no longer used)
- [ ] Test: buy credits via Stripe test checkout → verify webhook adds credits → run agent → verify deduction
- [x] Run DB migration: `ALTER TABLE users ADD COLUMN auto_renew boolean DEFAULT false, ADD COLUMN auto_renew_pack text DEFAULT null;`
- [ ] Test: enable auto-renew → exhaust credits → run agent → verify auto-charge + credit addition

### Revamped Onboarding (`.claude/plans/onboarding/00-master-plan.md`)
- [x] Phase 1: DB migrations — users (name, monthly_credits_granted_at) + sites (topic, topic_context, description, category, posting_schedule, posts_per_period) + set_free_credit_floor RPC
- [x] Phase 2: Monthly free credits — 5/month, no stacking, cron + login-check grant + new user auto-grant
- [x] Phase 3: Post-signup account setup — name collection gate `/dashboard/setup`, PATCH `/api/users/setup`, dashboard redirect chain
- [ ] Phase 3 manual: Enable Clerk email verification in Clerk Dashboard (config, not code)
- [x] Phase 4: `/new-site` wizard — AI topic brief (editable + refine), company scan, sources, schedule, AI name suggestions
- [x] Phase 5: Adaptive sidebar — minimal before first site, full after
- [x] Phase 6: Site dashboard to-do list — create post, set schedule, customize look (placeholder)
- [x] Phase 7: Generation context + cron scheduling — site context in prompts, per-site schedule filtering
- [x] Phase 8: Cleanup + documentation — delete old files, update all docs
- [x] AI source suggestion engine (carried over from previous plan)

---

## Remaining Setup
- [ ] Switch Clerk to production keys
- [ ] Test Stripe locally with `stripe listen --forward-to localhost:3000/api/webhooks/stripe`
- [ ] End-to-end test: sign up → onboard → buy credits → generate → publish → visit subdomain

## Completed
- [x] Clerk auth configured (test keys)
- [x] Supabase project + 5 tables + 2 RPC functions
- [x] Stripe account + credit pack product + 3 one-time prices + webhook endpoint
- [x] MindStudio local SDK integration
- [x] Vercel deployment + domains (inkpop.net, *.inkpop.net)
- [x] Build fixes (_error.tsx, not-found.tsx, optional chaining)
- [x] Credit pack billing: credits.ts, checkout, webhook, agent/run, cron, dashboard layout, sidebar, billing page, subscribe page, onboarding wizard simplified
- [x] AI source suggestion engine: suggestSources() in mindstudio.ts, /api/ai/suggest-sources, shared SourceSuggestions component, integrated into onboarding + dashboard
- [x] DB migration via Supabase CLI (credit_balance, credit_transactions, RPC functions)
- [x] Stripe product + prices created via CLI, env vars set in .env.local
- [x] Saved payment methods (setup_future_usage on checkout)
- [x] Auto-renew credits: autoRenewCredits(), /api/billing/auto-renew, billing page toggle, agent run + cron integration
- [x] Homepage updated: credit pack pricing, corrected copy (10 sources, pay-as-you-go)
- [x] Onboarding Phase 1: DB migration pushed via Supabase CLI — new columns on users/sites + set_free_credit_floor RPC
- [x] Onboarding Phase 2: Monthly free credits — grantMonthlyCredits(), isMonthlyGrantDue(), /api/cron/monthly-credits, login-check fallback in dashboard layout, new user auto-grant, billing page free tier info
- [x] Onboarding Phase 3: Account setup — /dashboard/setup page, NameSetupForm component, PATCH /api/users/setup, dashboard redirect chain (no name → setup, no sites → /new-site, has sites → /dashboard/sites)
- [x] Supabase CLI skill (.claude/skills/supabase-cli/) + always-on rule (.claude/rules/supabase-cli.md)
- [x] Updated supabase-patterns skill with new columns + credit_transactions table
- [x] Onboarding Phase 4: /new-site wizard — 4-step flow (topic brief → sources → schedule → name), 3 AI endpoints (topic-brief, scan-company, suggest-names), sites API accepts new fields
- [x] Moved /dashboard/setup → /setup (standalone screen, no dashboard layout for pre-onboarding)
- [x] Lazy Stripe initialization (getStripe()) to prevent module-level crash when env var not loaded
- [x] SourceSuggestions: added initialQuery prop with auto-search, manual add is single-row layout