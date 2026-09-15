"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Search, X } from "lucide-react"
import type { NflPlayer, Position } from "@/lib/nfl/types"
import { headshotUrl } from "@/lib/nfl/data"
import { playerValue } from "@/lib/nfl/value"
import { estimatedPrice } from "@/lib/nfl/grades"
import { cn } from "@/lib/utils"

type SortKey = "overall" | "value" | "estimate" | "name"

const POSITION_FILTERS: (Position | "ALL" | "OFF" | "DEF")[] = ["ALL", "OFF", "DEF", "QB", "RB", "WR", "TE", "EDGE", "LB", "CB", "S"]
const OFFENSE: Position[] = ["QB", "RB", "WR", "TE"]

const SORTS: { key: SortKey; label: string }[] = [
  { key: "overall", label: "Overall" },
  { key: "value", label: "Value" },
  { key: "estimate", label: "Est. Price" },
  { key: "name", label: "Name" },
]

// A representative budget/roster so the "est. price" column is meaningful on the
// browse page (matches the default league). The engine owns the math.
const REF_BUDGET = 50
const REF_ROSTER = 9

function initials(name: string): string {
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()
}

function Avatar({ player }: { player: NflPlayer }) {
  const url = headshotUrl(player)
  const [failed, setFailed] = useState(false)
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/10 ring-1 ring-white/10">
      {url && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" loading="lazy" onError={() => setFailed(true)} className="h-full w-full object-cover object-top" />
      ) : (
        <span className="text-[10px] font-bold text-[var(--color-text-muted)]">{initials(player.name)}</span>
      )}
    </span>
  )
}

const POS_TONE: Record<string, string> = {
  QB: "text-[var(--color-lime)]", RB: "text-[var(--color-lime)]", WR: "text-[var(--color-lime)]", TE: "text-[var(--color-lime)]",
  EDGE: "text-[var(--color-primary)]", LB: "text-[var(--color-primary)]", CB: "text-[var(--color-primary)]", S: "text-[var(--color-primary)]",
}

export default function PlayersClient({ players, season }: { players: NflPlayer[]; season: string }) {
  const [query, setQuery] = useState("")
  const [pos, setPos] = useState<(typeof POSITION_FILTERS)[number]>("ALL")
  const [sort, setSort] = useState<SortKey>("overall")

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = players.filter((p) => {
      if (pos === "OFF") return OFFENSE.includes(p.position)
      if (pos === "DEF") return !OFFENSE.includes(p.position)
      if (pos !== "ALL") return p.position === pos
      return true
    })
    if (q) {
      list = list.filter(
        (p) => p.name.toLowerCase().includes(q) || p.team.toLowerCase().includes(q) || p.position.toLowerCase().includes(q)
      )
    }
    const withValue = list.map((p) => ({
      p,
      value: playerValue(p),
      estimate: estimatedPrice(p, REF_BUDGET, REF_ROSTER),
    }))
    withValue.sort((a, b) => {
      switch (sort) {
        case "name": return a.p.name.localeCompare(b.p.name)
        case "value": return b.value - a.value
        case "estimate": return b.estimate - a.estimate
        case "overall":
        default: return b.p.overall - a.p.overall
      }
    })
    return withValue
  }, [players, query, pos, sort])

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 pb-28 md:pb-8">
      <div className="mb-6">
        <span className="text-xs font-bold uppercase tracking-[0.3em] text-[var(--color-lime)]">Lasyly Gridiron</span>
        <h1 className="mt-1 text-3xl font-black tracking-tight text-[var(--color-text-primary)]">NFL Players</h1>
        <p className="text-sm text-[var(--color-text-muted)]">{season} auction pool · {players.length} players</p>
      </div>

      {/* Search */}
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search players, teams, positions…"
          className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/70 py-2.5 pl-10 pr-9 text-sm text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-lime)]/50"
          aria-label="Search players"
        />
        {query && (
          <button onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]" aria-label="Clear search">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Position filter */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {POSITION_FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setPos(f)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide transition-colors",
              pos === f ? "border-[var(--color-lime)] bg-[var(--color-lime)]/10 text-[var(--color-lime)]" : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
            )}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Sort */}
      <div className="mb-4 flex items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">Sort</span>
        {SORTS.map((s) => (
          <button
            key={s.key}
            onClick={() => setSort(s.key)}
            className={cn(
              "rounded-md px-2 py-1 text-xs font-semibold transition-colors",
              sort === s.key ? "bg-white/10 text-[var(--color-text-primary)]" : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--color-border)] py-16 text-center">
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">No players found</p>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">Try a different search or clear the filters.</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map(({ p, value, estimate }) => (
            <Link
              key={p.id}
              href={`/nfl/players/${p.id}`}
              className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/50 px-3 py-2.5 transition-colors hover:border-white/20 hover:bg-white/[0.04]"
            >
              <Avatar player={p} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-[var(--color-text-primary)]">{p.name}</p>
                <p className="text-[11px] text-[var(--color-text-muted)]">
                  <span className={cn("font-bold", POS_TONE[p.position])}>{p.position}</span> · {p.team}
                </p>
              </div>
              <div className="hidden text-right sm:block">
                <p className="text-[9px] uppercase tracking-widest text-[var(--color-text-muted)]">Value</p>
                <p className="text-sm font-bold tabular-nums text-[var(--color-text-primary)]">{value}</p>
              </div>
              <div className="text-right">
                <p className="text-[9px] uppercase tracking-widest text-[var(--color-text-muted)]">Est.</p>
                <p className="text-sm font-bold tabular-nums text-[var(--color-lime)]">${estimate}</p>
              </div>
              <div className="flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded-lg bg-black/30">
                <span className="text-[7px] uppercase tracking-widest text-[var(--color-text-muted)]">OVR</span>
                <span className="text-sm font-black tabular-nums text-[var(--color-lime)]">{p.overall}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
