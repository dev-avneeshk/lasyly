import { describe, it, expect, vi, beforeEach } from "vitest"
// RT-06: deleting a message never told other viewers, so it stayed on their
// screens until reload.
const st = vi.hoisted(() => ({
  deleted: [] as { id: string }[],
  sent: [] as unknown[][],
}))
vi.mock("@/lib/rateLimit", () => ({ rateLimited: async () => null, RATE_LIMITS: {} }))
vi.mock("@/lib/realtime/chat", () => ({
  broadcastChatMessage: async (...args: unknown[]) => void st.sent.push(args),
}))
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) },
    from: (t: string) => {
      let isDelete = false
      const c: Record<string, unknown> = {
        delete: () => ((isDelete = true), c),
        maybeSingle: async () => ({ data: { id: MSG, user_id: "u1", subchannel_id: "sub1" } }),
        then: (r: (v: unknown) => unknown) =>
          r(t === "messages" && isDelete ? { data: st.deleted, error: null } : { data: null, error: null }),
      }
      for (const op of ["select", "eq"]) c[op] = () => c
      return c
    },
  }),
}))
const MSG = "11111111-1111-4111-8111-111111111111"
import { POST } from "@/app/api/rooms/[roomId]/messages/delete/route"
const del = () =>
  POST(
    new Request("http://localhost/api/rooms/r1/messages/delete", { method: "POST", body: JSON.stringify({ message_id: MSG }) }),
    { params: Promise.resolve({ roomId: "r1" }) }
  )
beforeEach(() => {
  st.deleted = []
  st.sent = []
})
describe("message delete broadcast (RT-06)", () => {
  it("broadcasts message_deleted to the sub-channel after a delete (was: no event)", async () => {
    st.deleted = [{ id: MSG }]
    expect((await del()).status).toBe(200)
    expect(st.sent).toEqual([["sub1", { id: MSG }, "message_deleted"]])
  })
  it("sends nothing when no row was deleted", async () => {
    expect((await del()).status).toBe(200)
    expect(st.sent).toEqual([])
  })
})
