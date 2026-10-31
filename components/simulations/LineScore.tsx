import type { SimGame } from "@/lib/simulations/types"
import { SimTeamLogo } from "./SimTeamLogo"

/** Points per period of the featured simulated game. */
export function LineScore({ game }: { game: SimGame }) {
  const f = game.featured
  const rows = [
    { team: game.away, periods: f.lineScore.away, final: f.final.away },
    { team: game.home, periods: f.lineScore.home, final: f.final.home },
  ]
  const winner = f.final.home > f.final.away ? game.home.abbr : game.away.abbr
  return (
    <div className="overflow-x-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/60">
      <table className="w-full min-w-[420px] text-[13px] tabular-nums">
        <thead>
          <tr className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
            <th className="px-4 py-2.5 text-left">Team</th>
            {f.lineScore.labels.map((l) => (
              <th key={l} className="px-3 py-2.5 text-right">
                {l}
              </th>
            ))}
            <th className="px-4 py-2.5 text-right">Final</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.team.abbr} className="border-t border-[var(--color-border)]">
              <td className="px-4 py-2.5">
                <span className="flex items-center gap-2 font-bold text-[var(--color-text-primary)]">
                  <SimTeamLogo team={r.team} size={22} />
                  {r.team.abbr}
                </span>
              </td>
              {r.periods.map((p, i) => (
                <td key={i} className="px-3 py-2.5 text-right text-[var(--color-text-primary)]/85">
                  {p}
                </td>
              ))}
              <td
                className={
                  r.team.abbr === winner
                    ? "px-4 py-2.5 text-right text-[16px] font-extrabold text-[var(--color-lime)]"
                    : "px-4 py-2.5 text-right text-[16px] font-extrabold text-[var(--color-text-primary)]"
                }
              >
                {r.final}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
