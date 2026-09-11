"use client"

import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import { cachedFetch } from "@/lib/clientCache"

// ─── Types ──────────────────────────────────────────────────────────────────

interface DefenseCell {
  key: string
  label: string
  perGame: number
  leagueAvg: number
  rank: number
  rankOf: number
  percentile: number
  offenseFriendly: boolean
}

interface DefenseResult {
  team: string
  position: string
  gamesFaced: number
  groups: Record<string, DefenseCell[]>
  summary: {
    weakest: { label: string; rank: number; rankOf: number; perGame: number } | null
    strongest: { label: string; rank: number; rankOf: number; perGame: number } | null
    scoring: { label: string; rank: number; rankOf: number; perGame: number } | null
  }
}

interface H2HGame {
  date: string
  player: string
  team: string
  position: string
  homeAway: string
  result: string
  value: number
  overLine: boolean | null
  isFocus: boolean
}

interface H2HResult {
  games: H2HGame[]
  overCount: number
  total: number
}

interface SplitsResult {
  player: string
  position: string
  games: number
  season: number | string
  splits: {
    passing: Record<string, number>
    rushing: Record<string, number>
    receiving: Record<string, number>
    fumbles: Record<string, number>
  }
}

interface Props {
  player: string
  team: string
  opponent: string
  /** The player's position (QB/RB/WR/TE). */
  position: string
  /** UI stat key (YDS/TD/REC/CAR/INT) for over/under coloring in H2H. */
  stat: string
  /** Reference prop line for H2H over/under. */
  line: number
}

const POSITIONS = ["QB", "RB", "WR", "TE"] as const
const SEASONS = ["all", "2025", "2024"] as const

// ─── Rank bar ─────────────────────────────────────────────────────────────────

/**
 * A softer/tougher bar. percentile: 1 = softest (allows most, good for offense),
 * 0 = toughest. Green = soft (favorable), red = tough.
 */
