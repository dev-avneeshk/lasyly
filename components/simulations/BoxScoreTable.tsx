import { cn } from "@/lib/utils"
import type { SimBoxRow, SimBoxTeam, SimTeam } from "@/lib/simulations/types"
import { SimTeamLogo } from "./SimTeamLogo"

const COLS: { key: keyof SimBoxRow; label: string; title: string }[] = [
  { key: "min", label: "MIN", title: "Minutes" },
  { key: "pts", label: "PTS", title: "Points" },
  { key: "reb", label: "REB", title: "Rebounds" },
  { key: "ast", label: "AST", title: "Assists" },
  { key: "fg", label: "FG", title: "Field goals made-attempted" },
  { key: "tp", label: "3P", title: "Three-pointers made-attempted" },
  { key: "ft", label: "FT", title: "Free throws made-attempted" },
  { key: "oreb", label: "OREB", title: "Offensive rebounds" },
  { key: "dreb", label: "DREB", title: "Defensive rebounds" },
  { key: "stl", label: "STL", title: "Steals" },
  { key: "blk", label: "BLK", title: "Blocks" },
  { key: "tov", label: "TOV", title: "Turnovers" },
  { key: "pf", label: "PF", title: "Personal fouls" },
]

/** One team's simulated box score (players by minutes, team totals, shooting line, DNPs). */
export function BoxScoreTable({ team, box, final }: { team: SimTeam; box: SimBoxTeam; final: number }) {
  const top = Math.max(...box.players.map((p) => p.pts))
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/60">
      <div className="flex items-center gap-3 border-b border-[var(--color-border)] px-4 py-3">
        <SimTeamLogo team={team} size={28} />
        <h3 className="flex-1 text-[15px] font-extrabold text-[var(--color-text-primary)]">{team.name}</h3>
        <span className="text-[20px] font-extrabold tabular-nums text-[var(--color-text-primary)]">{final}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-left text-[12px]">
          <thead>
            <tr className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
              <th className="sticky left-0 z-10 bg-[var(--color-surface)] px-4 py-2.5">Player</th>
              {COLS.map((c) => (
                <th key={c.key} title={c.title} className="px-2 py-2.5 text-right">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {box.players.map((p) => (
              <tr key={p.name} className="border-t border-[var(--color-border)] tabular-nums">
                <td className="sticky left-0 z-10 bg-[var(--color-surface)] px-4 py-2 font-semibold text-[var(--color-text-primary)]">
                  <span className="whitespace-nowrap">{p.name}</span>
                </td>
                {COLS.map((c) => (
                  <td
                    key={c.key}
                    className={cn(
                      "px-2 py-2 text-right text-[var(--color-text-primary)]/85",
                      c.key === "pts" && "font-bold text-[var(--color-text-primary)]",
                      c.key === "pts" && p.pts === top && "text-[var(--color-lime)]"
                    )}
                  >
                    {p[c.key]}
                  </td>
                ))}
              </tr>
            ))}
            <tr className="border-t border-[var(--color-border)] bg-white/[0.03] font-bold tabular-nums text-[var(--color-text-primary)]">
              <td className="sticky left-0 z-10 bg-[var(--color-surface)] px-4 py-2.5">Team</td>
              {COLS.map((c) => (
                <td key={c.key} className="whitespace-nowrap px-2 py-2.5 text-right">
                  {box.totals[c.key]}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <div className="flex flex-col gap-1 border-t border-[var(--color-border)] px-4 py-3 text-[11px] text-[var(--color-text-muted)]">
        {box.shooting && <p>{box.shooting}</p>}
        {box.dnp.length > 0 && <p>Did not play in this simulation: {box.dnp.join(", ")}.</p>}
      </div>
    </div>
  )
}
