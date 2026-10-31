import Link from "next/link"
import { Check, ChevronRight, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { favouriteSide, pickWasRight } from "@/lib/simulations/format"
import type { SimGame } from "@/lib/simulations/types"
import { LocalTipoff } from "./LocalTipoff"
import { SimTeamLogo } from "./SimTeamLogo"
import { WinChanceBar } from "./WinChanceBar"

function TeamLine({ game, side }: { game: SimGame; side: "home" | "away" }) {
  const team = game[side]
  const projected = side === "home" ? game.prediction.home : game.prediction.away
  const real = game.final ? game.final[side] : null
  const fav = favouriteSide(game) === side
  return (
    <div className="flex items-center gap-3">
      <SimTeamLogo team={team} size={34} />
      <div className="min-w-0 flex-1 leading-tight">
        <p className={cn("truncate text-[14px] font-bold", fav ? "text-[var(--color-text-primary)]" : "text-[var(--color-text-primary)]/80")}>
          {team.name}
        </p>
        <p className="text-[11px] text-[var(--color-text-muted)]">
          {side === "home" ? "Home" : "Away"} · {team.record}
        </p>
      </div>
      <div className="text-right leading-tight">
        <p className="text-[18px] font-extrabold tabular-nums text-[var(--color-text-primary)]">{projected.toFixed(0)}</p>
        {real !== null && <p className="text-[11px] tabular-nums text-[var(--color-text-muted)]">real {real}</p>}
      </div>
    </div>
  )
}

/** One game on the simulations board: teams, projected score, win chance, real result once known. */
export function SimGameCard({ game }: { game: SimGame }) {
  const right = pickWasRight(game)
  const fav = game[favouriteSide(game)]
  return (
    <Link
      href={`/analysis/simulations/${game.id}`}
      className="group flex flex-col gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/60 p-4 transition-colors hover:border-[var(--color-lime)]/40 hover:bg-[var(--color-surface)]"
    >
      <div className="flex items-center justify-between text-[11px] font-semibold text-[var(--color-text-muted)]">
        <LocalTipoff iso={game.tipoff} />
        {game.final ? (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-bold",
              right ? "bg-[var(--color-success)]/15 text-[var(--color-success)]" : "bg-[var(--color-danger)]/15 text-[var(--color-danger)]"
            )}
          >
            {right ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
            Final · pick {right ? "right" : "wrong"}
          </span>
        ) : (
          <span className="rounded-full bg-white/5 px-2 py-0.5">Simulated pre-game</span>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <p className="-mb-1 text-right text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">
          Projected
        </p>
        <TeamLine game={game} side="away" />
        <TeamLine game={game} side="home" />
      </div>

      <WinChanceBar game={game} />

      <div className="flex items-center justify-between border-t border-[var(--color-border)] pt-3 text-[12px]">
        <span className="text-[var(--color-text-muted)]">
          Pick <span className="font-bold text-[var(--color-text-primary)]">{fav.abbr}</span> · total{" "}
          <span className="font-bold text-[var(--color-text-primary)]">{game.prediction.total.toFixed(0)}</span>
        </span>
        <span className="inline-flex items-center gap-1 font-bold text-[var(--color-lime)]">
          Box score
          <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  )
}
