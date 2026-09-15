/**
 * Route-level loading UI for /tipsters.
 *
 * The marketing route group had no Suspense boundary, so navigating to
 * /tipsters showed a blank frame until the full page streamed in. This gives an
 * instant paint (improving perceived FCP on the route) while the segment loads.
 */
export default function TipstersLoading() {
  return (
    <div className="flex min-h-[60vh] flex-1 items-center justify-center py-20">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-[var(--color-lime)]" />
        <p className="text-sm text-slate-400">Loading…</p>
      </div>
    </div>
  )
}
