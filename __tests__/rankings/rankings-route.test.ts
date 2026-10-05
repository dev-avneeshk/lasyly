import { describe, it, expect, vi } from "vitest"
import { NextRequest } from "next/server"

// L-16: limit/offset reached `.range()` unclamped (NaN, negative) and season /
// mode were unvalidated, each minting a new cache key.
const calls = vi.hoisted(() => [] as Record<string, unknown>[])
vi.mock("@/lib/cache", () => ({ cached: async (_k: string, fn: () => unknown) => fn() }))
vi.mock("@/lib/rankings/nba/read", () => ({
  getNbaRankings: async (p: Record<string, unknown>) => (calls.push(p), { rankings: [] }),
}))

import { GET } from "@/app/api/rankings/route"

const get = (qs: string) => GET(new NextRequest(`http://localhost/api/rankings?${qs}`))

describe("GET /api/rankings params", () => {
  it("clamps limit/offset and coerces mode", async () => {
    expect((await get("limit=abc&offset=-5&mode=evil")).status).toBe(200)
    expect(calls.at(-1)).toMatchObject({ limit: 100, offset: 0, mode: "projected" })
    await get("limit=100000&offset=10")
    expect(calls.at(-1)).toMatchObject({ limit: 200, offset: 10 })
  })

  it("rejects a malformed season; accepts real ones", async () => {
    expect((await get("season=2026-27'%20or%201=1")).status).toBe(400)
    expect((await get("season=2025-26&mode=historical")).status).toBe(200)
    expect(calls.at(-1)).toMatchObject({ season: "2025-26", mode: "historical" })
  })
})
