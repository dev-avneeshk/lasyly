"use client"

import Link from "next/link"
import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

import { createClient } from "@/lib/supabase/client"
import { isSupabaseConfigured, supabaseConfigError } from "@/lib/supabase/config"

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()
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

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectTo)}`,
        // Skip the browser client PKCE step — the server callback route
        // handles the code exchange, so we don't need a client-side
        // code verifier stored in a cookie.
        skipBrowserRedirect: false,
      },
    })

    if (error) {
      setError(`Google sign-in error: ${error.message}`)
      setIsLoading(false)
      return
    }

    if (data.url) {
      // Hard redirect to Google's OAuth consent screen
      window.location.href = data.url
      return
    }

    setError("Google sign-in failed: no redirect URL returned. Check that the Google provider is enabled in your Supabase dashboard.")
    setIsLoading(false)
  }

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    
    const formData = new FormData(e.currentTarget)
    const email = formData.get('email') as string
    const password = formData.get('password') as string

    if (!isSupabaseConfigured()) {
      setError(supabaseConfigError)
      setIsLoading(false)
      return
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      // Surface the exact Supabase error — common causes:
      // "Invalid login credentials" → wrong password or user signed up via Google OAuth
      // "Email not confirmed" → user hasn't verified their email yet
      setError(error.message)
      setIsLoading(false)
      return
    }

    // Use a hard navigation instead of router.push so the browser sends the
    // freshly-set session cookies on the very first request to /explore.
    // router.push fires before @supabase/ssr has flushed all cookie writes,
    // which causes the middleware to see an empty session and redirect back
    // to /login.
    window.location.href = redirectTo
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
        <p className="text-[var(--color-text-muted)]">Enter your details to access your rooms.</p>
      </div>

      <form onSubmit={handleLogin} className="space-y-5">
        {error && (
          <div className="p-3 rounded-lg bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/20 text-sm text-[var(--color-danger)]">
            {error}
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-white/80">Email</label>
          <Input 
            type="email" 
            name="email"
            placeholder="you@example.com" 
            required 
            className="bg-black/20 border-white/10 focus-visible:ring-[var(--color-lime)]/50 focus-visible:border-[var(--color-lime)] h-12"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <label className="text-sm font-medium text-white/80">Password</label>
            <Link href="#" className="text-xs text-[var(--color-lime)] hover:text-white transition-colors">
              Forgot password?
            </Link>
          </div>
          <Input 
            type="password" 
            name="password"
            placeholder="••••••••" 
            required 
            className="bg-black/20 border-white/10 focus-visible:ring-[var(--color-lime)]/50 focus-visible:border-[var(--color-lime)] h-12"
          />
        </div>

        <Button 
          type="submit" 
          disabled={isLoading}
          className="w-full h-12 text-base font-semibold tracking-wide bg-[var(--color-lime)] text-black hover:opacity-90 transition-opacity border-none shadow-[0_4px_14px_rgba(212,255,0,0.4)]"
        >
          {isLoading ? "Signing in..." : "Sign in"}
        </Button>
      </form>

      <div className="mt-8 flex items-center gap-4">
        <div className="flex-1 h-[1px] bg-white/10"></div>
        <span className="text-xs text-[var(--color-text-muted)] font-medium uppercase tracking-wider">Or continue with</span>
        <div className="flex-1 h-[1px] bg-white/10"></div>
      </div>

      <div className="mt-6">
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
          Google
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
