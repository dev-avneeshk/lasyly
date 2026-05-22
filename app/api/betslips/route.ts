import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { withSecurity, validateRequestBody, CACHE_CONTROL } from "@/lib/security/routeHelpers"

const VALID_BET_TYPES = ["Single", "Accumulator", "System", "Lucky"] as const

const createBetslipSchema = z.object({
  sportsbook: z.string().min(1).max(100),
  bet_type: z.enum(VALID_BET_TYPES),
  odds: z.number().gt(0).lte(100000),
  matches: z.array(z.unknown()).min(1).max(20),
  room_id: z.string().uuid().optional().nullable(),
  description: z.string().max(500).optional().nullable(),
  stake: z.number().min(0).optional().nullable(),
  is_for_sale: z.boolean().optional().default(false),
  price: z.number().gt(0).optional().nullable(),
})

export const POST = withSecurity(async (request: Request) => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: "You must be logged in to create a betslip." },
      { status: 401 }
    )
  }

  const body = await request.json()
  const [data, validationError] = validateRequestBody(body, createBetslipSchema)
  if (validationError) return validationError

  // Validate is_for_sale + price
  if (data.is_for_sale && (!data.price || data.price <= 0)) {
    return NextResponse.json(
      { error: "A positive price is required when betslip is marked for sale." },
      { status: 400 }
    )
  }

  // Validate room_id if provided
  if (data.room_id) {
    const { data: room, error: roomErr } = await supabase
      .from("rooms")
      .select("id")
      .eq("id", data.room_id)
      .maybeSingle()

    if (roomErr) {
      return NextResponse.json({ error: "Failed to validate room." }, { status: 500 })
    }

    if (!room) {
      return NextResponse.json(
        { error: "Room not found." },
        { status: 400 }
      )
    }
  }

  // Insert betslip
  const { data: betslip, error: insertError } = await supabase
    .from("betslips")
    .insert({
      user_id: user.id,
      sportsbook: data.sportsbook,
      bet_type: data.bet_type,
      odds: data.odds,
      matches: data.matches,
      room_id: data.room_id || null,
      description: data.description || null,
      stake: data.stake ?? null,
      is_for_sale: data.is_for_sale ?? false,
      price: data.price ?? null,
      status: "Pending",
    })
    .select()
    .single()

  if (insertError) {
    return NextResponse.json({ error: "Failed to create betslip." }, { status: 500 })
  }

  return NextResponse.json(betslip, { status: 201 })
}, { cacheControl: CACHE_CONTROL.SENSITIVE })
