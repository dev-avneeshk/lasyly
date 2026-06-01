import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { withSecurity, checkQueryParams } from "@/lib/security/routeHelpers"

const MAX_COMMENT_LENGTH = 300
const COMMENT_RATE_LIMIT = 20 // per hour
const RATE_WINDOW_MS = 60 * 60 * 1000

/** GET /api/feed/posts/comments?post_id=xxx — fetch comments for a post */
export const GET = withSecurity(async (request: Request) => {
  const { searchParams } = new URL(request.url)
  const postId = searchParams.get("post_id")

  if (!postId) {
    return NextResponse.json({ error: "post_id is required" }, { status: 400 })
  }

  const injectionCheck = checkQueryParams({ postId })
  if (injectionCheck) return injectionCheck

  const supabase = createAdminClient()

  const { data: comments, error } = await supabase
    .from("post_comments")
    .select("id, user_id, content, created_at")
    .eq("post_id", postId)
    .order("created_at", { ascending: true })
    .limit(50)

  if (error) {
    if (error.code === "42P01") {
      return NextResponse.json({ comments: [] })
    }
    return NextResponse.json({ error: "Failed to fetch comments" }, { status: 500 })
  }

  // Fetch profiles
  const userIds = [...new Set((comments ?? []).map((c) => c.user_id))]
  let profileMap = new Map<string, any>()
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .in("id", userIds)

    if (profiles) {
      profileMap = new Map(profiles.map((p) => [p.id, p]))
    }
  }

  const enriched = (comments ?? []).map((c) => ({
    ...c,
    profile: profileMap.get(c.user_id) ?? null,
  }))

  return NextResponse.json({ comments: enriched })
})

/** POST /api/feed/posts/comments — add a comment to a post */
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

  const { post_id, content } = body

  if (!post_id || typeof post_id !== "string") {
    return NextResponse.json({ error: "post_id is required" }, { status: 400 })
  }

  if (!content || typeof content !== "string") {
    return NextResponse.json({ error: "content is required" }, { status: 400 })
  }

  const trimmed = content.replace(/<[^>]*>/g, "").trim()

  if (trimmed.length === 0) {
    return NextResponse.json({ error: "Comment cannot be empty" }, { status: 400 })
  }

  if (trimmed.length > MAX_COMMENT_LENGTH) {
    return NextResponse.json({ error: `Comment must be ${MAX_COMMENT_LENGTH} characters or less` }, { status: 400 })
  }

  // Rate limiting
  const adminClient = createAdminClient()
  const oneHourAgo = new Date(Date.now() - RATE_WINDOW_MS).toISOString()
  const { count } = await adminClient
    .from("post_comments")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", oneHourAgo)

  if ((count ?? 0) >= COMMENT_RATE_LIMIT) {
    return NextResponse.json({ error: "Rate limit: too many comments" }, { status: 429 })
  }

  const { data: comment, error } = await supabase
    .from("post_comments")
    .insert({
      post_id,
      user_id: user.id,
      content: trimmed,
    })
    .select("id, content, created_at")
    .single()

  if (error) {
    return NextResponse.json({ error: "Failed to add comment" }, { status: 500 })
  }

  return NextResponse.json({ comment }, { status: 201 })
})
