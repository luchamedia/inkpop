import { cache } from "react"
import { auth } from "@clerk/nextjs/server"
import { createServiceClient } from "@/lib/supabase/server"

export const getAuthUser = cache(async () => {
  const { userId } = await auth()
  if (!userId) throw new Error("Unauthorized")

  const supabase = createServiceClient()
  const { data: dbUser } = await supabase
    .from("users")
    .select("id, clerk_id, email, name, credit_balance, auto_renew, auto_renew_pack, stripe_customer_id, monthly_credits_granted_at")
    .eq("clerk_id", userId)
    .single()

  if (!dbUser) throw new Error("User not found")
  return dbUser
})
