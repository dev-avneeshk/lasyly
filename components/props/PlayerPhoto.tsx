"use client"

import Image from "next/image"
import { useState, useEffect } from "react"

interface PlayerPhotoProps {
  playerName: string
  team: string
  sport?: string
  headshotUrl?: string | null
  size?: number
}

/**
 * Player headshot component — supports all ESPN sports.
 * If headshotUrl is provided (pre-fetched from DB), uses it directly.
 * Otherwise falls back to the /api/players/headshot endpoint.
 * Falls back to styled initials if unavailable.
 *
 * Uses a module-level cache so headshot URLs persist across re-renders
 * and component remounts (e.g., when filters change and cards re-render).
 */

// ─── Module-level headshot cache ─────────────────────────────────────────────
// Persists across component mounts/unmounts within the same page session.
// Key: "playerName|team|sport" → URL string or "FAILED" sentinel
const headshotCache = new Map<string, string>()
const FAILED_SENTINEL = "__FAILED__"

function getCacheKey(name: string, team: string, sport?: string): string {
  return `${name.toLowerCase()}|${team.toLowerCase()}|${(sport ?? "").toLowerCase()}`
}

function getPlayerInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? "?"
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function PlayerPhoto({ playerName, team, sport, headshotUrl: preloadedUrl, size = 36 }: PlayerPhotoProps) {
  const cacheKey = getCacheKey(playerName, team, sport)

  // Check cache synchronously on mount
  const cachedValue = preloadedUrl ?? headshotCache.get(cacheKey) ?? null
  const cachedFailed = !preloadedUrl && headshotCache.get(cacheKey) === FAILED_SENTINEL

  const [headshotUrl, setHeadshotUrl] = useState<string | null>(
    cachedFailed ? null : (cachedValue !== FAILED_SENTINEL ? cachedValue : null)
  )
  const [failed, setFailed] = useState(cachedFailed)
  const initials = getPlayerInitials(playerName)

  useEffect(() => {
    // If we already have a URL from props or cache, use it directly
    if (preloadedUrl) {
      setHeadshotUrl(preloadedUrl)
      headshotCache.set(cacheKey, preloadedUrl)
      return
    }

    // If already cached (hit or miss), don't re-fetch
    const cached = headshotCache.get(cacheKey)
    if (cached === FAILED_SENTINEL) {
      setFailed(true)
      return
    }
    if (cached) {
      setHeadshotUrl(cached)
      return
    }

    let cancelled = false

    async function fetchHeadshot() {
      try {
        let url = `/api/players/headshot?name=${encodeURIComponent(playerName)}&team=${encodeURIComponent(team)}`
        if (sport) url += `&sport=${encodeURIComponent(sport)}`
        const res = await fetch(url)
        if (!res.ok) {
          headshotCache.set(cacheKey, FAILED_SENTINEL)
          if (!cancelled) setFailed(true)
          return
        }
        const data = await res.json()
        if (!cancelled) {
          if (data.success && data.headshot) {
            headshotCache.set(cacheKey, data.headshot)
            setHeadshotUrl(data.headshot)
          } else {
            headshotCache.set(cacheKey, FAILED_SENTINEL)
            setFailed(true)
          }
        }
      } catch {
        headshotCache.set(cacheKey, FAILED_SENTINEL)
        if (!cancelled) setFailed(true)
      }
    }

    fetchHeadshot()
    return () => { cancelled = true }
  }, [playerName, team, sport, preloadedUrl, cacheKey])

  if (failed) {
    return (
      <div
        className="rounded-full bg-[var(--color-surface-elevated)] flex items-center justify-center shrink-0 border border-[var(--color-border)]"
        style={{ width: size, height: size }}
      >
        <span
          className="font-bold text-[var(--color-text-muted)]"
          style={{ fontSize: size * 0.35 }}
        >
          {initials}
        </span>
      </div>
    )
  }

  if (!headshotUrl) {
    // Loading state — show placeholder
    return (
      <div
        className="rounded-full bg-[var(--color-surface-elevated)] flex items-center justify-center shrink-0 border border-[var(--color-border)] animate-pulse"
        style={{ width: size, height: size }}
      />
    )
  }

  return (
    <div
      className="rounded-full overflow-hidden shrink-0 bg-[var(--color-surface-elevated)] flex items-center justify-center border border-[var(--color-border)]"
      style={{ width: size, height: size }}
    >
      <Image
        src={headshotUrl}
        alt={playerName}
        width={size}
        height={size}
        className="object-cover scale-[1.5] translate-y-[2px]"
        unoptimized
        onError={() => {
          headshotCache.set(cacheKey, FAILED_SENTINEL)
          setFailed(true)
        }}
      />
    </div>
  )
}
