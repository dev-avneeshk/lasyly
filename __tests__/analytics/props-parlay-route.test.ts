import { describe, it, expect, vi } from "vitest"

// DB-15: L10 hit rates came from 20 arbitrary stat rows (no ORDER BY) plus a
// second query to date them, so "last 10 games" could be any 10.
const calls: unknown[][] = []
vi.mock("@/lib/rateLimit", async (orig) => ({
  ...(await orig<typeof import("@/lib/rateLimit")>()),
  rateLimited: async () => null,
}))
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const c: Record<string, unknown> = {}
      for (const m of ["select", "ilike", "order", "limit", "in", "eq"]) c[m] = (...a: unknown[]) => (calls.push([table, m, ...a]), c)
      c.then = (r: (v: unknown) => unknown) =>
        r({
          data:
            table === "nba_player_stats"
              ? [30, 10, 20].map((pts, i) => ({ pts, trb: 0, ast: 0, tp: 0, stl: 0, blk: 0, nba_games: { game_date: `2026-01-0${3 - i}` } }))
              : [],
          error: null,
        })
      return c
    },
  }),
}))

import { POST } from "@/app/api/props/parlay/route"

describe("POST /api/props/parlay", () => {
  it("reads the most recent games in one ordered query", async () => {
    const res = await POST(
      new Request("http://localhost/api/props/parlay", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "http://localhost:3000" },
        body: JSON.stringify({ legs: [{ propId: "lebron-james-pts", direction: "over" }] }),
      })
    )
    expect(res.status).toBe(200)
    expect(calls).toContainEqual(["nba_player_stats", "order", "nba_games(game_date)", { ascending: false }])
    expect(calls.some(([t]) => t === "nba_games")).toBe(false) // was: a second query per leg
  })
})
