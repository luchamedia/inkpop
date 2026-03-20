import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { createServiceClient } from "@/lib/supabase/server"

export default async function DashboardPage() {
  const { userId } = auth()
  if (!userId) redirect("/sign-in")

  const supabase = createServiceClient()

  const { data: dbUser } = await supabase
    .from("users")
    .select("id")
    .eq("clerk_id", userId)
    .single()

  if (!dbUser) redirect("/sign-in")

  // Check if user has any sites
  const { data: sites } = await supabase
    .from("sites")
    .select("id")
    .eq("user_id", dbUser.id)
    .limit(1)

  if (sites && sites.length > 0) {
    redirect("/dashboard/sites")
  }

  redirect("/dashboard/onboarding")
}
