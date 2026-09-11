/**
 * Deterministic seeded RNG (mulberry32) + helpers for the NFL Auction mode.
 *
 * The whole game — auction order and drive-simulation variance — runs through a
 * single seed so results are reproducible (important for a server-authoritative
 * model and for testing). Same seed + same inputs ⇒ same game.
 */

export type RNG = () => number

export function mulberry32(seed: number): RNG {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Hash an arbitrary string to a 32-bit seed. */
export function hashSeed(str: string): number {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function randInt(rng: RNG, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min
}

export function randRange(rng: RNG, min: number, max: number): number {
  return rng() * (max - min) + min
}

/** Fisher-Yates shuffle (returns a new array). */
export function shuffle<T>(rng: RNG, arr: T[]): T[] {
  const out = arr.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** Weighted pick by weight function. */
export function weightedPick<T>(rng: RNG, items: T[], weight: (t: T) => number): T {
  const total = items.reduce((s, it) => s + Math.max(0, weight(it)), 0)
  if (total <= 0) return items[Math.floor(rng() * items.length)]
  let r = rng() * total
  for (const it of items) {
    r -= Math.max(0, weight(it))
    if (r <= 0) return it
  }
  return items[items.length - 1]
}
