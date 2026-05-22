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

  // Rate limit room creation
  const rateCheck = checkRateLimit(`room-create:${user.id}`, RATE_LIMITS.roomCreate)
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: "You can only create 5 rooms per hour." },
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
