/**
 * AuctionEngine — the server-authoritative core of the NFL Auction game.
 *
 * State is a plain serializable object (persisted to Redis). All mutations go
 * through pure reducers that VALIDATE before applying, so the client can never
 * force an illegal budget, duplicate player, over-bid, or impossible roster.
 */

import {
  type AuctionLot,
  type AuctionResult,
  type BidRecord,
  type NflGameConfig,
  type NflGameResult,
  type GameStatus,
  type RosterState,
  type Season,
  type NflPlayer,
  type TeamId,
} from "./types"
import { getSeasonPlayers } from "./data"
import { emptyRoster, isRosterComplete, canAddPlayer, ownsPlayer, placePlayer, bestSlotFor } from "./roster"
import { maxAffordable, remaining, validateBidAmount, MIN_BID } from "./budget"
import { scaledOpeningBid } from "./value"
import { mulberry32, hashSeed, shuffle, type RNG } from "./rng"

// ─── Serializable game state ─────────────────────────────────────────────────

export interface NflAuctionState {
  gameId: string
  seed: number
  season: Season
  config: NflGameConfig
  status: GameStatus
  /** Ordered player ids still to be auctioned (front = current lot). */
  queue: string[]
  lot: AuctionLot | null
  passed: TeamId[]
  rosters: Record<TeamId, RosterState>
  isAI: Record<TeamId, boolean>
  history: BidRecord[]
  results: AuctionResult[]
  lotDeadline: number | null
  completedAt: number | null
  result?: NflGameResult | null
}

export function otherTeam(t: TeamId): TeamId {
  return t === "P1" ? "P2" : "P1"
}

/**
 * Total lots put up for auction. Both players need 9 (18 total); we show a few
 * extra so there's genuine competition and choice, but cap it so the auction
 * doesn't drag through the entire pool.
 */
export const MAX_LOTS = 24

/**
 * Build the auction order. For small budgets (≤$25) the biggest stars come
 * LAST so the "can you still afford a stud?" drama survives the cap. Larger
 * budgets interleave tiers for a lively, unpredictable flow. Shuffled within
 * tiers for variety.
 */
export function buildAuctionOrder(rng: RNG, pool: NflPlayer[], budget = 25): string[] {
  const byTier: Record<number, NflPlayer[]> = { 1: [], 2: [], 3: [], 4: [] }
  for (const p of pool) byTier[p.tier].push(p)
  for (const t of [1, 2, 3, 4]) byTier[t] = shuffle(rng, byTier[t])

  const cap = Math.min(MAX_LOTS, pool.length)

  if (budget <= 25) {
    const starCount = Math.min(6, byTier[1].length)
    const stars = byTier[1].slice(0, starCount)
    const restQuota = cap - stars.length
    const front = [...byTier[4], ...byTier[3], ...byTier[2]].slice(0, restQuota)
    return [...front, ...stars].map((p) => p.id)
  }

  const order: NflPlayer[] = []
  const buckets = [byTier[3], byTier[4], byTier[2], byTier[1]]
  let idx = 0
  while (buckets.some((b) => b.length > 0) && order.length < cap) {
    const bucket = buckets[idx % buckets.length]
    if (bucket.length > 0) order.push(bucket.shift()!)
    idx++
    if (idx % 4 === 0 && rng() < 0.4) idx++
  }
  return order.slice(0, cap).map((p) => p.id)
}

export function createGame(opts: {
  gameId: string
  config: NflGameConfig
  seed?: number
  vsAI?: boolean
}): NflAuctionState {
  const seed = opts.seed ?? hashSeed(opts.gameId)
  const rng = mulberry32(seed)
  const pool = getSeasonPlayers(opts.config.season)
  const queue = buildAuctionOrder(rng, pool, opts.config.budgetPerPlayer)

  return {
    gameId: opts.gameId,
    seed,
    season: opts.config.season,
    config: opts.config,
    status: "auction",
    queue,
    lot: null,
    passed: [],
    rosters: { P1: emptyRoster(), P2: emptyRoster() },
    isAI: { P1: false, P2: opts.vsAI !== false },
    history: [],
    results: [],
    lotDeadline: null,
    completedAt: null,
  }
}

// ─── Lot lifecycle ─────────────────────────────────────────────────────────

