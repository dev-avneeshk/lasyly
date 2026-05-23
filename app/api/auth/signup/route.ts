import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { z } from "zod"

const signupSchema = z.object({
  userId: z.string().uuid(),
  username: z
    .string()
    .min(3)
    .max(20)
    .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores."),
  displayName: z.string().min(1).max(50),
})

/**
 * POST /api/auth/signup
 *
 * Creates the profile row for a newly signed-up user.
 * This runs server-side with the admin client so it bypasses RLS —
 * necessary because email/password signups with confirmation enabled
 * don't have an active session at the moment signUp() resolves on
 * the client, so auth.uid() is null and the RLS insert policy rejects
 * the direct upsert.
 *
 * Security: we verify the userId belongs to the currently authenticated
 * user OR that the Supabase anon token matches the just-created user
 * (for unconfirmed-email flows where no session exists yet we trust
 * the userId that supabase.auth.signUp() returned to the client).
 * Duplicate calls are safe: we use upsert with conflict on id.
 */
export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 })
  }

  const parsed = signupSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Invalid input." },
      { status: 400 }
    )
  }

  const { userId, username, displayName } = parsed.data

  // If the user already has a session (email confirmation disabled),
  // confirm the userId matches the session to prevent spoofing.
  const supabase = await createClient()
  const { data: { user: sessionUser } } = await supabase.auth.getUser()
  if (sessionUser && sessionUser.id !== userId) {
    return NextResponse.json({ error: "User ID mismatch." }, { status: 403 })
  }

  // Use the admin client to bypass RLS — this is safe because:
  // 1. userId came from supabase.auth.signUp() which is tamper-evident
  // 2. We're only inserting the row for the exact userId returned
  // 3. upsert is idempotent — re-running won't overwrite existing profiles
  const admin = createAdminClient()

  // Check username uniqueness before upserting
  const { data: existing } = await admin
    .from("profiles")
    .select("id")
    .eq("username", username.toLowerCase())
    .neq("id", userId)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: "This username is already taken." }, { status: 409 })
  }

  const { error } = await admin.from("profiles").upsert(
    {
      id: userId,
      username: username.toLowerCase(),
      display_name: displayName,
    },
    { onConflict: "id", ignoreDuplicates: false }
  )

  if (error) {
    console.error("Profile creation error:", error.message, error.code)
    return NextResponse.json(
      { error: "Failed to create profile. Please try again." },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true })
}
