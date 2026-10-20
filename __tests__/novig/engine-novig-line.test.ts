/**
 * engine-v2 uses the stored Novig main line as propLine when one exists for
 * the player/stat, so the hit rate, graph overLine flags and direction are all
 * computed against it. Players without one keep computePropLine's L10 average.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"

const today = new Date().toISOString().slice(0, 10)

function daysAgo(days: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

// Two LAL players, 8 recent games each: 30 pts in 7 games, 10 in one, so the
// L10-average line is 27.5 and the over hit rate is 7/8.
const playerRows = (name: string) =>
  Array.from({ length: 8 }, (_, i) => ({
    id: `${name}-${i}`,
    player_name: name,
    team: "LAL",
    opponent: "BOS",
    position: "SF",
    minutes: "34:00",
    game_id: `0000000${i}-0000-4000-8000-000000000000`,
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
    nba_games: { game_date: daysAgo(i + 1), home_team: "Los Angeles Lakers", away_team: "Boston Celtics" },
  }))

const PLAYER_ROWS = [...playerRows("LeBron James"), ...playerRows("Luka Dončić")]

const st = vi.hoisted(() => ({
  novigRows: [] as unknown[],
  novigError: null as { message: string } | null,
  novigDates: [] as unknown[],
}))

vi.mock("@/lib/cache", () => ({
  cached: async (_key: string, fn: () => unknown) => fn(),
  invalidateCache: async () => {},
  invalidateCachePrefix: async () => {},
  CACHE_TTL: {},
}))

vi.mock("@/lib/supabase/paged", () => ({
  fetchPagedParallel: async (_count: unknown, page: (from: number, to: number) => Promise<unknown[]>) =>
    page(0, PLAYER_ROWS.length),
}))

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
        eq: (col: string, v: unknown) => {
          if (table === "novig_prop_lines" && col === "game_date") st.novigDates.push(v)
          return c
        },
        or: () => c,
        ilike: () => c,
        order: () => c,
        range: () => c,
        limit: () => c,
        then: (resolve: (v: unknown) => unknown) => {
          if (head) return resolve({ count: PLAYER_ROWS.length, error: null })
          if (table === "nba_games") {
            return resolve({
              data: [{ home_team: "LAL", away_team: "BOS", game_date: today, status: "scheduled" }],
              error: null,
            })
          }
          if (table === "nba_player_stats") return resolve({ data: PLAYER_ROWS, error: null })
          if (table === "novig_prop_lines") {
            return resolve(st.novigError ? { data: null, error: st.novigError } : { data: st.novigRows, error: null })
          }
          return resolve({ data: [], error: null })
        },
      }
      return c
    },
  }),
}))

import { computeMatchupScopedProps } from "@/lib/analytics/engine-v2"

const compute = () =>
  computeMatchupScopedProps("NBA", "pts", { direction: "over", matchup: "LAL-BOS", todayDate: today })

beforeEach(() => {
  st.novigRows = []
  st.novigError = null
  st.novigDates = []
})

describe("engine-v2 prop line source", () => {
  it("uses the stored Novig line, so hit rate, graph and direction follow it", async () => {
    // 31.5 is above every game: 0/8 over, so the direction flips to under.
    st.novigRows = [
      {
        line: 31.5,
        over_price: -110,
        under_price: -110,
        captured_at: "2026-10-20T16:00:05Z",
        stat: "pts",
        novig_player: "LeBron James",
        betroom_player_name: "LeBron James",
      },
    ]
    const { props } = await compute()
    expect(st.novigDates).toEqual([today])

    const lebron = props.find((p) => p.player === "LeBron James")!
    expect(lebron).toMatchObject({
      propLine: 31.5,
      lineSource: "market",
      averageLine: 27.5,
      marketLine: { book: "novig", line: 31.5, overPrice: -110, underPrice: -110, capturedAt: "2026-10-20T16:00:05Z" },
      hitRate: { over: 0, total: 8 },
      direction: "under",
    })
    expect(lebron.graphData.every((g) => g.overLine === false)).toBe(true)

    // No Novig line for Luka: the L10-average line is unchanged.
    const luka = props.find((p) => p.player === "Luka Dončić")!
    expect(luka).toMatchObject({
      propLine: 27.5,
      lineSource: "average",
      averageLine: 27.5,
      marketLine: null,
      hitRate: { over: 7, total: 8 },
      direction: "over",
    })
  })

  it("falls back to the average line when the Novig read fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    st.novigError = { message: "relation \"public.novig_prop_lines\" does not exist" }
    const { props } = await compute()
    expect(props.length).toBe(2)
    for (const p of props) {
      expect(p).toMatchObject({ propLine: 27.5, lineSource: "average", marketLine: null })
    }
    warn.mockRestore()
  })
})
