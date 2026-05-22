export default function AppLoading() {
  return (
    <div className="flex flex-1 items-center justify-center py-20">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-[var(--color-lime)]" />
        <p className="text-sm text-slate-400">Loading...</p>
      </div>
    </div>
  )
}
