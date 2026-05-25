"use client"

import Link from "next/link"
import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"

import { createClient } from "@/lib/supabase/client"
import { isSupabaseConfigured, supabaseConfigError } from "@/lib/supabase/config"

export function LoginContent() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get("redirect") || "/explore"

  const handleGoogleLogin = async () => {
    setIsLoading(true)
    setError(null)

    if (!isSupabaseConfigured()) {
      setError(supabaseConfigError)
      setIsLoading(false)
      return
    }

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

    const response = await fetch("/api/auth/guest", {
      method: "POST",
    })

    if (!response.ok) {
      setError("Unable to start guest mode. Please try again.")
      setIsLoading(false)
      return
    }

    window.location.href = redirectTo
  }

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-white mb-2">Welcome back</h2>
        <p className="text-[var(--color-text-muted)]">Sign in to access your rooms.</p>
      </div>

      {error && (
        <div className="mb-5 p-3 rounded-lg bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/20 text-sm text-[var(--color-danger)]">
          {error}
        </div>
      )}

      {/* Email login unavailable notice */}
      <div className="mb-6 p-4 rounded-xl border border-white/10 bg-white/5 flex items-start gap-3">
        <svg className="w-4 h-4 text-[var(--color-text-muted)] mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-sm text-[var(--color-text-muted)]">
          Email login is not available right now. Use Google, Apple, or continue as a guest.
        </p>
      </div>

      {/* OAuth buttons */}
      <div className="space-y-3">
        <Button
          type="button"
          variant="outline"
          disabled={isLoading}
          onClick={handleGoogleLogin}
          className="w-full h-12 border-white/10 hover:bg-white/5 bg-black/20 font-medium"
        >
          <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
            <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Continue with Google
        </Button>
      </div>

      <button
        type="button"
        disabled={isLoading}
        onClick={handleGuestLogin}
        className="mt-4 w-full text-sm font-semibold text-[var(--color-lime)] transition-colors hover:text-white disabled:pointer-events-none disabled:opacity-50"
      >
        Continue as guest
      </button>

      <div className="mt-8 text-center text-sm text-[var(--color-text-primary)]">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="text-[var(--color-lime)] font-semibold hover:underline">
          Sign up
        </Link>
      </div>
    </div>
  )
}
