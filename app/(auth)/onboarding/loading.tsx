/**
 * Route-level loading UI for /onboarding.
 *
 * The onboarding page is a heavy client component (Supabase client + icon set)
 * that runs several network calls on mount. Without a Suspense boundary the
 * auth route group showed a blank frame during navigation; this gives an
 * instant paint while the segment and its client bundle load.
 */
export default function OnboardingLoading() {
  return (
    <div className="flex min-h-[60vh] flex-1 items-center justify-center py-20">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-[var(--color-lime)]" />
        <p className="text-sm text-slate-400">Loading…</p>
      </div>
    </div>
  )
}
