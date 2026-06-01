import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { createAdminClient } from "@/lib/supabase/admin"
import { AUTH_COOKIE_OPTIONS } from "@/lib/supabase/auth-config"

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get("code")
  const next = requestUrl.searchParams.get("next") || "/explore"

  if (code) {
    // We need to track cookies set during exchangeCodeForSession so we can
    // forward them onto the redirect response. The cookies() API from
    // next/headers does NOT propagate to a manually-created NextResponse.redirect().
    const cookiesToSet: Array<{ name: string; value: string; options: Record<string, unknown> }> = []

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookies) {
            cookies.forEach((cookie) => {
              // Update request cookies so subsequent reads (e.g. getUser)
              // see the fresh tokens set by exchangeCodeForSession
              request.cookies.set(cookie.name, cookie.value)
              cookiesToSet.push(cookie)
            })
          },
        },
      }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      const { data: { user } } = await supabase.auth.getUser()

      let redirectTo = next

      if (user) {
        // Ensure the profile row exists. Use admin client to bypass RLS.
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
          redirectTo = "/onboarding"
        } else if (profile.username.match(/_[a-f0-9]{8}$/) || profile.username.startsWith("user_")) {
          // Profile exists but onboarding incomplete
          redirectTo = "/onboarding"
        } else {
          // Returning user with complete profile
          redirectTo = next === "/dashboard" ? "/explore" : next
        }
      }

      // Build redirect response and attach all session cookies
      const response = NextResponse.redirect(new URL(redirectTo, requestUrl.origin))
      cookiesToSet.forEach(({ name, value, options }) => {
        response.cookies.set(name, value, {
          ...options,
          ...AUTH_COOKIE_OPTIONS,
        })
      })
      return response
    }
  }

  // Fallback: redirect to login on error
  return NextResponse.redirect(new URL("/login", requestUrl.origin))
}
