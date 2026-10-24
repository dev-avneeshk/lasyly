/**
 * Multi-factor prop scoring.
 *
 * Every prop gets a chance of success for each side, blended from independent
 * signals, and a payout multiplier when a sportsbook priced the line:
 *
 * - Form: the player's hit rate on this exact line over L5 / L10 / L20,
 *   each Laplace-smoothed (so 5/5 is not 100%) and weighted toward L10.
 * - Projection: probability the result lands on the side, from a normal
 *   approximation centred on the model projection with the player's own
 *   game-to-game spread (floored so low-volume stats aren't over-confident).
 * - Market: the de-vigged price of the line, when one exists. It carries half
 *   the weight but is never shown to the user.
 * - Matchup: the opponent's defensive grade for the stat nudges the over/under.
 * - Minutes: a recent rise or drop in minutes (L5 vs L20) nudges the over/under.
 *
 * The multiplier is the decimal payout of the side's American price
 * (+108 -> 2.08x, -120 -> 1.83x). Value is the expected return per unit staked,
 * chance x multiplier - 1, and is what "best props" are ranked by.
 *
 * Unpriced lines get a model multiplier instead: the fair payout for the
 * blended chance, less a standard two-way margin (a 50% chance prices at
 * 1.91x, the same as -110). It carries no edge by construction, so `value`
 * stays null for those and they never enter the "best" lists.
 *
 * Pure module: no I/O, safe on server and client.
 */

import { noVigProbabilities } from "./market-edge"

export type Side = "over" | "under"

export interface PropValueFactors {
  /** Smoothed, window-weighted hit rate on the line for the side, 0-1. */
  form: number
  /** Probability from the projection's distribution, 0-1. */
  projection: number
  /** De-vigged market probability of the side, 0-1, when the line is priced. */
  market: number | null
  /** Additive matchup nudge (probability points). */
  matchup: number
  /** Additive minutes-trend nudge (probability points). */
  minutes: number
}

export interface PropValue {
  side: Side
  /** Blended chance the side hits, 0-1. */
  chance: number
  /** Decimal payout for the side (e.g. 2.08): the book's price, else the model's. */
  multiplier: number | null
  /** "market" when a sportsbook priced the line, "model" when estimated from `chance`. */
  multiplierSource: "market" | "model" | null
  /** Expected return per unit, chance x multiplier - 1; null unless market-priced. */
  value: number | null
  /** L10 games that went the side on this line. */
  hits: number
  /** L10 games with a decision on this line (pushes excluded). */
  games: number
  factors: PropValueFactors
}

export interface PropValueInput {
  propLine: number
  /** Chronological (oldest first) recent games. */
  lastGames?: { value: number; minutes?: number | null }[] | null
  projection?: { projection?: number | null } | null
  l10Avg?: number | null
  defensiveMatchup?: { grade?: string | null } | null
  lineSource?: "market" | "average"
  marketLine?: { overPrice: number; underPrice: number } | null
}

/**
 * Blend weights. Form and projection both come from the same recent games, so
 * together they get as much weight as the priced line, which already folds in
 * injuries and role news our box scores can't see. Market drops out (and the
 * rest renormalise) when the line is unpriced.
 */
export const WEIGHTS = { form: 0.3, projection: 0.2, market: 0.5 } as const
/** Window weights for the form factor. */
const FORM_WINDOWS: { size: number; weight: number }[] = [
  { size: 5, weight: 0.25 },
  { size: 10, weight: 0.45 },
  { size: 20, weight: 0.3 },
]
/** Over-side nudge per opponent defensive grade (A = soft defence). */
const MATCHUP_NUDGE: Record<string, number> = { A: 0.03, B: 0.015, C: 0, D: -0.015, F: -0.03 }
const MAX_MINUTES_NUDGE = 0.03
const MIN_CHANCE = 0.03
const MAX_CHANCE = 0.97

/** Decimal payout multiplier for an American price (+108 -> 2.08, -120 -> 1.83). */
export function americanToMultiplier(american: number): number | null {
  if (!Number.isFinite(american) || american === 0) return null
  const m = american > 0 ? 1 + american / 100 : 1 + 100 / -american
  return Math.round(m * 100) / 100
}

/** Two-way margin baked into model multipliers (-110 / -110 is ~4.5%). */
export const MODEL_MARGIN = 0.045
const MIN_MODEL_MULTIPLIER = 1.01
const MAX_MODEL_MULTIPLIER = 10

/**
 * Model payout for a side with the given chance of hitting: fair odds
 * (1 / chance) less {@link MODEL_MARGIN}, e.g. 0.5 -> 1.91x, 0.7 -> 1.36x.
 */
export function modelMultiplier(chance: number): number | null {
  if (!Number.isFinite(chance) || chance <= 0 || chance >= 1) return null
  const m = clamp((1 - MODEL_MARGIN) / chance, MIN_MODEL_MULTIPLIER, MAX_MODEL_MULTIPLIER)
  return Math.round(m * 100) / 100
}

/** Display form, e.g. "2.08x". */
export function formatMultiplier(m: number | null | undefined): string {
  return m == null ? "—" : `${m.toFixed(2)}x`
}

/** Standard normal CDF (Abramowitz-Stegun 7.1.26 via erf). */
function normalCdf(z: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2)
  const y =
    1 -
    (((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t) *
      Math.exp(-(z * z) / 2)
  return z >= 0 ? (1 + y) / 2 : (1 - y) / 2
}

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0
}

function stdev(xs: number[]): number {
  if (xs.length < 2) return 0
  const m = mean(xs)
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1))
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x))
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000
}

