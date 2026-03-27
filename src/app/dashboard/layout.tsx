import { auth, currentUser } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { createServiceClient } from "@/lib/supabase/server"
import { Sidebar } from "@/components/dashboard/sidebar"
import { SidebarProvider } from "@/components/dashboard/sidebar-context"
import { SidebarToggle } from "@/components/dashboard/sidebar-toggle"
import { grantMonthlyCredits, FREE_MONTHLY_CREDITS, isMonthlyGrantDue } from "@/lib/credits"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")

  const user = await currentUser()
  const supabase = createServiceClient()

  // Post-auth sync: ensure user row exists
  const { data: dbUser } = await supabase
    .from("users")
    .select("id, name, credit_balance, monthly_credits_granted_at")
    .eq("clerk_id", userId)
    .single()

  if (!dbUser) {
    // New user: create row and grant initial free credits
    const { data: newUser } = await supabase
      .from("users")
      .insert({
        clerk_id: userId,
        email: user?.emailAddresses[0]?.emailAddress || "",
      })
      .select("id, name, credit_balance, monthly_credits_granted_at")
      .single()

    if (newUser) {
      const result = await grantMonthlyCredits(newUser.id)
      newUser.credit_balance = result.balance
    }

    return (
      <SidebarProvider>
        <div className="flex h-screen overflow-hidden">
          <Sidebar creditBalance={newUser?.credit_balance ?? 0} sites={[]} />
          <main className="flex-1 overflow-y-auto">
            <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background px-6 py-3">
              <SidebarToggle />
            </div>
            <div className="px-8 py-8 lg:px-12">{children}</div>
          </main>
        </div>
      </SidebarProvider>
    )
  }

  // Run credit grant check and sites fetch in parallel (both depend only on dbUser.id)
  const creditGrantPromise = (async () => {
    if (isMonthlyGrantDue(dbUser.monthly_credits_granted_at)) {
      if (dbUser.credit_balance < FREE_MONTHLY_CREDITS) {
        const result = await grantMonthlyCredits(dbUser.id)
        return result.balance
      } else {
        await supabase
          .from("users")
          .update({ monthly_credits_granted_at: new Date().toISOString() })
          .eq("id", dbUser.id)
      }
    }
    return null
  })()

  const sitesPromise = supabase
    .from("sites")
    .select("id, name, subdomain")
    .eq("user_id", dbUser.id)
    .order("created_at", { ascending: true })

  const [grantedBalance, { data: sites }] = await Promise.all([creditGrantPromise, sitesPromise])
  if (grantedBalance !== null) dbUser.credit_balance = grantedBalance

  return (
    <SidebarProvider>
      <div className="flex h-screen overflow-hidden">
        <Sidebar
          creditBalance={dbUser?.credit_balance ?? 0}
          sites={sites ?? []}
        />
        <main className="flex-1 overflow-y-auto">
          <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background px-6 py-3">
            <SidebarToggle />
          </div>
          <div className="px-8 py-8 lg:px-12">{children}</div>
        </main>
      </div>
    </SidebarProvider>
  )
}
