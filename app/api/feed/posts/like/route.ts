import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { withSecurity } from "@/lib/security/routeHelpers"

/** POST /api/feed/posts/like — toggle like on a post */
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

  const { post_id } = body

  if (!post_id || typeof post_id !== "string") {
    return NextResponse.json({ error: "post_id is required" }, { status: 400 })
  }

  // Check if already liked
  const { data: existing } = await supabase
    .from("post_likes")
    .select("id")
    .eq("post_id", post_id)
    .eq("user_id", user.id)
    .maybeSingle()

  if (existing) {
    // Unlike
    await supabase.from("post_likes").delete().eq("id", existing.id)
    return NextResponse.json({ liked: false })
  } else {
    // Like
    const { error } = await supabase.from("post_likes").insert({
      post_id,
      user_id: user.id,
    })

    if (error) {
      // Could be a race condition duplicate
      if (error.code === "23505") {
        return NextResponse.json({ liked: true })
      }
      return NextResponse.json({ error: "Failed to like post" }, { status: 500 })
    }

    return NextResponse.json({ liked: true })
  }
})
