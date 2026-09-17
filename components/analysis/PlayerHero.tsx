"use client"

import { useState } from "react"
import { ArrowDown, ArrowUp, Check, ChevronLeft, Share2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { PlayerBio } from "@/lib/analytics/player-profile"

interface PlayerHeroProps {
  playerName: string
  headshotUrl: string | null
  teamLogoUrl: string | null
  teamAbbr: string
  teamName: string | null
  /** Primary team colour, hex without a leading `#`. Tints the backdrop. */
  teamColor: string | null
  bio: PlayerBio | null
  statLabel: string
  line: number
  /** Model projection for the active stat, when the engine produced one. */
  projection: number | null
  /** Model-implied two-way price. Null when there's no usable sample. */
  prices: { over: string; under: string } | null
  /** Side the model favours — gets the accent treatment. */
  recommended?: "over" | "under"
  onBack: () => void
}

/** Splits a name into a two-line watermark, e.g. ["NOAH", "GRAY"]. */
function watermarkLines(name: string): [string, string] {
  const parts = name.trim().split(/\s+/)
  if (parts.length < 2) return [parts[0]?.toUpperCase() ?? "", ""]
  return [parts[0].toUpperCase(), parts.slice(1).join(" ").toUpperCase()]
}

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .map((n) => n[0])
    .join("")
    .slice(0, 3)
    .toUpperCase()
}

/** Renders the bio strip, skipping anything the feed didn't provide. */
function bioParts(bio: PlayerBio | null): string[] {
  if (!bio) return []
  const parts: string[] = []
  if (bio.height) parts.push(bio.height)
  if (bio.weight) parts.push(/lb|kg/i.test(bio.weight) ? bio.weight : `${bio.weight} lbs`)
  if (bio.age != null) parts.push(`${bio.age} yrs`)
  return parts
}

