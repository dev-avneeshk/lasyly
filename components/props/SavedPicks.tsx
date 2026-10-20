"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Bookmark, Loader2, X } from "lucide-react"
import { STAT_LABELS } from "@/lib/props/constants"
import { playerSlug } from "@/components/analysis/playerHref"

interface SavedPick {
  id: string
  player_name: string
  sport: string
  stat_category: string
  prop_line: number
  direction: string
  status: string
  created_at: string
}

/**
 * The picks a user saved with the bookmark on a prop card (bet_tracker rows,
 * still pending). Before this list existed a saved pick went nowhere visible,
 * so the bookmark looked broken even when the save succeeded.
 */
export function SavedPicks() {
  const [picks, setPicks] = useState<SavedPick[] | null>(null)
  const [removing, setRemoving] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/bets?limit=100")
      if (!res.ok) {
        setPicks([])
        return
      }
      const data = (await res.json()) as { bets?: SavedPick[] }
      setPicks((data.bets ?? []).filter((b) => b.status === "pending"))
    } catch {
      setPicks([])
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const remove = async (id: string) => {
    setRemoving(id)
    try {
      const res = await fetch(`/api/bets/${id}`, { method: "DELETE" })
      if (res.ok || res.status === 404) {
        setPicks((prev) => (prev ?? []).filter((p) => p.id !== id))
      }
    } finally {
      setRemoving(null)
    }
  }

  if (picks === null) {
    return <div className="mt-8 h-20 animate-pulse rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]" />
  }

  return (
    <section aria-labelledby="saved-picks-heading" className="mt-8">
      <div className="mb-3 flex items-center justify-between">
        <h2
          id="saved-picks-heading"
          className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[var(--color-text-muted)]"
        >
          <Bookmark className="h-3.5 w-3.5 fill-current text-[var(--color-lime)]" />
          Saved picks
        </h2>
        <span className="text-[11px] font-bold tabular-nums text-[var(--color-text-muted)]">
          {picks.length}
        </span>
      </div>

      {picks.length === 0 ? (
        <p className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-5 text-sm text-[var(--color-text-muted)]">
          Nothing saved yet. Tap the bookmark on any prop card to save it here.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {picks.map((pick) => {
            const statLabel = STAT_LABELS[pick.stat_category] ?? pick.stat_category
            const href = `/analysis/${playerSlug(pick.player_name)}?${new URLSearchParams({
              stat: pick.stat_category,
              sport: pick.sport,
            }).toString()}`
            return (
              <li
                key={pick.id}
                className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3"
              >
                <Link href={href} className="min-w-0 flex-1 group">
                  <p className="truncate text-sm font-bold text-[var(--color-text-primary)] group-hover:text-[var(--color-lime)] transition-colors">
                    {pick.player_name}
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    <span className="font-semibold capitalize text-[var(--color-text-secondary)]">{pick.direction}</span>{" "}
                    {pick.prop_line} {statLabel} · {pick.sport} ·{" "}
                    {new Date(pick.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </p>
                </Link>
                <button
                  type="button"
                  onClick={() => remove(pick.id)}
                  disabled={removing === pick.id}
                  aria-label={`Remove ${pick.player_name} ${statLabel} from saved picks`}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--color-text-muted)] transition-colors hover:bg-white/5 hover:text-red-400 disabled:opacity-50"
                >
                  {removing === pick.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
