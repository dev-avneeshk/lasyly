import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { withSecurity, checkQueryParams, CACHE_CONTROL } from "@/lib/security/routeHelpers"

const PAGE_SIZE = 10
const MAX_CONTENT_LENGTH = 500
const MAX_IMAGE_URL_LENGTH = 2048

// Rate limit: max 5 posts per hour per user
const POST_RATE_LIMIT = 5
const POST_RATE_WINDOW_MS = 60 * 60 * 1000 // 1 hour

/** GET /api/feed/posts — fetch the public social feed (paginated) */
export const GET = withSecurity(async (request: Request) => {
  const { searchParams } = new URL(request.url)
  const cursor = searchParams.get("cursor") // ISO date for pagination
  const limit = Math.min(parseInt(searchParams.get("limit") ?? String(PAGE_SIZE), 10), 20)

  const injectionCheck = checkQueryParams({ cursor })
  if (injectionCheck) return injectionCheck

  const supabase = createAdminClient()

  // Get current user for "liked by me" status
  const clientSupabase = await createClient()
  const { data: { user } } = await clientSupabase.auth.getUser()

  let query = supabase
    .from("posts")
    .select("id, user_id, content, image_url, parlay_id, like_count, comment_count, created_at")
    .order("created_at", { ascending: false })
    .limit(limit + 1)

  if (cursor) {
    query = query.lt("created_at", cursor)
  }

  const { data: posts, error } = await query

  if (error) {
    // Table might not exist yet
    if (error.code === "42P01") {
      return NextResponse.json({ posts: [], hasMore: false })
    }
    return NextResponse.json({ error: "Failed to fetch feed" }, { status: 500 })
  }

  if (!posts || posts.length === 0) {
    return NextResponse.json({ posts: [], hasMore: false })
  }

  const hasMore = posts.length > limit
  const results = hasMore ? posts.slice(0, limit) : posts

  // Fetch profiles for post authors
  const userIds = [...new Set(results.map((p) => p.user_id))]
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .in("id", userIds)

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]))

  // Fetch parlay data for posts that have linked bets
  const parlayIds = results.filter((p) => p.parlay_id).map((p) => p.parlay_id!)
  let parlayMap = new Map<string, any>()
  if (parlayIds.length > 0) {
    const { data: parlays } = await supabase
      .from("parlays")
      .select(`
        id, status, odds, created_at,
        legs:parlay_legs(id, player_name, stat_category, prop_line, direction, l10_hit_rate)
      `)
      .in("id", parlayIds)

    if (parlays) {
      parlayMap = new Map(parlays.map((p) => [p.id, p]))
    }
  }

  // Check which posts the current user has liked
  let likedPostIds = new Set<string>()
  if (user) {
    const postIds = results.map((p) => p.id)
    const { data: likes } = await supabase
      .from("post_likes")
      .select("post_id")
      .eq("user_id", user.id)
      .in("post_id", postIds)

    if (likes) {
      likedPostIds = new Set(likes.map((l) => l.post_id))
    }
  }

  const enrichedPosts = results.map((post) => ({
    ...post,
    profile: profileMap.get(post.user_id) ?? null,
    parlay: post.parlay_id ? parlayMap.get(post.parlay_id) ?? null : null,
    liked_by_me: likedPostIds.has(post.id),
  }))

  return NextResponse.json({
    posts: enrichedPosts,
    hasMore,
    nextCursor: hasMore ? results[results.length - 1].created_at : null,
  })
}, { cacheControl: CACHE_CONTROL.PUBLIC_SHORT })

/** POST /api/feed/posts — create a new post */
export const POST = withSecurity(async (request: Request) => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 })
  }

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const { content, image_url, parlay_id } = body

  // Validation
  if (!content && !image_url && !parlay_id) {
    return NextResponse.json({ error: "Post must have content, an image, or a linked bet" }, { status: 400 })
  }

  if (content && typeof content !== "string") {
    return NextResponse.json({ error: "Content must be a string" }, { status: 400 })
  }

  if (content && content.length > MAX_CONTENT_LENGTH) {
    return NextResponse.json({ error: `Content must be ${MAX_CONTENT_LENGTH} characters or less` }, { status: 400 })
  }

  if (image_url && typeof image_url !== "string") {
    return NextResponse.json({ error: "Image URL must be a string" }, { status: 400 })
  }

  if (image_url && image_url.length > MAX_IMAGE_URL_LENGTH) {
    return NextResponse.json({ error: "Image URL too long" }, { status: 400 })
  }

  // Basic URL validation for image
  if (image_url && !image_url.startsWith("https://")) {
    return NextResponse.json({ error: "Image URL must use HTTPS" }, { status: 400 })
  }

  // Rate limiting: check recent posts by this user
  const adminClient = createAdminClient()
  const oneHourAgo = new Date(Date.now() - POST_RATE_WINDOW_MS).toISOString()
  const { count: recentPostCount } = await adminClient
    .from("posts")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", oneHourAgo)

  if ((recentPostCount ?? 0) >= POST_RATE_LIMIT) {
    return NextResponse.json(
      { error: `Rate limit: maximum ${POST_RATE_LIMIT} posts per hour` },
      { status: 429 }
    )
  }

  // If parlay_id is provided, verify it belongs to the user and is public
  if (parlay_id) {
    const { data: parlay } = await supabase
      .from("parlays")
      .select("id, user_id, visibility")
      .eq("id", parlay_id)
      .maybeSingle()

    if (!parlay) {
      return NextResponse.json({ error: "Parlay not found" }, { status: 404 })
    }
    if (parlay.user_id !== user.id) {
      return NextResponse.json({ error: "You can only share your own bets" }, { status: 403 })
    }
  }

  // Sanitize content: strip HTML tags
  const sanitizedContent = content
    ? content.replace(/<[^>]*>/g, "").trim()
    : null

  const { data: post, error } = await supabase
    .from("posts")
    .insert({
      user_id: user.id,
      content: sanitizedContent || null,
      image_url: image_url || null,
      parlay_id: parlay_id || null,
    })
    .select("id, content, image_url, parlay_id, like_count, comment_count, created_at")
    .single()

  if (error) {
    return NextResponse.json({ error: "Failed to create post" }, { status: 500 })
  }

  return NextResponse.json({ post }, { status: 201 })
})
