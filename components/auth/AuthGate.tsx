"use client"

import { LogIn } from "lucide-react"

/**
 * Full-page auth gate — renders when a page requires login but user is a guest.
 * Shows a centered message with sign up / log in buttons.
 */
export function AuthGatePage({ title = "Sign in to continue" }: { title?: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-lime)]/10 border border-[var(--color-lime)]/20 mb-5">
        <LogIn className="h-8 w-8 text-[var(--color-lime)]" />
      </div>
      <h1 className="text-xl font-bold text-white mb-2">{title}</h1>
      <p className="text-sm text-[var(--color-text-muted)] max-w-sm mb-6">
        Create a free account or sign in to access this feature and start tracking your bets.
      </p>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <a
          href="/signup"
          className="flex items-center justify-center w-full py-3 rounded-xl bg-[var(--color-lime)] text-black font-semibold text-sm hover:brightness-110 transition-all"
        >
          Sign up free
        </a>
        <a
          href="/login"
          className="flex items-center justify-center w-full py-3 rounded-xl bg-white/5 border border-[var(--color-border)] text-white font-semibold text-sm hover:bg-white/10 transition-all"
        >
          Log in
        </a>
      </div>
    </div>
  )
}

/**
 * Auth required popup/dialog — use as a modal overlay when a guest
 * tries to perform an action that requires login.
 */
export function AuthRequiredDialog({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative flex flex-col items-center gap-4 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-2xl px-8 py-8 shadow-2xl max-w-sm mx-4 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-lime)]/10 border border-[var(--color-lime)]/20">
          <LogIn className="h-7 w-7 text-[var(--color-lime)]" />
        </div>
        <h2 className="text-lg font-bold text-white">Sign in required</h2>
        <p className="text-sm text-[var(--color-text-muted)]">
          Create an account or sign in to build parlays, log picks, and track your bets.
        </p>
        <div className="flex flex-col gap-2 w-full mt-2">
          <a
            href="/signup"
            className="flex items-center justify-center w-full py-3 rounded-xl bg-[var(--color-lime)] text-black font-semibold text-sm hover:brightness-110 transition-all"
          >
            Sign up free
          </a>
          <a
            href="/login"
            className="flex items-center justify-center w-full py-3 rounded-xl bg-white/5 border border-[var(--color-border)] text-white font-semibold text-sm hover:bg-white/10 transition-all"
          >
            Log in
          </a>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-1 text-xs text-[var(--color-text-muted)] hover:text-white transition-colors"
        >
          Maybe later
        </button>
      </div>
    </div>
  )
}
