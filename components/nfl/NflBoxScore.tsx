"use client"

import type { NflGameResult, PlayerStatLine, TeamId } from "@/lib/nfl/types"
import { OFFENSE_SLOTS } from "@/lib/nfl/types"
import { cn } from "@/lib/utils"

/** A compact stat line string tuned to the player's role. */
function lineText(l: PlayerStatLine): string {
  const parts: string[] = []
  if (l.attempts > 0) parts.push(`${l.completions}/${l.attempts}, ${l.passYds} yd, ${l.passTd} TD${l.int ? `, ${l.int} INT` : ""}`)
  if (l.carries > 0) parts.push(`${l.carries} car, ${l.rushYds} yd${l.rushTd ? `, ${l.rushTd} TD` : ""}`)
  if (l.receptions > 0) parts.push(`${l.receptions} rec, ${l.recYds} yd${l.recTd ? `, ${l.recTd} TD` : ""}`)
  if (l.sacks > 0) parts.push(`${l.sacks} sack${l.sacks > 1 ? "s" : ""}`)
  if (l.interceptions > 0) parts.push(`${l.interceptions} INT`)
  if (l.tackles > 0) parts.push(`${l.tackles} tkl`)
  if (l.forcedIncompletions > 0 && parts.length === 0) parts.push(`${l.forcedIncompletions} PD`)
  return parts.join(" · ") || "—"
}

export function NflBoxScore({ result, team, label }: { result: NflGameResult; team: TeamId; label: string }) {
  const lines = result.box.filter((l) => l.team === team)
  const box = result.teamBox[team]
  const offense = lines.filter((l) => OFFENSE_SLOTS.includes(l.slot))
  const defense = lines.filter((l) => !OFFENSE_SLOTS.includes(l.slot))
  const thirdPct = box.thirdDownAtt > 0 ? Math.round((box.thirdDownConv / box.thirdDownAtt) * 100) : 0

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/60">
      <div className="flex items-center justify-between bg-white/[0.03] px-4 py-2">
        <span className="text-sm font-black uppercase tracking-wide text-[var(--color-lime)]">{label}</span>
        <span className="text-lg font-black tabular-nums text-[var(--color-text-primary)]">{box.points}</span>
      </div>

      <StatGroup title="Offense" tone="lime" lines={offense} />
      <StatGroup title="Defense" tone="primary" lines={defense} />

      <div className="grid grid-cols-3 gap-2 border-t border-[var(--color-border)] px-4 py-3 text-center text-[11px] sm:grid-cols-6">
        <Stat label="Total Yds" value={`${box.totalYards}`} />
        <Stat label="Pass" value={`${box.passYards}`} />
        <Stat label="Rush" value={`${box.rushYards}`} />
        <Stat label="1st Downs" value={`${box.firstDowns}`} />
        <Stat label="3rd Down" value={`${thirdPct}%`} />
        <Stat label="TO" value={`${box.turnovers}`} />
      </div>
    </div>
  )
}

function StatGroup({ title, tone, lines }: { title: string; tone: "lime" | "primary"; lines: PlayerStatLine[] }) {
  if (lines.length === 0) return null
  return (
    <div>
      <p className={cn(
        "px-4 pt-2 text-[9px] font-bold uppercase tracking-widest",
        tone === "lime" ? "text-[var(--color-lime)]/70" : "text-[var(--color-primary)]/70"
      )}>
        {title}
      </p>
      <table className="w-full text-xs">
        <tbody>
          {lines.map((l) => (
            <tr key={l.playerId} className="border-t border-[var(--color-border)]/60 first:border-0">
              <td className="w-14 px-3 py-1.5 text-left align-top">
                <span className="text-[9px] font-bold uppercase text-[var(--color-text-muted)]">{l.slot.replace(/\d/, "")}</span>
              </td>
              <td className="px-1 py-1.5 text-left">
                <span className="font-semibold text-[var(--color-text-primary)]">{l.name}</span>
                <span className="ml-2 text-[var(--color-text-muted)]">{lineText(l)}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-widest text-[var(--color-text-muted)]">{label}</div>
      <div className="font-bold text-[var(--color-text-primary)]">{value}</div>
    </div>
  )
}
