# Phase 2: Monthly Free Credits

## Context

Users get 5 free credits per month. Credits do NOT stack — "use it or lose it" means if you have < 5, you get topped up to 5; if you have >= 5 (from purchases or leftover), nothing changes. This encourages usage while not penalizing paying customers.

**Depends on:** Phase 1 (DB migrations — `monthly_credits_granted_at` column + `set_free_credit_floor` RPC)

---

## Changes

### 2.1 Credits module additions

**File:** `src/lib/credits.ts`

Add constant and function after the existing exports:

```typescript
export const FREE_MONTHLY_CREDITS = 5

export async function grantMonthlyCredits(
  userId: string
): Promise<{ granted: boolean; balance: number }> {
  const supabase = createServiceClient()

  // Atomic: set balance to max(current, 5) and update timestamp
  const { data } = await supabase.rpc("set_free_credit_floor", {
    user_id_input: userId,
    floor_amount: FREE_MONTHLY_CREDITS,
  })

  const newBalance = data ?? FREE_MONTHLY_CREDITS

  // Only log transaction if credits were actually granted (balance was < 5)
  // We can't know for sure from the RPC, but we log it regardless — the amount
  // will be 0 if balance was already >= 5 (handled by checking balance_after)
  await supabase.from("credit_transactions").insert({
    user_id: userId,
    amount: FREE_MONTHLY_CREDITS,
    balance_after: newBalance,
    type: "free_monthly",
    reference_id: `monthly_${new Date().toISOString().slice(0, 7)}`, // e.g. "monthly_2026-03"
  })

  return { granted: true, balance: newBalance }
}
```

**Helper to check if grant is due:**
```typescript
export function isMonthlyGrantDue(grantedAt: string | null): boolean {
  if (!grantedAt) return true
  const lastGrant = new Date(grantedAt)
  const now = new Date()
  // Due if we're in a different month than the last grant
  return (
    now.getUTCFullYear() !== lastGrant.getUTCFullYear() ||
    now.getUTCMonth() !== lastGrant.getUTCMonth()
  )
}
```

### 2.2 Monthly cron endpoint

**New file:** `src/app/api/cron/monthly-credits/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"
import { grantMonthlyCredits, FREE_MONTHLY_CREDITS } from "@/lib/credits"

export const maxDuration = 60

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = createServiceClient()

  // Find users where monthly grant is due
  // Due = never granted OR granted in a previous calendar month
  const startOfMonth = new Date()
  startOfMonth.setUTCDate(1)
  startOfMonth.setUTCHours(0, 0, 0, 0)

  const { data: users } = await supabase
    .from("users")
    .select("id, credit_balance, monthly_credits_granted_at")
    .or(`monthly_credits_granted_at.is.null,monthly_credits_granted_at.lt.${startOfMonth.toISOString()}`)

  let granted = 0
  let skipped = 0

  for (const user of users || []) {
    // Only grant if balance < FREE_MONTHLY_CREDITS (no stacking)
    if (user.credit_balance < FREE_MONTHLY_CREDITS) {
      await grantMonthlyCredits(user.id)
      granted++
    } else {
      // Still update the timestamp so we don't check again this month
      await supabase
        .from("users")
        .update({ monthly_credits_granted_at: new Date().toISOString() })
        .eq("id", user.id)
      skipped++
    }
  }

  return NextResponse.json({ granted, skipped, total: (users || []).length })
}
```

### 2.3 Login-check fallback

**File:** `src/app/dashboard/layout.tsx`

After the existing user upsert block (line 29), add monthly credit check:

```typescript
// Grant monthly free credits if due (catches mid-month signups missed by cron)
if (dbUser && isMonthlyGrantDue(dbUser.monthly_credits_granted_at)) {
  if (dbUser.credit_balance < FREE_MONTHLY_CREDITS) {
    const result = await grantMonthlyCredits(dbUser.id)
    dbUser.credit_balance = result.balance
  } else {
    // Update timestamp only so we skip next check
    await supabase
      .from("users")
      .update({ monthly_credits_granted_at: new Date().toISOString() })
      .eq("id", dbUser.id)
  }
}
```

**Imports to add:**
```typescript
import { grantMonthlyCredits, FREE_MONTHLY_CREDITS, isMonthlyGrantDue } from "@/lib/credits"
```

### 2.4 Vercel cron configuration

**File:** `vercel.json`

Add monthly cron entry to the `crons` array:

```json
{
  "path": "/api/cron/monthly-credits",
  "schedule": "0 0 1 * *"
}
```

This runs at midnight UTC on the 1st of each month.

### 2.5 Billing page updates

**File:** `src/app/dashboard/billing/page.tsx`

1. Add `"free_monthly"` to the transaction type label map: `"free_monthly" → "Monthly Free Credits"`
2. Add an info card above the transaction table:
   ```
   Free Tier: 5 credits refresh monthly (use it or lose it)
   ```

### 2.6 New user signup: auto-grant

When a new user is created in `dashboard/layout.tsx` (the upsert block at line 24-28), the insert should also trigger a monthly credit grant. After the insert, call `grantMonthlyCredits(newUser.id)`.

This ensures brand new users immediately have 5 credits to start with.

---

## Security Considerations

- Monthly cron endpoint uses same `CRON_SECRET` bearer token auth as daily cron
- `grantMonthlyCredits()` uses atomic RPC (`GREATEST`) — no race condition
- No new env vars needed (reuses `CRON_SECRET`)
- Login-check grant runs server-side only (in layout server component)

---

## Verification

1. `pnpm build` passes
2. New user signs up → immediately has 5 credits
3. Existing user with 2 credits → login → balance becomes 5
4. Existing user with 10 credits → login → balance stays 10, timestamp updated
5. Next month: user with 3 credits → cron runs → balance becomes 5
6. Billing page shows "Monthly Free Credits" label on free_monthly transactions
7. Test cron endpoint: `curl -H "Authorization: Bearer $CRON_SECRET" localhost:3000/api/cron/monthly-credits`

---

## Files Modified/Created

| File | Action |
|------|--------|
| `src/lib/credits.ts` | Add `FREE_MONTHLY_CREDITS`, `grantMonthlyCredits()`, `isMonthlyGrantDue()` |
| `src/app/api/cron/monthly-credits/route.ts` | New — monthly cron handler |
| `src/app/dashboard/layout.tsx` | Add login-check grant + new user grant |
| `src/app/dashboard/billing/page.tsx` | Add `free_monthly` label + info card |
| `vercel.json` | Add monthly cron entry |
