/**
 * Loading skeleton for the player analysis dashboard.
 * Renders a placeholder layout matching the final dashboard structure.
 */
export function PlayerDashboardSkeleton() {
  return (
    <div className="min-h-screen bg-[var(--color-background)] text-[var(--color-text-primary)] p-4 flex flex-col gap-4 overflow-x-hidden font-sans">
      {/* Back Button Skeleton */}
      <div className="h-4 w-16 rounded bg-white/5 animate-pulse" />
      {/* Row 1: Player Profile Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:h-[280px]">
        <div className="lg:col-span-3 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md p-4 animate-pulse">
          <div className="flex justify-between items-start mb-6">
            <div className="h-12 w-28 rounded bg-white/5" />
            <div className="w-14 h-14 rounded-full bg-white/5" />
          </div>
          <div className="flex justify-center mb-4">
            <div className="h-[120px] w-[100px] rounded-lg bg-white/5" />
          </div>
          <div className="grid grid-cols-3 gap-2 border-t border-[var(--color-border)] pt-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex flex-col items-center gap-1">
                <div className="h-3 w-10 rounded bg-white/5" />
                <div className="h-5 w-8 rounded bg-white/5" />
              </div>
            ))}
          </div>
        </div>
        <div className="lg:col-span-6 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md p-4 animate-pulse">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-white/5" />
              <div className="h-4 w-24 rounded bg-white/5" />
            </div>
            <div className="h-5 w-12 rounded bg-white/5" />
          </div>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-12 rounded bg-white/5" />
            ))}
          </div>
        </div>
        <div className="lg:col-span-3 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md p-4 animate-pulse">
          <div className="h-5 w-20 rounded bg-white/5 mx-auto mb-4" />
          <div className="flex justify-between items-center px-4 my-6">
            <div className="w-16 h-16 rounded-full bg-white/5" />
            <div className="h-6 w-16 rounded bg-white/5" />
            <div className="w-16 h-16 rounded-full bg-white/5" />
          </div>
          <div className="h-4 w-32 rounded bg-white/5 mx-auto" />
        </div>
      </div>
      {/* Row 2: Stat Selector Skeleton */}
      <div className="flex gap-2 overflow-hidden">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="h-10 w-20 rounded-md bg-white/5 animate-pulse shrink-0" />
        ))}
      </div>
      {/* Row 3: Performance Chart Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-9 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md p-4 animate-pulse">
          <div className="flex justify-between items-center mb-4">
            <div className="h-5 w-28 rounded bg-white/5" />
            <div className="flex items-center gap-2">
              <div className="h-7 w-32 rounded bg-white/5" />
              <div className="h-5 w-10 rounded bg-white/5" />
            </div>
          </div>
          <div className="h-[320px] flex items-end gap-2 px-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="flex-1 rounded-t bg-white/5"
                style={{ height: `${30 + Math.random() * 60}%` }}
              />
            ))}
          </div>
        </div>
        <div className="lg:col-span-3 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md p-4 animate-pulse">
          <div className="h-5 w-32 rounded bg-white/5 mx-auto mb-4" />
          <div className="space-y-3">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="flex justify-between">
                <div className="h-4 w-12 rounded bg-white/5" />
                <div className="h-4 w-8 rounded bg-white/5" />
                <div className="h-4 w-8 rounded bg-white/5" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
