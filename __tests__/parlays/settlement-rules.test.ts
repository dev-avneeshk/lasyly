import { describe, it, expect, vi, beforeEach } from "vitest"

// L-03: legs settled against games played before the parlay existed (past-
// posting). L-04: unsettleable legs expired to `push` and the parlay to `won`.
const st = vi.hoisted(() => ({
  legs: [] as Record<string, unknown>[],
  stats: [] as Record<string, unknown>[],
  games: [] as Record<string, unknown>[],
  tipOffs: [] as { homeTeam: string; startTime: string }[],
  updates: [] as { table: string; values: Record<string, unknown>; filters: unknown[][] }[],
  parlayLegs: [] as Record<string, unknown>[],
  stale: [] as Record<string, unknown>[],
}))

vi.mock("@/lib/services/espn", () => ({ fetchESPNLeague: async () => st.tipOffs }))
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const filters: unknown[][] = []
      let values: Record<string, unknown> | null = null
      const run = () => {
        if (values) {
          st.updates.push({ table, values, filters })
          return { error: null }
        }
        const f = Object.fromEntries(filters.map(([op, c, v]) => [`${op}:${c}`, v]))
        if (table === "parlay_legs" && f["eq:result"] === "pending") return { data: st.legs, error: null }
        if (table === "parlay_legs") return { data: st.parlayLegs, error: null }
        if (table === "parlays") return { data: st.stale, error: null }
        if (table === "nba_player_stats") {
          const rows = st.stats
            .filter((r) => r.player_name === f["eq:player_name"] && String(r.game_id) >= String(f["gte:game_id"]))
            .sort((a, b) => String(a.game_id).localeCompare(String(b.game_id)))
          return { data: rows.slice(0, 1), error: null }
        }
        if (table === "nba_games") return { data: st.games, error: null }
        return { data: [], error: null }
      }
      const chain: Record<string, unknown> = {
        then: (res: (v: unknown) => unknown) => res(run()),
      }
      for (const op of ["select", "eq", "gte", "lt", "in", "order", "limit"]) {
        chain[op] = (c?: unknown, v?: unknown) => (filters.push([op, c, v]), chain)
      }
      chain.update = (v: Record<string, unknown>) => ((values = v), chain)
      return chain
    },
  }),
}))

import { settleParlayLegs, parlayOutcome, easternDay } from "@/lib/parlays/settlement"

// 2026-01-15 20:00 ET = 2026-01-16T01:00Z. Lakers home game that night.
const leg = (created_at: string) => ({
  id: "leg1", parlay_id: "p1", player_name: "LeBron James", stat_category: "pts",
  prop_line: 0.5, direction: "over", sport: "NBA", result: "pending", parlays: { created_at },
})
const game = (game_id: string) => ({ player_name: "LeBron James", game_id, pts: 30 })
const settledLeg = () => st.updates.find((u) => u.table === "parlay_legs" && u.values.result !== "push")

beforeEach(() => {
  st.updates = []
  st.parlayLegs = [{ result: "pending" }]
  st.stale = []
  st.games = [{ game_url: "202601150LAL", home_team: "Los Angeles Lakers" }]
  st.tipOffs = [{ homeTeam: "Los Angeles Lakers", startTime: "2026-01-16T00:30:00Z" }] // 19:30 ET
})

describe("NBA settlement never uses a game that started before the bet", () => {
  it("only an earlier game exists → leg stays pending (was: settled won on it)", async () => {
    st.legs = [leg("2026-01-16T12:00:00Z")]
    st.stats = [game("202601150LAL")]
    await settleParlayLegs()
    expect(settledLeg()).toBeUndefined()
  })

  it("same-day game that tipped off before the bet → pending", async () => {
    st.legs = [leg("2026-01-16T01:00:00Z")] // 20:00 ET, 30 min after tip-off
    st.stats = [game("202601150LAL")]
    await settleParlayLegs()
    expect(settledLeg()).toBeUndefined()
  })

  it("same-day game when the tip-off is unknown → pending", async () => {
    st.tipOffs = []
    st.legs = [leg("2026-01-15T17:00:00Z")]
    st.stats = [game("202601150LAL")]
    await settleParlayLegs()
    expect(settledLeg()).toBeUndefined()
  })

  it("same-day game that tipped off after the bet → settles, guarded on pending", async () => {
    st.legs = [leg("2026-01-15T17:00:00Z")] // noon ET
    st.stats = [game("202601130LAL"), game("202601150LAL")]
    await settleParlayLegs()
    const u = settledLeg()
    expect(u?.values).toEqual({ result: "won", game_id: "202601150LAL" })
    expect(u?.filters).toContainEqual(["eq", "result", "pending"])
  })

  it("next-day game settles without a tip-off lookup", async () => {
    st.tipOffs = []
    st.legs = [leg("2026-01-14T23:00:00Z")]
    st.stats = [game("202601150LAL")]
    await settleParlayLegs()
    expect(settledLeg()?.values.result).toBe("won")
  })
})

describe("stale parlay expiry", () => {
  it("voids a stale zero-leg parlay even when no legs are pending anywhere (was: pending forever)", async () => {
    st.legs = []
    st.stale = [{ id: "p0" }]
    st.parlayLegs = []
    const res = await settleParlayLegs()
    expect(res.parlaysExpired).toBe(1)
    expect(st.updates).toContainEqual(expect.objectContaining({
      table: "parlays", values: expect.objectContaining({ status: "void" }),
    }))
  })
})

describe("parlayOutcome", () => {
  it.each([
    [["won", "won"], false, "won"],
    [["won", "push"], false, "won"],
    [["push", "push"], false, "void"],
    [["won", "lost"], false, "lost"],
    [["won", "pending"], false, null],
    [["won", "pending"], true, "void"], // was: won (free win from an unsettleable leg)
    [["pending", "pending"], true, "void"],
    [["lost", "pending"], true, "lost"],
  ])("%j expired=%s → %s", (results, expired, expected) => {
    expect(parlayOutcome(results as string[], expired as boolean)).toBe(expected)
  })
})

describe("easternDay", () => {
  it("uses the US Eastern calendar day, not UTC", () => {
    expect(easternDay("2026-01-16T03:00:00Z")).toBe("20260115")
    expect(easternDay("2026-07-16T03:59:00Z")).toBe("20260715")
  })
})
