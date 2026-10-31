import { pct } from "@/lib/simulations/format"
import type { SimProjection, SimTeam } from "@/lib/simulations/types"
import { SimTeamLogo } from "./SimTeamLogo"

/** Per-player averages over every simulated run in which he played, plus his chance to play. */
export function ProjectionsTable({ team, rows }: { team: SimTeam; rows: SimProjection[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/60">
      <div className="flex items-center gap-3 border-b border-[var(--color-border)] px-4 py-3">
        <SimTeamLogo team={team} size={24} />
        <h3 className="text-[14px] font-extrabold text-[var(--color-text-primary)]">{team.name}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-[12px] tabular-nums">
          <thead>
            <tr className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
              <th className="px-4 py-2.5">Player</th>
              <th className="px-2 py-2.5 text-right" title="Share of simulations in which he plays">
                Plays
              </th>
              <th className="px-2 py-2.5 text-right">MIN</th>
              <th className="px-2 py-2.5 text-right">PTS</th>
              <th className="px-2 py-2.5 text-right">REB</th>
              <th className="px-2 py-2.5 text-right">AST</th>
              <th className="px-3 py-2.5 text-right">3PM</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name} className="border-t border-[var(--color-border)]">
                <td className="px-4 py-2">
                  <span className="block whitespace-nowrap font-semibold text-[var(--color-text-primary)]">{r.name}</span>
                  <span className="block text-[10px] capitalize text-[var(--color-text-muted)]">{r.role}</span>
                </td>
                <td className="px-2 py-2 text-right text-[var(--color-text-muted)]">{pct(r.pPlay)}</td>
                <td className="px-2 py-2 text-right text-[var(--color-text-primary)]/85">{r.min.toFixed(1)}</td>
                <td className="px-2 py-2 text-right font-bold text-[var(--color-text-primary)]">{r.pts.toFixed(1)}</td>
                <td className="px-2 py-2 text-right text-[var(--color-text-primary)]/85">{r.reb.toFixed(1)}</td>
                <td className="px-2 py-2 text-right text-[var(--color-text-primary)]/85">{r.ast.toFixed(1)}</td>
                <td className="px-3 py-2 text-right text-[var(--color-text-primary)]/85">{r.tp.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
