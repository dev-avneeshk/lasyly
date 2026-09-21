"use client"

import Image from "next/image"
import Link from "next/link"
import { motion } from "framer-motion"
import { Users, Zap, BarChart3, Trophy, ArrowRight } from "lucide-react"

/**
 * Arena hub — the single entry point for all play modes.
 *
 * A full-bleed hero introduces the Arena, then two large sport cards (NBA and
 * NFL) each link into that sport's auction flow. Quizzes stay reachable from
 * each card's secondary link so the whole Arena is one page.
 */

type Sport = {
  id: "nba" | "nfl"
  label: string
  blurb: string
  href: string
  quizHref: string
  logoSlug: string
  tags: string[]
  /** Accent color token/value for the card's tint and CTA. */
  accent: string
  primary: boolean
}

const SPORTS: Sport[] = [
  {
    id: "nba",
    label: "NBA Arena",
    blurb: "Auction and Quiz for NBA.",
    href: "/arena/nba",
    quizHref: "/quiz?sport=nba",
    logoSlug: "nba",
    tags: ["Live Auctions", "1v1 Mode", "Player IQ", "Build & Compete"],
    accent: "var(--color-lime)",
    primary: true,
  },
  {
    id: "nfl",
    label: "NFL Arena",
    blurb: "Auction and Quiz for NFL.",
    href: "/nfl",
    quizHref: "/quiz?sport=nfl",
    logoSlug: "nfl",
    tags: ["Live Auctions", "1v1 Mode", "Player IQ", "Build & Compete"],
    accent: "#4aa3ff",
    primary: false,
  },
]

const FEATURES = [
  { icon: Users, title: "Real People", desc: "Compete with the community" },
  { icon: Zap, title: "Live & Dynamic", desc: "Real-time auctions and quizzes" },
  { icon: BarChart3, title: "Play Your Way", desc: "Skill, strategy, and knowledge" },
]

const espnLeagueLogo = (slug: string) => `https://a.espncdn.com/i/teamlogos/leagues/500/${slug}.png`

