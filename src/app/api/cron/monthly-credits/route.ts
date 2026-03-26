import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"
import { grantMonthlyCredits, FREE_MONTHLY_CREDITS } from "@/lib/credits"

export const maxDuration = 60

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = createServiceClient()

  // Find users where monthly grant is due
  const startOfMonth = new Date()
  startOfMonth.setUTCDate(1)
  startOfMonth.setUTCHours(0, 0, 0, 0)

  const { data: users } = await supabase
    .from("users")
    .select("id, credit_balance, monthly_credits_granted_at")
    .or(`monthly_credits_granted_at.is.null,monthly_credits_granted_at.lt.${startOfMonth.toISOString()}`)

  let granted = 0
  let skipped = 0

  for (const user of users || []) {
    if (user.credit_balance < FREE_MONTHLY_CREDITS) {
      await grantMonthlyCredits(user.id)
      granted++
    } else {
      // Update timestamp so we don't check again this month
      await supabase
        .from("users")
        .update({ monthly_credits_granted_at: new Date().toISOString() })
        .eq("id", user.id)
      skipped++
    }
  }

  return NextResponse.json({ granted, skipped, total: (users || []).length })
}
