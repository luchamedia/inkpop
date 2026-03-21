import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { createServiceClient } from "@/lib/supabase/server"
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard"

export default async function OnboardingPage() {
  const { userId } = auth()
  if (!userId) redirect("/sign-in")

  const supabase = createServiceClient()
  const { data: dbUser } = await supabase
    .from("users")
    .select("subscription_status")
    .eq("clerk_id", userId)
    .single()

  const isSubscribed = dbUser?.subscription_status === "active"

  return <OnboardingWizard isSubscribed={isSubscribed} />
}
