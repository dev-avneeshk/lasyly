import {
  createGame,
  placeBid,
  pass,
  resolveLot,
  openNextLot,
  buildAuctionOrder,
  type NflAuctionState,
} from "@/lib/nfl/auction"
import { maxAffordable, validateBidAmount } from "@/lib/nfl/budget"
import { emptyRoster, placePlayer, isRosterComplete, canFillSlot, rosterCount, bestSlotFor } from "@/lib/nfl/roster"
import { getSeasonPlayers, findPlayer } from "@/lib/nfl/data"
import { DEFAULT_CONFIG, ROSTER_SLOTS, type NflPlayer, type RosterState } from "@/lib/nfl/types"
import { decideAI, walkAwayPrice } from "@/lib/nfl/ai"
import { runSimulation } from "@/lib/nfl/game"
import { mulberry32 } from "@/lib/nfl/rng"

const SEASON = "2025"

// Pool-derived helpers so tests stay valid as the generated pool changes,
// rather than hardcoding slug ids that drift with the data.
function topByPosition(pos: string, n = 0): NflPlayer {
  const sorted = getSeasonPlayers(SEASON)
    .filter((p) => p.position === pos)
    .sort((a, b) => b.overall - a.overall)
  const p = sorted[n]
  if (!p) throw new Error(`no ${pos} at index ${n}`)
  return p
}
function worstByPosition(pos: string, n = 0): NflPlayer {
  const sorted = getSeasonPlayers(SEASON)
    .filter((p) => p.position === pos)
    .sort((a, b) => a.overall - b.overall)
  const p = sorted[n]
  if (!p) throw new Error(`no ${pos} at index ${n}`)
  return p
}
/** A top QB — stands in for the old hardcoded Mahomes. */
function mahomes() {
  return topByPosition("QB")
}

describe("NFL — data", () => {
  it("has a pool with every position represented", () => {
    const pool = getSeasonPlayers(SEASON)
    expect(pool.length).toBeGreaterThanOrEqual(30)
    const positions = new Set(pool.map((p) => p.position))
    for (const pos of ["QB", "RB", "WR", "TE", "EDGE", "LB", "CB", "S"] as const) {
      expect(positions.has(pos)).toBe(true)
    }
  })

  it("has at least 2 QBs and 2 WRs so both rosters can be filled", () => {
    const pool = getSeasonPlayers(SEASON)
    expect(pool.filter((p) => p.position === "QB").length).toBeGreaterThanOrEqual(2)
    // Two WR slots per team × 2 teams = 4 WRs minimum.
    expect(pool.filter((p) => p.position === "WR").length).toBeGreaterThanOrEqual(4)
  })

  it("ratings are all within 0-99", () => {
    for (const p of getSeasonPlayers(SEASON)) {
      expect(p.overall).toBeGreaterThan(0)
      expect(p.overall).toBeLessThanOrEqual(99)
      for (const v of Object.values(p.attributes)) {
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThanOrEqual(99)
      }
    }
  })
})

describe("NFL — budget", () => {
  it("reserves $1 per remaining slot when computing max affordable", () => {
    const roster = emptyRoster() // 9 open slots
    // total 25, 9 slots → most on first player = 25 - 8*1 = 17
    expect(maxAffordable(25, roster)).toBe(17)
  })

  it("updates max affordable after a purchase", () => {
    let roster = emptyRoster()
    roster = placePlayer(roster, mahomes(), 8, "QB")
    // remaining = 17, 8 open slots → max next = 17 - 7 = 10
    expect(maxAffordable(25, roster)).toBe(10)
    expect(rosterCount(roster)).toBe(1)
  })

  it("rejects a bid that would make the roster impossible to complete", () => {
    const roster = emptyRoster()
    expect(validateBidAmount(18, 5, 25, roster)).toBeTruthy() // max is 17
    expect(validateBidAmount(17, 5, 25, roster)).toBeNull()
  })
})

