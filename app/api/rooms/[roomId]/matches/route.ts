import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { withSecurity, validateRequestBody, checkQueryParams, CACHE_CONTROL } from "@/lib/security/routeHelpers"

const addMatchSchema = z.object({
  match_id: z.string().min(1).max(255),
  home_team: z.string().min(1).max(255),
  away_team: z.string().min(1).max(255),
  league: z.string().max(255).optional().nullable(),
  sport: z.string().max(100).optional().nullable(),
})

export const GET = withSecurity(async (
  _request: Request,
  context?: { params: Promise<Record<string, string>> }
) => {
  const { roomId } = await context!.params
  const supabase = await createClient()

  const { data: roomMatches, error } = await supabase
    .from("room_matches")
    .select("*")
    .eq("room_id", roomId)
    .order("added_at", { ascending: false })

  if (error) {
    return NextResponse.json({ error: "Failed to fetch matches." }, { status: 500 })
  }

  return NextResponse.json({ matches: roomMatches ?? [] })
}, { cacheControl: CACHE_CONTROL.PUBLIC_SHORT })

export const POST = withSecurity(async (
  request: Request,
  context?: { params: Promise<Record<string, string>> }
) => {
  const { roomId } = await context!.params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: "You must be logged in to add matches." },
      { status: 401 }
    )
  }

  // Check user is owner or moderator of this room
  const { data: membership } = await supabase
    .from("room_members")
    .select("role")
    .eq("room_id", roomId)
    .eq("user_id", user.id)
    .maybeSingle()

  if (!membership || (membership.role !== "owner" && membership.role !== "moderator")) {
    return NextResponse.json(
      { error: "Only room owners and moderators can add matches." },
      { status: 403 }
    )
  }

  const body = await request.json()
  const [data, validationError] = validateRequestBody(body, addMatchSchema)
  if (validationError) return validationError

  const { data: inserted, error: insertErr } = await supabase
    .from("room_matches")
    .insert({
      room_id: roomId,
      match_id: data.match_id,
      home_team: data.home_team,
      away_team: data.away_team,
      league: data.league ?? null,
      sport: data.sport ?? null,
      added_by: user.id,
    })
    .select()
    .single()

  if (insertErr) {
    if (insertErr.code === "23505") {
      return NextResponse.json(
        { error: "This match is already added to the room." },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: "Failed to add match." }, { status: 500 })
  }

  return NextResponse.json(inserted, { status: 201 })
}, { cacheControl: CACHE_CONTROL.SENSITIVE })

export const DELETE = withSecurity(async (
  request: Request,
  context?: { params: Promise<Record<string, string>> }
) => {
  const { roomId } = await context!.params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: "You must be logged in." },
      { status: 401 }
    )
  }

  const { searchParams } = new URL(request.url)
  const matchId = searchParams.get("match_id")

  // Check query params for injection patterns
  const injectionCheck = checkQueryParams({ matchId })
  if (injectionCheck) return injectionCheck

  if (!matchId) {
    return NextResponse.json(
      { error: "match_id query parameter is required." },
      { status: 400 }
    )
  }

  // Check user is owner or moderator
  const { data: membership } = await supabase
    .from("room_members")
    .select("role")
    .eq("room_id", roomId)
    .eq("user_id", user.id)
    .maybeSingle()

  if (!membership || (membership.role !== "owner" && membership.role !== "moderator")) {
    return NextResponse.json(
      { error: "Only room owners and moderators can remove matches." },
      { status: 403 }
    )
  }

  const { error: deleteErr } = await supabase
    .from("room_matches")
    .delete()
    .eq("room_id", roomId)
    .eq("match_id", matchId)

  if (deleteErr) {
    return NextResponse.json({ error: "Failed to remove match." }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}, { cacheControl: CACHE_CONTROL.SENSITIVE })
