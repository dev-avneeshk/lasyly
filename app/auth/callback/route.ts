import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { safeRedirectPath } from "@/lib/security/safeRedirect"
import { createServerClient } from "@supabase/ssr"
import { createAdminClient } from "@/lib/supabase/admin"
import { AUTH_COOKIE_OPTIONS } from "@/lib/supabase/auth-config"

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get("code")
  const next = safeRedirectPath(requestUrl.searchParams.get("next"))

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

        // Starter Coins, on EVERY sign-in rather than only when this route
        // created the profile.
        //
        // It used to sit inside the `!profile` branch above, and it never took
        // effect: on the live database all 23 accounts had 0 Coins and the
        // ledger had no SIGNUP_BONUS rows at all. Either the branch didn't run
        // (a profile already existed, e.g. created by a database trigger) or
        // the call failed and was only logged. Granting outside the branch
        // covers both, and gives existing accounts their bonus on next sign-in.
        //
        // Calling it every time is safe. grant_signup_bonus takes a per-user
        // advisory lock and uq_transactions_signup_bonus allows one row per
        // user, so repeats return 'duplicate' without touching the balance.
        // (It must never go back in PATCH /api/profiles/me: that route runs on
        // every profile edit and has no per-user rate limit.) Sign-ins are rare
        // enough that one extra RPC here costs nothing.
        const { data: bonus, error: bonusErr } = await admin.rpc("grant_signup_bonus", {
          p_user_id: user.id,
        })
        if (bonusErr || (bonus !== "completed" && bonus !== "duplicate")) {
          // Best-effort: never block sign-in on the bonus.
          console.error("Signup bonus grant error:", bonusErr?.message ?? bonus)
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
