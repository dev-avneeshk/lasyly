import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Check, ChevronLeft, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { allSimGameIds, favouriteSide, findSimGame, pct, pickWasRight, slateDateLabel } from "@/lib/simulations"
import type { SimGame } from "@/lib/simulations"
import { BoxScoreTable } from "@/components/simulations/BoxScoreTable"
import { LineScore } from "@/components/simulations/LineScore"
import { LocalTipoff } from "@/components/simulations/LocalTipoff"
import { PlayByPlay } from "@/components/simulations/PlayByPlay"
import { ProjectionsTable } from "@/components/simulations/ProjectionsTable"
import { SimTeamLogo } from "@/components/simulations/SimTeamLogo"
import { WinChanceBar } from "@/components/simulations/WinChanceBar"

// Every exported game is prerendered; any other id is a 404.
export const dynamicParams = false

export function generateStaticParams() {
  return allSimGameIds().map((gameId) => ({ gameId }))
}

type Params = { params: Promise<{ gameId: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { gameId } = await params
  const hit = findSimGame(gameId)
  if (!hit) return { title: "Simulation not found — Lasyly" }
  const { game } = hit
  return {
    title: `${game.away.abbr} @ ${game.home.abbr} simulation — Lasyly`,
    description: `${game.away.name} at ${game.home.name}: win chances, projected score and a full simulated box score from 5,000 simulated games.`,
    alternates: { canonical: `/analysis/simulations/${game.id}` },
  }
}

/** "POR by 7.7" for a home-minus-away margin. */
function marginText(game: SimGame, v: number, digits = 1): string {
  if (Math.abs(v) < 0.05) return "Even"
  return v > 0 ? `${game.home.abbr} by ${v.toFixed(digits)}` : `${game.away.abbr} by ${(-v).toFixed(digits)}`
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/60 px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">{label}</p>
      <p className="mt-1 text-[18px] font-extrabold tabular-nums text-[var(--color-text-primary)]">{value}</p>
      {sub && <p className="text-[11px] text-[var(--color-text-muted)]">{sub}</p>}
    </div>
  )
}

function TeamHead({ game, side }: { game: SimGame; side: "home" | "away" }) {
  const team = game[side]
  return (
    <div className={cn("flex min-w-0 flex-col items-center gap-2 text-center", side === "home" ? "md:items-end md:text-right" : "md:items-start md:text-left")}>
      <SimTeamLogo team={team} size={64} />
      <div className="min-w-0 leading-tight">
        <p className="truncate text-[16px] font-extrabold text-[var(--color-text-primary)] md:text-[20px]">{team.name}</p>
        <p className="text-[12px] text-[var(--color-text-muted)]">
          {side === "home" ? "Home" : "Away"} · {team.record}
        </p>
      </div>
    </div>
  )
}

