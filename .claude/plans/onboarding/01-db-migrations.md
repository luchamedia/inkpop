# Phase 1: Database Migrations

## Context

All subsequent phases depend on new columns on `users` and `sites` tables, plus a new RPC function for the monthly free credit system. This must be done first.

---

## Changes

### 1.1 SQL Migration

Run in Supabase SQL Editor (and save to `supabase/migrations/` for tracking).

```sql
-- Users: display name + monthly free credit tracking
ALTER TABLE users ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS monthly_credits_granted_at timestamptz;

-- Sites: topic context from onboarding, posting schedule
ALTER TABLE sites ADD COLUMN IF NOT EXISTS topic text;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS topic_context jsonb;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS posting_schedule text DEFAULT 'weekly';
ALTER TABLE sites ADD COLUMN IF NOT EXISTS posts_per_period integer DEFAULT 1;

-- New RPC: set credit floor for monthly free tier (no stacking)
-- GREATEST(balance, floor) means: if balance < 5, set to 5; if >= 5, leave unchanged
CREATE OR REPLACE FUNCTION set_free_credit_floor(user_id_input uuid, floor_amount integer)
RETURNS integer AS $$
  UPDATE users
  SET credit_balance = GREATEST(credit_balance, floor_amount),
      monthly_credits_granted_at = now()
  WHERE id = user_id_input
  RETURNING credit_balance;
$$ LANGUAGE sql;
```

**Column rationale:**
- `users.name` — nullable, existing users won't have it, collected post-signup
- `users.monthly_credits_granted_at` — timestamptz for comparing against `now()` to determine if grant is due
- `sites.topic` — raw topic string from onboarding step 1
- `sites.topic_context` — jsonb array of `[{ question: string, answer: string }]` from AI chat
- `sites.description` — derived text summary of the site's purpose
- `sites.category` — optional topic category
- `sites.posting_schedule` — `'daily'`, `'weekly'`, or `'custom'`. Default `'weekly'` so existing sites don't get unexpected daily runs
- `sites.posts_per_period` — integer frequency count. Default 1

### 1.2 Update `getAuthUser()` select

**File:** `src/lib/auth.ts` (line 11)

**Current select:**
```
"id, clerk_id, email, credit_balance, auto_renew, auto_renew_pack, stripe_customer_id"
```

**New select:**
```
"id, clerk_id, email, name, credit_balance, auto_renew, auto_renew_pack, stripe_customer_id, monthly_credits_granted_at"
```

### 1.3 Update dashboard layout select

**File:** `src/app/dashboard/layout.tsx` (line 20)

**Current select:**
```
"id, credit_balance"
```

**New select:**
```
"id, name, credit_balance, monthly_credits_granted_at"
```

This is needed for Phase 2 (login-check grant) and Phase 3 (name gate).

---

## Migration file location

Save SQL to: `supabase/migrations/20260325_onboarding_revamp.sql`

---

## Verification

1. Run migration in Supabase SQL Editor
2. Verify columns exist: `SELECT column_name FROM information_schema.columns WHERE table_name = 'users'` and `table_name = 'sites'`
3. Test RPC: `SELECT set_free_credit_floor('<test-user-id>', 5)`
4. `pnpm build` passes (no type errors from extended selects)

---

## Documentation Updates

- `CLAUDE.md` — update Database section with new columns
- `.claude/plans/TODO.md` — mark migration done when complete
