export default function AnalysisLoading() {
  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header skeleton */}
      <div className="h-8 w-56 animate-pulse rounded-lg bg-white/5" />
      {/* Filter bar skeleton */}
      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-9 w-24 animate-pulse rounded-full bg-white/5" />
        ))}
      </div>
      {/* Prop cards skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="h-52 animate-pulse rounded-xl bg-white/5 border border-white/5" />
        ))}
      </div>
    </div>
  )
}
