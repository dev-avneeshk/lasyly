"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import type { SeasonPlayer } from "@/lib/arena/types"
import { headshotUrl } from "@/lib/arena/data"
import { cn } from "@/lib/utils"

function initials(name: string): string {
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()
}

function Headshot({ player }: { player: SeasonPlayer }) {
  const url = headshotUrl(player)
  const [failed, setFailed] = useState(false)
  return (
    <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-gradient-to-b from-white/10 to-white/[0.02] ring-1 ring-white/10">
      {url && !failed ? (
        // Plain <img> (not next/image) so we don't need remotePatterns config.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={player.name}
          loading="lazy"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover object-top"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-2xl font-black text-[var(--color-text-muted)]">
          {initials(player.name)}
        </div>
      )}
    </div>
  )
}

const TIER_LABEL: Record<number, string> = { 1: "SUPERSTAR", 2: "ALL-STAR", 3: "STARTER", 4: "ROLE PLAYER" }
const TIER_GLOW: Record<number, string> = {
  1: "shadow-[0_0_60px_-10px_rgba(212,255,0,0.55)] border-[var(--color-lime)]/60",
  2: "shadow-[0_0_50px_-14px_rgba(108,99,255,0.55)] border-[var(--color-primary)]/50",
  3: "shadow-[0_0_40px_-16px_rgba(0,212,170,0.4)] border-[var(--color-secondary)]/40",
  4: "border-[var(--color-border)]",
}

function StatBar({ label, value }: { label: string; value: number }) {
  const color =
    value >= 88 ? "var(--color-lime)" : value >= 75 ? "var(--color-secondary)" : value >= 60 ? "var(--color-primary)" : "var(--color-text-muted)"
  return (
    <div className="flex items-center gap-2">
      <span className="w-14 shrink-0 text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
        <motion.div
          className="h-full rounded-full"
          style={{ background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      </div>
      <span className="w-6 text-right text-[11px] font-semibold tabular-nums text-[var(--color-text-primary)]">{value}</span>
    </div>
  )
}

export function PlayerCard({ player }: { player: SeasonPlayer }) {
  const a = player.attributes
  const positions = [player.primaryPosition, ...player.secondaryPositions].join(" / ")

  const keyStats: { label: string; value: number }[] = [
    { label: "Score", value: a.scoring },
    { label: "3PT", value: a.threePointShooting },
    { label: "Playmk", value: a.playmaking },
    { label: "Reb", value: a.rebounding },
    { label: "Per D", value: a.perimeterDefense },
    { label: "Rim", value: a.rimProtection },
  ]

  return (
    <motion.div
      key={player.id}
      initial={{ opacity: 0, scale: 0.94, y: 14 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.94, y: -14 }}
      transition={{ type: "spring", stiffness: 260, damping: 24 }}
      className={cn(
        "relative w-full max-w-md overflow-hidden rounded-3xl border bg-gradient-to-b from-[var(--color-surface-elevated)] to-[var(--color-surface)] p-6",
        TIER_GLOW[player.tier]
      )}
    >
      <div className="flex items-start gap-4">
        <Headshot player={player} />
        <div className="min-w-0 flex-1">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--color-lime)]">
            {TIER_LABEL[player.tier]}
          </span>
          <h2 className="mt-1 text-2xl font-black leading-tight text-[var(--color-text-primary)]">
            {player.name}
          </h2>
          <p className="text-sm text-[var(--color-text-muted)]">
            {positions} · {player.team}
          </p>
        </div>
        <div className="flex flex-col items-center rounded-2xl bg-black/30 px-4 py-2">
          <span className="text-[9px] uppercase tracking-widest text-[var(--color-text-muted)]">OVR</span>
          <span className="text-3xl font-black tabular-nums text-[var(--color-lime)]">{player.overall}</span>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-1.5">
        {keyStats.map((s) => (
          <StatBar key={s.label} label={s.label} value={s.value} />
        ))}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 text-xs">
        <div>
          <p className="mb-1 font-semibold uppercase tracking-wide text-[var(--color-secondary)]">Strengths</p>
          <ul className="space-y-0.5 text-[var(--color-text-muted)]">
            {player.strengths.slice(0, 4).map((s) => (
              <li key={s} className="flex gap-1"><span className="text-[var(--color-lime)]">+</span>{s}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-1 font-semibold uppercase tracking-wide text-[var(--color-danger)]">Weaknesses</p>
          <ul className="space-y-0.5 text-[var(--color-text-muted)]">
            {player.weaknesses.slice(0, 3).map((s) => (
              <li key={s} className="flex gap-1"><span className="text-[var(--color-danger)]">−</span>{s}</li>
            ))}
          </ul>
        </div>
      </div>
    </motion.div>
  )
}
