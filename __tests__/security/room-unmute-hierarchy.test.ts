import { describe, it, expect, vi, beforeEach } from "vitest"

// REV-24: unmute (DELETE) only checked that the caller was owner/moderator, so
// a moderator the owner muted could unmute themselves or a fellow moderator.
const st = vi.hoisted(() => ({
  me: "11111111-1111-4111-8111-111111111111",
  roles: {} as Record<string, string>,
  deleted: [] as string[],
}))
vi.mock("@/lib/rateLimit", () => ({ rateLimited: async () => null, RATE_LIMITS: {} }))
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: st.me } } }) },
    from: () => {
      let uid = ""
      const c: Record<string, unknown> = {
        select: () => c,
        eq: (k: string, v: string) => ((k === "user_id" ? (uid = v) : 0), c),
        maybeSingle: async () => ({ data: st.roles[uid] ? { role: st.roles[uid] } : null }),
      }
      return c
    },
  }),
}))
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => {
      const c: Record<string, unknown> = {
        delete: () => c,
        eq: (k: string, v: string) => ((k === "user_id" ? st.deleted.push(v) : 0), c),
        then: (r: (v: unknown) => unknown) => r({ error: null }),
      }
      return c
    },
  }),
}))

import { DELETE } from "@/app/api/rooms/[roomId]/members/mute/route"

const MOD2 = "22222222-2222-4222-8222-222222222222"
const MEMBER = "33333333-3333-4333-8333-333333333333"
const unmute = (user_id: string) =>
  DELETE(new Request("http://localhost/api/rooms/r1/members/mute", { method: "DELETE", body: JSON.stringify({ user_id }) }), {
    params: Promise.resolve({ roomId: "r1" }),
  })

beforeEach(() => {
  st.deleted = []
  st.roles = { [st.me]: "moderator", [MOD2]: "moderator", [MEMBER]: "member" }
})

describe("DELETE /api/rooms/[roomId]/members/mute", () => {
  it("a moderator cannot unmute themselves or another moderator (was: 200)", async () => {
    expect((await unmute(st.me)).status).toBe(403)
    expect((await unmute(MOD2)).status).toBe(403)
    expect(st.deleted).toEqual([])
  })
  it("a moderator can unmute a member; the owner can unmute a moderator", async () => {
    expect((await unmute(MEMBER)).status).toBe(200)
    st.roles[st.me] = "owner"
    expect((await unmute(MOD2)).status).toBe(200)
    expect(st.deleted).toEqual([MEMBER, MOD2])
  })
})
