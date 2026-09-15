"use client"

import { useState } from "react"
import Image from "next/image"
import { motion } from "framer-motion"
import type { SeasonPlayer } from "@/lib/arena/types"
import { headshotUrl } from "@/lib/arena/data"

function initials(name: string): string {
  return name.split(" ").map((word) => word[0]).slice(0, 2).join("").toUpperCase()
}

function Headshot({ player }: { player: SeasonPlayer }) {
  const url = headshotUrl(player)
  const [failed, setFailed] = useState(false)

  return (
    <div className="relative h-[8.75rem] w-[8.75rem] shrink-0 overflow-hidden rounded-[1.15rem] border border-white/10 bg-[radial-gradient(circle_at_50%_10%,rgba(123,110,255,0.52),transparent_58%),linear-gradient(145deg,#202955,#0c1025)] sm:h-40 sm:w-40">
      {url && !failed ? (
        // next/image optimizes + edge-caches NBA CDN headshots (AVIF/WebP,
        // 24h minimumCacheTTL). `priority` because this is the focal card of
        // the active lot — it should never lazy-load.
        <Image
          src={url}
          alt={player.name}
          fill
          sizes="160px"
          priority
          onError={() => setFailed(true)}
          className="object-cover object-top [filter:contrast(1.06)_saturate(.92)]"
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-3xl font-black tracking-tight text-white/60">
          {initials(player.name)}
        </span>
      )}
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-[#0b1028] to-transparent" />
    </div>
  )
}

const TIER_LABEL: Record<number, string> = { 1: "SUPERSTAR", 2: "ALL-STAR", 3: "STARTER", 4: "ROLE PLAYER" }

function StatBar({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="grid grid-cols-[3.6rem_1fr_1.55rem] items-center gap-2">
      <span className="text-[9px] font-medium uppercase tracking-[0.08em] text-[#9da6be]">{label}</span>
      <span className="h-1.5 overflow-hidden rounded-full bg-white/[0.09]">
        <motion.span
          className="block h-full rounded-full"
          style={{ backgroundColor: tone, transformOrigin: "left" }}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: value / 100 }}
          transition={{ duration: 0.48, ease: [0.16, 1, 0.3, 1] }}
        />
      </span>
      <span className="text-right text-[10px] font-bold tabular-nums text-[#e1e5f1]">{value}</span>
    </div>
  )
}

export function PlayerCard({ player }: { player: SeasonPlayer }) {
  const attributes = player.attributes
  const positions = [player.primaryPosition, ...player.secondaryPositions].join(" / ")
  const strengths = player.strengths.slice(0, 3)
  const keyStats = [
    { label: "Scoring", value: attributes.scoring, tone: "#caff12" },
    { label: "3PT", value: attributes.threePointShooting, tone: "#24dbc4" },
    { label: "Playmaking", value: attributes.playmaking, tone: "#5f91ff" },
    { label: "Rebounding", value: attributes.rebounding, tone: "#8b5cf6" },
    { label: "Per. defense", value: attributes.perimeterDefense, tone: "#2ad8b5" },
    { label: "Rim defense", value: attributes.rimProtection, tone: "#b8bfce" },
  ]

  return (
    <motion.article
      key={player.id}
      initial={{ opacity: 0, scale: 0.97, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97, y: -12 }}
      transition={{ type: "spring", stiffness: 260, damping: 25 }}
      className="relative w-full overflow-hidden rounded-[1.45rem] border border-[#5f48d9]/80 bg-[linear-gradient(145deg,#19265f_0%,#0b1030_48%,#0d1122_100%)] p-4 shadow-[0_24px_64px_rgba(47,44,174,0.3)] sm:p-5"
    >
      <div aria-hidden className="absolute inset-x-0 top-0 h-28 bg-[radial-gradient(ellipse_at_15%_-20%,rgba(117,144,255,0.42),transparent_70%)]" />
      <div className="relative flex items-start gap-3 sm:gap-4">
        <Headshot player={player} />
        <div className="min-w-0 flex-1 pt-1">
          <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.18em] text-[#d4ff00]">
            <span className="grid h-3 w-3 place-items-center rounded-full border border-[#d4ff00]/70 text-[7px]">+</span>
            {TIER_LABEL[player.tier]}
          </span>
          <h2 className="mt-2 text-[1.4rem] font-black leading-[1.05] tracking-[-0.04em] text-[#f5f7ff] sm:text-[1.7rem]">{player.name}</h2>
          <p className="mt-1 text-[11px] font-medium text-[#adb8d2]">{positions} · {player.team}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {strengths.map((strength) => (
              <span key={strength} className="rounded-full border border-[#7069dd]/70 bg-[#241e68]/60 px-2 py-0.5 text-[8px] font-medium text-[#d5d6ff]">{strength}</span>
            ))}
          </div>
        </div>
        <div className="grid h-[4.4rem] w-[4.4rem] shrink-0 place-items-center rounded-xl border border-white/[0.06] bg-[#090d1f]/65 text-center">
          <div>
            <span className="block text-[8px] font-semibold uppercase tracking-[0.16em] text-[#9da6be]">OVR</span>
            <span className="mt-0.5 block text-3xl font-black leading-none tabular-nums text-[#d4ff00]">{player.overall}</span>
          </div>
        </div>
      </div>

      <div className="relative mt-5 grid gap-3 sm:grid-cols-[1fr_0.9fr]">
        <section className="rounded-xl border border-white/[0.06] bg-[#090d1f]/45 p-3">
          <h3 className="mb-3 text-[9px] font-bold uppercase tracking-[0.16em] text-[#d7ddeb]">Attributes</h3>
          <div className="space-y-2.5">
            {keyStats.map((stat) => <StatBar key={stat.label} {...stat} />)}
          </div>
        </section>
        <div className="grid gap-3">
          <section className="rounded-xl border border-[#15bfa8]/20 bg-[#0c202a]/50 p-3">
            <h3 className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#24dfc5]">Strengths</h3>
            <ul className="mt-2 space-y-1 text-[9px] leading-3.5 text-[#c4cedc]">
              {strengths.map((strength) => <li key={strength} className="flex gap-1.5"><span className="font-bold text-[#d4ff00]">+</span>{strength}</li>)}
            </ul>
          </section>
          <section className="rounded-xl border border-[#ef6363]/15 bg-[#24121e]/45 p-3">
            <h3 className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#ff7d88]">Weaknesses</h3>
            <ul className="mt-2 space-y-1 text-[9px] leading-3.5 text-[#c4cedc]">
              {player.weaknesses.slice(0, 3).map((weakness) => <li key={weakness} className="flex gap-1.5"><span className="font-bold text-[#ff7d88]">−</span>{weakness}</li>)}
            </ul>
          </section>
        </div>
      </div>
    </motion.article>
  )
}
