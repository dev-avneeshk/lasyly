/**
 * The NFL engine threads nfl_games.id (the ESPN event id, stored on each stat
 * row as game_id) onto every lastGames entry so a clicked performance-chart bar
 * can open that game's boxscore. This verifies the passthrough: each computed
 * lastGames entry carries eventId equal to its row's game_id.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

const today = new Date().toISOString().slice(0, 10)

// 6 games for one player (SEA WR), most recent first, each with a distinct
// ESPN event id in game_id. receiving yards drive the "YDS" stat.
const PLAYER_ROWS = Array.from({ length: 6 }, (_, i) => ({
  player_name: "Jaxon Smith-Njigba",
  athlete_id: "4432773",
  team: "SEA",
  opponent: "SF",
  position: "WR",
  game_date: `2025-09-${String(28 - i).padStart(2, "0")}`,
  game_id: `40177200${i}`,
  pass_yds: 0,
  rush_yds: 0,
  rec_yds: 80 + i,
  pass_td: 0,
  rush_td: 0,
  rec_td: 0,
  rec: 6,
  rush_att: 0,
  pass_int: 0,
  sacks: 0,
}))

// cached() just runs the producer (no Redis in tests).
vi.mock("@/lib/cache", () => ({
  cached: async (_key: string, fn: () => unknown) => fn(),
  CACHE_TTL: {},
}))

// The player-history read is paged; return our rows regardless of range.
vi.mock("@/lib/supabase/paged", () => ({
  fetchPagedParallel: async (_count: unknown, page: (from: number, to: number) => Promise<unknown[]>) =>
    page(0, PLAYER_ROWS.length),
}))

// Headshots and defense enrichment are orthogonal to the eventId passthrough.
vi.mock("@/lib/data/headshot-storage", () => ({
  getStoredHeadshotIds: async () => new Set<string>(),
  resolveHeadshotUrl: () => null,
  espnHeadshotUrl: () => null,
}))
vi.mock("@/lib/analytics/nfl-defense", () => ({
  getNFLDefenseLeagueTable: async () => null,
  rankDefenseTable: () => {
    throw new Error("no defense table in test")
  },
}))

// Supabase: the slate query (nfl_games) returns a single SEA–SF game today; the
// player-stats page query returns PLAYER_ROWS; completed-games/espn_players
// reads return empty.
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      let selected = ""
      let head = false
      const c: Record<string, unknown> = {
        select: (cols: string, o?: { head?: boolean }) => {
          selected = cols
          head = !!o?.head
          return c
        },
        in: () => c,
        gte: () => c,
        lte: () => c,
        eq: () => c,
        or: () => c,
        order: () => c,
        range: () => c,
        limit: () => c,
        then: (resolve: (v: unknown) => unknown) => {
          if (head) return resolve({ count: PLAYER_ROWS.length, error: null })
          if (table === "nfl_games") {
            // Could be the slate query or the completed-games query.
            if (selected.includes("home_abbr") && selected.includes("game_date")) {
              return resolve({
                data: [
                  { home_abbr: "SEA", away_abbr: "SF", game_date: today, status: "scheduled" },
                ],
                error: null,
              })
            }
            return resolve({ data: [], error: null })
          }
          if (table === "nfl_player_stats") {
            return resolve({ data: PLAYER_ROWS, error: null })
          }
          return resolve({ data: [], error: null })
        },
      }
      return c
    },
  }),
}))

import { computeNFLProps } from "@/lib/analytics/engine-nfl"

beforeEach(() => {
  vi.clearAllMocks()
})

describe("NFL engine — eventId passthrough", () => {
  it("sets lastGames[i].eventId to the row's game_id", async () => {
    const result = await computeNFLProps("YDS", today, { search: "smith-njigba" })

    const prop = result.props.find((p) => p.player === "Jaxon Smith-Njigba")
    expect(prop).toBeDefined()
    expect(prop!.lastGames.length).toBeGreaterThan(0)

    // Each entry carries the ESPN event id from its game_id, numeric string.
    for (let i = 0; i < prop!.lastGames.length; i++) {
      expect(prop!.lastGames[i].eventId).toBe(PLAYER_ROWS[i].game_id)
      expect(prop!.lastGames[i].eventId).toMatch(/^\d{1,20}$/)
    }
  })
})
