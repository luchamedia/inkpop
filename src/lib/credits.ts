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

export const SOURCE_LIMIT = 10
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

  // Atomic increment
  const { data } = await supabase.rpc("increment_credit_balance", {
    user_id_input: userId,
    amount: credits,
  })

  const newBalance = data ?? credits

  // Log the transaction
  await supabase.from("credit_transactions").insert({
    user_id: userId,
    amount: credits,
    balance_after: newBalance,
    type,
    reference_id: referenceId,
  })

  return newBalance
}

export async function deductCredits(
  userId: string,
  postCount: number,
  siteId: string
): Promise<{ success: boolean; balance: number }> {
  const supabase = createServiceClient()

  // Atomic conditional deduction — prevents overdraw
  const { data } = await supabase.rpc("deduct_credit_balance", {
    user_id_input: userId,
    amount: postCount,
  })

  // rpc returns null if the WHERE condition failed (insufficient balance)
  if (data === null || data === undefined) {
    const balance = await getBalance(userId)
    return { success: false, balance }
  }

  const newBalance = data as number

  // Log the transaction
  await supabase.from("credit_transactions").insert({
    user_id: userId,
    amount: -postCount,
    balance_after: newBalance,
    type: "generation",
    site_id: siteId,
  })

  return { success: true, balance: newBalance }
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

  const { data } = await supabase.rpc("set_free_credit_floor", {
    user_id_input: userId,
    floor_amount: FREE_MONTHLY_CREDITS,
  })

  const newBalance = data ?? FREE_MONTHLY_CREDITS

  await supabase.from("credit_transactions").insert({
    user_id: userId,
    amount: FREE_MONTHLY_CREDITS,
    balance_after: newBalance,
    type: "free_monthly",
    reference_id: `monthly_${new Date().toISOString().slice(0, 7)}`,
  })

  return { granted: true, balance: newBalance }
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
