import { describe, it, expect, vi, beforeEach } from "vitest"

// L-02: owners could PATCH `status: "won"` (self-reported leaderboard results).
// DB-04: `.in(names).limit(names.length)` on a per-game stats table rejected
// valid multi-player parlays; the tennis check built an `.or()` filter string.
const st = vi.hoisted(() => ({
  known: new Set<string>(),
  probes: [] as string[][],
  updates: [] as Record<string, unknown>[],
}))

// Chainable query stub: records filters, resolves like PostgREST.
function query(onResolve: (q: { table: string; filters: string[][]; update?: Record<string, unknown> }) => unknown) {
  const q = { table: "", filters: [] as string[][], update: undefined as Record<string, unknown> | undefined }
  const chain: Record<string, unknown> = {
    from: (t: string) => ((q.table = t), chain),
    select: () => chain,
    insert: (rows: unknown) => ((q.update = Array.isArray(rows) ? { rows } : (rows as Record<string, unknown>)), chain),
    update: (u: Record<string, unknown>) => ((q.update = u), chain),
    delete: () => chain,
    eq: (c: string, v: string) => (q.filters.push([c, v]), chain),
    or: (f: string) => (q.filters.push(["or", f]), chain),
    in: (c: string, v: string) => (q.filters.push([c, v]), chain),
    limit: () => chain,
    single: async () => onResolve(q),
    then: (res: (v: unknown) => unknown) => res(onResolve(q)),
  }
  return chain
}

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (t: string) =>
      (query((q) => {
        const [col, name] = q.filters[0] ?? []
        st.probes.push([q.table, col, name])
        return { data: st.known.has(name) ? [{ [col]: name }] : [] }
      }).from as (t: string) => unknown)(t),
  }),
}))
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) },
    from: (t: string) =>
      (query((q) => {
        if (q.update) st.updates.push(q.update)
        if (q.table === "parlay_legs") return { data: [{ leg_order: 1 }], error: null }
        return { data: { id: "p1", ...q.update }, error: null }
      }).from as (t: string) => unknown)(t),
  }),
}))

import { POST } from "@/app/api/parlays/route"
import { PATCH } from "@/app/api/parlays/[id]/route"

const leg = (player_name: string, sport = "NBA") => ({
  player_name, stat_category: "pts", prop_line: 10.5, direction: "over", l10_hit_rate: 60, sport,
})
const post = (legs: unknown[]) =>
  POST(new Request("http://localhost/api/parlays", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://localhost:3000" },
    body: JSON.stringify({ legs, visibility: "private" }),
  }))
const patch = (body: unknown) =>
  PATCH(
    new Request("http://localhost/api/parlays/p1", {
      method: "PATCH",
      headers: { "content-type": "application/json", origin: "http://localhost:3000" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: "p1" }) }
  )

beforeEach(() => {
  st.known = new Set()
  st.probes = []
  st.updates = []
})

describe("POST /api/parlays player validation", () => {
  it("accepts three real NBA players (each probed on its own)", async () => {
    st.known = new Set(["A", "B", "C"])
    const res = await post([leg("A"), leg("B"), leg("C")])
    expect(res.status).toBe(201)
    expect(st.probes).toHaveLength(3)
  })

  it("rejects an unknown player and never builds an .or() filter from names", async () => {
    st.known = new Set(["A"])
    const res = await post([leg("A"), leg("x,id.not.is.null", "Tennis")])
    expect(res.status).toBe(400)
    expect(st.probes.every(([, col]) => col !== "or")).toBe(true)
  })

  it("does not let the client choose a status", async () => {
    st.known = new Set(["A", "B"])
    await post([leg("A"), leg("B")])
    expect(st.updates[0]).not.toHaveProperty("status")
  })
})

describe("PATCH /api/parlays/[id]", () => {
  it("refuses manual status changes", async () => {
    expect((await patch({ status: "won" })).status).toBe(400)
    expect(st.updates).toEqual([])
  })

  it("still changes visibility", async () => {
    const res = await patch({ visibility: "public" })
    expect(res.status).toBe(200)
    expect(st.updates).toEqual([{ visibility: "public" }])
  })
})
