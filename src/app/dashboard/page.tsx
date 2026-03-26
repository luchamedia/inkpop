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

  if (!dbUser) redirect("/sign-in")

  // Name gate: new users must set their name first
  if (!dbUser.name) redirect("/setup")

  // Check if user has any sites
  const { count } = await supabase
    .from("sites")
    .select("*", { count: "exact", head: true })
    .eq("user_id", dbUser.id)

  if (!count || count === 0) redirect("/new-site")

  redirect("/dashboard/sites")
}
