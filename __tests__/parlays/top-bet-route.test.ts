import { describe, it, expect, vi } from "vitest"

// DB-14: one parlays query per pin (N+1), and the fallback took an unordered
// 100 messages.
const st = vi.hoisted(() => ({ parlayQueries: 0 }))
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: (t: string) => {
      const c: Record<string, unknown> = {}
      for (const op of ["select", "eq", "order", "limit", "not", "in", "maybeSingle"]) c[op] = () => c
      c.then = (r: (v: unknown) => unknown) => {
        if (t === "pinned_messages")
          return r({
            data: ["p9", "p2", "p1"].map((id) => ({ messages: { kind: "betslip", betslip_id: id, profiles: { username: id } } })),
          })
        if (t === "parlays") {
          st.parlayQueries++
          return r({ data: [{ id: "p1" }, { id: "p2" }] }) // p9 no longer exists
        }
        return r({ data: [] })
      }
      return c
    },
  }),
}))

import { GET } from "@/app/api/rooms/[roomId]/top-bet/route"

describe("GET /api/rooms/[roomId]/top-bet", () => {
  it("resolves all pins in one query and returns the newest that exists", async () => {
    const res = await GET(new Request("http://localhost/api/rooms/r1/top-bet"), { params: Promise.resolve({ roomId: "r1" }) })
    expect((await res.json()).bet).toMatchObject({ id: "p2", author: "p2", pinned: true })
    expect(st.parlayQueries).toBe(1)
  })
})
