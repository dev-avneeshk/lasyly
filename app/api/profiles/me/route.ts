import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { withSecurity, validateRequestBody, CACHE_CONTROL } from "@/lib/security/routeHelpers"

const updateProfileSchema = z.object({
  username: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores.").optional(),
  display_name: z.string().max(50).optional(),
  avatar_url: z.string().max(500).optional().nullable(),
  bio: z.string().max(500).optional().nullable(),
  favourite_sports: z.array(z.string().max(50)).max(10).optional().nullable(),
  country: z.string().max(100).optional().nullable(),
  account_type: z.enum(["bettor", "tipster", "both"]).optional(),
})

export const GET = withSecurity(async () => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 })
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select(
      "id, username, display_name, avatar_url, bio, favourite_sports, country, account_type, is_verified, created_at"
    )
    .eq("id", user.id)
    .single()

  if (error) {
    return NextResponse.json({ error: "Failed to fetch profile." }, { status: 500 })
  }

  // wallet_balance is column-level revoked from the authenticated role.
  // Read it through the SECURITY DEFINER RPC instead.
  const { data: walletBalance, error: walletErr } = await supabase.rpc(
    "get_my_wallet_balance"
  )

  if (walletErr) {
    return NextResponse.json({ error: "Failed to fetch wallet." }, { status: 500 })
  }

  return NextResponse.json({
    ...profile,
    wallet_balance: Number(walletBalance ?? 0),
  })
}, { cacheControl: CACHE_CONTROL.SENSITIVE })

export const PATCH = withSecurity(async (request: Request) => {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (!user || authError) {
    console.error("Profile PATCH auth error:", authError?.message ?? "No user found")
    return NextResponse.json(
      { error: "Not authenticated. Please log in again." },
      { status: 401 }
    )
  }

  const body = await request.json()
  const [data, validationError] = validateRequestBody(body, updateProfileSchema)
  if (validationError) return validationError

  // Validate username uniqueness if provided
  if (data.username !== undefined) {
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", data.username.toLowerCase())
      .neq("id", user.id)
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { error: "This username is already taken." },
        { status: 409 }
      )
    }
  }

  // Build update payload (only include provided fields)
  const updatePayload: Record<string, unknown> = {}
  if (data.username !== undefined) updatePayload.username = data.username.toLowerCase()
  if (data.display_name !== undefined) updatePayload.display_name = data.display_name
  if (data.avatar_url !== undefined) updatePayload.avatar_url = data.avatar_url
  if (data.bio !== undefined) updatePayload.bio = data.bio
  if (data.favourite_sports !== undefined) updatePayload.favourite_sports = data.favourite_sports
  if (data.country !== undefined) updatePayload.country = data.country
  if (data.account_type !== undefined) updatePayload.account_type = data.account_type

  if (Object.keys(updatePayload).length === 0) {
    return NextResponse.json(
      { error: "No fields to update." },
      { status: 400 }
    )
  }

  const { data: profile, error: updateErr } = await supabase
    .from("profiles")
    .update(updatePayload)
    .eq("id", user.id)
    .select()
    .single()

  if (updateErr) {
    console.error("Profile update DB error:", updateErr.message, updateErr.code)
    return NextResponse.json(
      { error: "Failed to update profile. Please try again." },
      { status: 500 }
    )
  }

  return NextResponse.json(profile)
}, { cacheControl: CACHE_CONTROL.SENSITIVE })
