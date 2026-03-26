# Phase 5: Adaptive Sidebar

## Context

The sidebar should always be visible but adapt based on whether the user has any sites yet. Before site creation: minimal nav (account, help, credits, "Create a site" CTA). After site creation: full nav with Sites, Dashboard, Billing.

**Depends on:** Phase 4 (site creation flow exists)

---

## Changes

### 5.1 Sidebar component

**File:** `src/components/dashboard/sidebar.tsx`

Add `hasSites: boolean` prop:

```typescript
interface SidebarProps {
  creditBalance: number
  hasSites: boolean
}
```

**Current nav items (line 9-13):**
```typescript
const navItems = [
  { label: "Sites", href: "/dashboard/sites", icon: Globe },
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Billing", href: "/dashboard/billing", icon: CreditCard },
]
```

**New behavior:**
- When `hasSites` is false: show only logo, credit balance, "Create a site" button (links to `/new-site`), and Clerk `UserButton`
- When `hasSites` is true: show full nav items + credit balance + UserButton

```typescript
export function Sidebar({ creditBalance, hasSites }: SidebarProps) {
  const pathname = usePathname()

  return (
    <aside className="flex h-screen w-64 flex-col border-r bg-muted/40 p-4">
      <div className="mb-8">
        <Link href="/dashboard" className="text-xl font-bold">
          inkpop
        </Link>
      </div>

      {hasSites ? (
        <nav className="flex flex-1 flex-col gap-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent",
                pathname === item.href || (item.href !== "/dashboard" && pathname?.startsWith(item.href))
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>
      ) : (
        <div className="flex flex-1 flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            Get started by creating your first AI-powered blog.
          </p>
          <Link href="/new-site">
            <Button className="w-full" size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Create a site
            </Button>
          </Link>
        </div>
      )}

      <div className="space-y-3 border-t pt-4">
        <div className="flex items-center justify-between rounded-md bg-accent/50 px-3 py-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Coins className="h-4 w-4" />
            <span>{creditBalance} credits</span>
          </div>
          {hasSites && (
            <Link
              href="/dashboard/billing"
              className="text-xs font-medium text-primary hover:underline"
            >
              Buy more
            </Link>
          )}
        </div>
        <UserButton afterSignOutUrl="/" />
      </div>
    </aside>
  )
}
```

**New import needed:** `Plus` from `lucide-react`, `Button` from `@/components/ui/button`

### 5.2 Dashboard layout: pass `hasSites`

**File:** `src/app/dashboard/layout.tsx`

After the existing user upsert and monthly credit check, fetch site count:

```typescript
// Fetch site count for sidebar state
const { count: siteCount } = await supabase
  .from("sites")
  .select("*", { count: "exact", head: true })
  .eq("user_id", dbUser.id)

// ... in JSX:
<Sidebar creditBalance={dbUser?.credit_balance ?? 0} hasSites={(siteCount ?? 0) > 0} />
```

This is a lightweight `head: true` query — returns only the count, no row data.

---

## Security Considerations

- No new API routes or data exposure
- Site count query uses `dbUser.id` (server-side, verified via Clerk auth)
- The "Create a site" link goes to `/new-site` which is auth-protected

---

## Verification

1. `pnpm build` passes
2. New user (no sites) → sidebar shows logo, credit balance, "Create a site" CTA, UserButton
3. User with sites → sidebar shows full nav (Sites, Dashboard, Billing), credit balance, "Buy more", UserButton
4. Click "Create a site" → navigates to `/new-site`
5. After creating first site → return to dashboard → sidebar now shows full nav

---

## Files Modified

| File | Action |
|------|--------|
| `src/components/dashboard/sidebar.tsx` | Add `hasSites` prop, conditional rendering |
| `src/app/dashboard/layout.tsx` | Fetch site count, pass `hasSites` to Sidebar |