export function PlayerHero({
  playerName,
  headshotUrl,
  teamLogoUrl,
  teamAbbr,
  teamName,
  teamColor,
  bio,
  statLabel,
  line,
  projection,
  prices,
  recommended = "over",
  onBack,
}: PlayerHeroProps) {
  const [copied, setCopied] = useState(false)
  const [firstLine, secondLine] = watermarkLines(playerName)
  const details = bioParts(bio)
  const tint = teamColor ? `#${teamColor}` : null

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard blocked — nothing useful to fall back to here.
    }
  }

  return (
    <section className="relative overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
      {/* Team-coloured wash. Uses the real brand colour when we have it. */}
      {tint && (
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.16] pointer-events-none"
          style={{ background: `radial-gradient(120% 140% at 0% 0%, ${tint} 0%, transparent 60%)` }}
        />
      )}

      {/* Oversized name watermark */}
      <div
        aria-hidden
        className="absolute left-3 top-1 select-none pointer-events-none leading-[0.82] font-black tracking-tighter text-white/[0.045] text-[56px] md:text-[68px]"
      >
        <span className="block">{firstLine}</span>
        {secondLine && <span className="block">{secondLine}</span>}
      </div>

      <div className="relative flex flex-col gap-5 p-4 md:flex-row md:items-center md:gap-6 md:p-5">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to props"
          className="absolute right-4 top-4 md:static md:order-first shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-[var(--color-text-muted)] hover:text-white hover:bg-white/5 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* Headshot */}
        <div className="relative shrink-0 self-end md:self-center">
          <div className="w-[104px] h-[104px] md:w-[116px] md:h-[116px] rounded-2xl overflow-hidden bg-[var(--color-surface-elevated)] border border-[var(--color-border)] flex items-end justify-center">
            {headshotUrl ? (
              // Headshots come from several ESPN CDN hosts and are already sized.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={headshotUrl}
                alt={playerName}
                className="w-full h-full object-cover object-top"
              />
            ) : (
              <span className="text-2xl font-black text-[var(--color-text-muted)] self-center">
                {initialsOf(playerName)}
              </span>
            )}
          </div>
          {teamLogoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={teamLogoUrl}
              alt={teamAbbr}
              className="absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-full bg-[var(--color-surface)] p-1 border border-[var(--color-border)] object-contain"
            />
          )}
        </div>

        {/* Identity */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-[26px] md:text-[30px] font-black leading-none tracking-tight text-white truncate">
              {playerName}
            </h1>
            <button
              type="button"
              onClick={handleShare}
              aria-label="Copy link to this prop"
              title={copied ? "Link copied" : "Copy link to this prop"}
              className="shrink-0 w-7 h-7 rounded-md flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-lime)] hover:bg-white/5 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-[var(--color-lime)]" /> : <Share2 className="w-3.5 h-3.5" />}
            </button>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-[var(--color-text-muted)]">
            {bio?.position && (
              <span className="px-1.5 py-0.5 rounded bg-[var(--color-surface-elevated)] font-bold text-white">
                {bio.position}
              </span>
            )}
            {bio?.jerseyNumber && <span className="font-semibold">#{bio.jerseyNumber}</span>}
            {(bio?.position || bio?.jerseyNumber) && (teamName || teamAbbr) && (
              <span className="text-white/15">|</span>
            )}
            <span className="font-semibold text-white/80">{teamName ?? teamAbbr}</span>
          </div>

          {details.length > 0 && (
            <p className="mt-1.5 flex items-center gap-2.5 text-[12px] text-[var(--color-text-muted)]">
              {details.map((detail, i) => (
                <span key={detail} className="flex items-center gap-2.5">
                  {i > 0 && <span className="text-white/15">·</span>}
                  {detail}
                </span>
              ))}
            </p>
          )}
        </div>

        {/* Metric tiles */}
        <div className="flex flex-wrap items-stretch gap-2 shrink-0">
          <div className="flex flex-col items-center justify-center min-w-[74px] px-3 py-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)]/70">
            <span className="text-[19px] font-black leading-none text-white tabular-nums">
              {projection ?? "—"}
            </span>
            <span className="mt-1 text-[10px] font-semibold text-[var(--color-text-muted)]">
              Projection
            </span>
          </div>

          <div className="flex flex-col items-center justify-center min-w-[74px] px-3 py-2.5 rounded-xl border border-[var(--color-lime)]/25 bg-[var(--color-lime)]/[0.07]">
            <span className="text-[19px] font-black leading-none text-[var(--color-lime)] tabular-nums">
              {line}
            </span>
            <span className="mt-1 text-[10px] font-semibold text-[var(--color-text-muted)]">Line</span>
          </div>

          {(["over", "under"] as const).map((side) => {
            const Icon = side === "over" ? ArrowUp : ArrowDown
            const isRecommended = recommended === side
            const price = prices?.[side] ?? null
            return (
              <div
                key={side}
                title={
                  price
                    ? `${side === "over" ? "Over" : "Under"} ${line} ${statLabel} — ${price} model-implied price, not a sportsbook line`
                    : "Not enough sample to price this side"
                }
                className={cn(
                  "flex items-center justify-center gap-1.5 min-w-[86px] px-3 py-2.5 rounded-xl border",
                  isRecommended
                    ? "border-[var(--color-lime)]/40 bg-[var(--color-lime)]/10 text-[var(--color-lime)]"
                    : "border-[var(--color-border)] bg-[var(--color-surface-elevated)]/70 text-[var(--color-text-muted)]"
                )}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="text-[13px] font-bold tabular-nums whitespace-nowrap">
                  {side === "over" ? "O" : "U"} {price ?? "—"}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Price provenance — these are model numbers, not market prices. */}
      {prices && (
        <p className="relative px-4 pb-3 md:px-5 text-[10px] text-[var(--color-text-muted)]/70">
          O/U prices are model-implied from hit rate — not sportsbook lines.
        </p>
      )}
    </section>
  )
}
