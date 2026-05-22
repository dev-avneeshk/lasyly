import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { cached, CACHE_TTL } from "@/lib/cache"
import { withSecurity, checkQueryParams, CACHE_CONTROL } from "@/lib/security/routeHelpers"

const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 50

export const GET = withSecurity(async (request: Request) => {
  const { searchParams } = new URL(request.url)
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const roomId = searchParams.get("room_id")
  const cursor = searchParams.get("cursor")
  const pageSizeParam = searchParams.get("page_size")

  // Check query params for injection patterns
  const injectionCheck = checkQueryParams({ roomId, cursor, pageSizeParam })
  if (injectionCheck) return injectionCheck

  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, parseInt(pageSizeParam ?? String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE)
  )

  // If room_id is provided, validate it exists and check access for private rooms
  if (roomId) {
    const { data: room, error: roomErr } = await supabase
      .from("rooms")
      .select("id, type")
      .eq("id", roomId)
      .maybeSingle()

    if (roomErr) {
      return NextResponse.json({ error: "Failed to validate room." }, { status: 500 })
    }

    if (!room) {
      return NextResponse.json({ error: "Room not found." }, { status: 404 })
    }

    // Private rooms require membership to view betslips
    if (room.type === "Private") {
      if (!user) {
        return NextResponse.json({ error: "Authentication required." }, { status: 401 })
      }

      const { data: membership } = await supabase
        .from("room_members")
        .select("id")
        .eq("room_id", roomId)
        .eq("user_id", user.id)
        .maybeSingle()

      if (!membership) {
        return NextResponse.json({ error: "You must be a member to view this room's content." }, { status: 403 })
      }
    }
  }

  // Build the betslips query
  let query = supabase
    .from("betslips")
    .select(`
      id,
      room_id,
      user_id,
      sportsbook,
      bet_type,
      odds,
      stake,
      payout,
      matches,
      description,
      status,
      is_for_sale,
      price,
      comment_count,
      created_at,
      profiles:user_id (id, username, display_name, avatar_url, is_verified)
    `)
    .order("created_at", { ascending: false })
    .limit(pageSize + 1)

  // Apply cursor if valid
  if (cursor) {
    const cursorDate = new Date(cursor)
    if (!isNaN(cursorDate.getTime())) {
      query = query.lt("created_at", cursor)
    }
  }

  if (roomId) {
    query = query.eq("room_id", roomId)
  } else if (user) {
    const { followedUserIds, joinedRoomIds } = await cached(
      `feed-graph:${user.id}`,
      async () => {
        const [followsRes, membershipsRes] = await Promise.all([
          supabase.from("follows").select("following_id").eq("follower_id", user.id),
          supabase.from("room_members").select("room_id").eq("user_id", user.id),
        ])
        return {
          followedUserIds: followsRes.data?.map((f) => f.following_id) ?? [],
          joinedRoomIds: membershipsRes.data?.map((m) => m.room_id) ?? [],
        }
      },
      CACHE_TTL.feed
    )

    if (followedUserIds.length === 0 && joinedRoomIds.length === 0) {
      return NextResponse.json({
        betslips: [],
        pagination: { next_cursor: null, has_more: false, page_size: pageSize },
      })
    }

    const filters: string[] = []
    if (followedUserIds.length > 0) {
      filters.push(`user_id.in.(${followedUserIds.join(",")})`)
    }
    if (joinedRoomIds.length > 0) {
      filters.push(`room_id.in.(${joinedRoomIds.join(",")})`)
    }

    query = query.or(filters.join(","))
  } else {
    const { data: publicRooms } = await supabase
      .from("rooms")
      .select("id")
      .in("type", ["Public", "Tipster"])

    const publicRoomIds = publicRooms?.map((r) => r.id) ?? []

    if (publicRoomIds.length === 0) {
      return NextResponse.json({
        betslips: [],
        pagination: { next_cursor: null, has_more: false, page_size: pageSize },
      })
    }

    query = query.in("room_id", publicRoomIds)
  }

  const { data: rawBetslips, error: fetchError } = await query

  if (fetchError) {
    return NextResponse.json({ error: "Failed to fetch feed." }, { status: 500 })
  }

  const allResults = rawBetslips ?? []
  const hasMore = allResults.length > pageSize
  const betslips = hasMore ? allResults.slice(0, pageSize) : allResults
  const nextCursor = hasMore ? betslips[betslips.length - 1]?.created_at ?? null : null

  // Get user's unlocked picks to determine redaction
  let unlockedBetslipIds: Set<string> = new Set()
  if (user) {
    const { data: unlocked } = await supabase
      .from("unlocked_picks")
      .select("betslip_id")
      .eq("user_id", user.id)

    if (unlocked) {
      unlockedBetslipIds = new Set(unlocked.map((u) => u.betslip_id))
    }
  }

  // Format response
  const formattedBetslips = betslips.map((s) => {
    const profile = Array.isArray(s.profiles) ? s.profiles[0] : s.profiles

    const shouldRedact =
      s.is_for_sale &&
      s.user_id !== user?.id &&
      !unlockedBetslipIds.has(s.id)

    return {
      id: s.id,
      room_id: s.room_id,
      user_id: s.user_id,
      sportsbook: s.sportsbook,
      bet_type: s.bet_type,
      odds: s.odds,
      stake: s.stake,
      payout: s.payout,
      matches: shouldRedact ? [] : s.matches,
      description: s.description,
      status: s.status,
      is_for_sale: s.is_for_sale,
      price: s.price,
      comment_count: s.comment_count,
      created_at: s.created_at,
      user: {
        id: profile?.id ?? s.user_id,
        username: profile?.username ?? "user",
        display_name: profile?.display_name ?? "User",
        avatar_url: profile?.avatar_url ?? null,
        is_verified: profile?.is_verified ?? false,
      },
    }
  })

  return NextResponse.json({
    betslips: formattedBetslips,
    pagination: {
      next_cursor: nextCursor,
      has_more: hasMore,
      page_size: pageSize,
    },
  })
}, { cacheControl: CACHE_CONTROL.SENSITIVE })
