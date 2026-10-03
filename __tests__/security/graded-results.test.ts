import { describe, it, expect, vi, beforeEach } from "vitest"

// L-11: tipster win rate compared "won" with the stored "Won" (always 0) and
// counted Pending in the denominator. L-12: a betslip could be re-graded any
// time (old losses → wins). AUTHZ-9: any user could enqueue generate-ai-writeup.
const st = vi.hoisted(() => ({
  betslip: null as Record<string, unknown> | null,
  updates: [] as { client: string; values: Record<string, unknown>; filters: string[][] }[],
  enqueued: [] as string[],
}))

function chain(resolve: (filters: string[][], values?: Record<string, unknown>) => unknown) {
  const filters: string[][] = []
  let values: Record<string, unknown> | undefined
  const c: Record<string, unknown> = {
    select: () => c,
    update: (v: Record<string, unknown>) => ((values = v), c),
    eq: (k: string, v: string) => (filters.push([k, v]), c),
    in: () => c,
    order: () => c,
    range: () => c,
    maybeSingle: async () => resolve(filters, values),
    then: (r: (v: unknown) => unknown) => r(resolve(filters, values)),
  }
  return c
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) },
    from: () =>
      chain((filters, values) => (values ? update("user", filters, values) : { data: st.betslip, error: null })),
  }),
}))
function update(client: string, filters: string[][], values: Record<string, unknown>) {
  st.updates.push({ client, values, filters })
  const pending = filters.some(([k, v]) => k === "status" && v === st.betslip?.status)
  return { data: pending ? [{ ...st.betslip, ...values }] : [], error: null }
}
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (t: string) =>
      chain((filters, values) => {
        if (values) return update("admin", filters, values)
        if (t === "profiles") return { data: [{ id: "t1", username: "t", account_type: "tipster" }], error: null }
        if (t === "betslips")
          return { data: ["Won", "Won", "Lost", "Pending", "Void"].map((status) => ({ user_id: "t1", status })), error: null }
        return { data: [], error: null }
      }),
  }),
}))
vi.mock("@/lib/cache", async (orig) => ({
  ...(await orig<typeof import("@/lib/cache")>()),
  cached: async (_k: string, fn: () => unknown) => fn(),
}))
vi.mock("@/lib/rateLimit", async (orig) => ({
  ...(await orig<typeof import("@/lib/rateLimit")>()),
  checkRateLimit: async () => ({ allowed: true, retryAfterMs: 0 }),
}))
vi.mock("@/lib/queue", async (orig) => ({
  ...(await orig<typeof import("@/lib/queue")>()),
  enqueueJob: async (type: string) => (st.enqueued.push(type), "job-1"),
}))

import { GET as tipsters } from "@/app/api/tipsters/route"
import { PATCH as gradeBetslip } from "@/app/api/betslips/[betslipId]/status/route"
import { POST as enqueue } from "@/app/api/jobs/enqueue/route"

const json = (url: string, method: string, body: unknown) =>
  new Request(`http://localhost${url}`, {
    method,
    headers: { "content-type": "application/json", origin: "http://localhost:3000" },
    body: JSON.stringify(body),
  })
const grade = (status: string) =>
  gradeBetslip(json("/api/betslips/b1/status", "PATCH", { status }), { params: Promise.resolve({ betslipId: "b1" }) })

beforeEach(() => {
  st.updates = []
  st.enqueued = []
})

describe("tipster win rate (L-11)", () => {
  it("counts stored 'Won' over graded slips only (was: 0%)", async () => {
    const body = await (await tipsters(new Request("http://localhost/api/tipsters"))).json()
    expect(body.tipsters[0]).toMatchObject({ win_rate: 67, total_picks: 5 })
  })
})

describe("betslip grading (L-12)", () => {
  it("grades a Pending slip once, guarded on Pending and owner, via the service role (REV-16)", async () => {
    st.betslip = { id: "b1", user_id: "u1", odds: 2, stake: 10, status: "Pending" }
    const res = await grade("Won")
    expect(res.status).toBe(200)
    expect(st.updates[0]).toMatchObject({ client: "admin", values: { status: "Won", payout: 20 } })
    expect(st.updates[0].filters).toContainEqual(["status", "Pending"])
    expect(st.updates[0].filters).toContainEqual(["user_id", "u1"])
  })

  it("refuses to re-grade a settled slip (was: Lost → Won allowed)", async () => {
    st.betslip = { id: "b1", user_id: "u1", odds: 2, stake: 10, status: "Lost" }
    expect((await grade("Won")).status).toBe(409)
    expect(st.updates).toEqual([])
  })

  it("can't be reset to Pending", async () => {
    st.betslip = { id: "b1", user_id: "u1", odds: 2, stake: 10, status: "Won" }
    expect((await grade("Pending")).status).toBe(400)
  })
})

describe("job enqueue (AUTHZ-9)", () => {
  it("rejects generate-ai-writeup from users; export-bets still works", async () => {
    const denied = await enqueue(json("/api/jobs/enqueue", "POST", { type: "generate-ai-writeup", payload: { propId: "x" } }))
    expect(denied.status).toBe(403)
    const ok = await enqueue(json("/api/jobs/enqueue", "POST", { type: "export-bets" }))
    expect(ok.status).toBe(200)
    expect(st.enqueued).toEqual(["export-bets"])
  })
})
