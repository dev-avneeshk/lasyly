/**
 * The NBA engine (engine-v2) threads nba_player_stats.game_id (= nba_games.id)
 * onto every lastGames entry so a clicked performance-chart bar can open that
 * game's DB-backed boxscore. This verifies the passthrough: each computed
 * lastGames entry carries gameId equal to its row's game_id.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

const today = new Date().toISOString().slice(0, 10)

/** `today` minus `days`, as YYYY-MM-DD. */
function daysAgo(days: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

// 8 games for one player (LAL), most recent first (i=0 is the most recent, one
// day ago), each with a distinct game_id UUID. `pts` drives the "pts" stat.
// Dates are recent so every game clears the engine's quality gate (>= 5 games,
// most recent within 14 days, >= 10 min in >= 3 of the last 5).
const PLAYER_ROWS = Array.from({ length: 8 }, (_, i) => ({
  id: `row-${i}`,
  player_name: "LeBron James",
  team: "LAL",
  opponent: "BOS",
  position: "SF",
  minutes: "34:00",
  game_id: `0000000${i}-0000-4000-8000-000000000000`,
  // Skew the distribution so the over hit rate clears the engine's 60% gate
  // (7 of 8 games above the ~27.5 computed line) and a prop is actually emitted.
  pts: i === 7 ? 10 : 30,
  trb: 8,
  ast: 7,
  tp: 2,
  stl: 1,
  blk: 1,
  tov: 3,
  fg: 10,
  fga: 20,
  ft: 4,
  fta: 5,
  nba_games: {
    game_date: daysAgo(i + 1),
    home_team: "Los Angeles Lakers",
    away_team: "Boston Celtics",
  },
}))

// cached() just runs the producer (no Redis in tests).
vi.mock("@/lib/cache", () => ({
  cached: async (_key: string, fn: () => unknown) => fn(),
  CACHE_TTL: {},
}))

// The slate read is paged; return our rows regardless of range.
vi.mock("@/lib/supabase/paged", () => ({
  fetchPagedParallel: async (
    _count: unknown,
    page: (from: number, to: number) => Promise<unknown[]>
  ) => page(0, PLAYER_ROWS.length),
}))

// Supabase admin: slate query (nba_games) returns a scheduled LAL-BOS game today;
// nba_player_stats head count returns the row count; defense/correlation/line
// reads return empty.
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      let head = false
      const c: Record<string, unknown> = {
        select: (_cols: string, o?: { head?: boolean }) => {
          head = !!o?.head
          return c
        },
        in: () => c,
        gte: () => c,
        lte: () => c,
        eq: () => c,
        or: () => c,
        ilike: () => c,
        order: () => c,
        range: () => c,
        limit: () => c,
        then: (resolve: (v: unknown) => unknown) => {
          if (head) return resolve({ count: PLAYER_ROWS.length, error: null })
          if (table === "nba_games") {
            return resolve({
              data: [
                { home_team: "LAL", away_team: "BOS", game_date: today, status: "scheduled" },
              ],
              error: null,
            })
          }
          if (table === "nba_player_stats") {
            return resolve({ data: PLAYER_ROWS, error: null })
          }
          return resolve({ data: [], error: null })
        },
      }
      return c
    },
  }),
}))

import { computeMatchupScopedProps } from "@/lib/analytics/engine-v2"

beforeEach(() => {
  vi.clearAllMocks()
})

describe("NBA engine — gameId passthrough", () => {
  it("sets lastGames[i].gameId to the row's game_id", async () => {
    const result = await computeMatchupScopedProps("NBA", "pts", {
      direction: "over",
      matchup: "LAL-BOS",
      todayDate: today,
    })

    const prop = result.props.find((p) => p.player === "LeBron James")
    expect(prop).toBeDefined()
    expect(prop!.lastGames.length).toBeGreaterThan(0)

    // lastGames is chronological (oldest first); PLAYER_ROWS is newest first.
    // Every entry must carry a game_id UUID present in the source rows.
    const sourceIds = new Set(PLAYER_ROWS.map((r) => r.game_id))
    for (const g of prop!.lastGames) {
      expect(g.gameId).toBeDefined()
      expect(sourceIds.has(g.gameId!)).toBe(true)
      expect(g.gameId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
    }

    // Oldest game first → the row with the smallest game_date.
    expect(prop!.lastGames[0].gameId).toBe(PLAYER_ROWS[PLAYER_ROWS.length - 1].game_id)
  })
})
