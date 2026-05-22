import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { checkRateLimit, RATE_LIMITS } from "@/lib/rateLimit"
import { invalidateCachePrefix } from "@/lib/cache"
import { withSecurity, validateRequestBody, CACHE_CONTROL } from "@/lib/security/routeHelpers"

const followSchema = z.object({
  followingId: z.string().uuid(),
})

export const POST = withSecurity(async (request: Request) => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: "Guest users cannot follow profiles." },
      { status: 401 }
    )
  }

  const body = await request.json()
  const [data, validationError] = validateRequestBody(body, followSchema)
  if (validationError) return validationError

  // Rate limit
  const rateCheck = checkRateLimit(`follow:${user.id}`, RATE_LIMITS.follow)
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: "Too many follow actions. Please slow down." },
      { status: 429 }
    )
  }

  // Cannot follow yourself
  if (data.followingId === user.id) {
    return NextResponse.json(
      { error: "You cannot follow yourself." },
      { status: 400 }
    )
  }

  // Validate target user exists
  const { data: targetUser, error: targetErr } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", data.followingId)
    .maybeSingle()

  if (targetErr) {
    return NextResponse.json({ error: "Failed to validate user." }, { status: 500 })
  }

  if (!targetUser) {
    return NextResponse.json(
      { error: "User not found." },
      { status: 404 }
    )
  }

  // Check existing follow (toggle behavior)
  const { data: existing, error: lookupError } = await supabase
    .from("follows")
    .select("id")
    .eq("follower_id", user.id)
    .eq("following_id", data.followingId)
    .maybeSingle()

  if (lookupError) {
    return NextResponse.json({ error: "Failed to check follow status." }, { status: 500 })
  }

  if (existing) {
    const { error } = await supabase
      .from("follows")
      .delete()
      .eq("id", existing.id)
      .eq("follower_id", user.id)

    if (error) {
      return NextResponse.json({ error: "Failed to unfollow." }, { status: 500 })
    }
  } else {
    const { error } = await supabase.from("follows").insert({
      follower_id: user.id,
      following_id: data.followingId,
    })

    if (error) {
      return NextResponse.json({ error: "Failed to follow." }, { status: 500 })
    }
  }

  invalidateCachePrefix(`feed-graph:${user.id}`)

  const [{ count: followerCount }, { count: followingCount }] = await Promise.all([
    supabase
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("following_id", data.followingId),
    supabase
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("follower_id", user.id),
  ])

  return NextResponse.json({
    following: !existing,
    followerCount: followerCount ?? 0,
    followingCount: followingCount ?? 0,
  })
}, { cacheControl: CACHE_CONTROL.SENSITIVE })
