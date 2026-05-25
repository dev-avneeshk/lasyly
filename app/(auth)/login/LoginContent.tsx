"use client"

import Link from "next/link"
import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { isSupabaseConfigured, supabaseConfigError } from "@/lib/supabase/config"

export function LoginContent() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function getRedirect() {
    if (typeof window === "undefined") return "/explore"
    return new URLSearchParams(window.location.search).get("redirect") || "/explore"
  }

  const handleGoogleLogin = async () => {
    setIsLoading(true)
    setError(null)

    if (!isSupabaseConfigured()) {
      setError(supabaseConfigError)
      setIsLoading(false)
      return
    }

    const redirectTo = getRedirect()
    const supabase = createClient()
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectTo)}`,
        skipBrowserRedirect: false,
      },
    })

    if (error) {
      setError(`Google sign-in error: ${error.message}`)
      setIsLoading(false)
      return
    }

    if (data.url) {
      window.location.href = data.url
      return
    }

    setError("Google sign-in failed: no redirect URL returned. Check that the Google provider is enabled in your Supabase dashboard.")
    setIsLoading(false)
  }

  const handleGuestLogin = async () => {
    setIsLoading(true)
    setError(null)

    const response = await fetch("/api/auth/guest", { method: "POST" })

    if (!response.ok) {
      setError("Unable to start guest mode. Please try again.")
      setIsLoading(false)
      return
    }

    window.location.href = getRedirect()
  }

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl md:text-3xl font-bold font-serif tracking-tight text-white mb-2">Welcome back</h2>
        <p className="text-sm text-[var(--color-text-muted)]">Sign in to access your rooms and picks.</p>
      </div>

      {error && (
        <div className="mb-5 p-3.5 rounded-xl bg-red-500/8 border border-red-500/15 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Info notice */}
      <div className="mb-6 p-4 rounded-[1rem] border border-white/6 bg-white/3 flex items-start gap-3">
        <svg className="w-4 h-4 text-[var(--color-text-muted)] mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
          Email login is not available right now. Use Google or continue as a guest.
        </p>
      </div>

      {/* Google button */}
      <button
        type="button"
        disabled={isLoading}
        onClick={handleGoogleLogin}
        className="w-full h-12 rounded-full border border-white/10 bg-white/3 hover:bg-white/6 text-white font-medium text-sm flex items-center justify-center gap-3 transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:scale-[0.99] active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
        Continue with Google
      </button>

      {/* Guest button */}
      <button
        type="button"
        disabled={isLoading}
        onClick={handleGuestLogin}
        className="mt-4 w-full text-sm font-semibold text-[var(--color-lime)] transition-colors duration-300 hover:text-white disabled:pointer-events-none disabled:opacity-50"
      >
        Continue as guest
      </button>

      {/* Sign up link */}
      <div className="mt-8 pt-6 border-t border-[var(--color-border)] text-center text-sm text-[var(--color-text-muted)]">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="text-[var(--color-lime)] font-semibold hover:underline transition-colors duration-300">
          Sign up
        </Link>
      </div>
    </div>
  )
}
