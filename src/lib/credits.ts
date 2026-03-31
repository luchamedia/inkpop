import { createServiceClient } from "@/lib/supabase/server"
import { getStripe } from "@/lib/stripe"

export const CREDIT_PACKS = {
  pack_10: {
    credits: 10,
    priceInCents: 500,
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_10!,
    label: "Starter",
    perPost: "$0.50",
  },
  pack_50: {
    credits: 50,
    priceInCents: 2250,
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_50!,
    label: "Standard",
    perPost: "$0.45",
    discount: "10% off",
  },
  pack_100: {
    credits: 100,
    priceInCents: 4000,
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_100!,
    label: "Bulk",
    perPost: "$0.40",
    discount: "20% off",
  },
} as const

export type PackId = keyof typeof CREDIT_PACKS

export const SOURCE_LIMIT = 15
export const FREE_MONTHLY_CREDITS = 5

export function getPackByPriceId(
  priceId: string
): { packId: PackId; credits: number } | null {
  for (const [packId, pack] of Object.entries(CREDIT_PACKS)) {
    if (pack.priceId === priceId) {
      return { packId: packId as PackId, credits: pack.credits }
    }
  }
  return null
}

export async function getBalance(userId: string): Promise<number> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from("users")
    .select("credit_balance")
    .eq("id", userId)
    .single()

  return data?.credit_balance ?? 0
}

export async function addCredits(
  userId: string,
  credits: number,
  referenceId: string,
  type: string = "purchase"
): Promise<number> {
  const supabase = createServiceClient()

  // Atomic increment + transaction log in a single RPC call
  const { data, error } = await supabase.rpc("add_credit_with_log", {
    user_id_input: userId,
    amount_input: credits,
    reference_id_input: referenceId,
    type_input: type,
  })

  if (error) throw new Error(`Failed to add credits: ${error.message}`)
  return data as number
}

export async function deductCredits(
  userId: string,
  postCount: number,
  siteId: string
): Promise<{ success: boolean; balance: number }> {
  const supabase = createServiceClient()

  // Atomic deduction + transaction log in a single RPC call
  const { data } = await supabase.rpc("deduct_credit_with_log", {
    user_id_input: userId,
    amount_input: postCount,
    site_id_input: siteId,
    type_input: "generation",
  })

  // RPC returns null if insufficient balance
  if (data === null || data === undefined) {
    const balance = await getBalance(userId)
    return { success: false, balance }
  }

  return { success: true, balance: data as number }
}

export function isMonthlyGrantDue(grantedAt: string | null): boolean {
  if (!grantedAt) return true
  const lastGrant = new Date(grantedAt)
  const now = new Date()
  return (
    now.getUTCFullYear() !== lastGrant.getUTCFullYear() ||
    now.getUTCMonth() !== lastGrant.getUTCMonth()
  )
}

export async function grantMonthlyCredits(
  userId: string
): Promise<{ granted: boolean; balance: number }> {
  const supabase = createServiceClient()

  // set_free_credit_floor now handles transaction logging atomically
  const { data, error } = await supabase.rpc("set_free_credit_floor", {
    user_id_input: userId,
    floor_amount: FREE_MONTHLY_CREDITS,
  })

  if (error) return { granted: false, balance: 0 }
  return { granted: true, balance: data as number }
}

export async function autoRenewCredits(
  userId: string,
  stripeCustomerId: string,
  packId: PackId
): Promise<{ success: boolean; newBalance?: number; error?: string }> {
  const pack = CREDIT_PACKS[packId]
  if (!pack) {
    return { success: false, error: "Invalid pack" }
  }

  // Get customer's most recent saved card
  const stripe = getStripe()

  const paymentMethods = await stripe.paymentMethods.list({
    customer: stripeCustomerId,
    type: "card",
    limit: 1,
  })

  const paymentMethod = paymentMethods.data[0]
  if (!paymentMethod) {
    return { success: false, error: "No saved payment method" }
  }

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: pack.priceInCents,
      currency: "usd",
      customer: stripeCustomerId,
      payment_method: paymentMethod.id,
      off_session: true,
      confirm: true,
      metadata: {
        auto_renew: "true",
        pack: packId,
        credits: String(pack.credits),
        user_id: userId,
      },
    })

    if (paymentIntent.status === "succeeded") {
      const newBalance = await addCredits(userId, pack.credits, paymentIntent.id, "auto_renew")
      return { success: true, newBalance }
    }

    return { success: false, error: `Payment status: ${paymentIntent.status}` }
  } catch (err: unknown) {
    const stripeErr = err as { type?: string; message?: string }
    if (stripeErr.type === "StripeCardError") {
      return { success: false, error: "Card declined" }
    }
    return { success: false, error: stripeErr.message || "Payment failed" }
  }
}
