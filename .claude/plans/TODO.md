# inkpop — Project TODO

## In Progress

### Multi-Tier Pricing (`.claude/plans/pricing-tiers.md`)
- [ ] Create `src/lib/plans.ts` config module
- [ ] DB migration: add `plan` and `stripe_subscription_id` columns to `users`
- [ ] Update `getAuthUser()` to return `plan`
- [ ] Remove subscription gate from dashboard layout
- [ ] Create `src/lib/limits.ts` enforcement helpers
- [ ] Update `/api/sites` with site limit check
- [ ] Update `/api/agent/run` with post limit check
- [ ] Update `/api/cron/daily-run` with post limit check
- [ ] Update `/api/checkout` to accept plan parameter
- [ ] Update `/api/webhooks/stripe` (store plan, handle subscription.updated)
- [ ] Create `/api/billing/change-plan` route
- [ ] Rewrite `/subscribe` page with 4-tier pricing grid
- [ ] Create `/dashboard/billing` page
- [ ] Add Billing link to sidebar
- [ ] Create 3 Stripe products/prices (Plus, Pro, Ultra)
- [ ] Add new env vars to `.env.local` and `.env.example`
- [ ] Delete `step-subscribe.tsx`
- [ ] Update CLAUDE.md (env vars table, routes, database schema)

### AI-Assisted Onboarding (`.claude/plans/ai-onboarding.md`)
- [ ] DB migration: add `description`, `category`, `vibe`, `posting_schedule` to `sites`
- [ ] Create `/api/ai/describe-site` endpoint
- [ ] Create `/api/ai/recommend-sources` endpoint
- [ ] Create `/api/ai/suggest-names` endpoint
- [ ] Update `/api/sites` POST to accept new fields
- [ ] Build `step-vibe.tsx` component
- [ ] Rewrite `step-sources.tsx` (Sources of Truth + AI recommendations)
- [ ] Build `step-schedule.tsx` component
- [ ] Build `step-name.tsx` component
- [ ] Rewrite `onboarding-wizard.tsx` (4-step flow)
- [ ] Update dashboard landing page (welcome CTA instead of redirect)
- [ ] Update `mindstudio.ts` to accept site context in prompt
- [ ] Update `/api/agent/run` to pass site context
- [ ] Update `/api/cron/daily-run` with schedule filtering + site context
- [ ] Delete old `step-site.tsx`
- [ ] Update CLAUDE.md (routes, database schema, key flows)

---

## Remaining Setup
- [ ] Switch Clerk to production keys
- [ ] Test Stripe locally with `stripe listen --forward-to localhost:3000/api/webhooks/stripe`
- [ ] End-to-end test: sign up → onboard → generate → publish → visit subdomain

## Completed
- [x] Clerk auth configured (test keys)
- [x] Supabase project + 4 tables
- [x] Stripe account + product + webhook endpoint
- [x] MindStudio local SDK integration
- [x] Vercel deployment + domains (inkpop.net, *.inkpop.net)
- [x] Build fixes (_error.tsx, not-found.tsx, optional chaining)
- [x] Plans written: pricing-tiers.md, ai-onboarding.md