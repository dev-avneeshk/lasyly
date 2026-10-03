import { describe, it, expect, vi, beforeEach } from "vitest"

// L-03: legs settled against games played before the parlay existed (past-
// posting). L-04: unsettleable legs expired to `push` and the parlay to `won`.
// REV-8: nba_player_stats.game_id is a UUID; dates come from nba_games.
// REV-10: a bet placed after tonight's tip-off grades on the next game.
const st = vi.hoisted(() => ({
  legs: [] as Record<string, unknown>[],
  stats: [] as { player_name: string; game_id: string; pts: number; nba_games: { game_date: string; home_team: string } }[],
  tipOffs: [] as { homeTeam: string; startTime: string }[],
  updates: [] as { table: string; values: Record<string, unknown>; filters: unknown[][] }[],
  parlayLegs: [] as Record<string, unknown>[],
  stale: [] as Record<string, unknown>[],
  legReads: 0,
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
          const ids = (filters.find(([op, c]) => op === "in" && c === "id")?.[2] ?? []) as string[]
          return { data: ids.map((id) => ({ id })), error: null }
        }
        const f = Object.fromEntries(filters.map(([op, c, v]) => [`${op}:${c}`, v]))
        if (table === "parlay_legs" && f["eq:result"] === "pending") return { data: st.legs, error: null }
        if (table === "parlay_legs") {
          if ((filters.find(([op]) => op === "select")?.[2] as { head?: boolean })?.head) return { count: st.parlayLegs.length, error: null }
          const range = filters.find(([op]) => op === "range") as [string, number, number] | undefined
          st.legReads++ // PostgREST returns at most 1000 rows per read
          return { data: range ? st.parlayLegs.slice(range[1], range[2] + 1) : st.parlayLegs.slice(0, 1000), error: null }
        }
        if (table === "parlays") return { data: st.stale, error: null }
        if (table === "nba_player_stats") {
          const rows = st.stats
            .filter((r) => r.player_name === f["eq:player_name"] && r.nba_games.game_date >= String(f["gte:nba_games.game_date"]))
            .sort((a, b) => a.nba_games.game_date.localeCompare(b.nba_games.game_date))
          return { data: rows.slice(0, Number(filters.find(([op]) => op === "limit")?.[1])), error: null }
        }
        return { data: [], error: null }
      }
      const chain: Record<string, unknown> = {
        then: (res: (v: unknown) => unknown) => res(run()),
      }
      for (const op of ["select", "eq", "gte", "lt", "in", "order", "limit", "range"]) {
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
// Lakers home games; game_id is the nba_games UUID, not a date slug.
const game = (game_date: string) => ({
  player_name: "LeBron James", game_id: `uuid-${game_date}`, pts: 30,
  nba_games: { game_date, home_team: "Los Angeles Lakers" },
})
const settledLeg = () => st.updates.find((u) => u.table === "parlay_legs" && u.values.result !== "push")

beforeEach(() => {
  st.updates = []
  st.parlayLegs = [{ result: "pending" }]
  st.stale = []
  st.legReads = 0
  st.tipOffs = [{ homeTeam: "Los Angeles Lakers", startTime: "2026-01-16T00:30:00Z" }] // 19:30 ET
})

describe("NBA settlement never uses a game that started before the bet", () => {
  it("only an earlier game exists → leg stays pending (was: settled won on it)", async () => {
    st.legs = [leg("2026-01-16T12:00:00Z")]
    st.stats = [game("2026-01-15")]
    await settleParlayLegs()
    expect(settledLeg()).toBeUndefined()
  })

  it("same-day game that tipped off before the bet, no later game yet → pending", async () => {
    st.legs = [leg("2026-01-16T01:00:00Z")] // 20:00 ET, 30 min after tip-off
    st.stats = [game("2026-01-15")]
    await settleParlayLegs()
    expect(settledLeg()).toBeUndefined()
  })

  it("same-day game that tipped off before the bet → grades on the next game (was: void)", async () => {
    st.legs = [leg("2026-01-16T01:00:00Z")]
    st.stats = [game("2026-01-15"), { ...game("2026-01-17"), pts: 0 }]
    await settleParlayLegs()
    expect(settledLeg()?.values).toEqual({ result: "lost", game_id: "uuid-2026-01-17" })
  })

  // REV-23: a duplicated stats row for tonight's game was taken as "next game".
  it("duplicated row for tonight's started game is not the next game", async () => {
    st.legs = [leg("2026-01-16T01:00:00Z")]
    st.stats = [game("2026-01-15"), game("2026-01-15")]
    await settleParlayLegs()
    expect(settledLeg()).toBeUndefined() // was: settled won on the game already in progress
    st.stats.push({ ...game("2026-01-17"), pts: 0 })
    await settleParlayLegs()
    expect(settledLeg()?.values).toEqual({ result: "lost", game_id: "uuid-2026-01-17" })
  })

  it("same-day game when the tip-off is unknown → pending", async () => {
    st.tipOffs = []
    st.legs = [leg("2026-01-15T17:00:00Z")]
    st.stats = [game("2026-01-15")]
    await settleParlayLegs()
    expect(settledLeg()).toBeUndefined()
  })

  it("same-day game that tipped off after the bet → settles, guarded on pending", async () => {
    st.legs = [leg("2026-01-15T17:00:00Z")] // noon ET
    st.stats = [game("2026-01-13"), game("2026-01-15")]
    await settleParlayLegs()
    const u = settledLeg()
    expect(u?.values).toEqual({ result: "won", game_id: "uuid-2026-01-15" })
    expect(u?.filters).toContainEqual(["eq", "result", "pending"])
  })

  it("next-day game settles without a tip-off lookup", async () => {
    st.tipOffs = []
    st.legs = [leg("2026-01-14T23:00:00Z")]
    st.stats = [game("2026-01-15")]
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

// L-05: expiry read each stale parlay's legs and wrote its outcome one by one.
describe("stale parlay expiry is batched", () => {
  it("one leg read, one push update and one update per outcome for many parlays", async () => {
    st.legs = []
    st.stale = [{ id: "p1" }, { id: "p2" }, { id: "p3" }, { id: "p4" }]
    st.parlayLegs = [
      { id: "a", parlay_id: "p1", result: "won" },
      { id: "b", parlay_id: "p2", result: "pending" },
      { id: "c", parlay_id: "p3", result: "lost" },
      { id: "d", parlay_id: "p4", result: "pending" },
    ]
    const res = await settleParlayLegs()
    expect(res.parlaysExpired).toBe(4)
    expect(st.legReads).toBe(1) // was 4
    const pushes = st.updates.filter((u) => u.table === "parlay_legs")
    expect(pushes).toHaveLength(1)
    expect(pushes[0].filters).toContainEqual(["in", "id", ["b", "d"]])
    const finishes = st.updates.filter((u) => u.table === "parlays").map((u) => u.values.status)
    expect(finishes).toEqual(["won", "lost", "void"]) // was 4 updates
  })
})

// REV-37: legs were read 100 parlays per unpaged .in(); past 1000 rows the
// rest of the chunk was dropped, so a legacy parlay's `lost` leg went missing.
describe("expiry reads every leg past the 1000-row cap", () => {
  it("a lost leg at row 1001 still resolves its parlay lost (was: won)", async () => {
    st.legs = []
    st.stale = Array.from({ length: 100 }, (_, i) => ({ id: `p${i}` }))
    st.parlayLegs = st.stale.flatMap(({ id }, i) =>
      Array.from({ length: i === 99 ? 11 : 10 }, (_, j) => ({ id: `${id}-${j}`, parlay_id: id, result: i === 99 && j === 10 ? "lost" : "won" })))
    await settleParlayLegs()
    const lost = st.updates.find((u) => u.table === "parlays" && u.values.status === "lost")
    expect(lost?.filters).toContainEqual(["in", "id", ["p99"]])
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
    expect(easternDay("2026-01-16T03:00:00Z")).toBe("2026-01-15")
    expect(easternDay("2026-07-16T03:59:00Z")).toBe("2026-07-15")
  })
})
