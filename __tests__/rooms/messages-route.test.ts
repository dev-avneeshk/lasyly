import { describe, it, expect, vi, beforeEach } from "vitest"

// DB-13: the chat hot path awaited each check in turn (GET 4 round trips for a
// public room, POST 5-7 before the insert). Each query here takes one "tick";
// the recorder counts how many ticks the request waited on.
const { OWN_SUB } = vi.hoisted(() => ({ OWN_SUB: "11111111-1111-4111-8111-111111111111" }))
const st = vi.hoisted(() => ({
  ticks: 0,
  inFlight: 0,
  maxInFlight: 0,
  member: true as boolean,
  roomType: "Public",
  muted: false,
  inserted: null as Record<string, unknown> | null,
}))
vi.mock("@/lib/rateLimit", () => ({ checkRateLimitBatch: async () => null, RATE_LIMITS: {} }))
vi.mock("@/lib/realtime/chat", () => ({ broadcastChatMessage: async () => {} }))
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) },
    rpc: async () => ({ data: null }),
    from: (t: string) => {
      let insert: Record<string, unknown> | null = null
      let matched: Record<string, unknown> = {}
      const result = () => {
        if (insert) return { data: { id: "m1", content: insert.content, created_at: "now", profiles: null }, error: null }
        if (t === "rooms") return { data: { id: "r1", type: st.roomType } }
        if (t === "room_members") return { data: st.member ? { id: 1 } : null, error: null }
        if (t === "room_mutes") return { data: st.muted ? { muted_until: "2999-01-01T00:00:00Z" } : null }
        // Only r1's own channel resolves; any other id belongs to another room.
        if (t === "room_subchannels")
          return { data: !matched.id || matched.id === OWN_SUB ? { id: OWN_SUB } : null, error: null }
        if (t === "messages") return { data: [{ id: "m1", content: "hi", created_at: "t", profiles: null, betslip_id: null }], error: null }
        return { data: [] }
      }
      const settle = async () => {
        st.inFlight++
        st.maxInFlight = Math.max(st.maxInFlight, st.inFlight)
        await new Promise((r) => setTimeout(r, 5))
        st.inFlight--
        if (st.inFlight === 0) st.ticks++
        return result()
      }
      const c: Record<string, unknown> = {
        insert: (v: Record<string, unknown>) => ((insert = v), (st.inserted = v), c),
        match: (v: Record<string, unknown>) => ((matched = v), c),
        maybeSingle: settle,
        single: settle,
        then: (r: (v: unknown) => unknown, j: (e: unknown) => unknown) => settle().then(r, j),
      }
      for (const op of ["select", "eq", "gt", "gte", "lt", "in", "order", "limit"]) c[op] = () => c
      return c
    },
  }),
}))

import { GET, POST } from "@/app/api/rooms/[roomId]/messages/route"

const params = { params: Promise.resolve({ roomId: "r1" }) }
const send = (content = "hello there", subchannelId?: string) =>
  POST(
    new Request("http://localhost/api/rooms/r1/messages", { method: "POST", body: JSON.stringify({ content, subchannelId }) }),
    params
  )

beforeEach(() => {
  Object.assign(st, { ticks: 0, inFlight: 0, maxInFlight: 0, member: true, roomType: "Public", muted: false, inserted: null })
})

describe("chat messages route round trips (DB-13)", () => {
  it("POST runs membership, mute and default-channel checks together, then inserts (was 4 serial waits)", async () => {
    const res = await send()
    expect(res.status).toBe(201)
    expect(st.ticks).toBe(2)
    expect(st.maxInFlight).toBe(3)
    expect(st.inserted).toMatchObject({ subchannel_id: "11111111-1111-4111-8111-111111111111", content: "hello there" })
  })
  it("POST still refuses non-members and muted users", async () => {
    st.member = false
    expect((await send()).status).toBe(403)
    st.member = true
    st.muted = true
    expect((await send()).status).toBe(403)
    expect(st.inserted).toBeNull()
  })
  // RA-1: a member of rooms A and B posted to A with B's sub-channel id; the row
  // showed up in B but B's moderators couldn't delete it (room_id = A).
  it("POST refuses another room's sub-channel id and still accepts this room's", async () => {
    const res = await send("hello there", "22222222-2222-4222-8222-222222222222")
    expect(res.status).toBe(400)
    expect(st.inserted).toBeNull()
    expect((await send("hello there", OWN_SUB)).status).toBe(201)
    expect(st.inserted).toMatchObject({ room_id: "r1", subchannel_id: OWN_SUB })
  })
  it("GET on a public room waits 2 round trips (was 3; 4 with betslip cards)", async () => {
    const res = await GET(new Request("http://localhost/api/rooms/r1/messages"), params)
    expect((await res.json()).messages).toHaveLength(1)
    expect(st.ticks).toBe(2)
  })
  // The messages read now runs alongside the room check; a non-member of a
  // private room must still get 403 and none of the rows.
  it("GET on a private room refuses a non-member without returning messages", async () => {
    st.roomType = "Private"
    st.member = false
    const res = await GET(new Request("http://localhost/api/rooms/r1/messages"), params)
    expect(res.status).toBe(403)
    expect(await res.json()).not.toHaveProperty("messages")
    st.member = true
    expect((await (await GET(new Request("http://localhost/api/rooms/r1/messages"), params)).json()).messages).toHaveLength(1)
  })
})