/** Hits / decided games for a side over the last `size` games. */
function windowRecord(values: number[], line: number, side: Side, size: number) {
  const recent = values.slice(-size)
  let hits = 0
  let games = 0
  for (const v of recent) {
    if (v === line) continue // push
    games++
    if (side === "over" ? v > line : v < line) hits++
  }
  return { hits, games }
}

function formFactor(values: number[], line: number, side: Side): number {
  let total = 0
  let weight = 0
  for (const w of FORM_WINDOWS) {
    const { hits, games } = windowRecord(values, line, side, w.size)
    if (games === 0) continue
    total += w.weight * ((hits + 1) / (games + 2))
    weight += w.weight
  }
  return weight > 0 ? total / weight : 0.5
}

function projectionFactor(values: number[], line: number, side: Side, projected: number): number {
  const spread = Math.max(stdev(values.slice(-15)), Math.sqrt(Math.max(projected, 0.5)) * 0.8, 0.5)
  const pOver = 1 - normalCdf((line - projected) / spread)
  return side === "over" ? pOver : 1 - pOver
}

function minutesNudge(games: { minutes?: number | null }[]): number {
  const mins = games.map((g) => g.minutes ?? 0).filter((m) => m > 0)
  if (mins.length < 8) return 0
  const recent = mean(mins.slice(-5))
  const base = mean(mins.slice(-20))
  if (base <= 0) return 0
  return clamp((recent / base - 1) * 0.15, -MAX_MINUTES_NUDGE, MAX_MINUTES_NUDGE)
}

function scoreSide(input: PropValueInput, side: Side): PropValue {
  const games = input.lastGames ?? []
  const values = games.map((g) => g.value)
  const line = input.propLine
  const projected =
    typeof input.projection?.projection === "number" && Number.isFinite(input.projection.projection)
      ? input.projection.projection
      : input.l10Avg ?? mean(values.slice(-10))

  const form = formFactor(values, line, side)
  const projection = projectionFactor(values, line, side, projected)

  const priced = input.lineSource === "market" && input.marketLine ? input.marketLine : null
  const fair = priced ? noVigProbabilities(priced.overPrice, priced.underPrice) : null
  const market = fair ? (side === "over" ? fair.over : fair.under) : null

  const overNudge = MATCHUP_NUDGE[(input.defensiveMatchup?.grade ?? "").toUpperCase()] ?? 0
  const matchup = side === "over" ? overNudge : -overNudge
  const minuteTrend = minutesNudge(games)
  const minutes = side === "over" ? minuteTrend : -minuteTrend

  const blend =
    market === null
      ? (WEIGHTS.form * form + WEIGHTS.projection * projection) / (WEIGHTS.form + WEIGHTS.projection)
      : WEIGHTS.form * form + WEIGHTS.projection * projection + WEIGHTS.market * market
  const chance = clamp(blend + matchup + minutes, MIN_CHANCE, MAX_CHANCE)

  const marketMultiplier = priced
    ? americanToMultiplier(side === "over" ? priced.overPrice : priced.underPrice)
    : null
  const multiplier = marketMultiplier ?? modelMultiplier(round3(chance))
  const multiplierSource = marketMultiplier !== null ? "market" : multiplier !== null ? "model" : null
  const l10 = windowRecord(values, line, side, 10)

  return {
    side,
    chance: round3(chance),
    multiplier,
    multiplierSource,
    value: marketMultiplier === null ? null : round3(chance * marketMultiplier - 1),
    hits: l10.hits,
    games: l10.games,
    factors: {
      form: round3(form),
      projection: round3(projection),
      market: market === null ? null : round3(market),
      matchup: round3(matchup),
      minutes: round3(minutes),
    },
  }
}

/** Scores both sides and returns the one more likely to hit. */
export function computePropValue(input: PropValueInput): PropValue | null {
  if (!Number.isFinite(input.propLine) || !(input.lastGames?.length)) return null
  const over = scoreSide(input, "over")
  const under = scoreSide(input, "under")
  return under.chance > over.chance ? under : over
}

/** Smallest L10 sample that can make a "best" list. */
export const MIN_GAMES_FOR_BEST = 5
/** Props shown per "best" list. */
export const BEST_LIST_SIZE = 10

/** A best prop must be priced, likelier than not, and positive expected value. */
export function qualifiesForValue(v: PropValue | null | undefined): v is PropValue & { value: number; multiplier: number } {
  return !!v && v.multiplierSource === "market" && v.multiplier !== null && v.value !== null && v.games >= MIN_GAMES_FOR_BEST && v.chance >= 0.5 && v.value > 0
}

export interface ValueLists<T> {
  top: T[]
  overs: T[]
  unders: T[]
}

/**
 * Best props by expected value (ties: higher chance). One prop per player per
 * list, so a single player cannot fill it.
 */
export function rankByValue<T extends { id: string; player?: string; propValue?: PropValue | null }>(
  props: readonly T[],
  size: number = BEST_LIST_SIZE
): ValueLists<T> {
  const scored = props
    .filter((p) => qualifiesForValue(p.propValue))
    .sort((a, b) => {
      const va = a.propValue!.value!
      const vb = b.propValue!.value!
      if (vb !== va) return vb - va
      return b.propValue!.chance - a.propValue!.chance
    })

  const pick = (keep: (p: T) => boolean) => {
    const seen = new Set<string>()
    const out: T[] = []
    for (const p of scored) {
      if (!keep(p)) continue
      const who = (p.player ?? p.id).toLowerCase()
      if (seen.has(who)) continue
      seen.add(who)
      out.push(p)
      if (out.length >= size) break
    }
    return out
  }

  return {
    top: pick(() => true),
    overs: pick((p) => p.propValue!.side === "over"),
    unders: pick((p) => p.propValue!.side === "under"),
  }
}
