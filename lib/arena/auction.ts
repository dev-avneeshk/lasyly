/**
 * AuctionEngine — the server-authoritative core of the game.
 *
 * The state is a plain serializable object (persisted to Redis). All mutations
 * go through pure reducers that VALIDATE before applying, so the client can
 * never force an illegal budget, duplicate player, over-bid, or impossible
 * roster. Every transition is guarded and idempotent-friendly.
 */

import {
  type ArenaGameConfig,
  type AuctionLot,
  type AuctionResult,
  type BidRecord,
  type GameResult,
  type GameStatus,
  type RosterState,
  type Season,
  type SeasonPlayer,
  type TeamId,
} from "./types"
import { POSITIONS, type Position } from "./types"
import { getSeasonPlayers } from "./data"
import {
  emptyRoster,
  isRosterComplete,
  canAddPlayer,
  ownsPlayer,
  placePlayer,
  bestSlotFor,
  auctionSlotFor,
  canForceAddPlayer,
  eligiblePositions,
  openStarterSlots,
} from "./roster"
import { maxAffordable, remaining, validateBidAmount, MIN_BID } from "./budget"
import { scaledOpeningBid } from "./value"
import { mulberry32, hashSeed, shuffle, type RNG } from "./rng"

// ─── Serializable game state ─────────────────────────────────────────────────

export interface ArenaState {
  gameId: string
  seed: number
  season: Season
  config: ArenaGameConfig
  status: GameStatus
  /** Ordered list of player ids still to be auctioned (front = current lot). */
  queue: string[]
  /** Current lot, or null between lots / before start. */
  lot: AuctionLot | null
  /** Which teams have already passed on the current lot. */
  passed: TeamId[]
  rosters: Record<TeamId, RosterState>
  /** Whether each seat is controlled by AI. P1 is the human by default. */
  isAI: Record<TeamId, boolean>
  history: BidRecord[]
  results: AuctionResult[]
  /** Server clock: ms timestamp the current lot's timer expires. */
  lotDeadline: number | null
  /**
   * How many times each player has been offered and gone unsold. Passed-out lots
   * go back on the board (cheaper, since the opening bid is re-clamped to what's
   * affordable) instead of vanishing — otherwise the board dies before both
   * rosters are full and slots get silently auto-filled.
   */
  reoffers?: Record<string, number>
  completedAt: number | null
  /** Cached simulation result (computed once, persisted; never recomputed). */
  result?: GameResult | null
}

export function otherTeam(t: TeamId): TeamId {
  return t === "P1" ? "P2" : "P1"
}

// ─── Initialization ──────────────────────────────────────────────────────────

/**
 * Build the randomized auction order. We interleave tiers so superstars don't
 * all appear up front (keeps the auction tense throughout) while still shuffling
 * within tiers for variety.
 */
/**
 * Total lots put up for auction. Both players need 6, so 12 minimum; we show a
 * few extra so there's genuine competition and choice, but cap it so the
 * auction doesn't drag through the entire 38-player pool.
 */
export const MAX_LOTS = 20

/**
 * Minimum eligible players per position the board must contain: one for each of
 * the two teams. Without this the tier-based ordering could cap the board with
 * (say) zero centers, making it impossible for both teams to field a legal
 * lineup — they'd get silently auto-filled with $1 scrubs at the end.
 */
const MIN_PER_POSITION = 2

/**
 * How many times a passed-out player may be re-offered before the board gives up
 * on them. Bounded so the auction is guaranteed to terminate.
 */
const MAX_REOFFERS = 3

/**
 * Guarantee the capped board can actually fill both rosters: every position must
 * have at least MIN_PER_POSITION eligible players on the board. Where coverage is
 * short we swap in an eligible player from the leftover pool, sacrificing the
 * most redundant player already selected (one whose positions are best covered).
 */
