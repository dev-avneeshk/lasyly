import { NextResponse } from "next/server"
import Stripe from "stripe"
import { createClient } from "@/lib/supabase/server"
import { withSecurity, CACHE_CONTROL } from "@/lib/security/routeHelpers"
import { checkRateLimit, RATE_LIMITS } from "@/lib/rateLimit"

function isStripeConfigured(): boolean {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) return false
  if (key === "sk_test_dummy" || key === "sk_test_placeholder" || key === "sk_test_placeholder_not_functional") return false
  if (key.startsWith("sk_")) return true
  return false
}

export const POST = withSecurity(async (req: Request) => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: "You must be logged in to top up your wallet." },
      { status: 401 }
    )
  }

  // Rate limit wallet operations
  const rateCheck = checkRateLimit(`wallet:${user.id}`, RATE_LIMITS.wallet)
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: "Too many wallet operations. Please wait a moment." },
      { status: 429 }
    )
  }

  // Check Stripe configuration
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "Payments are currently unavailable. Please try again later." },
      { status: 503 }
    )
  }

  const body = await req.json()
  const { amount } = body

  // Validate amount
  if (!amount || typeof amount !== "number" || amount < 10 || amount > 10000) {
    return NextResponse.json(
      { error: "Amount must be between $10 and $10,000." },
      { status: 400 }
    )
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2026-04-22.dahlia",
  })

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "Lasyly Wallet Top-Up",
              description: `Add $${amount.toFixed(2)} to your Lasyly wallet.`,
            },
            unit_amount: Math.round(amount * 100), // Convert to cents
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/wallet?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/wallet?canceled=true`,
      metadata: {
        userId: user.id,
        type: "TOP_UP",
      },
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error("Stripe Checkout Error:", error)
    return NextResponse.json(
      { error: "Failed to create checkout session." },
      { status: 500 }
    )
  }
}, { cacheControl: CACHE_CONTROL.SENSITIVE })
