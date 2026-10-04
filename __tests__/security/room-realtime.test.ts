import { describe, it, expect, vi, beforeEach } from "vitest"

// RT-03: chat/membership broadcasts went out on PUBLIC channels (anyone with
// the anon key could listen or forge). RT-09: a rejected httpSend leaked the
// channel on the memoized admin client. The DB half (who may join) is tested
// by scripts/db/test-room-realtime-auth.sh via db-lockdown.test.ts.
const rt = vi.hoisted(() => ({
  opened: [] as { topic: string; private: boolean }[],
  removed: 0,
  fail: false,
}))
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    channel: (topic: string, opts?: { config?: { private?: boolean } }) => {
      rt.opened.push({ topic, private: opts?.config?.private === true })
      return {
        httpSend: async () => {
          if (rt.fail) throw new Error("realtime down")
          return { success: true }
        },
      }
    },
    removeChannel: async () => void rt.removed++,
  }),
}))

import { broadcastChatMessage } from "@/lib/realtime/chat"
import { broadcastMembersChanged } from "@/lib/realtime/members"

const msg = { id: "m1", content: "hi", is_system: false, created_at: "2026-01-01T00:00:00Z", user_id: "u1" }

beforeEach(() => {
  rt.opened = []
  rt.removed = 0
  rt.fail = false
})

describe("room realtime senders", () => {
  it("send on private topics only", async () => {
    await broadcastChatMessage("sub-1", msg)
    await broadcastMembersChanged("room-1")
    expect(rt.opened).toEqual([
      { topic: "room-sub-sub-1", private: true },
      { topic: "room-members-room-1", private: true },
    ])
  })

  it("always release the channel, even when the send throws", async () => {
    rt.fail = true
    await expect(broadcastChatMessage("sub-1", msg)).resolves.toBeUndefined()
    await expect(broadcastMembersChanged("room-1")).resolves.toBeUndefined()
    expect(rt.removed).toBe(2)
  })
})