function ensurePositionalCoverage(
  selected: SeasonPlayer[],
  pool: SeasonPlayer[]
): SeasonPlayer[] {
  const out = [...selected]
  const inBoard = new Set(out.map((p) => p.id))
  const leftovers = pool.filter((p) => !inBoard.has(p.id))

  const countFor = (pos: Position, list: SeasonPlayer[]) =>
    list.filter((p) => eligiblePositions(p).includes(pos)).length

  for (const pos of POSITIONS) {
    while (countFor(pos, out) < MIN_PER_POSITION) {
      const candidateIdx = leftovers.findIndex((p) =>
        eligiblePositions(p).includes(pos)
      )
      if (candidateIdx === -1) break // pool genuinely has nobody for this slot

      // Drop the most redundant board member: one whose every position still has
      // surplus coverage after removal. Never drop someone we just added for a
      // still-short position.
      let dropIdx = -1
      for (let i = out.length - 1; i >= 0; i--) {
        const p = out[i]
        if (eligiblePositions(p).includes(pos)) continue // needed for this slot
        const stillCovered = eligiblePositions(p).every(
          (pp) => countFor(pp, out) > MIN_PER_POSITION
        )
        if (stillCovered) {
          dropIdx = i
          break
        }
      }
      const [candidate] = leftovers.splice(candidateIdx, 1)
      if (dropIdx >= 0) out.splice(dropIdx, 1, candidate)
      else out.push(candidate) // nothing safe to drop — grow the board instead
    }
  }
  return out
}

export function buildAuctionOrder(rng: RNG, pool: SeasonPlayer[], budget = 25): string[] {
  const byTier: Record<number, SeasonPlayer[]> = { 1: [], 2: [], 3: [], 4: [] }
  for (const p of pool) byTier[p.tier].push(p)
  for (const t of [1, 2, 3, 4]) byTier[t] = shuffle(rng, byTier[t])

  const cap = Math.min(MAX_LOTS, pool.length)

  // ── Small-budget leagues: STARS COME LAST ────────────────────────────────
  // Build a capped board: mostly role/mid players up front, then a handful of
  // elite tier-1/2 studs as the finale. We reserve the last ~5 lots for stars
  // so the "can you still afford a stud?" drama survives the cap.
  if (budget <= 25) {
    const starCount = Math.min(5, byTier[1].length)
    const stars = byTier[1].slice(0, starCount)
    const restQuota = cap - stars.length
    // Fill the front from cheapest → up: tier 4, then 3, then leftover tier 2.
    const front = [...byTier[4], ...byTier[3], ...byTier[2]].slice(0, restQuota)
    // Coverage is enforced on the non-star block so the "stars last" finale is
    // preserved; stars stay pinned to the back.
    const covered = ensurePositionalCoverage(front, [
      ...byTier[4],
      ...byTier[3],
      ...byTier[2],
    ])
    return [...covered, ...stars].map((p) => p.id)
  }

  // ── Bigger leagues: interleave tiers for a lively, unpredictable flow ─────
  const order: SeasonPlayer[] = []
  const buckets = [byTier[3], byTier[4], byTier[2], byTier[1]] // lower tiers first
  let idx = 0
  while (buckets.some((b) => b.length > 0) && order.length < cap) {
    const bucket = buckets[idx % buckets.length]
    if (bucket.length > 0) order.push(bucket.shift()!)
    idx++
    if (idx % 4 === 0 && rng() < 0.4) idx++ // jitter the rotation
  }
  return ensurePositionalCoverage(order.slice(0, cap), pool).map((p) => p.id)
}

