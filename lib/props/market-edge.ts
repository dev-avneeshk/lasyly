/**
 * Scoring props against the market line.
 *
 * A prop only has a market view when its line came from a sportsbook
 * (lineSource "market", marketLine set: Pinnacle, Novig, DraftKings, ...).
 * For those:
 *
 * - Market probability: the no-vig probability of the recommended side, from
 *   the book's over/under prices (multiplicative de-vig).
 * - Model probability: the recommended side's hit rate over the last games,
 *   shrunk toward the market probability with a prior worth PRIOR_GAMES games.
 *   Raw hit rates are noisy (8/10 is not an 80% bet), so the market acts as
 *   the prior and the player's recent record moves it.
 * - Edge: model probability minus market probability. Positive means the
 *   player has beaten this line more often than the price implies.
 *
 * Pure module: no I/O, safe on server and client.
 */

/** Prior weight, in games, given to the market price when estimating the true rate. */
export const PRIOR_GAMES = 10
/** Smallest sample that can qualify for a "best" list. */
export const MIN_GAMES_FOR_BEST = 5
/** How many props each "best" list shows. */
export const BEST_LIST_SIZE = 6

export interface MarketEdge {
  side: "over" | "under"
  /** No-vig market probability of `side`, 0–1. */
  marketProb: number
  /** Shrunk model probability of `side`, 0–1. */
  modelProb: number
  /** modelProb − marketProb (probability points, e.g. 0.12 = +12%). */
  edge: number
  /** Games in the sample that went `side` against this line. */
  hits: number
  /** Sample size (last games, up to 10). */
  games: number
  /** American price for `side` at `book`. */
  price: number
  /** Book that posted the line and price. */
  book: string
  /** Projection minus line; positive favours the over. Null without a projection. */
  projectionGap: number | null
  /** Whether the projection sits on the same side of the line as `side`. */
  projectionAgrees: boolean
}

/** Implied probability of an American price, without removing the vig. */
export function impliedProbability(american: number): number {
  if (!Number.isFinite(american) || american === 0) return NaN
  return american > 0 ? 100 / (american + 100) : -american / (-american + 100)
}

/** No-vig probabilities for a two-way market, or null if the prices are unusable. */
export function noVigProbabilities(
  overPrice: number,
  underPrice: number
): { over: number; under: number } | null {
  const o = impliedProbability(overPrice)
  const u = impliedProbability(underPrice)
  if (!Number.isFinite(o) || !Number.isFinite(u) || o + u <= 0) return null
  return { over: o / (o + u), under: u / (o + u) }
}

/**
 * Whether a market is a genuine main line rather than an alternate/ladder line
 * (e.g. SGA 34.5 at +257/−335). A main line is priced near 50/50; we keep
 * markets whose no-vig over probability is within 0.35–0.65.
 */
export function isBalancedMarket(overPrice: number, underPrice: number): boolean {
  const p = noVigProbabilities(overPrice, underPrice)
  return p !== null && Math.abs(p.over - 0.5) <= 0.15
}

/** Minimal prop shape the scorer needs (server and client props both fit). */
export interface EdgeInput {
  propLine: number
  direction?: "over" | "under"
  hitRate?: { over: number; total: number } | null
  lineSource?: "market" | "average"
  marketLine?: { book?: string; overPrice: number; underPrice: number } | null
  projection?: { projection: number } | null
}

/** The market view of a prop, or null when its line is not a market line. */
export function computeMarketEdge(prop: EdgeInput): MarketEdge | null {
  if (prop.lineSource !== "market" || !prop.marketLine) return null
  const games = prop.hitRate?.total ?? 0
  if (games <= 0) return null
  const fair = noVigProbabilities(prop.marketLine.overPrice, prop.marketLine.underPrice)
  if (!fair) return null

  const side = prop.direction ?? "over"
  const overHits = prop.hitRate?.over ?? 0
  const hits = side === "over" ? overHits : games - overHits
  const marketProb = side === "over" ? fair.over : fair.under
  const modelProb = (hits + PRIOR_GAMES * marketProb) / (games + PRIOR_GAMES)

  const projected = prop.projection?.projection
  const projectionGap = typeof projected === "number" && Number.isFinite(projected)
    ? Math.round((projected - prop.propLine) * 10) / 10
    : null
  const projectionAgrees = projectionGap !== null && (side === "over" ? projectionGap > 0 : projectionGap < 0)

  return {
    side,
    marketProb: round3(marketProb),
    modelProb: round3(modelProb),
    edge: round3(modelProb - marketProb),
    hits,
    games,
    price: side === "over" ? prop.marketLine.overPrice : prop.marketLine.underPrice,
    book: prop.marketLine.book ?? "market",
    projectionGap,
    projectionAgrees,
  }
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000
}

export interface BestPropLists<T> {
  /** Highest chance of success on either side. */
  top: T[]
  /** Highest chance of success on the over. */
  overs: T[]
  /** Highest chance of success on the under. */
  unders: T[]
}

/**
 * Whether a prop can appear in a "best" list: a real sportsbook line, a big
 * enough sample, the player's record on this line beats the book's price
 * (edge > 0), and the projection lands on the same side. Props where the
 * signals disagree are left out even when one of them looks strong.
 */
export function qualifiesForBest(edge: MarketEdge | null | undefined): edge is MarketEdge {
  return !!edge && edge.games >= MIN_GAMES_FOR_BEST && edge.edge > 0 && edge.projectionAgrees
}

/** Highest chance of success first; ties go to the bigger edge, then the bigger sample. */
function byChance(a: MarketEdge, b: MarketEdge): number {
  if (b.modelProb !== a.modelProb) return b.modelProb - a.modelProb
  if (b.edge !== a.edge) return b.edge - a.edge
  return b.games - a.games
}

/**
 * The three "best" lists from a slate, ranked by chance of success (modelProb:
 * the player's record on the book's line, shrunk toward the book's no-vig
 * price). Only props on a real sportsbook line (from ParlayAPI) can qualify,
 * and each player appears at most once per list (his best prop), so one player
 * cannot fill a list.
 */
export function rankBestProps<T extends { id: string; player?: string; marketEdge?: MarketEdge | null }>(
  props: readonly T[],
  size: number = BEST_LIST_SIZE
): BestPropLists<T> {
  const scored = props
    .filter((p): p is T & { marketEdge: MarketEdge } => qualifiesForBest(p.marketEdge))
    .sort((a, b) => byChance(a.marketEdge, b.marketEdge))

  const pick = (keep: (p: T & { marketEdge: MarketEdge }) => boolean) => {
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
    overs: pick((p) => p.marketEdge.side === "over"),
    unders: pick((p) => p.marketEdge.side === "under"),
  }
}