export default async function SimulationGamePage({ params }: Params) {
  const { gameId } = await params
  const hit = findSimGame(gameId)
  if (!hit) notFound()
  const { slate, game } = hit
  const p = game.prediction
  const right = pickWasRight(game)
  const fav = game[favouriteSide(game)]
  const f = game.featured

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-8 px-4 py-6 md:px-8">
      <Link
        href="/analysis/simulations"
        className="inline-flex w-fit items-center gap-1 text-[12px] font-semibold text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-primary)]"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        All simulations
      </Link>

      {/* Matchup + prediction */}
      <section className="flex flex-col gap-5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/60 p-5 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2 text-[12px] text-[var(--color-text-muted)]">
          <span>
            {slateDateLabel(game.date, true)} (US date) · tip-off <LocalTipoff iso={game.tipoff} withDate />
          </span>
          <span className="rounded-full border border-[var(--color-warning)]/30 bg-[var(--color-warning)]/10 px-3 py-0.5 text-[11px] font-semibold text-[var(--color-warning)]">
            Experimental · not betting advice
          </span>
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 md:gap-6">
          <TeamHead game={game} side="away" />
          <div className="flex flex-col items-center gap-1 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">Projected</p>
            <p className="text-[30px] font-black tabular-nums tracking-tight text-[var(--color-text-primary)] md:text-[40px]">
              {p.away.toFixed(0)}
              <span className="mx-2 text-[var(--color-text-muted)]">–</span>
              {p.home.toFixed(0)}
            </p>
            {game.final ? (
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[12px] font-bold",
                  right ? "bg-[var(--color-success)]/15 text-[var(--color-success)]" : "bg-[var(--color-danger)]/15 text-[var(--color-danger)]"
                )}
              >
                {right ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                Real final {game.final.away}–{game.final.home}
              </span>
            ) : (
              <span className="text-[11px] text-[var(--color-text-muted)]">average of {slate.sims.toLocaleString("en-US")} simulations</span>
            )}
          </div>
          <TeamHead game={game} side="home" />
        </div>

        <WinChanceBar game={game} size="lg" />

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Tile label="Pick" value={fav.abbr} sub={`${pct(fav === game.home ? p.pHome : 1 - p.pHome)} of simulations`} />
          <Tile
            label="Projected margin"
            value={marginText(game, p.margin)}
            sub={`80%: ${marginText(game, p.marginLo, 0)} to ${marginText(game, p.marginHi, 0)}`}
          />
          <Tile label="Projected total" value={p.total.toFixed(1)} sub={`80%: ${p.totalLo.toFixed(0)}–${p.totalHi.toFixed(0)}`} />
          <Tile label="Overtime" value={pct(p.overtime)} sub="of simulations" />
          <Tile label="Win by 20+" value={pct(p.blowout)} sub="either team" />
          <Tile label="Pace" value={p.possessions.toFixed(1)} sub={`possessions · ${p.fouls.toFixed(1)} fouls per team`} />
        </div>

        <p className="text-[11px] text-[var(--color-text-muted)]">
          Model {game.model ?? slate.models.featured}
          {game.minutesBeforeTip !== null ? `, run ${game.minutesBeforeTip.toLocaleString("en-US")} minutes before tip-off` : ""}. The
          previous version ({slate.models.baseline}) gave {game.home.abbr} {pct(game.baseline.pHome)} and a{" "}
          {game.baseline.away.toFixed(0)}–{game.baseline.home.toFixed(0)} average score. No injury news is used.
        </p>
      </section>

      {/* Simulated box score */}
      <section className="flex flex-col gap-4" aria-labelledby="box">
        <div className="leading-tight">
          <h2 id="box" className="text-[20px] font-extrabold text-[var(--color-text-primary)]">
            Simulated box score
          </h2>
          <p className="text-[12px] text-[var(--color-text-muted)]">
            Simulation #{f.simNumber.toLocaleString("en-US")} of {slate.sims.toLocaleString("en-US")}: the one game (no
            overtime) closest to the typical result on fifteen measures. It is one possible game, not the forecast.
          </p>
        </div>
        <LineScore game={game} />
        {f.notes && <p className="text-[11px] text-[var(--color-text-muted)]">{f.notes}</p>}
        <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
          <BoxScoreTable team={game.away} box={f.box.away} final={f.final.away} />
          <BoxScoreTable team={game.home} box={f.box.home} final={f.final.home} />
        </div>
      </section>

      {/* Player projections */}
      <section className="flex flex-col gap-4" aria-labelledby="proj">
        <div className="leading-tight">
          <h2 id="proj" className="text-[20px] font-extrabold text-[var(--color-text-primary)]">
            Player projections
          </h2>
          <p className="text-[12px] text-[var(--color-text-muted)]">
            Averages over every simulation in which the player plays, and how often he plays.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <ProjectionsTable team={game.away} rows={game.projections.away} />
          <ProjectionsTable team={game.home} rows={game.projections.home} />
        </div>
      </section>

      {/* Play-by-play */}
      <section className="flex flex-col gap-4" aria-labelledby="pbp">
        <div className="leading-tight">
          <h2 id="pbp" className="text-[20px] font-extrabold text-[var(--color-text-primary)]">
            Play-by-play
          </h2>
          <p className="text-[12px] text-[var(--color-text-muted)]">Every logged event of the simulated game above.</p>
        </div>
        <PlayByPlay plays={f.plays} home={game.home} away={game.away} />
      </section>
    </div>
  )
}
