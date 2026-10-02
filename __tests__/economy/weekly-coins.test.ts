import { describe, it, expect, vi, beforeEach } from "vitest"

// L-15: each run restarted at the first page, so once the payout exceeded the
// time budget the same already-paid users were re-walked and the tail of the
// table never got this week's coins.
const st = vi.hoisted(() => ({
  ids: [] as string[],
  paid: new Set<string>(),
  kv: new Map<string, string>(),
  now: 0,
}))

vi.mock("@/lib/security/cronAuth", () => ({ isAuthorizedCron: () => true }))
vi.mock("@/lib/redis", () => ({
  getRedisClient: () => ({
    get: async (k: string) => st.kv.get(k) ?? null,
    set: async (k: string, v: string) => (st.kv.set(k, v), "OK"),
    del: async (k: string) => Number(st.kv.delete(k)),
  }),
}))
vi.mock("@/lib/economy/wallet", () => ({
  grantWeeklyLevelBonus: async ({ userId }: { userId: string }) => {
    st.now += 50 // each grant costs 50 ms of the 45 s budget
    if (st.paid.has(userId)) return "duplicate"
    st.paid.add(userId)
    return "completed"
  },
}))
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => {
      let after = ""
      let limit = Infinity
      let range: [number, number] | null = null
      const c: Record<string, unknown> = {
        select: () => c,
        order: () => c,
        gt: (_k: string, v: string) => ((after = v), c),
        limit: (n: number) => ((limit = n), c),
        range: (a: number, b: number) => ((range = [a, b]), c),
        then: (r: (v: unknown) => unknown) => {
          const rows = st.ids.filter((id) => id > after).map((id) => ({ id, level: 1 }))
          return r({ data: range ? rows.slice(range[0], range[1] + 1) : rows.slice(0, limit), error: null })
        },
      }
      return c
    },
  }),
}))

import { POST } from "@/app/api/cron/weekly-coins/route"

const run = async () => (await POST(new Request("http://localhost/api/cron/weekly-coins", { method: "POST" }))).json()

beforeEach(() => {
  st.ids = Array.from({ length: 1200 }, (_, i) => `u${String(i).padStart(5, "0")}`)
  st.paid.clear()
  st.kv.clear()
  st.now = 0
  vi.spyOn(Date, "now").mockImplementation(() => st.now)
})

describe("weekly coins payout (L-15)", () => {
  it("a run that hits the budget is resumed by the next call and pays everyone once", async () => {
    const first = await run()
    expect(first).toMatchObject({ incomplete: true, granted: 1000 })
    const second = await run()
    expect(second).toMatchObject({ incomplete: false, granted: 200, skipped: 0 }) // was: re-walked the first 1000
    expect(st.paid.size).toBe(1200)
    expect(st.kv.size).toBe(0) // cursor cleared once complete
  })
})
