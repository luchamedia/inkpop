import { auth } from "@clerk/nextjs/server"
import { createServiceClient } from "@/lib/supabase/server"

export async function getAuthUser() {
  const { userId } = auth()
  if (!userId) throw new Error("Unauthorized")

  const supabase = createServiceClient()
  const { data: dbUser } = await supabase
    .from("users")
    .select("id, clerk_id, email, subscription_status")
    .eq("clerk_id", userId)
    .single()

  if (!dbUser) throw new Error("User not found")
  return dbUser
}
