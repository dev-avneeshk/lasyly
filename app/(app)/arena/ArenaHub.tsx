"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { Gamepad2, Shield, Brain, ChevronRight, Trophy } from "lucide-react"

/**
 * Arena hub — the single entry point for all play modes.
 *
 * NBA and NFL are shown as two separate, always-visible sections (no collapsable
 * nav). Each sport surfaces its Auction and its Quiz so the whole Arena is
 * visible on one page.
 */

type Mode = {
  key: string
  title: string
  blurb: string
  href: string
  icon: typeof Gamepad2
  tag: string
}

type Sport = {
  id: "nba" | "nfl"
  label: string
  accent: string // token for the sport's accent color
  icon: typeof Gamepad2
  modes: Mode[]
}

const SPORTS: Sport[] = [
  {
    id: "nba",
    label: "NBA",
    accent: "var(--color-lime)",
    icon: Gamepad2,
    modes: [
      {
        key: "nba-auction",
        title: "NBA Auction",
        blurb: "Win a live bidding war for 6 players, then simulate a 1v1 game.",
        href: "/arena/nba",
        icon: Gamepad2,
        tag: "1v1 Auction",
      },
      {
        key: "nba-quiz",
        title: "NBA Quiz",
        blurb: "Prove your basketball IQ across history, players, teams, and tactics.",
        href: "/quiz?sport=nba",
        icon: Brain,
        tag: "Trivia",
      },
    ],
  },
  {
    id: "nfl",
    label: "NFL",
    accent: "#4aa3ff",
    icon: Shield,
    modes: [
      {
        key: "nfl-auction",
        title: "NFL Auction",
        blurb: "Draft a 9-player roster in a live auction, then run a 1v1 sim.",
        href: "/nfl",
        icon: Shield,
        tag: "1v1 Auction",
      },
      {
        key: "nfl-quiz",
        title: "NFL Quiz",
        blurb: "Test your football knowledge — QBs, dynasties, and Super Bowls.",
        href: "/quiz?sport=nfl",
        icon: Brain,
        tag: "Trivia",
      },
    ],
  },
]

export default function ArenaHub() {
  return (
    <div className="relative mx-auto max-w-5xl px-4 py-10 pb-40 md:pb-12">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-64 w-[120%] -translate-x-1/2 rounded-full bg-[var(--color-lime)]/10 blur-[120px]"
      />

      {/* Hero */}
      <header className="relative text-center">
        <span className="text-xs font-bold uppercase tracking-[0.4em] text-[var(--color-lime)]">
          Lasyly Arena
        </span>
        <h1 className="mt-3 text-4xl font-black tracking-tight text-[var(--color-text-primary)] sm:text-5xl">
          Enter the <span className="text-[var(--color-lime)]">Arena</span>
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-[var(--color-text-muted)]">
          Draft rosters in live auctions and test your sports IQ. Pick your sport and mode below.
        </p>
      </header>

      {/* Sport sections */}
      <div className="mt-10 space-y-12">
        {SPORTS.map((sport) => (
          <section key={sport.id} aria-labelledby={`arena-${sport.id}`}>
            <div className="mb-4 flex items-center gap-3">
              <span
                className="grid h-10 w-10 place-items-center rounded-xl"
                style={{ backgroundColor: `color-mix(in srgb, ${sport.accent} 12%, transparent)`, color: sport.accent }}
              >
                <sport.icon className="h-5 w-5" />
              </span>
              <div>
                <h2
                  id={`arena-${sport.id}`}
                  className="text-xl font-black tracking-tight text-[var(--color-text-primary)]"
                >
                  {sport.label}
                </h2>
                <p className="text-xs text-[var(--color-text-muted)]">
                  Auction and Quiz for {sport.label}.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {sport.modes.map((mode) => (
                <ModeCard key={mode.key} mode={mode} accent={sport.accent} />
              ))}
            </div>
          </section>
        ))}
      </div>

      {/* Footnote */}
      <p className="mt-10 flex items-center justify-center gap-2 text-center text-[11px] text-[var(--color-text-muted)]">
        <Trophy className="h-3.5 w-3.5 text-[var(--color-lime)]" />
        Auctions play solo vs CPU or 1v1 against a friend.
      </p>
    </div>
  )
}

function ModeCard({ mode, accent }: { mode: Mode; accent: string }) {
  const Icon = mode.icon
  return (
    <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.15 }}>
      <Link
        href={mode.href}
        className="group flex h-full items-start justify-between gap-4 rounded-2xl border border-[var(--color-border)] bg-white/[0.02] p-5 transition-all hover:border-white/20 hover:bg-white/[0.04]"
      >
        <div className="flex min-w-0 items-start gap-3">
          <span
            className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl"
            style={{ backgroundColor: `color-mix(in srgb, ${accent} 12%, transparent)`, color: accent }}
          >
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-base font-black text-[var(--color-text-primary)]">
                {mode.title}
              </h3>
              <span className="shrink-0 rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                {mode.tag}
              </span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-[var(--color-text-muted)]">
              {mode.blurb}
            </p>
          </div>
        </div>
        <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-[var(--color-text-muted)] transition-transform group-hover:translate-x-1 group-hover:text-[var(--color-lime)]" />
      </Link>
    </motion.div>
  )
}
