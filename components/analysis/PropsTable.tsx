"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { Check, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { STAT_LABELS } from "@/lib/props/constants"
import { formatGameTime } from "@/lib/props/dates"
import { formatMultiplier } from "@/lib/props/prop-value"
import {
  headshotOf,
  hitRateToneClass,
  positionOf,
  projectionOf,
  sideOf,
  sideRecord,
} from "@/lib/props/display"
import type { EnhancedPropCardData } from "@/lib/analytics/types"
import { PlayerPhoto } from "@/components/props/PlayerPhoto"
import { TeamLogo } from "@/components/props/TeamLogo"
import { propDetailHref } from "./playerHref"

export interface GameInfo {
  home: string
  away: string
  time: string | null
}

interface PropsTableProps {
  props: EnhancedPropCardData[]
  loading: boolean
  /** Team abbreviation -> tonight's game. */
  gameByTeam: Record<string, GameInfo>
  selectedIds: Set<string>
  onToggleSelect: (propId: string) => void
  onToggleSelectAll: (select: boolean) => void
  /** Props already in My Predictor. */
  addedIds: Set<string>
  onAdd: (prop: EnhancedPropCardData, direction: "over" | "under") => void
  addDisabled?: boolean
  emptyMessage: string
}

const L10_GAMES = 10

/** Bars for a run of games; filled lime when the game went the side. */
function MiniBars({
  values,
  line,
  side,
  label,
}: {
  values: number[]
  line: number
  side: "over" | "under"
  label: string
}) {
  if (values.length === 0) {
    return <span className="text-[11px] text-[var(--color-text-muted)]">—</span>
  }
  const max = Math.max(line * 1.4, ...values, 1)
  const hit = (v: number) => (side === "over" ? v > line : v < line)
  const hits = values.filter(hit).length
  return (
    <div
      className="flex items-end gap-[3px] h-7 w-[92px]"
      role="img"
      aria-label={`${label}: ${hits} of ${values.length} went ${side} ${line}`}
      title={values.join(", ")}
    >
      {values.map((v, i) => (
        <span
          key={i}
          className={cn("flex-1 min-w-[4px] rounded-[2px]", hit(v) ? "bg-[var(--color-lime)]" : "bg-white/15")}
          style={{ height: `${Math.max(10, Math.min(100, (v / max) * 100))}%` }}
        />
      ))}
    </div>
  )
}

function SkeletonRow() {
  return (
    <tr className="border-t border-[var(--color-border)]">
      {Array.from({ length: 10 }).map((_, i) => (
        <td key={i} className="px-3 py-3">
          <span className="block h-4 rounded bg-white/5 animate-pulse" />
        </td>
      ))}
    </tr>
  )
}

/**
 * The props slate as a dense table: player, matchup, side and line, model
 * projection, L10 hit rate, L10 and head-to-head form, payout multiplier.
 */
