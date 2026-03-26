import { NextResponse } from "next/server"
import { getStripe } from "@/lib/stripe"
import { createServiceClient } from "@/lib/supabase/server"
import { addCredits } from "@/lib/credits"
import Stripe from "stripe"

export async function POST(req: Request) {
  const body = await req.text()
  const signature = req.headers.get("stripe-signature")

  if (!signature) {
    return NextResponse.json({ error: "No signature" }, { status: 400 })
  }

  const stripe = getStripe()
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err) {
    console.error("Webhook signature verification failed:", err)
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }

  const supabase = createServiceClient()

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session
      const clerkId = session.metadata?.clerk_id
      const credits = parseInt(session.metadata?.credits || "0", 10)
      const customerId =
        typeof session.customer === "string"
          ? session.customer
          : session.customer?.id

      if (clerkId && credits > 0) {
        // Ensure stripe_customer_id is stored
        if (customerId) {
          await supabase
            .from("users")
            .update({ stripe_customer_id: customerId })
            .eq("clerk_id", clerkId)
        }

        // Look up internal user ID
        const { data: dbUser } = await supabase
          .from("users")
          .select("id")
          .eq("clerk_id", clerkId)
          .single()

        if (dbUser) {
          await addCredits(dbUser.id, credits, session.id)
        }
      }
      break
    }
  }

  return NextResponse.json({ received: true })
}