function playerById(state: NflAuctionState, id: string): NflPlayer {
  const p = getSeasonPlayers(state.season).find((x) => x.id === id)
  if (!p) throw new Error(`Unknown player id: ${id}`)
  return p
}

/** Skip queued players NEITHER team can roster anymore. Guarantees termination. */
function pruneUnwinnableFront(state: NflAuctionState): void {
  while (state.queue.length > 0) {
    const p = playerById(state, state.queue[0])
    const anyCanTake =
      (!isRosterComplete(state.rosters.P1) && canAddPlayer(state.rosters.P1, p)) ||
      (!isRosterComplete(state.rosters.P2) && canAddPlayer(state.rosters.P2, p))
    if (anyCanTake) break
    state.queue.shift()
  }
}

/** Open the next lot. Returns true if a lot was opened, false if none remain. */
export function openNextLot(state: NflAuctionState): boolean {
  if (rostersDone(state)) {
    finalizeAuction(state)
    return false
  }
  pruneUnwinnableFront(state)
  if (state.queue.length === 0) {
    finalizeAuction(state)
    return false
  }
  const id = state.queue[0]
  const player = playerById(state, id)
  let open = scaledOpeningBid(player, state.config.budgetPerPlayer, state.config.rosterSize)

  // Clamp the opening bid to what an active, eligible team can actually afford,
  // so a lot can never be un-sellable and stall the auction.
  let affordableFloor = 0
  for (const t of ["P1", "P2"] as TeamId[]) {
    if (isRosterComplete(state.rosters[t])) continue
    if (!canAddPlayer(state.rosters[t], player)) continue
    affordableFloor = Math.max(affordableFloor, maxAffordable(state.config.budgetPerPlayer, state.rosters[t]))
  }
  if (affordableFloor > 0) open = Math.min(open, affordableFloor)
  open = Math.max(1, open)

  state.lot = { player, currentBid: open, highBidder: null, openingBid: open }
  state.passed = []
  state.lotDeadline = Date.now() + state.config.auctionTimerSeconds * 1000
  return true
}

function rostersDone(state: NflAuctionState): boolean {
  return isRosterComplete(state.rosters.P1) && isRosterComplete(state.rosters.P2)
}

/** A team is out of the auction once its roster is full. */
export function teamActive(state: NflAuctionState, team: TeamId): boolean {
  return !isRosterComplete(state.rosters[team])
}

// ─── Bidding ─────────────────────────────────────────────────────────────

export interface BidOutcome {
  ok: boolean
  error?: string
  state: NflAuctionState
}

/**
 * Place a bid for `team` at `amount`. Fully validated & server-authoritative.
 * On success the team becomes high bidder, passes are cleared, and the lot timer
 * resets to the shorter window.
 */
export function placeBid(state: NflAuctionState, team: TeamId, amount: number): BidOutcome {
  if (state.status !== "auction" || !state.lot) {
    return { ok: false, error: "No active lot.", state }
  }
  if (!teamActive(state, team)) {
    return { ok: false, error: "Your roster is already full.", state }
  }
  const player = state.lot.player
  if (ownsPlayer(state.rosters[team], player.id)) {
    return { ok: false, error: "You already own this player.", state }
  }
  if (!canAddPlayer(state.rosters[team], player)) {
    return { ok: false, error: `You have no open slot for ${player.name}.`, state }
  }
  const total = state.config.budgetPerPlayer
  const allowEqual = state.lot.highBidder === null
  const err = validateBidAmount(amount, state.lot.currentBid, total, state.rosters[team], allowEqual)
  if (err) return { ok: false, error: err, state }

  state.lot.currentBid = amount
  state.lot.highBidder = team
  state.passed = [] // any new bid re-opens the lot for both
  state.history.push({
    playerId: player.id,
    playerName: player.name,
    bidder: team,
    amount,
    ts: Date.now(),
  })
  state.lotDeadline = Date.now() + state.config.auctionTimerResetSeconds * 1000
  return { ok: true, state }
}

/**
 * Next legal bid for a team = currentBid + league increment, capped by
 * affordability. Returns null if they can't afford even one step.
 */
export function minRaise(state: NflAuctionState, team: TeamId): number | null {
  if (!state.lot) return null
  const max = maxAffordable(state.config.budgetPerPlayer, state.rosters[team])

  if (state.lot.highBidder === null) {
    const open = state.lot.currentBid
    return open <= max ? open : null
  }

  const step = state.config.bidIncrement || 1
  const next = state.lot.currentBid + step
  if (next > max) {
    const one = state.lot.currentBid + 1
    return one <= max ? one : null
  }
  return next
}