describe("NFL — roster rules", () => {
  it("prevents duplicate players", () => {
    const roster = placePlayer(emptyRoster(), mahomes(), 8, "QB")
    expect(() => placePlayer(roster, mahomes(), 4, "QB")).toThrow(/Duplicate/)
  })

  it("enforces positional eligibility (a QB can't fill WR1)", () => {
    expect(canFillSlot(mahomes(), "WR1")).toBe(false)
    expect(canFillSlot(mahomes(), "QB")).toBe(true)
  })

  it("routes a WR into WR1 then WR2", () => {
    const wr1 = topByPosition("WR", 0)
    const wr2 = topByPosition("WR", 1)
    let roster = emptyRoster()
    expect(bestSlotFor(roster, wr1)).toBe("WR1")
    roster = placePlayer(roster, wr1, 6)
    expect(bestSlotFor(roster, wr2)).toBe("WR2")
    roster = placePlayer(roster, wr2, 6)
    // Third WR has no slot.
    const wr3 = topByPosition("WR", 2)
    expect(bestSlotFor(roster, wr3)).toBeNull()
  })
})

describe("NFL — auction flow", () => {
  it("stars come last on a $25 board", () => {
    const pool = getSeasonPlayers(SEASON)
    const order = buildAuctionOrder(mulberry32(1), pool, 25)
    const ids = order.map((id) => pool.find((p) => p.id === id)!)
    // "Elite" = protected by the fire-sale guard: tier 1/2 OR overall >= 80.
    // This captures name starters at overall 79-80 that fall into tier 3 but
    // must NOT be sold cheap early.
    const isElite = (p: (typeof ids)[number]) => p.tier <= 2 || p.overall >= 80
    // The final lots should all be elite players.
    const lastSix = ids.slice(-6)
    expect(lastSix.every(isElite)).toBe(true)
    // And no elite player should appear in the first third of the draft.
    const firstThird = ids.slice(0, Math.floor(ids.length / 3))
    expect(firstThird.some(isElite)).toBe(false)
  })

  it("highest bidder wins the lot and budget updates; never negative", () => {
    const state = createGame({ gameId: "nfl-win", config: { ...DEFAULT_CONFIG }, vsAI: false, seed: 7 })
    openNextLot(state)
    const player = state.lot!.player
    placeBid(state, "P1", state.lot!.currentBid + 1)
    const price = state.lot!.currentBid
    pass(state, "P2")
    const owns = Object.values(state.rosters.P1.slots).some((s) => s?.player.id === player.id)
    expect(owns).toBe(true)
    const spent = Object.values(state.rosters.P1.slots).reduce((s, o) => s + (o?.price ?? 0), 0)
    expect(spent).toBe(price)
    expect(spent).toBeLessThanOrEqual(DEFAULT_CONFIG.budgetPerPlayer)
  })

  it("auction always completes with exactly 9 players each (5 offense + 4 defense)", () => {
    const state = createGame({ gameId: "nfl-complete", config: { ...DEFAULT_CONFIG }, vsAI: true, seed: 123 })
    runAuctionToCompletion(state)
    expect(state.status).toBe("lineup")
    for (const team of ["P1", "P2"] as const) {
      expect(isRosterComplete(state.rosters[team])).toBe(true)
      const filled = ROSTER_SLOTS.filter((s) => state.rosters[team].slots[s] !== null)
      expect(filled.length).toBe(9)
    }
  })

  it("no duplicate players across both rosters", () => {
    const state = createGame({ gameId: "nfl-dupe", config: { ...DEFAULT_CONFIG }, vsAI: true, seed: 55 })
    runAuctionToCompletion(state)
    const ids = new Set<string>()
    for (const team of ["P1", "P2"] as const) {
      for (const s of Object.values(state.rosters[team].slots)) {
        if (s) {
          expect(ids.has(s.player.id)).toBe(false)
          ids.add(s.player.id)
        }
      }
    }
  })
})

describe("NFL — AI", () => {
  it("produces a legal decision for an affordable lot", () => {
    const state = createGame({ gameId: "nfl-ai", config: { ...DEFAULT_CONFIG }, vsAI: true, seed: 9 })
    openNextLot(state)
    const wa = walkAwayPrice(state, "P2")
    expect(wa).toBeGreaterThanOrEqual(0)
    const decision = decideAI(state, "P2")
    expect(["bid", "pass"]).toContain(decision.action)
  })
})

