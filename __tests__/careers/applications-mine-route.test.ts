import { describe, it, expect, vi, beforeEach } from "vitest"

// GET /api/careers/applications/mine — "has this signed-in account already
// applied in this scope?". Fails open to { applied: false } for signed-out,
// invalid jobId, rate-limit, or DB error so the apply form always renders.

let authUser: { id: string; is_anonymous: boolean } | null = { id: "u1", is_anonymous: false }
let selectResult: { data: Record<string, unknown> | null; error: unknown } = { data: null, error: null }

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: authUser } }) },
  }),
}))
vi.mock("@/lib/rateLimit", async (orig) => ({
  ...(await orig<typeof import("@/lib/rateLimit")>()),
  checkRateLimit: async () => ({ allowed: true, retryAfterMs: 0 }),
}))
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => {
        const chain: Record<string, unknown> = {}
        chain.eq = () => chain
        chain.is = () => chain
        chain.maybeSingle = async () => selectResult
        return chain
      },
    }),
  }),
}))
// Mock the real UUID check so the route's `@/lib/careers/server` import doesn't
// pull in `server-only` (which is a build-time guard, not available in vitest).
vi.mock("@/lib/careers/server", () => ({
  isUuid: (v: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v),
}))

import { GET } from "@/app/api/careers/applications/mine/route"

const JOB_ID = "11111111-1111-4111-8111-111111111111"

const req = (query = "") =>
  new Request(`http://localhost/api/careers/applications/mine${query}`, {
    method: "GET",
    headers: { origin: "http://localhost:3000" },
  })

beforeEach(() => {
  authUser = { id: "u1", is_anonymous: false }
  selectResult = { data: null, error: null }
})

describe("GET /api/careers/applications/mine", () => {
  it("returns { applied: false } when signed out", async () => {
    authUser = null
    const res = await GET(req())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ applied: false })
  })

  it("returns { applied: true, reference } when a matching row exists", async () => {
    selectResult = { data: { reference: "ABCD1234" }, error: null }
    const res = await GET(req(`?jobId=${JOB_ID}`))
    expect(await res.json()).toEqual({ applied: true, reference: "ABCD1234" })
  })

  it("returns { applied: false } when no row exists", async () => {
    const res = await GET(req(`?jobId=${JOB_ID}`))
    expect(await res.json()).toEqual({ applied: false })
  })

  it("returns { applied: false } for an invalid jobId", async () => {
    const res = await GET(req("?jobId=not-a-uuid"))
    expect(await res.json()).toEqual({ applied: false })
  })

  it("treats an absent jobId as the general pool and returns the match", async () => {
    selectResult = { data: { reference: "GEN00001" }, error: null }
    const res = await GET(req())
    expect(await res.json()).toEqual({ applied: true, reference: "GEN00001" })
  })
})
