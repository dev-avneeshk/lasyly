export default function RoomsLoading() {
  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="h-8 w-32 animate-pulse rounded-lg bg-white/5" />
        <div className="h-9 w-28 animate-pulse rounded-full bg-white/5" />
      </div>
      {/* Room cards skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-36 animate-pulse rounded-xl bg-white/5 border border-white/5" />
        ))}
      </div>
    </div>
  )
}
