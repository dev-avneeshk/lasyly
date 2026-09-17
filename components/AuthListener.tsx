"use client"

import { useEffect } from "react"
import { getSupabaseClient } from "@/lib/supabase/lazy-client"
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
 *
 * The Supabase client is loaded lazily (see lib/supabase/lazy-client.ts). A
 * static import here put 177 KB of supabase-js into the blocking script set of
 * every route under app/(app). This is a token-refresh watchdog against tokens
 * that live for an hour — starting it a beat after the page is interactive costs
 * nothing and is not a behaviour change worth the bytes.
 */
export default function AuthListener() {
  const router = useRouter()

  useEffect(() => {
    let cancelled = false
    let unsubscribe: (() => void) | null = null

    const subscribe = async () => {
      let supabase
      try {
        supabase = await getSupabaseClient()
      } catch {
        // Chunk failed to load. The server-side session is untouched, so the
        // user keeps working; they just lose proactive refresh for this page.
        return
      }
      // Unmounted (or navigated) while the chunk was in flight.
      if (cancelled) return

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event) => {
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

      unsubscribe = () => subscription.unsubscribe()
    }

    // Wait for the page to settle before spending main-thread time on this.
    const idle = (
      window as Window &
        typeof globalThis & {
          requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number
        }
    ).requestIdleCallback

    if (typeof idle === "function") idle(() => void subscribe(), { timeout: 3000 })
    else setTimeout(() => void subscribe(), 1000)

    return () => {
      cancelled = true
      unsubscribe?.()
    }
  }, [router])

  return null
}
