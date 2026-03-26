import { NextResponse } from "next/server"
import { auth, currentUser } from "@clerk/nextjs/server"
import { getStripe } from "@/lib/stripe"
import { createServiceClient } from "@/lib/supabase/server"
import { CREDIT_PACKS, type PackId } from "@/lib/credits"

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { pack } = (await req.json()) as { pack: PackId }
    const packConfig = CREDIT_PACKS[pack]
    if (!packConfig) {
      return NextResponse.json({ error: "Invalid pack" }, { status: 400 })
    }

    const user = await currentUser()
    const supabase = createServiceClient()

    // Get or create DB user
    const { data: dbUser } = await supabase
      .from("users")
      .select("id, stripe_customer_id")
      .eq("clerk_id", userId)
      .single()

    const stripe = getStripe()
    let customerId = dbUser?.stripe_customer_id

    // Create Stripe customer if needed
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user?.emailAddresses[0]?.emailAddress,
        metadata: { clerk_id: userId },
      })
      customerId = customer.id

      await supabase
        .from("users")
        .update({ stripe_customer_id: customerId })
        .eq("clerk_id", userId)
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "payment",
      payment_intent_data: {
        setup_future_usage: "off_session",
      },
      line_items: [
        {
          price: packConfig.priceId,
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings?tab=billing&purchased=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/top-up`,
      metadata: {
        clerk_id: userId,
        pack,
        credits: String(packConfig.credits),
      },
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error("Checkout error:", error)
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    )
  }
}