describe("NFL — simulation", () => {
  it("two completed rosters always produce a valid result with a winner", () => {
    const state = createGame({ gameId: "nfl-sim", config: { ...DEFAULT_CONFIG }, vsAI: true, seed: 321 })
    runAuctionToCompletion(state)
    const result = runSimulation(state.rosters.P1, state.rosters.P2, SEASON, state.seed)
    expect(["P1", "P2"]).toContain(result.winner)
    expect(result.finalScore.p1).not.toBe(result.finalScore.p2)
    // Realistic-ish NFL score range.
    expect(result.finalScore.p1).toBeGreaterThanOrEqual(0)
    // Realistic NFL ceiling — blowouts happen but a single team shouldn't clear
    // the high 50s. (The old sim produced 56-42 games with impossible stat lines.)
    expect(result.finalScore.p1).toBeLessThanOrEqual(60)
    expect(result.finalScore.p2).toBeLessThanOrEqual(60)
    expect(result.mvp.playerId).toBeTruthy()
    expect(result.scoutReports.P1.biggestThreat).toBeTruthy()
  })

  it("produces realistic scoring and stat lines across many games", () => {
    let teamGames = 0
    let scoreSum = 0
    let over45 = 0
    let maxPassYds = 0
    for (let i = 0; i < 60; i++) {
      const state = createGame({ gameId: `nfl-realism-${i}`, config: { ...DEFAULT_CONFIG }, vsAI: true, seed: i + 1 })
      runAuctionToCompletion(state)
      const r = runSimulation(state.rosters.P1, state.rosters.P2, SEASON, state.seed)
      for (const s of [r.finalScore.p1, r.finalScore.p2]) {
        teamGames++
        scoreSum += s
        if (s > 45) over45++
      }
      for (const l of r.box) maxPassYds = Math.max(maxPassYds, l.passYds)
    }
    const avg = scoreSum / teamGames
    // Average team score should sit in a believable NFL band, not video-game highs.
    expect(avg).toBeGreaterThan(10)
    expect(avg).toBeLessThan(28)
    // Blowouts over 45 must be rare tail events.
    expect(over45 / teamGames).toBeLessThan(0.05)
    // No single-game passing line should be physically absurd (season-length).
    expect(maxPassYds).toBeLessThan(700)
  })

  it("is deterministic for the same seed and rosters", () => {
    const a = createGame({ gameId: "nfl-det", config: { ...DEFAULT_CONFIG }, vsAI: true, seed: 2024 })
    runAuctionToCompletion(a)
    const r1 = runSimulation(a.rosters.P1, a.rosters.P2, SEASON, 2024)
    const r2 = runSimulation(a.rosters.P1, a.rosters.P2, SEASON, 2024)
    expect(r1.finalScore).toEqual(r2.finalScore)
    expect(r1.winner).toEqual(r2.winner)
  })

  it("a clearly stronger team wins most of the time, but not always", () => {
    // Best vs worst player at each position, drawn from the live pool.
    const squad = (pick: (pos: string, n: number) => NflPlayer) => [
      pick("QB", 0), pick("RB", 0), pick("WR", 0), pick("WR", 1), pick("TE", 0),
      pick("EDGE", 0), pick("LB", 0), pick("CB", 0), pick("S", 0),
    ]
    const strong = buildRosterFrom(squad(topByPosition))
    const weak = buildRosterFrom(squad(worstByPosition))
    let strongWins = 0
    const N = 60
    for (let i = 0; i < N; i++) {
      const r = runSimulation(strong, weak, SEASON, 1000 + i)
      if (r.winner === "P1") strongWins++
    }
    expect(strongWins).toBeGreaterThan(N * 0.65)
    expect(strongWins).toBeLessThanOrEqual(N)
  })
})

// ─── helpers ──────────────────────────────────────────────────────────────

function runAuctionToCompletion(state: NflAuctionState) {
  let guard = 0
  while (state.status === "auction" && guard++ < 5000) {
    if (!state.lot) {
      if (!openNextLot(state)) break
      continue
    }
    let settled = false
    let inner = 0
    while (!settled && inner++ < 300) {
      const before = state.lot?.currentBid
      for (const team of ["P1", "P2"] as const) {
        if (!state.lot) break
        const d = decideAI(state, team)
        if (d.action === "bid") placeBid(state, team, d.amount)
        else pass(state, team)
      }
      if (!state.lot) { settled = true; break }
      if (state.lot && state.lot.currentBid === before) {
        resolveLot(state)
        settled = true
      }
    }
  }
}

function buildRoster(ids: string[]): RosterState {
  let roster = emptyRoster()
  for (const id of ids) {
    const p = findPlayer(SEASON, id)!
    roster = placePlayer(roster, p, 3)
  }
  return roster
}

function buildRosterFrom(players: NflPlayer[]): RosterState {
  let roster = emptyRoster()
  for (const p of players) roster = placePlayer(roster, p, 3)
  return roster
}
