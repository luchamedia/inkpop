# Credit System

Located in `src/lib/credits.ts`. Usage-based billing via pre-purchased credit packs (10/$5, 50/$22.50, 100/$40). One credit = one blog post.

## Atomic RPCs

All credit mutations use single-RPC calls that combine the balance update and transaction log in one atomic operation (no separate `INSERT` into `credit_transactions` needed). RPCs have `EXECUTE` revoked from `anon`/`authenticated` roles — only callable via service role key.

- `add_credit_with_log(user_id, amount, reference_id?, type?)` — increments balance + inserts transaction row. Returns new balance.
- `deduct_credit_with_log(user_id, amount, site_id?, type?)` — conditional deduction (prevents overdraw) + inserts transaction row. Returns new balance on success, `NULL` if insufficient.
- `set_free_credit_floor(user_id, floor_amount)` — `GREATEST(balance, floor)` + logs transaction if balance changed. Used for monthly free credits.

## Application Functions

- `CREDIT_PACKS` — pack config with Stripe price IDs and `priceInCents`
- `getBalance(userId)` — read credit balance
- `addCredits(userId, credits, referenceId, type?)` — calls `add_credit_with_log` RPC (type defaults to `"purchase"`)
- `deductCredits(userId, postCount, siteId)` — calls `deduct_credit_with_log` RPC
- `autoRenewCredits(userId, stripeCustomerId, packId)` — charges saved card off-session, adds credits on success (type `"auto_renew"`)
- `FREE_MONTHLY_CREDITS = 5` — monthly free tier (use it or lose it, no stacking)
- `isMonthlyGrantDue(grantedAt)` — checks if grant is due (different calendar month)
- `grantMonthlyCredits(userId)` — calls `set_free_credit_floor` RPC (transaction logging handled by RPC)
- `SOURCE_LIMIT = 15` — max sources per site
- Checkout uses `setup_future_usage: "off_session"` to save payment methods for auto-renew
