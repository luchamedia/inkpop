import { NextResponse } from "next/server"
import { getAuthUser } from "@/lib/auth"
import { createServiceClient } from "@/lib/supabase/server"
import { CREDIT_PACKS, type PackId } from "@/lib/credits"

export async function GET() {
  try {
    const user = await getAuthUser()
    return NextResponse.json({
      auto_renew: user.auto_renew ?? false,
      auto_renew_pack: user.auto_renew_pack ?? null,
      has_payment_method: !!user.stripe_customer_id,
    })
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}

export async function POST(req: Request) {
  try {
    const user = await getAuthUser()
    const { enabled, pack } = (await req.json()) as {
      enabled: boolean
      pack?: string
    }

    if (enabled) {
      if (!pack || !CREDIT_PACKS[pack as PackId]) {
        return NextResponse.json({ error: "Invalid pack" }, { status: 400 })
      }
      if (!user.stripe_customer_id) {
        return NextResponse.json(
          { error: "Purchase credits at least once before enabling auto-renew" },
          { status: 400 }
        )
      }
    }

    const supabase = createServiceClient()
    await supabase
      .from("users")
      .update({
        auto_renew: enabled,
        auto_renew_pack: enabled ? pack : null,
      })
      .eq("id", user.id)

    return NextResponse.json({
      auto_renew: enabled,
      auto_renew_pack: enabled ? pack : null,
    })
  } catch (error) {
    console.error("Auto-renew update error:", error)
    return NextResponse.json(
      { error: "Failed to update auto-renew settings" },
      { status: 500 }
    )
  }
}
