import { describe, it, expect, vi } from "vitest"

// REV-40: the paged betslips read throws on error, and the public profile
// route turned that into a 500, losing the header and follow state.
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: null } }) },
    from: (t: string) => {
      const c: Record<string, unknown> = {}
      for (const op of ["select", "eq", "in", "order", "range"]) c[op] = () => c
      c.maybeSingle = async () => ({ data: { id: "u1", username: "amy" }, error: null })
      c.then = (r: (v: unknown) => unknown) =>
        r(t === "betslips" ? { data: null, count: null, error: { message: "timeout" } } : { count: 3, error: null })
      return c
    },
  }),
}))

import { GET } from "@/app/api/profiles/[identifier]/route"

describe("GET /api/profiles/[identifier]", () => {
  it("a failed betslips read returns the profile with empty stats (was: 500)", async () => {
    const res = await GET(new Request("http://localhost/api/profiles/amy"), { params: Promise.resolve({ identifier: "amy" }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.username).toBe("amy")
    expect(body.follower_count).toBe(3)
    expect(body.stats.total_picks).toBe(0)
  })
})
