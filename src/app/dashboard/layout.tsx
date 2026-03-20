import { auth, currentUser } from "@clerk/nextjs/server"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { createServiceClient } from "@/lib/supabase/server"
import { Sidebar } from "@/components/dashboard/sidebar"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { userId } = auth()
  if (!userId) redirect("/sign-in")

  const user = await currentUser()
  const supabase = createServiceClient()

  // Post-auth sync: ensure user row exists
  const { data: dbUser } = await supabase
    .from("users")
    .select("id, subscription_status")
    .eq("clerk_id", userId)
    .single()

  if (!dbUser) {
    await supabase.from("users").insert({
      clerk_id: userId,
      email: user?.emailAddresses[0]?.emailAddress || "",
    })
  }

  // Subscription gate — redirect to /subscribe if not active
  // Allow onboarding through since step 3 handles subscribe
  const headersList = headers()
  const pathname = headersList.get("x-pathname") || ""
  const isOnboarding = pathname.includes("/onboarding")

  if (!isOnboarding && dbUser?.subscription_status !== "active") {
    redirect("/subscribe")
  }

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-8">{children}</main>
    </div>
  )
}
