import type { Metadata } from "next"
import Link from "next/link"
import { ChevronLeft, Dices } from "lucide-react"
import { listSlates, slateDateLabel, slateRecord } from "@/lib/simulations"
import { SimGameCard } from "@/components/simulations/SimGameCard"

export const metadata: Metadata = {
  title: "NBA Game Simulations — Lasyly",
  description:
    "Every NBA game played 5,000 times, possession by possession, by the Lasyly simulation engine: win chances, projected scores and a full simulated box score.",
  alternates: { canonical: "/analysis/simulations" },
}

// The slates are static JSON shipped with the build.
export const dynamic = "force-static"

export default function SimulationsPage() {
  const slates = listSlates()
  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-8 px-4 py-6 md:px-8">
      <div className="flex flex-col gap-4">
        <Link
          href="/analysis?sport=NBA"
          className="inline-flex w-fit items-center gap-1 text-[12px] font-semibold text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-primary)]"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Props
        </Link>
        <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--color-lime)]/15 text-[var(--color-lime)]">
              <Dices className="h-6 w-6" />
            </span>
            <div className="leading-tight">
              <h1 className="text-[24px] font-extrabold tracking-[-0.02em] text-[var(--color-text-primary)] md:text-[26px]">
                NBA Game Simulations
              </h1>
              <p className="text-[12px] text-[var(--color-text-muted)]">
                Each game played 5,000 times, possession by possession. Win chances and scores are averages; open a
                game for one full simulated box score.
              </p>
            </div>
          </div>
          <p className="w-fit shrink-0 whitespace-nowrap rounded-full border border-[var(--color-warning)]/30 bg-[var(--color-warning)]/10 px-3 py-1 text-[11px] font-semibold text-[var(--color-warning)]">
            Experimental model · not betting advice
          </p>
        </header>
      </div>

      {slates.map((slate) => {
        const rec = slateRecord(slate)
        return (
          <section key={slate.date} className="flex flex-col gap-4" aria-labelledby={`slate-${slate.date}`}>
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[var(--color-border)] pb-2">
              <h2 id={`slate-${slate.date}`} className="text-[18px] font-extrabold text-[var(--color-text-primary)]">
                {slateDateLabel(slate.date, true)}
                <span className="ml-2 text-[12px] font-semibold text-[var(--color-text-muted)]">
                  {slate.games.length} games · US date
                </span>
              </h2>
              <p className="text-[12px] text-[var(--color-text-muted)]">
                {rec.decided > 0 ? (
                  <>
                    Picks right:{" "}
                    <span className="font-bold text-[var(--color-text-primary)]">
                      {rec.right} of {rec.decided}
                    </span>{" "}
                    ·{" "}
                  </>
                ) : null}
                model {slate.models.featured} · {slate.sims.toLocaleString("en-US")} sims per game
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {slate.games.map((g) => (
                <SimGameCard key={g.id} game={g} />
              ))}
            </div>
          </section>
        )
      })}

      <p className="max-w-[900px] text-[11px] leading-relaxed text-[var(--color-text-muted)]">
        How it works: the Lasyly engine replays each game possession by possession (shots by zone, rebounds,
        turnovers, fouls and free throws, substitutions, the clock and overtime) from the players&apos; recent box
        scores, each team&apos;s defense and this season&apos;s league level. Predictions are made before tip-off from games
        played before that day. It is experimental, has no injury news and is not validated against betting markets.
      </p>
    </div>
  )
}
