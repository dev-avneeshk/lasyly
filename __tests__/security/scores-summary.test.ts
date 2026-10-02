import { describe, it, expect, vi, beforeEach } from "vitest"

// DB-03: the summary route served the first stored ESPN snapshot DB-first
// forever (live games froze), matched `LIKE '%id%'` (wrong event), and stored
// live snapshots.
const db = vi.hoisted(() => ({ calls: [] as unknown[][], stored: null as unknown }))
vi.mock("@/lib/cache", () => ({ cached: (_k: string, fn: () => unknown) => fn() }))
vi.mock("@/lib/services/espn", () => ({
  getLeagueSportPath: () => "basketball/nba",
  fetchESPNSummary: async (_p: string, eventId: string) => ({ eventId, headline: "fresh" }),
}))
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    const chain: Record<string, (...a: unknown[]) => unknown> = {}
    for (const m of ["from", "select", "eq", "like", "not", "limit", "update"]) {
      chain[m] = (...a: unknown[]) => (db.calls.push([m, ...a]), chain)
    }
    chain.maybeSingle = async () => ({ data: db.stored })
    chain.then = (res: (v: unknown) => unknown) => res({ error: null })
    return chain
  },
}))

import { GET } from "@/app/api/scores/[eventId]/summary/route"

const call = (eventId: string) =>
  GET(new Request(`http://localhost/api/scores/${eventId}/summary?league=nba`), {
    params: Promise.resolve({ eventId }),
  })

beforeEach(() => {
  db.calls = []
  db.stored = null
})

describe("GET /api/scores/[eventId]/summary", () => {
  it("rejects non-numeric event ids", async () => {
    expect((await call("1%,x")).status).toBe(400)
    expect((await call("abc")).status).toBe(400)
  })

  it("reads only a stored FINAL copy by exact event id", async () => {
    await call("401584721")
    expect(db.calls).toContainEqual(["eq", "event_id", "401584721"])
    expect(db.calls).toContainEqual(["eq", "raw_data->>storedFinal", "true"])
    expect(db.calls.some((c) => c[0] === "like")).toBe(false)
  })

  it("stores the ESPN summary only for finished games", async () => {
    const res = await call("401584721")
    expect((await res.json()).data.headline).toBe("fresh")
    await new Promise((r) => setTimeout(r, 0))
    expect(db.calls).toContainEqual(["eq", "status", "Finished"])
  })
})
