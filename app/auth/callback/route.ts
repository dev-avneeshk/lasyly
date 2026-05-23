import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get("code")
  const next = requestUrl.searchParams.get("next") || "/explore"

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        // Ensure the profile row exists. For email/password signups with
        // confirmation enabled, the user row in auth.users only becomes
        // live after they click the confirmation link — this is the first
        // point we can safely insert the profile. Use admin client to
        // bypass RLS (the session is valid but may not have propagated
        // to RLS cookies yet on this server request).
        const admin = createAdminClient()
        const { data: profile } = await admin
          .from("profiles")
          .select("username")
          .eq("id", user.id)
          .maybeSingle()

        if (!profile) {
          // New user — create a minimal profile. They'll complete it in onboarding.
          const autoUsername = `user_${user.id.replace(/-/g, "").slice(0, 8)}`
          await admin.from("profiles").upsert(
            {
              id: user.id,
              username: autoUsername,
              display_name: user.user_metadata?.display_name ?? user.email?.split("@")[0] ?? autoUsername,
              avatar_url: user.user_metadata?.avatar_url ?? null,
            },
            { onConflict: "id", ignoreDuplicates: true }
          )
          return NextResponse.redirect(new URL("/onboarding", requestUrl.origin))
        }

        // Profile exists — check if onboarding is complete
        if (profile.username.match(/_[a-f0-9]{8}$/) || profile.username.startsWith("user_")) {
          return NextResponse.redirect(new URL("/onboarding", requestUrl.origin))
        }
      }

      return NextResponse.redirect(new URL(next, requestUrl.origin))
    }
  }

  // Fallback: redirect to login on error
  return NextResponse.redirect(new URL("/login", requestUrl.origin))
}
