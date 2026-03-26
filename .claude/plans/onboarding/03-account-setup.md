# Phase 3: Post-Signup Account Setup

## Context

After signing up (with Clerk email verification), users need to set their display name before proceeding. This creates a gate: if `users.name` is null, redirect to `/dashboard/setup`. After entering their name, they're directed to `/new-site` to create their first site.

**Depends on:** Phase 1 (DB migrations — `name` column on `users`)

---

## Changes

### 3.1 Clerk Email Verification (Manual Config)

**Action:** In Clerk Dashboard → User & Authentication → Email, Phone, Username:
- Set "Email verification" to "Required"
- This is a Clerk config change, not a code change
- No code modifications needed — `@clerk/nextjs` handles the verification flow automatically

### 3.2 Name collection page

**New file:** `src/app/dashboard/setup/page.tsx`

Server component that checks if name is already set (redirect to `/dashboard` if so), otherwise renders the name form.

```typescript
import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { createServiceClient } from "@/lib/supabase/server"
import { NameSetupForm } from "@/components/onboarding/name-setup-form"

export default async function SetupPage() {
  const { userId } = auth()
  if (!userId) redirect("/sign-in")

  const supabase = createServiceClient()
  const { data: dbUser } = await supabase
    .from("users")
    .select("name")
    .eq("clerk_id", userId)
    .single()

  // If name already set, skip to dashboard
  if (dbUser?.name) redirect("/dashboard")

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <NameSetupForm />
    </div>
  )
}
```

### 3.3 Name setup form component

**New file:** `src/components/onboarding/name-setup-form.tsx`

Client component: simple form with name input and "Get Started" CTA.

```typescript
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function NameSetupForm() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return

    setSaving(true)
    const res = await fetch("/api/users/setup", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    })

    if (res.ok) {
      router.push("/new-site")
    }
    setSaving(false)
  }

  return (
    <div className="w-full max-w-sm space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold">Welcome to inkpop</h1>
        <p className="text-muted-foreground">What should we call you?</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Your name</Label>
          <Input
            id="name"
            placeholder="Enter your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            autoFocus
          />
        </div>
        <Button type="submit" className="w-full" disabled={!name.trim() || saving}>
          {saving ? "Saving..." : "Get Started"}
        </Button>
      </form>
    </div>
  )
}
```

### 3.4 User setup API route

**New file:** `src/app/api/users/setup/route.ts`

PATCH handler to update the user's name.

```typescript
import { NextResponse } from "next/server"
import { getAuthUser } from "@/lib/auth"
import { createServiceClient } from "@/lib/supabase/server"

export async function PATCH(req: Request) {
  try {
    const user = await getAuthUser()
    const { name } = await req.json()

    // Validate: required, string, max 100 chars, strip HTML tags
    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "Name is required" }, { status: 400 })
    }

    const sanitized = name.replace(/<[^>]*>/g, "").trim().slice(0, 100)
    if (!sanitized) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 })
    }

    const supabase = createServiceClient()
    await supabase
      .from("users")
      .update({ name: sanitized })
      .eq("id", user.id)

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}
```

### 3.5 Dashboard layout: name gate

**File:** `src/app/dashboard/layout.tsx`

After the upsert block and monthly credit check, add the name gate:

```typescript
import { headers } from "next/headers"

// ... after dbUser is resolved ...

// Name gate: redirect to setup if name not set
const headerList = headers()
const pathname = headerList.get("x-pathname") || ""
// Alternative: use next/headers to check — or just exclude /dashboard/setup
if (dbUser && !dbUser.name) {
  // Don't redirect if already on setup page (avoid loop)
  // Note: we can't easily get pathname in a layout, so we check the child route
  // The setup page itself handles the redirect-if-name-exists case
}
```

**Better approach:** Instead of checking pathname in the layout (which is complex), make the setup page self-contained:
- The layout does NOT redirect — it just passes `hasName: !!dbUser?.name` to a context or directly
- The `src/app/dashboard/page.tsx` (the landing page) checks and redirects:

### 3.6 Dashboard landing page changes

**File:** `src/app/dashboard/page.tsx`

Current behavior: redirects to `/dashboard/sites` or `/dashboard/onboarding`.

New behavior:
1. If no name → redirect to `/dashboard/setup`
2. If no sites → redirect to `/new-site`
3. If has sites → redirect to `/dashboard/sites`

```typescript
import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { createServiceClient } from "@/lib/supabase/server"

export default async function DashboardPage() {
  const { userId } = auth()
  if (!userId) redirect("/sign-in")

  const supabase = createServiceClient()
  const { data: dbUser } = await supabase
    .from("users")
    .select("id, name")
    .eq("clerk_id", userId)
    .single()

  if (!dbUser?.name) redirect("/dashboard/setup")

  const { count } = await supabase
    .from("sites")
    .select("*", { count: "exact", head: true })
    .eq("user_id", dbUser.id)

  if (!count || count === 0) redirect("/new-site")

  redirect("/dashboard/sites")
}
```

---

## Security Considerations

- `PATCH /api/users/setup` uses `getAuthUser()` — only updates the authenticated user's row
- Name input is HTML-stripped and length-limited (100 chars) to prevent XSS
- No SQL injection risk (Supabase parameterizes)
- Setup page server-side checks prevent access if name is already set

---

## Verification

1. `pnpm build` passes
2. New user signs up → lands on `/dashboard` → redirected to `/dashboard/setup`
3. Enter name → "Get Started" → redirected to `/new-site`
4. Returning user with name set → `/dashboard` → redirected to `/dashboard/sites`
5. Returning user with name but no sites → `/dashboard` → redirected to `/new-site`
6. Manually visit `/dashboard/setup` with name already set → redirected to `/dashboard`

---

## Files Modified/Created

| File | Action |
|------|--------|
| `src/app/dashboard/setup/page.tsx` | New — name collection page |
| `src/components/onboarding/name-setup-form.tsx` | New — name input form |
| `src/app/api/users/setup/route.ts` | New — PATCH handler for name |
| `src/app/dashboard/page.tsx` | Modify — new redirect logic (name → sites → new-site) |
