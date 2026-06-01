"use client"

import { useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"

/**
 * Client-side auth state listener.
 *
 * Mounts once at the app shell level and keeps the Supabase session alive
 * by subscribing to onAuthStateChange. This ensures:
 * 1. Access tokens are refreshed before they expire (autoRefreshToken)
 * 2. If a refresh fails (e.g., refresh token expired after 7 days),
 *    the user is redirected to login instead of seeing broken UI.
 * 3. Client-side navigations (which skip the proxy) still have valid tokens.
 */
export default function AuthListener() {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "TOKEN_REFRESHED") {
        // Token was refreshed successfully — trigger a router refresh
        // so Server Components re-read the updated cookies.
        router.refresh()
      }

      if (event === "SIGNED_OUT") {
        // Session ended (refresh token expired or user logged out elsewhere)
        router.push("/login")
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [router])

  return null
}
