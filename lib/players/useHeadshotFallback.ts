"use client"

import { useCallback, useState } from "react"

export interface HeadshotSources {
  /** Our own stored copy. Null when the bucket URL cannot be built. */
  stored: string | null
  /** The origin CDN, used if the stored object is missing. */
  origin: string
}

/**
 * Pick the best headshot URL a client component can use, degrading on error.
 *
 * Server code asks the bucket what it holds (`getStoredHeadshotIds`) before
 * choosing a URL. A client component cannot: the index is a `server-only` read.
 * So it optimistically requests the deterministic stored path and steps down when
 * the browser reports a load failure:
 *
 *   stored WebP (~15KB)  ->  origin CDN (~200KB)  ->  caller renders initials
 *
 * Without the middle step, a player missing from the bucket would show initials
 * even though a perfectly good photo exists upstream — which is what made this a
 * fallback chain rather than a straight swap. 47 of the ids in the pools have no
 * upstream photo at all, so the final step is still reachable and still needed.
 *
 * The failure state is keyed on the origin URL, so rendering a different player
 * into the same component resets it instead of inheriting the previous player's
 * error.
 */
export function useHeadshotFallback(sources: HeadshotSources | null): {
  src: string | null
  onError: () => void
} {
  const [failure, setFailure] = useState<{ key: string; stage: number } | null>(null)

  const key = sources?.origin ?? ""
  const stage = failure?.key === key ? failure.stage : 0

  const src = !sources
    ? null
    : stage === 0
      ? (sources.stored ?? sources.origin)
      : stage === 1
        ? sources.origin
        : null

  const onError = useCallback(() => {
    // Skip the origin step when we never had a stored URL to begin with —
    // otherwise a missing bucket config would retry the same URL and loop.
    setFailure({ key, stage: stage === 0 && sources?.stored ? 1 : 2 })
  }, [key, stage, sources?.stored])

  return { src, onError }
}