export function createGame(opts: {
  gameId: string
  config: ArenaGameConfig
  seed?: number
  vsAI?: boolean
}): ArenaState {
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

function playerById(state: ArenaState, id: string): SeasonPlayer {
  const p = getSeasonPlayers(state.season).find((x) => x.id === id)
  if (!p) throw new Error(`Unknown player id: ${id}`)
  return p
}

/**
 * Drop queued players that NEITHER team could EVER roster (no eligible starter
 * slot and no bench slot left on either side). This guarantees the auction always
 * terminates and never deadlocks on an unassignable player.
 *
 * Deliberately uses the PERMISSIVE check: a player who currently fits nobody's
 * open starter slot is only *temporarily* unavailable, because the bench unlocks
 * once a team's starting five is complete. Pruning them here would permanently
 * strip the board of bench candidates and force the $1 auto-fill fallback later.
 * `selectNextLot` already sorts them to the back until they're actually wanted.
 */
function pruneUnrosterable(state: ArenaState): void {
  state.queue = state.queue.filter((id) => {
    const p = playerById(state, id)
    return (
      (!isRosterComplete(state.rosters.P1) && canForceAddPlayer(state.rosters.P1, p)) ||
      (!isRosterComplete(state.rosters.P2) && canForceAddPlayer(state.rosters.P2, p))
    )
  })
}

/** Teams that still have at least one empty slot. */
function activeTeams(state: ArenaState): TeamId[] {
  return (["P1", "P2"] as TeamId[]).filter((t) => !isRosterComplete(state.rosters[t]))
}

/**
 * Choose which queued player goes up next, so the board never wastes its final
 * lots on players who fill nobody's actual need.
 *
 * The old behavior took the head of the queue blindly and only skipped players
 * that literally nobody could roster. That let a guard go up while a team still
 * needed a PF and a C — with the queue nearly empty, that team could no longer
 * complete a real lineup and got silently auto-filled with $1 scrubs.
 *
 * Priority, highest first:
 *   2 — fills a CRITICAL open starter slot (remaining eligible supply is at or
 *       below the number of teams that still need it: auction it now or someone
 *       can never fill that slot).
 *   1 — fills SOME team's open starter slot.
 *   0 — bench-only fodder (nobody needs them in the five).
 * Ties keep the existing queue order, preserving the tier pacing/drama.
 */
function selectNextLot(state: ArenaState): boolean {
  const teams = activeTeams(state)
  if (teams.length === 0) return false

  const queued = state.queue.map((id) => playerById(state, id))

  // Only consider players SOME active team can legally take right now. Opening a
  // lot nobody can bid on would resolve unsold and delete that player from the
  // board for good (resolveLot drops the lot either way).
  const biddable = queued.filter((p) =>
    teams.some((t) => canAddPlayer(state.rosters[t], p))
  )
  if (biddable.length === 0) return false

  // Demand: how many active teams still need each starter position.
  const demand = {} as Record<Position, number>
  for (const pos of POSITIONS) {
    demand[pos] = teams.filter((t) => state.rosters[t].slots[pos] === null).length
  }
  // Supply: how many queued players are eligible for each position.
  const supply = {} as Record<Position, number>
  for (const pos of POSITIONS) {
    supply[pos] = queued.filter((p) => eligiblePositions(p).includes(pos)).length
  }
  const critical = new Set(
    POSITIONS.filter((pos) => demand[pos] > 0 && supply[pos] <= demand[pos])
  )

  // Which starter positions are open for at least one team that could roster p.
  const priorityOf = (p: SeasonPlayer): number => {
    let best = 0
    for (const t of teams) {
      if (!canAddPlayer(state.rosters[t], p)) continue
      const open = openStarterSlots(state.rosters[t])
      const fills = eligiblePositions(p).filter((pos) => open.includes(pos))
      if (fills.length === 0) continue
      best = Math.max(best, fills.some((pos) => critical.has(pos)) ? 2 : 1)
    }
    return best
  }

  let best = biddable[0]
  let bestScore = -1
  for (const p of biddable) {
    const score = priorityOf(p)
    if (score > bestScore) {
      bestScore = score
      best = p
      if (score === 2) break // can't beat critical; keep the earliest such player
    }
  }

  const idx = state.queue.indexOf(best.id)
  if (idx > 0) {
    const [chosen] = state.queue.splice(idx, 1)
    state.queue.unshift(chosen)
  }
  return true
}

/** Open the next lot. Returns true if a lot was opened, false if none remain. */
export function openNextLot(state: ArenaState): boolean {
  if (rostersDone(state)) {
    finalizeAuction(state)
    return false
  }
  pruneUnrosterable(state)
  if (state.queue.length === 0) {
    finalizeAuction(state)
    return false
  }
  // Nothing left that anyone can legally take → stop burning lots and finalize.
  if (!selectNextLot(state)) {
    finalizeAuction(state)
    return false
  }
  const id = state.queue[0]
  const player = playerById(state, id)
  let open = scaledOpeningBid(player, state.config.budgetPerPlayer, state.config.rosterSize)

  // Clamp the opening bid to what an active, eligible team can actually afford.
  // Otherwise a $3 opener is un-buyable when both teams have only $1 left — the
  // lot could never sell and the auction would stall. We drop the floor to the
  // highest affordable amount among teams that can still roster this player.
  let affordableFloor = 0
  for (const t of ["P1", "P2"] as TeamId[]) {
    if (isRosterComplete(state.rosters[t])) continue
    if (!canAddPlayer(state.rosters[t], player)) continue
    affordableFloor = Math.max(affordableFloor, maxAffordable(state.config.budgetPerPlayer, state.rosters[t]))
  }
  if (affordableFloor > 0) open = Math.min(open, affordableFloor)
  open = Math.max(1, open)

  state.lot = {
    player,
    currentBid: open,
    highBidder: null,
    openingBid: open,
  }
  state.passed = []
  state.lotDeadline = Date.now() + state.config.auctionTimerSeconds * 1000
  return true
}

function rostersDone(state: ArenaState): boolean {
  return isRosterComplete(state.rosters.P1) && isRosterComplete(state.rosters.P2)
}

/** A team is out of the auction once its roster is full. */
export function teamActive(state: ArenaState, team: TeamId): boolean {
  return !isRosterComplete(state.rosters[team])
}

// ─── Bidding ─────────────────────────────────────────────────────────────

export interface BidOutcome {
  ok: boolean
  error?: string
  state: ArenaState
}

/**
 * Place a bid for `team` at `amount`. Fully validated & server-authoritative.
 * On success, the team becomes high bidder, the other team's "passed" flag is
 * cleared (they may respond), and the lot timer resets to the shorter window.
 */
export function placeBid(
  state: ArenaState,
  team: TeamId,
  amount: number
): BidOutcome {
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
    return {
      ok: false,
      error: `You have no open slot for ${player.name}.`,
      state,
    }
  }
  const total = state.config.budgetPerPlayer
  // First bid on an unclaimed lot may equal the opening price.
  const allowEqual = state.lot.highBidder === null
  const err = validateBidAmount(amount, state.lot.currentBid, total, state.rosters[team], allowEqual)
  if (err) return { ok: false, error: err, state }

  // Apply.
  state.lot.currentBid = amount
  state.lot.highBidder = team
  state.passed = state.passed.filter((t) => t !== team && t !== otherTeam(team))
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
 * The next legal bid for a team = currentBid + the league's bid increment,
 * capped by affordability. Returns null if they can't afford even one step.
 */
export function minRaise(state: ArenaState, team: TeamId): number | null {
  if (!state.lot) return null
  const max = maxAffordable(state.config.budgetPerPlayer, state.rosters[team])

  // FIRST bid on an unclaimed lot takes it AT the opening price (no +increment).
  // e.g. opener $3, nobody has bid → you can claim at exactly $3.
  if (state.lot.highBidder === null) {
    const open = state.lot.currentBid
    return open <= max ? open : null
  }

  // Subsequent raises step up by the league increment (fallback to +$1).
  const step = state.config.bidIncrement || 1
  const next = state.lot.currentBid + step
  if (next > max) {
    const one = state.lot.currentBid + 1
    return one <= max ? one : null
  }
  return next
}

/**
 * A team passes on the current lot. If both teams have passed (or only one team
 * is active and it passed while not holding the high bid), the lot resolves.
 */
export function pass(state: ArenaState, team: TeamId): BidOutcome {
  if (state.status !== "auction" || !state.lot) {
    return { ok: false, error: "No active lot.", state }
  }
  if (!state.passed.includes(team)) state.passed.push(team)

  maybeResolveLot(state)
  return { ok: true, state }
}

/** Number of teams still eligible to bid on the current lot. */
function biddableTeams(state: ArenaState): TeamId[] {
  const teams: TeamId[] = ["P1", "P2"]
  return teams.filter((t) => canBidOnLot(state, t))
}

function canBidOnLot(state: ArenaState, team: TeamId): boolean {
  if (!state.lot) return false
  if (!teamActive(state, team)) return false
  if (ownsPlayer(state.rosters[team], state.lot.player.id)) return false
  if (!canAddPlayer(state.rosters[team], state.lot.player)) return false
  // Can they afford at least a min raise (if they're not the high bidder)?
  if (state.lot.highBidder === team) return true
  const next = state.lot.currentBid + 1
  return next <= maxAffordable(state.config.budgetPerPlayer, state.rosters[team])
}

/**
 * Resolve the lot if bidding has settled: everyone who could bid has passed, or
 * the timer expired (see tick). Assigns the player to the high bidder, or drops
 * the lot if no one bid.
 */
export function maybeResolveLot(state: ArenaState): void {
  if (!state.lot) return
  const eligible = biddableTeams(state).filter((t) => t !== state.lot!.highBidder)
  const allNonLeadersPassed = eligible.every((t) => state.passed.includes(t))
  if (allNonLeadersPassed) resolveLot(state)
}

/** Force-resolve the current lot (timer expiry). */
export function resolveLot(state: ArenaState): void {
  if (!state.lot) return
  const { player, highBidder, currentBid } = state.lot

  let sold = false
  if (highBidder && teamActive(state, highBidder)) {
    // Award the player.
    const roster = state.rosters[highBidder]
    const slot = auctionSlotFor(roster, player)
    if (slot) {
      state.rosters[highBidder] = placePlayer(roster, player, currentBid, slot)
      state.results.push({
        playerId: player.id,
        playerName: player.name,
        winner: highBidder,
        price: currentBid,
      })
      sold = true
    }
  }

  state.queue = state.queue.filter((id) => id !== player.id)

  if (!sold) {
    // Passed out. Re-offer it later (back of the board) while anyone still needs
    // players, up to a hard cap so the auction always terminates. The re-offer is
    // usually cheaper because openNextLot re-clamps the opening bid to whatever
    // the remaining budgets can actually afford.
    const seen = state.reoffers?.[player.id] ?? 0
    const anyoneNeedsPlayers =
      !isRosterComplete(state.rosters.P1) || !isRosterComplete(state.rosters.P2)
    if (anyoneNeedsPlayers && seen < MAX_REOFFERS) {
      state.reoffers = { ...(state.reoffers ?? {}), [player.id]: seen + 1 }
      state.queue.push(player.id)
    }
  }

  state.lot = null
  state.passed = []
  state.lotDeadline = null

  // Immediately try to open the next lot (also finalizes if done).
  openNextLot(state)
}

/**
 * Server tick: called periodically. If the current lot's deadline has passed,
 * resolve it. Returns true if state changed.
 */
export function tick(state: ArenaState, now: number = Date.now()): boolean {
  if (state.status !== "auction") return false
  if (!state.lot) {
    return openNextLot(state)
  }
  if (state.lotDeadline !== null && now >= state.lotDeadline) {
    resolveLot(state)
    return true
  }
  return false
}

// ─── Finalization ──────────────────────────────────────────────────────────

/**
 * When the queue is exhausted but a roster is still incomplete (rare — only if
 * the pool ran dry, which shouldn't happen with 40 players & 12 slots), we
 * auto-fill remaining slots with the best affordable free agents so the game
 * always reaches a valid, playable state.
 */
export function finalizeAuction(state: ArenaState): void {
  autoFillIfNeeded(state, "P1")
  autoFillIfNeeded(state, "P2")
  state.lot = null
  state.passed = []
  state.lotDeadline = null
  state.status = "lineup"
}

function autoFillIfNeeded(state: ArenaState, team: TeamId): void {
  if (isRosterComplete(state.rosters[team])) return
  const pool = getSeasonPlayers(state.season)
  const owned = new Set<string>()
  for (const t of ["P1", "P2"] as TeamId[]) {
    for (const s of Object.values(state.rosters[t].slots)) {
      if (s) owned.add(s.player.id)
    }
  }
  // Best-value available players, cheapest realistic price.
  const available = pool
    .filter((p) => !owned.has(p.id))
    .sort((a, b) => b.overall - a.overall)

  let guard = 0
  while (!isRosterComplete(state.rosters[team]) && guard++ < 50) {
    let placed = false
    for (const p of available) {
      if (owned.has(p.id)) continue
      // Permissive: the fallback must be able to fill the bench too, otherwise a
      // roster could never be completed and the sim would get <5 starters.
      if (!canForceAddPlayer(state.rosters[team], p)) continue
      const rem = remaining(state.config.budgetPerPlayer, state.rosters[team])
      const price = Math.min(MIN_BID, Math.max(0, rem))
      state.rosters[team] = placePlayer(state.rosters[team], p, price)
      owned.add(p.id)
      state.results.push({
        playerId: p.id,
        playerName: p.name,
        winner: team,
        price,
      })
      placed = true
      break
    }
    if (!placed) break
  }
}
