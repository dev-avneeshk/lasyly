import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { checkRateLimit, RATE_LIMITS } from "@/lib/rateLimit"
import { sanitizeText } from "@/lib/sanitize"
import { withSecurity, validateRequestBody, CACHE_CONTROL } from "@/lib/security/routeHelpers"

const VALID_ROOM_TYPES = ["Public", "Private", "Tipster"] as const

const createRoomSchema = z.object({
  name: z.string().min(3).max(40),
  description: z.string().min(1).max(200),
  sport_tag: z.string().min(1).max(50),
  type: z.enum(VALID_ROOM_TYPES),
})

export const POST = withSecurity(async (request: Request) => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: "You must be logged in to create a room." },
      { status: 401 }
    )
  }

  const body = await request.json()
  const [data, validationError] = validateRequestBody(body, createRoomSchema)
  if (validationError) return validationError

  // Free-tier cap: max 2 rooms per user (3rd requires Pro). Enforced in the DB
  // so the count is authoritative. 402 tells the client to show the upgrade UI.
  const { data: gate } = await supabase.rpc("can_create_room", { p_user_id: user.id })
  if (gate && gate.allowed === false) {
    if (gate.error === "LIMIT_REACHED") {
      return NextResponse.json({ error: "LIMIT_REACHED", limit: "rooms" }, { status: 402 })
    }
    return NextResponse.json({ error: gate.error || "Not allowed." }, { status: 403 })
  }

  // Anti-spam rate limit (separate from the tier cap): burst protection only.
  const rateCheck = await checkRateLimit(`room-create:${user.id}`, RATE_LIMITS.roomCreate)
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: "You're creating rooms too fast. Please wait a bit." },
      { status: 429 }
    )
  }

  // Sanitize inputs
  const cleanName = sanitizeText(data.name, 40)
  const cleanDescription = sanitizeText(data.description, 200)

  if (cleanName.length < 3) {
    return NextResponse.json(
      { error: "Room name must be between 3 and 40 characters." },
      { status: 400 }
    )
  }

  // Insert the room
  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .insert({
      name: cleanName,
      description: cleanDescription,
      sport_tag: data.sport_tag,
      type: data.type,
      creator_id: user.id,
    })
    .select()
    .single()

  if (roomError) {
    return NextResponse.json({ error: "Failed to create room." }, { status: 500 })
  }

  // Add creator as owner in room_members
  const { error: memberError } = await supabase.from("room_members").insert({
    room_id: room.id,
    user_id: user.id,
    role: "owner",
  })

  if (memberError) {
    return NextResponse.json({ error: "Failed to add room membership." }, { status: 500 })
  }

  return NextResponse.json(room, { status: 201 })
}, { cacheControl: CACHE_CONTROL.SENSITIVE })
