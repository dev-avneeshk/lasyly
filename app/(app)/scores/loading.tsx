export default function ScoresLoading() {
  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Sport tabs skeleton */}
      <div className="flex gap-2 overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-9 w-20 animate-pulse rounded-full bg-white/5" />
        ))}
      </div>
      {/* Score cards skeleton */}
      <div className="space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-xl bg-white/5 border border-white/5" />
        ))}
      </div>
    </div>
  )
}