/** A team passes on the current lot; may resolve the lot. */
export function pass(state: NflAuctionState, team: TeamId): BidOutcome {
  if (state.status !== "auction" || !state.lot) {
    return { ok: false, error: "No active lot.", state }
  }
  if (!state.passed.includes(team)) state.passed.push(team)
  maybeResolveLot(state)
  return { ok: true, state }
}

function biddableTeams(state: NflAuctionState): TeamId[] {
  const teams: TeamId[] = ["P1", "P2"]
  return teams.filter((t) => canBidOnLot(state, t))
}

function canBidOnLot(state: NflAuctionState, team: TeamId): boolean {
  if (!state.lot) return false
  if (!teamActive(state, team)) return false
  if (ownsPlayer(state.rosters[team], state.lot.player.id)) return false
  if (!canAddPlayer(state.rosters[team], state.lot.player)) return false
  if (state.lot.highBidder === team) return true
  const next = state.lot.currentBid + 1
  return next <= maxAffordable(state.config.budgetPerPlayer, state.rosters[team])
}

/** Resolve the lot if all non-leaders who could bid have passed. */
export function maybeResolveLot(state: NflAuctionState): void {
  if (!state.lot) return
  const eligible = biddableTeams(state).filter((t) => t !== state.lot!.highBidder)
  const allNonLeadersPassed = eligible.every((t) => state.passed.includes(t))
  if (allNonLeadersPassed) resolveLot(state)
}

/** Force-resolve the current lot (timer expiry / all passed). */
export function resolveLot(state: NflAuctionState): void {
  if (!state.lot) return
  const { player, highBidder, currentBid } = state.lot

  if (highBidder && teamActive(state, highBidder)) {
    const roster = state.rosters[highBidder]
    const slot = bestSlotFor(roster, player)
    if (slot) {
      state.rosters[highBidder] = placePlayer(roster, player, currentBid, slot)
      state.results.push({ playerId: player.id, playerName: player.name, winner: highBidder, price: currentBid })
    }
  }
  state.queue = state.queue.filter((id) => id !== player.id)
  state.lot = null
  state.passed = []
  state.lotDeadline = null
  openNextLot(state)
}

/** Server tick: resolve an expired lot. Returns true if state changed. */
export function tick(state: NflAuctionState, now: number = Date.now()): boolean {
  if (state.status !== "auction") return false
  if (!state.lot) return openNextLot(state)
  if (state.lotDeadline !== null && now >= state.lotDeadline) {
    resolveLot(state)
    return true
  }
  return false
}

// ─── Finalization ──────────────────────────────────────────────────────────

/**
 * Auto-fill any remaining slots with the best affordable free agents so the
 * game always reaches a valid, playable state, then flip to "lineup".
 */
export function finalizeAuction(state: NflAuctionState): void {
  autoFillIfNeeded(state, "P1")
  autoFillIfNeeded(state, "P2")
  state.lot = null
  state.passed = []
  state.lotDeadline = null
  state.status = "lineup"
}

function autoFillIfNeeded(state: NflAuctionState, team: TeamId): void {
  if (isRosterComplete(state.rosters[team])) return
  const pool = getSeasonPlayers(state.season)
  const owned = new Set<string>()
  for (const t of ["P1", "P2"] as TeamId[]) {
    for (const s of Object.values(state.rosters[t].slots)) {
      if (s) owned.add(s.player.id)
    }
  }
  const available = pool.filter((p) => !owned.has(p.id)).sort((a, b) => b.overall - a.overall)

  let guard = 0
  while (!isRosterComplete(state.rosters[team]) && guard++ < 60) {
    let placed = false
    for (const p of available) {
      if (owned.has(p.id)) continue
      if (!canAddPlayer(state.rosters[team], p)) continue
      const rem = remaining(state.config.budgetPerPlayer, state.rosters[team])
      const price = Math.min(MIN_BID, Math.max(0, rem))
      state.rosters[team] = placePlayer(state.rosters[team], p, price)
      owned.add(p.id)
      state.results.push({ playerId: p.id, playerName: p.name, winner: team, price })
      placed = true
      break
    }
    if (!placed) break
  }
}
