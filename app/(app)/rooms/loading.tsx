export default function RoomsLoading() {
  return (
    <div className="h-[calc(100dvh-64px)] bg-[#313338] flex flex-col">
      {/* Header skeleton */}
      <div className="shrink-0 px-6 pt-6 pb-4 border-b border-[#1e1f22]">
        <div className="flex items-center justify-between mb-4">
          <div className="h-6 w-40 animate-pulse rounded bg-white/5" />
          <div className="h-9 w-28 animate-pulse rounded bg-white/5" />
        </div>
        <div className="h-10 w-full animate-pulse rounded bg-[#1e1f22]" />
      </div>

      {/* Cards skeleton */}
      <div className="flex-1 overflow-y-auto px-6 pt-5">
        <div className="h-4 w-32 animate-pulse rounded bg-white/5 mb-3" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-lg bg-[#2b2d31] overflow-hidden">
              <div className="h-[120px] animate-pulse bg-white/5" />
              <div className="p-3 space-y-2">
                <div className="h-4 w-3/4 animate-pulse rounded bg-white/5" />
                <div className="h-3 w-full animate-pulse rounded bg-white/5" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-white/5" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
