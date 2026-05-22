import { MessageSquare, Lock } from "lucide-react"

export default function MyRoomsPage() {
  return (
    <div className="min-h-screen bg-[var(--color-background)] flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        <div className="w-20 h-20 rounded-full bg-[var(--color-lime)]/10 border border-[var(--color-lime)]/20 flex items-center justify-center mx-auto mb-6">
          <MessageSquare className="w-10 h-10 text-[var(--color-lime)]" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-3">Rooms</h1>
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--color-warning)]/10 border border-[var(--color-warning)]/20 mb-4">
          <Lock className="w-4 h-4 text-[var(--color-warning)]" />
          <span className="text-sm font-semibold text-[var(--color-warning)]">Coming Soon</span>
        </div>
        <p className="text-[var(--color-text-muted)] text-sm leading-relaxed">
          Join communities, create watch parties, and discuss picks with other sports fans. This feature is currently under development.
        </p>
      </div>
    </div>
  )
}
