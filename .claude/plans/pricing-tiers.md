# Plan: Multi-Tier Pricing

## Context

inkpop currently has a single $49/mo plan. We're switching to a freemium model with 4 tiers so users can try before they buy. Free users get full dashboard access — payment is no longer a gate to using the product.

## Tiers
| Tier | Price | Sites | Posts | Cron |
|------|-------|-------|-------|------|
| Free | $0 | 1 | 5/month | Yes |
| Plus | $19/mo | 1 | Unlimited | Yes |
| Pro | $49/mo | 5 | Unlimited | Yes |
| Ultra | $99/mo | Unlimited | Unlimited | Yes |

---

## Steps

### 1. Plan config module
**New file: `src/lib/plans.ts`**
- `PlanTier` type: `"free" | "plus" | "pro" | "ultra"`
- `PLANS` record with tier name, price, `stripePriceId`, limits (`sites`, `postsPerMonth`), feature list
- Helpers: `getPlanByPriceId(priceId)`, `getPlanLimits(tier)`, `isPaidPlan(tier)`
- Price IDs from env: `NEXT_PUBLIC_STRIPE_PRICE_ID_PLUS`, `_PRO`, `_ULTRA`

### 2. Database migration (SQL in Supabase)
```sql
ALTER TABLE users ADD COLUMN plan text DEFAULT 'free';
ALTER TABLE users ADD COLUMN stripe_subscription_id text;
-- Backfill existing active users to 'pro' (they were on $49 plan)
UPDATE users SET plan = 'pro' WHERE subscription_status = 'active';
```

### 3. Auth changes
- **`src/lib/auth.ts`** — add `plan` to the select query in `getAuthUser()`
- **`src/app/dashboard/layout.tsx`** — remove the subscription gate redirect (`subscription_status !== "active"` → `/subscribe`). All authenticated users can access the dashboard now.

### 4. Limit enforcement
**New file: `src/lib/limits.ts`**
- `checkSiteLimit(userId, plan)` — counts user's sites vs plan limit
- `checkPostLimit(userId, plan)` — counts user's posts created this calendar month vs plan limit (5/mo for free, unlimited for paid)
- Both return `{ allowed, current, max }`

**API route changes:**
- **`src/app/api/sites/route.ts`** — call `checkSiteLimit()` before insert, return 403 if exceeded
- **`src/app/api/agent/run/route.ts`** — call `checkPostLimit()` before generation, return 403 if exceeded
- **`src/app/api/cron/daily-run/route.ts`** — check post limit per site before generating (skip sites at limit)

### 5. Stripe changes
- **`src/app/api/checkout/route.ts`** — accept `{ plan }` in request body, look up `stripePriceId` from `PLANS`, pass `plan` in session metadata
- **`src/app/api/webhooks/stripe/route.ts`**:
  - `checkout.session.completed` — read `plan` from metadata, set `plan` + `subscription_status: "active"` + `stripe_subscription_id`
  - `customer.subscription.deleted` — set `plan: "free"` + `subscription_status: "canceled"`
  - Add `customer.subscription.updated` handler — read price ID, look up plan via `getPlanByPriceId()`, update `plan` column
- **New: `src/app/api/billing/change-plan/route.ts`** — for upgrades/downgrades, uses `stripe.subscriptions.update()` with proration

### 6. UI changes
- **`src/app/subscribe/page.tsx`** — rewrite as 4-card pricing grid (Free/Plus/Pro/Ultra). Free → "Get Started" link to dashboard. Paid → POST to `/api/checkout` with plan.
- **Remove `src/components/onboarding/step-subscribe.tsx`** — payment no longer in onboarding
- **New: `src/app/dashboard/billing/page.tsx`** — shows current plan, usage stats, change plan / manage subscription
- **Add sidebar link** for "Billing" in `src/components/dashboard/sidebar.tsx`
- Contextual upgrade prompts when limits are hit (site creation, agent run)

### 7. Environment variables
- Add: `NEXT_PUBLIC_STRIPE_PRICE_ID_PLUS`, `NEXT_PUBLIC_STRIPE_PRICE_ID_PRO`, `NEXT_PUBLIC_STRIPE_PRICE_ID_ULTRA`
- Remove: `NEXT_PUBLIC_STRIPE_PRICE_ID`
- Update `.env.example`

---

## Verification
1. `pnpm build` passes
2. Free tier: sign up → access dashboard → create 1 site → generate up to 5 posts/mo → see limit on 6th
3. Paid tier: /subscribe → pick Plus → Stripe checkout → return → unlimited posts
4. Upgrade: Billing page → change Plus to Pro → can create up to 5 sites
5. Webhook: `stripe trigger checkout.session.completed` works

## Key Files
- `src/lib/plans.ts` (new)
- `src/lib/limits.ts` (new)
- `src/lib/auth.ts`
- `src/app/dashboard/layout.tsx`
- `src/app/subscribe/page.tsx`
- `src/app/dashboard/billing/page.tsx` (new)
- `src/app/api/checkout/route.ts`
- `src/app/api/webhooks/stripe/route.ts`
- `src/app/api/billing/change-plan/route.ts` (new)
- `src/app/api/sites/route.ts`
- `src/app/api/agent/run/route.ts`
- `src/app/api/cron/daily-run/route.ts`
- `src/components/dashboard/sidebar.tsx`
- `src/components/onboarding/step-subscribe.tsx` (delete)
- `.env.example`