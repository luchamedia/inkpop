# Credit System

Located in `src/lib/credits.ts`. Usage-based billing via pre-purchased credit packs (10/$5, 50/$22.50, 100/$40). One credit = one blog post.

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
