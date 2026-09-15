"use client"

import Link from "next/link"
import { ArrowLeft, ChevronRight } from "lucide-react"
import type { NflPlayer, Position } from "@/lib/nfl/types"
import { NflPlayerCard } from "@/components/nfl/NflPlayerCard"
import { playerValue, offenseScore, defenseScore } from "@/lib/nfl/value"
import { estimatedPrice } from "@/lib/nfl/grades"
import { cn } from "@/lib/utils"

const OFFENSE: Position[] = ["QB", "RB", "WR", "TE"]

// Full attribute groups per position for the detail breakdown — richer than the
// card's key stats, and role-relevant so we never show a QB's coverage rating.
function attributeGroups(player: NflPlayer): { title: string; rows: { label: string; value: number }[] }[] {
  const a = player.attributes
  switch (player.position) {
    case "QB":
      return [
        { title: "Passing", rows: [
          { label: "Short Accuracy", value: a.shortAccuracy },
          { label: "Deep Accuracy", value: a.deepAccuracy },
          { label: "Arm Strength", value: a.armStrength },
          { label: "Pocket Awareness", value: a.pocketAwareness },
          { label: "Decision Making", value: a.decisionMaking },
        ]},
        { title: "Athleticism", rows: [
          { label: "Mobility", value: a.mobility },
          { label: "Speed", value: a.speed },
          { label: "Clutch", value: a.clutch },
          { label: "Consistency", value: a.consistency },
        ]},
      ]
    case "RB":
      return [
        { title: "Rushing", rows: [
          { label: "Speed", value: a.speed },
          { label: "Vision", value: a.vision },
          { label: "Power", value: a.power },
          { label: "Agility", value: a.agility },
        ]},
        { title: "Receiving", rows: [
          { label: "Catching", value: a.catching },
          { label: "YAC", value: a.yac },
          { label: "Route Running", value: a.routeRunning },
        ]},
      ]
    case "WR":
    case "TE":
      return [
        { title: "Receiving", rows: [
          { label: "Separation", value: a.separation },
          { label: "Catching", value: a.catching },
          { label: "Route Running", value: a.routeRunning },
          { label: "Contested Catch", value: a.contestedCatch },
          { label: "YAC", value: a.yac },
        ]},
        { title: player.position === "TE" ? "Blocking" : "Athleticism", rows: player.position === "TE"
          ? [{ label: "Run Block", value: a.runBlock }, { label: "Pass Block", value: a.passBlock }, { label: "Speed", value: a.speed }]
          : [{ label: "Speed", value: a.speed }, { label: "Agility", value: a.agility }, { label: "Awareness", value: a.awareness }]
        },
      ]
    case "EDGE":
    case "LB":
      return [
        { title: "Pass Rush & Run", rows: [
          { label: "Pass Rush", value: a.passRush },
          { label: "Run Stop", value: a.runStop },
          { label: "Tackling", value: a.tackling },
          { label: "Power", value: a.power },
          { label: "Strength", value: a.strength },
        ]},
        { title: "Range", rows: [
          { label: "Coverage", value: a.coverage },
          { label: "Speed", value: a.speed },
          { label: "Awareness", value: a.awareness },
        ]},
      ]
    case "CB":
    case "S":
      return [
        { title: "Coverage", rows: [
          { label: "Coverage", value: a.coverage },
          { label: "Ball Hawk", value: a.ballHawk },
          { label: "Speed", value: a.speed },
          { label: "Agility", value: a.agility },
        ]},
        { title: "Run Support", rows: [
          { label: "Tackling", value: a.tackling },
          { label: "Run Stop", value: a.runStop },
          { label: "Awareness", value: a.awareness },
        ]},
      ]
    default:
      return []
  }
}

function AttrBar({ label, value }: { label: string; value: number }) {
  const color = value >= 88 ? "var(--color-lime)" : value >= 75 ? "var(--color-secondary)" : value >= 60 ? "var(--color-primary)" : "var(--color-text-muted)"
  return (
    <div className="flex items-center gap-3">
      <span className="w-32 shrink-0 text-xs text-[var(--color-text-muted)]">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
        <div className="h-full rounded-full" style={{ width: `${value}%`, background: color }} />
      </div>
      <span className="w-7 text-right text-xs font-semibold tabular-nums text-[var(--color-text-primary)]">{value}</span>
    </div>
  )
}

export default function PlayerDetailClient({ player, season }: { player: NflPlayer; season: string }) {
  const side = OFFENSE.includes(player.position) ? "offense" : "defense"
  const impact = side === "offense" ? offenseScore(player) : defenseScore(player)
  const value = playerValue(player)
  const groups = attributeGroups(player)

  const estimates = [
    { budget: 25, label: "Rookie ($25)" },
    { budget: 50, label: "Pro ($50)" },
    { budget: 100, label: "All-Pro ($100)" },
  ].map((b) => ({ ...b, price: estimatedPrice(player, b.budget, 9) }))

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 pb-28 md:pb-8">
      {/* Breadcrumb */}
      <nav className="mb-5 flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
        <Link href="/nfl/players" className="flex items-center gap-1 hover:text-[var(--color-text-primary)]">
          <ArrowLeft className="h-3.5 w-3.5" /> Players
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-[var(--color-text-primary)]">{player.name}</span>
      </nav>

      <div className="grid gap-6 md:grid-cols-[1fr_1fr]">
        {/* Card */}
        <div className="flex justify-center">
          <NflPlayerCard player={player} />
        </div>

        {/* Value + estimates */}
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Overall" value={`${player.overall}`} tone="lime" />
            <Stat label="Value" value={`${value}`} />
            <Stat label={side === "offense" ? "Off. Impact" : "Def. Impact"} value={`${Math.round(impact)}`} />
          </div>

          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/60 p-4">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">Estimated Auction Price</p>
            <div className="space-y-2">
              {estimates.map((e) => (
                <div key={e.budget} className="flex items-center justify-between text-sm">
                  <span className="text-[var(--color-text-muted)]">{e.label}</span>
                  <span className="font-bold tabular-nums text-[var(--color-lime)]">${e.price}</span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[10px] leading-tight text-[var(--color-text-muted)]">
              Prices scale to league budget. Designer estimates for game balance — not official stats.
            </p>
          </div>

          <Link
            href="/nfl"
            className="rounded-xl bg-[var(--color-lime)] py-3 text-center text-sm font-black uppercase tracking-wide text-black transition-opacity hover:opacity-90"
          >
            Draft players in an auction
          </Link>
        </div>
      </div>

      {/* Attribute breakdown */}
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {groups.map((g) => (
          <div key={g.title} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/60 p-5">
            <h3 className={cn("mb-3 text-sm font-black uppercase tracking-wide", side === "offense" ? "text-[var(--color-lime)]" : "text-[var(--color-primary)]")}>
              {g.title}
            </h3>
            <div className="space-y-2">
              {g.rows.map((r) => (
                <AttrBar key={r.label} label={r.label} value={r.value} />
              ))}
            </div>
          </div>
        ))}
      </div>

      <p className="mt-6 text-center text-[10px] text-[var(--color-text-muted)]">{season} season pool</p>
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "lime" }) {
  return (
    <div className="rounded-xl bg-black/20 py-2.5 text-center">
      <div className="text-[9px] uppercase tracking-widest text-[var(--color-text-muted)]">{label}</div>
      <div className={cn("text-xl font-black tabular-nums", tone === "lime" ? "text-[var(--color-lime)]" : "text-[var(--color-text-primary)]")}>{value}</div>
    </div>
  )
}
