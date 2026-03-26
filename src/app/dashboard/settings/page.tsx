import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { createServiceClient } from "@/lib/supabase/server"
import { SettingsTabs } from "@/components/settings/settings-tabs"
import { AccountTab } from "@/components/settings/account-tab"
import { BillingTab } from "@/components/settings/billing-tab"

export default async function SettingsPage() {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")

  const supabase = createServiceClient()

  const { data: dbUser } = await supabase
    .from("users")
    .select("id, name, email, credit_balance")
    .eq("clerk_id", userId)
    .single()

  if (!dbUser) redirect("/sign-in")

  const { data: transactions } = await supabase
    .from("credit_transactions")
    .select("id, amount, balance_after, type, created_at")
    .eq("user_id", dbUser.id)
    .order("created_at", { ascending: false })
    .limit(50)

  return (
    <div>
      <div className="mb-4">
        <h1 className="font-serif text-3xl font-semibold tracking-tight">Settings</h1>
      </div>

      <SettingsTabs>
        {{
          account: <AccountTab name={dbUser.name ?? ""} email={dbUser.email} />,
          billing: <BillingTab creditBalance={dbUser.credit_balance ?? 0} transactions={transactions ?? []} />,
        }}
      </SettingsTabs>
    </div>
  )
}
