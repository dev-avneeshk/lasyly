import { NextResponse } from "next/server"
import Stripe from "stripe"
import { createAdminClient } from "@/lib/supabase/admin"

const stripeKey = process.env.STRIPE_SECRET_KEY

const stripe = new Stripe(stripeKey || "sk_test_placeholder_not_functional", {
  // Pinned to the current Stripe API version. Verified at:
  // https://docs.stripe.com/sdks/versioning
  apiVersion: "2026-04-22.dahlia",
})

/**
 * Stripe webhook endpoint.
 *
 * Behavior is identical in every environment: the request body MUST be a
 * Stripe-signed payload that verifies against STRIPE_WEBHOOK_SECRET. There
 * is no dev-mode bypass — the previous bypass (parsing raw JSON when
 * NODE_ENV=development) was a forgery vector for any preview deployment
 * that accidentally ran with NODE_ENV=development. Stripe's CLI
 * (`stripe listen --forward-to localhost:3000/api/webhooks/stripe`) supplies
 * a real signing secret and signed events for local development, so this
 * endpoint never has a legitimate reason to accept unsigned bodies.
 */
export async function POST(req: Request) {
  if (!stripeKey) {
    console.error("STRIPE_SECRET_KEY is not configured")
    return NextResponse.json(
      { error: "Stripe not configured" },
      { status: 500 }
    )
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET is not configured")
    return NextResponse.json(
      { error: "Webhook configuration error" },
      { status: 500 }
    )
  }

  const body = await req.text()
  const sig = req.headers.get("stripe-signature")

  if (!sig) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 }
    )
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown webhook error"
    console.error("Webhook signature verification failed:", message)
    return NextResponse.json(
      { error: "Webhook signature verification failed" },
      { status: 400 }
    )
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session

    if (session.metadata?.type === "TOP_UP") {
      const userId = session.metadata.userId
      const amountTotal = session.amount_total

      // Skip if metadata is missing userId or amount is null/zero.
      if (!userId || !amountTotal || amountTotal === 0) {
        return NextResponse.json({ received: true, skipped: true }, { status: 200 })
      }

      const amount = amountTotal / 100 // Convert cents to dollars

      // Use the service-role client to call the atomic top-up RPC.
      let supabase: ReturnType<typeof createAdminClient>
      try {
        supabase = createAdminClient()
      } catch {
        console.error("Admin client unavailable for webhook processing")
        return NextResponse.json({ received: true }, { status: 200 })
      }

      const { data: outcome, error: rpcError } = await supabase.rpc(
        "process_stripe_topup",
        {
          p_user_id: userId,
          p_amount: amount,
          p_stripe_session_id: session.id,
        }
      )

      if (rpcError) {
        console.error("process_stripe_topup RPC error:", rpcError.message)
        return NextResponse.json(
          { error: "Failed to process payment" },
          { status: 500 }
        )
      }

      if (outcome === "duplicate") {
        return NextResponse.json(
          { received: true, duplicate: true },
          { status: 200 }
        )
      }

      if (outcome === "invalid_amount") {
        return NextResponse.json(
          { received: true, skipped: true },
          { status: 200 }
        )
      }
    }
  }

  return NextResponse.json({ received: true }, { status: 200 })
}
