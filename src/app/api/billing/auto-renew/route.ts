import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api-helpers"
import { createServiceClient } from "@/lib/supabase/server"
import { CREDIT_PACKS, type PackId } from "@/lib/credits"

export async function GET() {
  return withAuth(async (user) => {
    return NextResponse.json({
      auto_renew: user.auto_renew ?? false,
      auto_renew_pack: user.auto_renew_pack ?? null,
      has_payment_method: !!user.stripe_customer_id,
    })
  })
}

export async function POST(req: Request) {
  return withAuth(async (user) => {
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
  })
}
