/**
 * PARITY FIXTURE EXPORTER (run via vitest; throwaway).
 *
 * Builds deterministic roster pairs from the real player pool, runs the
 * production `simulateGame` over many seeds for each pair, and writes the
 * rosters (by slot → playerId + price) plus the TS win rate / score stats to
 * auction_ai/validation/parity_fixtures.json. The Python parity harness then
 * runs the IDENTICAL rosters + seeds through the ported simulator and compares
 * win rates within tolerance.
 *
 *   npx vitest run scripts/parity-fixture.test.ts
 */
import { writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { test } from "vitest"
import { getSeasonPlayers } from "../lib/arena/data"
import { emptyRoster, placePlayer } from "../lib/arena/roster"
import { simulateGame } from "../lib/arena/simulation"
import type { RosterState, SeasonPlayer } from "../lib/arena/types"
import { mulberry32 } from "../lib/arena/rng"

const SEASON = "2025-26"
const SLOTS = ["PG", "SG", "SF", "PF", "C", "BENCH"] as const

/** Build a legal 6-player roster by filling each slot with an eligible player,
 *  chosen deterministically from a seeded shuffle of the pool. */
function buildRoster(pool: SeasonPlayer[], rng: () => number, used: Set<string>): RosterState {
  let roster = emptyRoster()
  for (const slot of SLOTS) {
    const eligible = pool.filter((p) => {
      if (used.has(p.id)) return false
      if (slot === "BENCH") return true
      return [p.primaryPosition, ...p.secondaryPositions].includes(slot as never)
    })
    // Pick a pseudo-random eligible player, price = a small deterministic value.
    const pick = eligible[Math.floor(rng() * eligible.length)]
    if (!pick) throw new Error(`no eligible player for ${slot}`)
    used.add(pick.id)
    roster = placePlayer(roster, pick, 1 + Math.floor(rng() * 6), slot)
  }
  return roster
}

test("export parity fixtures", () => {
  const pool = getSeasonPlayers(SEASON)
  const PAIRS = 25
  const GAMES_PER_PAIR = 400
  const fixtures: unknown[] = []

  for (let pair = 0; pair < PAIRS; pair++) {
    const rng = mulberry32(0x9e3779b9 ^ (pair * 2654435761))
    const used = new Set<string>()
    const r1 = buildRoster(pool, rng, used)
    const r2 = buildRoster(pool, rng, used)

    let p1Wins = 0
    let sumP1 = 0
    let sumP2 = 0
    for (let g = 0; g < GAMES_PER_PAIR; g++) {
      const seed = (pair * 100003 + g * 31 + 17) >>> 0
      const res = simulateGame(r1, r2, SEASON, seed, { P1: 0, P2: 0 })
      if (res.winner === "P1") p1Wins++
      sumP1 += res.finalScore.p1
      sumP2 += res.finalScore.p2
    }

    const rosterToSlots = (r: RosterState) =>
      Object.fromEntries(
        SLOTS.map((s) => [s, r.slots[s] ? { id: r.slots[s]!.player.id, price: r.slots[s]!.price } : null])
      )

    fixtures.push({
      pair,
      seedBase: (pair * 100003 + 17) >>> 0,
      seedStep: 31,
      games: GAMES_PER_PAIR,
      p1: rosterToSlots(r1),
      p2: rosterToSlots(r2),
      ts: {
        p1WinRate: p1Wins / GAMES_PER_PAIR,
        avgP1: sumP1 / GAMES_PER_PAIR,
        avgP2: sumP2 / GAMES_PER_PAIR,
      },
    })
  }

  const dest = resolve(process.cwd(), "auction_ai/validation/parity_fixtures.json")
  writeFileSync(dest, JSON.stringify({ season: SEASON, fixtures }, null, 2))
  // eslint-disable-next-line no-console
  console.log(`Wrote ${fixtures.length} parity fixtures to ${dest}`)
})
