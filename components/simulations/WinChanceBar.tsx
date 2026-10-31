import { cn } from "@/lib/utils"
import { pct } from "@/lib/simulations/format"
import type { SimGame } from "@/lib/simulations/types"

/** Away share on the left, home share on the right; the favourite's side is lime. */
export function WinChanceBar({ game, size = "md" }: { game: SimGame; size?: "md" | "lg" }) {
  const pHome = game.prediction.pHome
  const pAway = 1 - pHome
  const homeFav = pHome >= 0.5
  return (
    <div className="flex flex-col gap-1.5">
      <div
        className={cn("flex items-center justify-between font-bold", size === "lg" ? "text-[15px]" : "text-[12px]")}
      >
        <span className={homeFav ? "text-[var(--color-text-muted)]" : "text-[var(--color-lime)]"}>
          {game.away.abbr} {pct(pAway)}
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">
          Win chance
        </span>
        <span className={homeFav ? "text-[var(--color-lime)]" : "text-[var(--color-text-muted)]"}>
          {pct(pHome)} {game.home.abbr}
        </span>
      </div>
      <div
        className={cn("flex w-full overflow-hidden rounded-full bg-white/5", size === "lg" ? "h-3" : "h-2")}
        role="img"
        aria-label={`${game.away.abbr} ${pct(pAway)}, ${game.home.abbr} ${pct(pHome)}`}
      >
        <span
          className={cn("h-full", homeFav ? "bg-white/20" : "bg-[var(--color-lime)]")}
          style={{ width: `${pAway * 100}%` }}
        />
        <span
          className={cn("h-full", homeFav ? "bg-[var(--color-lime)]" : "bg-white/20")}
          style={{ width: `${pHome * 100}%` }}
        />
      </div>
    </div>
  )
}
