import { describe, it, expect, vi, beforeEach } from "vitest"
// DB-21: the job deleted a sport's correlations, then inserted the new set in
// batches with errors ignored, so readers saw an empty or partial table and a
// failed batch lost the data until the next run.
const st = vi.hoisted(() => ({ ops: [] as string[], failUpsert: false }))
const GAMES = Array.from({ length: 12 }, (_, i) => `g${i}`)
const ROWS = ["A", "B"].flatMap((player_name, p) =>
  GAMES.map((game_id, i) => ({ player_name, game_id, pts: i * (p + 1), trb: i % 3, ast: 12 - i, tp: i % 2, stl: i % 4, blk: i % 5 }))
)
vi.mock("@/lib/supabase/paged", () => ({ fetchPagedParallel: async () => ROWS }))
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => {
      const c: Record<string, unknown> = {
        upsert: (rows: unknown[], o: { onConflict: string }) => {
          st.ops.push(`upsert ${rows.length} ${o.onConflict}`)
          return Promise.resolve({ error: st.failUpsert ? { message: "boom" } : null })
        },
        delete: () => (st.ops.push("delete"), c),
        eq: () => c,
        lt: (k: string) => (st.ops.push(`lt ${k}`), Promise.resolve({ error: null })),
      }
      return c
    },
  }),
}))
import { jobHandlers, JOB_TYPES } from "@/lib/queue/handlers"
const run = () => jobHandlers[JOB_TYPES.COMPUTE_CORRELATIONS]({ sports: ["NBA"] })
beforeEach(() => {
  st.ops = []
  st.failUpsert = false
})
describe("correlations job write (DB-21)", () => {
  it("upserts the new set, then drops only rows from older runs", async () => {
    const result = (await run()) as { breakdown: { NBA: number } }
    expect(result.breakdown.NBA).toBeGreaterThan(0)
    expect(st.ops[0]).toMatch(/^upsert \d+ sport,prop_a,prop_b$/)
    expect(st.ops.slice(-2)).toEqual(["delete", "lt computed_at"]) // was: delete first
  })
  it("a failed write throws and keeps the old rows", async () => {
    st.failUpsert = true
    await expect(run()).rejects.toThrow(/write failed/)
    expect(st.ops).not.toContain("delete")
  })
})