export default function ArenaHub() {
  return (
    <div className="pb-40 md:pb-12">
      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-[var(--color-border)]">
        {/* Athlete imagery background */}
        <Image
          src="/arena.webp"
          alt=""
          aria-hidden
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
        {/* Legibility overlays: darken top→bottom and center so the headline and
            feature chips stay readable over the imagery. */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(80% 120% at 50% 40%, rgba(10,11,9,0.55) 0%, rgba(10,11,9,0.78) 55%, #0a0b09 92%)",
          }}
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-[var(--color-background)]"
        />
        {/* Lime tint from the top to keep the brand glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(70% 80% at 50% -10%, rgba(212,255,0,0.10) 0%, transparent 55%)",
          }}
        />

        {/* Decorative graffiti text */}
        <span
          aria-hidden
          className="pointer-events-none absolute left-4 top-1/2 hidden -translate-y-1/2 -rotate-6 select-none text-2xl font-black uppercase leading-[0.9] tracking-tight text-[var(--color-lime)]/40 lg:block"
        >
          Built<br />By<br />Fans
        </span>
        <span
          aria-hidden
          className="pointer-events-none absolute right-4 top-1/2 hidden -translate-y-1/2 rotate-6 select-none text-right text-2xl font-black uppercase leading-[0.9] tracking-tight text-[var(--color-lime)]/40 lg:block"
        >
          Know<br />More<br />Play<br />Bigger
        </span>

        <div className="relative z-10 mx-auto max-w-3xl px-4 py-14 text-center md:py-20">
          <span className="text-xs font-bold uppercase tracking-[0.4em] text-[var(--color-lime)]">
            Lasyly Arena
          </span>
          <h1 className="mt-3 text-4xl font-black tracking-tight text-[var(--color-text-primary)] sm:text-5xl md:text-6xl">
            Enter the <span className="text-[var(--color-lime)]">Arena</span>
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm text-[var(--color-text-muted)] md:text-base">
            Draft rosters in live auctions and test your sports IQ. Pick your sport and mode below.
          </p>

          {/* Feature chips */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="flex items-center gap-2.5 text-left">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--color-lime)]/10 text-[var(--color-lime)]">
                  <f.icon className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-xs font-bold text-[var(--color-text-primary)]">{f.title}</p>
                  <p className="text-[11px] text-[var(--color-text-muted)]">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Choose your arena ──────────────────────────────────────────────── */}
      <div className="mx-auto max-w-5xl px-4">
        <p className="py-6 text-center text-[11px] font-bold uppercase tracking-[0.4em] text-[var(--color-text-muted)]">
          Choose Your Arena
        </p>

        <div className="grid gap-4 md:grid-cols-2">
          {SPORTS.map((sport) => (
            <ArenaCard key={sport.id} sport={sport} />
          ))}
        </div>

        {/* Footnote */}
        <div className="mt-6 flex items-center justify-center gap-3 rounded-2xl border border-[var(--color-border)] bg-white/[0.02] px-5 py-4 text-center">
          <Trophy className="h-4 w-4 shrink-0 text-[var(--color-lime)]" />
          <div>
            <p className="text-xs font-semibold text-[var(--color-text-primary)]">
              Auctions play solo vs CPU or 1v1 against a friend.
            </p>
            <p className="text-[11px] text-[var(--color-text-muted)]">
              Pick a sport. Build your squad. Prove your knowledge.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function ArenaCard({ sport }: { sport: Sport }) {
  const isNba = sport.id === "nba"
  return (
    <motion.div whileHover={{ y: -3 }} transition={{ duration: 0.15 }}>
      <div
        className="group relative flex h-full flex-col overflow-hidden rounded-3xl border p-6 md:p-7"
        style={{
          borderColor: `color-mix(in srgb, ${sport.accent} 22%, transparent)`,
        }}
      >
        {/* Sport background imagery */}
        <Image
          src={isNba ? "/bb_arena.webp" : "/nfl_arena.webp"}
          alt=""
          aria-hidden
          fill
          sizes="(max-width: 768px) 100vw, 640px"
          className="object-cover object-center transition-transform duration-500 group-hover:scale-105"
        />
        {/* Tint + legibility gradient over the imagery */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background: isNba
              ? "linear-gradient(135deg, rgba(212,255,0,0.10) 0%, rgba(12,16,10,0.72) 42%, rgba(10,12,9,0.94) 100%)"
              : "linear-gradient(135deg, rgba(74,163,255,0.16) 0%, rgba(9,16,26,0.74) 42%, rgba(8,12,18,0.95) 100%)",
          }}
        />
        {/* Decorative crest glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-8 top-1/2 h-48 w-48 -translate-y-1/2 rounded-full blur-3xl"
          style={{ background: `color-mix(in srgb, ${sport.accent} 18%, transparent)` }}
        />

        <div className="relative z-10 flex-1">
          {/* League crest */}
          <div className="mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-black/40 ring-1 ring-white/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={espnLeagueLogo(sport.logoSlug)}
              alt={`${sport.id.toUpperCase()} logo`}
              className="h-9 w-9 object-contain"
              loading="lazy"
            />
          </div>

          <h2 className="text-2xl font-black tracking-tight text-[var(--color-text-primary)]">
            {sport.label}
          </h2>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">{sport.blurb}</p>

          {/* Feature tags */}
          <div className="mt-4 flex flex-wrap gap-2">
            {sport.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-white/[0.06] px-3 py-1 text-[11px] font-semibold text-white/70"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* CTA row */}
        <div className="relative z-10 mt-6 flex items-center gap-3">
          <Link
            href={sport.href}
            id={`arena-enter-${sport.id}`}
            className={
              isNba
                ? "inline-flex items-center gap-2 rounded-full bg-[var(--color-lime)] px-6 py-3 text-sm font-bold text-black transition-transform duration-200 hover:scale-[0.98] active:scale-[0.96]"
                : "inline-flex items-center gap-2 rounded-full border border-white/25 px-6 py-3 text-sm font-bold text-white transition-colors duration-200 hover:border-[#4aa3ff]/60 hover:text-white"
            }
          >
            Enter {sport.id.toUpperCase()} Arena
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href={sport.quizHref}
            className="text-xs font-semibold text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-primary)]"
          >
            or take the quiz
          </Link>
        </div>
      </div>
    </motion.div>
  )
}