function RankBar({ cell }: { cell: DefenseCell }) {
  // For offense-friendly stats, high percentile is favorable (green). For
  // defense-friendly (INT), invert the color meaning.
  const favorable = cell.offenseFriendly ? cell.percentile : 1 - cell.percentile
  const color =
    favorable >= 0.6 ? "var(--color-lime)" : favorable >= 0.35 ? "#f5a623" : "#e5484d"
  const rankColor =
    favorable >= 0.6 ? "text-[var(--color-lime)]" : favorable >= 0.35 ? "text-amber-400" : "text-red-400"
  const pct = Math.round(cell.percentile * 100)

  return (
    <div className="grid grid-cols-[110px_44px_1fr_88px] items-center gap-3 py-2 border-b border-white/[0.04] last:border-0">
      <span className="text-[11px] text-[var(--color-text-muted)] uppercase tracking-wide truncate">{cell.label}</span>
      <span className="text-sm font-bold text-white tabular-nums text-right">{cell.perGame}</span>
      <div className="relative h-2 rounded-full bg-white/[0.06] overflow-hidden">
        {/* midpoint marker */}
        <div className="absolute inset-y-0 left-1/2 w-px bg-white/10" />
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-300"
          style={{ width: `${pct}%`, background: color, boxShadow: `0 0 8px ${color}55` }}
        />
      </div>
      <div className="text-right leading-tight">
        <div className={cn("text-[11px] font-bold tabular-nums", rankColor)}>#{cell.rank}<span className="text-[var(--color-text-muted)] font-normal">/{cell.rankOf}</span></div>
        <div className="text-[9px] text-[var(--color-text-muted)] tabular-nums">avg {cell.leagueAvg}</div>
      </div>
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function NFLMatchupPanels({ player, team, opponent, position, stat, line }: Props) {
  const [tab, setTab] = useState<"opponent" | "h2h" | "splits">("opponent")

  // Opponent / Defense Allowed
  const [defPos, setDefPos] = useState<string>(POSITIONS.includes(position as any) ? position : "RB")
  const [defSeason, setDefSeason] = useState<string>("2025")
  const [defense, setDefense] = useState<DefenseResult | null>(null)
  const [defLoading, setDefLoading] = useState(false)

  useEffect(() => {
    if (!opponent) return
    setDefLoading(true)
    cachedFetch<DefenseResult>(
      `/api/props/nfl-defense?team=${encodeURIComponent(opponent)}&position=${defPos}&season=${defSeason}`,
      300_000
    )
      .then((d) => setDefense(d))
      .catch(() => setDefense(null))
      .finally(() => setDefLoading(false))
  }, [opponent, defPos, defSeason])

  // H2H
  const [h2h, setH2h] = useState<H2HResult | null>(null)
  useEffect(() => {
    if (!opponent) return
    cachedFetch<H2HResult>(
      `/api/props/nfl-h2h?view=h2h&opponent=${encodeURIComponent(opponent)}&position=${defPos}&stat=${stat}&line=${line}&player=${encodeURIComponent(player)}`,
      300_000
    )
      .then((d) => setH2h(d))
      .catch(() => setH2h(null))
  }, [opponent, defPos, stat, line, player])

  // Splits
  const [splitsSeason, setSplitsSeason] = useState<string>("2025")
  const [perGame, setPerGame] = useState(true)
  const [splitsTab, setSplitsTab] = useState<"passing" | "rushing" | "receiving" | "fumbles">(
    position === "QB" ? "passing" : position === "WR" || position === "TE" ? "receiving" : "rushing"
  )
  const [splits, setSplits] = useState<SplitsResult | null>(null)
  useEffect(() => {
    if (!player) return
    cachedFetch<SplitsResult>(
      `/api/props/nfl-h2h?view=splits&player=${encodeURIComponent(player)}&season=${splitsSeason}&perGame=${perGame}`,
      300_000
    )
      .then((d) => setSplits(d))
      .catch(() => setSplits(null))
  }, [player, splitsSeason, perGame])

  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl overflow-hidden">
      {/* Tabs */}
      <div className="flex items-center gap-1 px-2 pt-2 border-b border-[var(--color-border)]">
        {([
          ["opponent", "Opponent"],
          ["h2h", `${defPos} vs ${opponent}`],
          ["splits", "Splits"],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "px-3.5 py-2 text-xs font-semibold tracking-wide rounded-t-lg transition-colors relative",
              tab === key
                ? "text-[var(--color-lime)] bg-[var(--color-lime)]/[0.06] after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:bg-[var(--color-lime)] after:rounded-full"
                : "text-[var(--color-text-muted)] hover:text-white hover:bg-white/[0.03]"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ─── Opponent / Defense Allowed ─── */}
      {tab === "opponent" && (
        <div className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <div>
              <h3 className="font-bold text-[15px] tracking-tight flex items-center gap-2">
                <span className="text-[var(--color-lime)]">{opponent}</span> Defense Allowed
              </h3>
              <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                {defense ? `vs ${defPos} · ${defense.gamesFaced} games · per-game averages` : "—"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {/* Position tabs */}
              <div className="flex bg-[var(--color-surface-elevated)] rounded-lg border border-[var(--color-border)] p-0.5">
                {POSITIONS.map((p) => (
                  <button
                    key={p}
                    onClick={() => setDefPos(p)}
                    className={cn(
                      "px-3 py-1 text-[11px] rounded-md font-semibold transition-colors",
                      defPos === p ? "bg-[var(--color-lime)] text-black" : "text-[var(--color-text-muted)] hover:text-white"
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <select
                value={defSeason}
                onChange={(e) => setDefSeason(e.target.value)}
                className="bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded px-2 py-1 text-[11px] text-white"
              >
                {SEASONS.map((s) => (
                  <option key={s} value={s}>{s === "all" ? "All seasons" : s}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Summary cards */}
          {defense?.summary && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-5">
              <SummaryCard title="Weakest Spot" tone="good" data={defense.summary.weakest} note="concedes most" />
              <SummaryCard title="Strongest Spot" tone="bad" data={defense.summary.strongest} note="locks down" />
              <SummaryCard title="Scoring" tone="mid" data={defense.summary.scoring} note="TD matchup" />
            </div>
          )}

          {defLoading && !defense ? (
            <DefenseSkeleton />
          ) : defense ? (
            <div className="flex flex-col gap-5">
              {/* Column header aligned to the bar grid */}
              <div className="grid grid-cols-[110px_44px_1fr_88px] items-center gap-3 text-[9px] uppercase tracking-widest text-[var(--color-text-muted)]/70">
                <span></span>
                <span className="text-right">/G</span>
                <span className="flex items-center justify-between px-0.5"><span>◄ Tougher</span><span>Softer ►</span></span>
                <span className="text-right">Rank</span>
              </div>
              {Object.entries(defense.groups).map(([group, cells]) => (
                <div key={group}>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-white/70 mb-1.5">{group}</div>
                  <div className="rounded-lg bg-white/[0.02] px-3">
                    {cells.map((c) => <RankBar key={c.key} cell={c} />)}
                  </div>
                </div>
              ))}
              <p className="text-[10px] text-[var(--color-text-muted)] leading-relaxed">
                #1 = softest matchup (this defense concedes the most here). Bars read from the offense&apos;s side —
                further right and greener means more favorable. INT is read from the defense&apos;s side.
              </p>
            </div>
          ) : (
            <div className="py-10 text-center text-sm text-[var(--color-text-muted)]">No defensive data available.</div>
          )}
        </div>
      )}

      {/* ─── H2H game history ─── */}
      {tab === "h2h" && (
        <div className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-[15px] tracking-tight flex items-center gap-2">
              {defPos} <span className="text-[var(--color-text-muted)] font-normal">vs</span> <span className="text-[var(--color-lime)]">{opponent}</span>
            </h3>
            {h2h && h2h.total > 0 && (
              <div className="flex items-center gap-1.5 text-[11px]">
                <span className="px-2 py-1 rounded-md bg-[var(--color-lime)]/15 text-[var(--color-lime)] font-bold tabular-nums">
                  {Math.round((h2h.overCount / h2h.total) * 100)}% O
                </span>
                <span className="px-2 py-1 rounded-md bg-red-500/15 text-red-400 font-bold tabular-nums">
                  {Math.round(((h2h.total - h2h.overCount) / h2h.total) * 100)}% U
                </span>
                <span className="text-[var(--color-text-muted)] ml-0.5">@ {line}</span>
              </div>
            )}
          </div>
          {h2h && h2h.games.length > 0 ? (
            <div className="overflow-auto max-h-[440px] rounded-lg border border-[var(--color-border)]">
              <table className="w-full text-xs">
                <thead className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] sticky top-0 bg-[var(--color-surface-elevated)] z-10">
                  <tr className="text-left">
                    <th className="py-2 px-3 font-semibold">Date</th>
                    <th className="py-2 px-2 font-semibold">Res</th>
                    <th className="py-2 px-2 font-semibold">H/A</th>
                    <th className="py-2 px-2 font-semibold">Player</th>
                    <th className="py-2 px-3 text-right font-semibold">{stat}</th>
                  </tr>
                </thead>
                <tbody>
                  {h2h.games.map((g, i) => (
                    <tr
                      key={i}
                      className={cn(
                        "border-t border-white/[0.04] transition-colors hover:bg-white/[0.02]",
                        g.isFocus && "bg-[var(--color-lime)]/[0.07]"
                      )}
                    >
                      <td className="py-2 px-3 text-[var(--color-text-muted)] whitespace-nowrap tabular-nums">{g.date}</td>
                      <td className="py-2 px-2">
                        <span className={cn(
                          "inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-bold",
                          g.result === "W" ? "bg-[var(--color-lime)]/15 text-[var(--color-lime)]" : g.result === "L" ? "bg-red-500/15 text-red-400" : "text-[var(--color-text-muted)]"
                        )}>{g.result || "—"}</span>
                      </td>
                      <td className="py-2 px-2 text-[var(--color-text-muted)]">{g.homeAway}</td>
                      <td className={cn("py-2 px-2 truncate max-w-[170px]", g.isFocus ? "text-[var(--color-lime)] font-semibold" : "text-white")}>
                        {g.player} <span className="text-[9px] text-[var(--color-text-muted)] ml-0.5">{g.position}</span>
                      </td>
                      <td className="py-2 px-3 text-right">
                        <span className={cn(
                          "inline-block min-w-[28px] font-bold tabular-nums",
                          g.overLine === true ? "text-[var(--color-lime)]" : g.overLine === false ? "text-red-400" : "text-white"
                        )}>{g.value}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-10 text-center text-sm text-[var(--color-text-muted)]">No head-to-head history vs {opponent}.</div>
          )}
          {h2h && h2h.games.length > 0 && (
            <p className="text-[10px] text-[var(--color-text-muted)] mt-2.5 flex items-center gap-3">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[var(--color-lime)]" /> over {line}</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400" /> under {line}</span>
              <span>· {player}&apos;s rows highlighted</span>
            </p>
          )}
        </div>
      )}

      {/* ─── Splits ─── */}
      {tab === "splits" && (
        <div className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h3 className="font-bold text-[15px] tracking-tight">
              {splits?.player ?? player} <span className="text-[var(--color-text-muted)] font-normal">· Splits</span>
            </h3>
            <div className="flex items-center gap-2">
              <select
                value={splitsSeason}
                onChange={(e) => setSplitsSeason(e.target.value)}
                className="bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-lg px-2.5 py-1.5 text-[11px] text-white cursor-pointer"
              >
                {SEASONS.map((s) => <option key={s} value={s}>{s === "all" ? "All" : s}</option>)}
              </select>
              <div className="flex bg-[var(--color-surface-elevated)] rounded-lg border border-[var(--color-border)] p-0.5">
                {[["true", "Per Game"], ["false", "Total"]].map(([v, l]) => (
                  <button
                    key={v}
                    onClick={() => setPerGame(v === "true")}
                    className={cn("px-2.5 py-1 text-[11px] rounded-md font-semibold transition-colors", (perGame ? "true" : "false") === v ? "bg-[var(--color-lime)] text-black" : "text-[var(--color-text-muted)] hover:text-white")}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {/* Split category tabs */}
          <div className="flex gap-2 mb-4">
            {(["passing", "rushing", "receiving", "fumbles"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setSplitsTab(t)}
                className={cn(
                  "px-3.5 py-1.5 text-[11px] rounded-lg capitalize font-semibold transition-colors",
                  splitsTab === t ? "bg-[var(--color-lime)] text-black" : "bg-[var(--color-surface-elevated)] text-[var(--color-text-muted)] hover:text-white"
                )}
              >
                {t}
              </button>
            ))}
          </div>
          {splits ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {Object.entries(splits.splits[splitsTab]).map(([label, value]) => (
                  <div key={label} className="bg-white/[0.02] border border-[var(--color-border)] rounded-lg px-3 py-2.5">
                    <div className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide truncate">{label}</div>
                    <div className="text-lg font-bold text-white tabular-nums mt-0.5">{value}</div>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-[var(--color-text-muted)] pt-3">
                {splits.games} games · {perGame ? "per game" : "total"} · {splits.season === "all" ? "all seasons" : splits.season}
              </p>
            </>
          ) : (
            <div className="py-10 text-center text-sm text-[var(--color-text-muted)]">No split data available.</div>
          )}
        </div>
      )}
    </div>
  )
}

function SummaryCard({
  title, tone, data, note,
}: {
  title: string
  tone: "good" | "bad" | "mid"
  data: { label: string; rank: number; rankOf: number; perGame: number } | null
  note: string
}) {
  const toneClass =
    tone === "good" ? "text-[var(--color-lime)]" : tone === "bad" ? "text-red-400" : "text-amber-400"
  const dot =
    tone === "good" ? "bg-[var(--color-lime)]" : tone === "bad" ? "bg-red-400" : "bg-amber-400"
  const edge =
    tone === "good" ? "before:bg-[var(--color-lime)]" : tone === "bad" ? "before:bg-red-400" : "before:bg-amber-400"
  return (
    <div className={cn(
      "relative overflow-hidden bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-lg p-3 pl-3.5",
      "before:absolute before:inset-y-0 before:left-0 before:w-1", edge
    )}>
      <div className={cn("flex items-center gap-1.5 text-[9px] uppercase tracking-wider font-bold mb-1.5", toneClass)}>
        <span className={cn("w-1.5 h-1.5 rounded-full", dot)} />
        {title}
      </div>
      {data ? (
        <>
          <div className="flex items-baseline gap-1.5">
            <span className="text-sm font-bold text-white">{data.label}</span>
            <span className={cn("text-sm font-bold tabular-nums", toneClass)}>{data.perGame}</span>
          </div>
          <div className="text-[10px] text-[var(--color-text-muted)] mt-0.5">Rank {data.rank}/{data.rankOf} · {note}</div>
        </>
      ) : (
        <div className="text-xs text-[var(--color-text-muted)]">—</div>
      )}
    </div>
  )
}

function DefenseSkeleton() {
  return (
    <div className="flex flex-col gap-2 animate-pulse">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="grid grid-cols-[110px_44px_1fr_88px] items-center gap-3 py-2">
          <div className="h-3 rounded bg-white/[0.06]" />
          <div className="h-3 rounded bg-white/[0.06]" />
          <div className="h-2 rounded-full bg-white/[0.06]" />
          <div className="h-3 rounded bg-white/[0.06]" />
        </div>
      ))}
    </div>
  )
}
