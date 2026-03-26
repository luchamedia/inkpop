import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { createServiceClient } from "@/lib/supabase/server"
import { NameSetupForm } from "@/components/onboarding/name-setup-form"

export default async function SetupPage() {
  const { userId } = await auth()
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
    <div className="flex min-h-screen flex-col items-center justify-center bg-background-secondary">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <span className="font-serif text-2xl font-semibold">inkpop</span>
        </div>
        <NameSetupForm />
      </div>
    </div>
  )
}