export function PropsTable({
  props,
  loading,
  gameByTeam,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  addedIds,
  onAdd,
  addDisabled,
  emptyMessage,
}: PropsTableProps) {
  const router = useRouter()
  const allSelected = props.length > 0 && props.every((p) => selectedIds.has(p.id))

  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/60 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1080px] text-left">
          <thead>
            <tr className="text-[11px] font-semibold text-[var(--color-text-muted)]">
              <th className="w-10 px-3 py-3">
                <input
                  type="checkbox"
                  aria-label="Select all props"
                  checked={allSelected}
                  onChange={(e) => onToggleSelectAll(e.target.checked)}
                  className="h-4 w-4 rounded border-[var(--color-border)] bg-transparent accent-[var(--color-lime)] cursor-pointer"
                />
              </th>
              <th className="px-3 py-3">Player</th>
              <th className="px-3 py-3">Matchup</th>
              <th className="px-3 py-3">Prop</th>
              <th className="px-3 py-3 text-center">Projection</th>
              <th className="px-3 py-3">Hit Rate</th>
              <th className="px-3 py-3">L10</th>
              <th className="px-3 py-3">H2H</th>
              <th className="px-3 py-3 text-center">Multiplier</th>
              <th className="px-3 py-3 text-center">Add</th>
            </tr>
          </thead>
          <tbody>
            {loading && props.length === 0 ? (
              Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
            ) : props.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-3 py-12 text-center text-sm text-[var(--color-text-muted)]">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              props.map((prop) => {
                const side = sideOf(prop)
                const record = sideRecord(prop)
                const tone = hitRateToneClass(record.pct)
                const projection = projectionOf(prop)
                const position = positionOf(prop)
                const game = gameByTeam[(prop.team ?? "").toUpperCase()]
                const multiplier = prop.propValue?.multiplier ?? null
                const strongMultiplier = multiplier !== null && multiplier >= 2
                const l10 = [...(prop.lastGames ?? [])]
                  .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""))
                  .slice(-L10_GAMES)
                  .map((g) => g.value)
                const h2h = (prop.h2h ?? []).map((g) => g.value)
                const statLabel = STAT_LABELS[prop.statCategory] ?? prop.statCategory.toUpperCase()
                const href = propDetailHref(prop)
                const selected = selectedIds.has(prop.id)
                const added = addedIds.has(prop.id)

                return (
                  <tr
                    key={prop.id}
                    onClick={(e) => {
                      const t = e.target as HTMLElement
                      if (t.closest("button, a, input, label")) return
                      router.push(href)
                    }}
                    className={cn(
                      "border-t border-[var(--color-border)] cursor-pointer transition-colors hover:bg-white/[0.025]",
                      selected && "bg-[var(--color-lime)]/[0.04]"
                    )}
                  >
                    <td className="px-3 py-2.5">
                      <input
                        type="checkbox"
                        aria-label={`Select ${prop.player} ${statLabel}`}
                        checked={selected}
                        onChange={() => onToggleSelect(prop.id)}
                        className="h-4 w-4 rounded border-[var(--color-border)] bg-transparent accent-[var(--color-lime)] cursor-pointer"
                      />
                    </td>

                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2.5 min-w-[170px]">
                        <PlayerPhoto
                          playerName={prop.player}
                          team={prop.team}
                          sport={prop.sport}
                          headshotUrl={headshotOf(prop)}
                          size={34}
                        />
                        <div className="min-w-0 leading-tight">
                          <Link
                            href={href}
                            className="block truncate text-[13px] font-bold text-[var(--color-text-primary)] hover:text-[var(--color-lime)] transition-colors"
                          >
                            {prop.player}
                          </Link>
                          <p className="text-[11px] text-[var(--color-text-muted)]">
                            {[position, prop.team].filter(Boolean).join(" • ")}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-3 py-2.5">
                      {game ? (
                        <div className="flex items-center gap-2 whitespace-nowrap">
                          <span className="flex items-center gap-1">
                            <TeamLogo team={game.away} size={20} />
                            <span className="text-[10px] text-[var(--color-text-muted)]">@</span>
                            <TeamLogo team={game.home} size={20} />
                          </span>
                          <span className="leading-tight">
                            <span className="block text-[11px] font-semibold text-[var(--color-text-primary)]">
                              {game.away} @ {game.home}
                            </span>
                            {game.time && (
                              <span className="block text-[10px] text-[var(--color-text-muted)]" suppressHydrationWarning>
                                {formatGameTime(game.time)}
                              </span>
                            )}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[11px] text-[var(--color-text-muted)]">vs {prop.matchup}</span>
                      )}
                    </td>

                    <td className="px-3 py-2.5 leading-tight">
                      <span className="block text-[11px] text-[var(--color-text-muted)]">{statLabel}</span>
                      <span
                        className={cn(
                          "block text-[13px] font-bold tabular-nums",
                          side === "over" ? "text-[var(--color-lime)]" : "text-[var(--color-danger)]"
                        )}
                      >
                        {side === "over" ? "Over" : "Under"} {prop.propLine}
                      </span>
                    </td>

                    <td className="px-3 py-2.5 text-center text-[13px] font-semibold tabular-nums text-[var(--color-text-primary)]">
                      {projection != null ? projection.toFixed(1) : "—"}
                    </td>

                    <td className="px-3 py-2.5">
                      <div className="w-[104px]">
                        <p className="text-[12px] font-bold tabular-nums">
                          <span className={tone.text}>{record.pct}%</span>{" "}
                          <span className="font-medium text-[var(--color-text-muted)]">
                            ({record.hits}/{record.games})
                          </span>
                        </p>
                        <div className="mt-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                          <div className={cn("h-full rounded-full", tone.bar)} style={{ width: `${record.pct}%` }} />
                        </div>
                      </div>
                    </td>

                    <td className="px-3 py-2.5">
                      <MiniBars values={l10} line={prop.propLine} side={side} label="Last 10 games" />
                    </td>

                    <td className="px-3 py-2.5">
                      <MiniBars values={h2h} line={prop.propLine} side={side} label={`vs ${prop.matchup}`} />
                    </td>

                    <td className="px-3 py-2.5 text-center">
                      <span
                        className={cn(
                          "inline-flex min-w-[52px] justify-center rounded-md border px-2 py-1 text-[12px] font-bold tabular-nums",
                          multiplier === null
                            ? "border-[var(--color-border)] text-[var(--color-text-muted)]"
                            : strongMultiplier
                              ? "border-[var(--color-lime)]/60 bg-[var(--color-lime)]/[0.08] text-[var(--color-lime)]"
                              : "border-white/20 bg-white/[0.04] text-[var(--color-text-primary)]"
                        )}
                        title={multiplier === null ? "No priced line for this prop" : "Payout per unit if it hits"}
                      >
                        {formatMultiplier(multiplier)}
                      </span>
                    </td>

                    <td className="px-3 py-2.5 text-center">
                      <button
                        type="button"
                        disabled={addDisabled && !added}
                        onClick={() => onAdd(prop, side)}
                        aria-pressed={added}
                        aria-label={`${added ? "Added" : "Add"} ${prop.player} ${side} ${prop.propLine} ${statLabel} ${added ? "to" : "to"} My Predictor`}
                        title={added ? "In My Predictor" : "Add to My Predictor"}
                        className={cn(
                          "inline-flex h-7 w-7 items-center justify-center rounded-full border transition-colors",
                          added
                            ? "border-[var(--color-lime)] bg-[var(--color-lime)] text-black"
                            : "border-[var(--color-lime)]/70 text-[var(--color-lime)] hover:bg-[var(--color-lime)]/15",
                          addDisabled && !added && "opacity-40 cursor-not-allowed"
                        )}
                      >
                        {added ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
