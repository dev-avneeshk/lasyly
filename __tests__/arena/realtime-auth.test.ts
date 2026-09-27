/**
 * Arena live updates: private channels + the legacy nudge.
 *
 * The database side (the RLS policy that decides who may join) is tested
 * against a real Postgres by scripts/db/test-arena-realtime-auth.sh. This file
 * covers the app side of the contract:
 *
 *   - pushes carrying the view go ONLY to the private channel;
 *   - until the cutoff, tabs opened before the deploy (subscribed to the old
 *     public `arena-game-<id>` topic) get a BARE nudge there, never the view;
 *   - a seat is registered for the channel before the player is told its name,
 *     and a registration failure never breaks the request.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

type Sent = { topic: string; private: boolean; event: string; payload: Record<string, unknown> }
const rt = vi.hoisted(() => ({
  sent: [] as Sent[],
  rpc: vi.fn(),
}))

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    channel: (topic: string, opts?: { config?: { private?: boolean } }) => ({
      httpSend: async (event: string, payload: Record<string, unknown>) => {
        rt.sent.push({ topic, private: opts?.config?.private === true, event, payload })
        return { success: true }
      },
    }),
    removeChannel: async () => {},
    rpc: rt.rpc,
  }),
}))

import {
  arenaChannelName,
  broadcastArenaUpdate,
  legacyArenaChannelName,
  registerArenaChannelMember,
  LEGACY_NUDGE_UNTIL,
  ARENA_UPDATE_EVENT,
} from "@/lib/realtime/arena"
import { createGame } from "@/lib/arena/auction"
import { serverView } from "@/lib/arena/server"
import { DEFAULT_CONFIG } from "@/lib/arena/types"

const SECRET = "s".repeat(40)
let savedSecret: string | undefined

beforeEach(() => {
  savedSecret = process.env.ARENA_CHANNEL_SECRET
  process.env.ARENA_CHANNEL_SECRET = SECRET
  rt.sent.length = 0
  rt.rpc.mockReset()
})
afterEach(() => {
  if (savedSecret === undefined) delete process.env.ARENA_CHANNEL_SECRET
  else process.env.ARENA_CHANNEL_SECRET = savedSecret
})

function view(gameId: string) {
  return serverView(createGame({ gameId, config: { ...DEFAULT_CONFIG }, vsAI: false, seed: 1 }), "P1", 3)
}

describe("broadcastArenaUpdate", () => {
  const BEFORE = LEGACY_NUDGE_UNTIL - 1
  const AFTER = LEGACY_NUDGE_UNTIL

  it("sends the full view on the PRIVATE channel only", async () => {
    await broadcastArenaUpdate("g1", view("g1"), AFTER)

    expect(rt.sent).toHaveLength(1)
    const [msg] = rt.sent
    expect(msg.topic).toBe(arenaChannelName("g1"))
    expect(msg.private).toBe(true)
    expect(msg.event).toBe(ARENA_UPDATE_EVENT)
    expect(msg.payload.view).toMatchObject({ gameId: "g1", rev: 3 })
  })

  it("before the cutoff, also nudges the old public topic — with no game data", async () => {
    await broadcastArenaUpdate("g2", view("g2"), BEFORE)

    const legacy = rt.sent.filter((m) => m.topic === legacyArenaChannelName("g2"))
    expect(legacy).toHaveLength(1)
    expect(legacy[0].private).toBe(false)
    // Exactly the bare nudge: old clients answer it with an authorized GET.
    expect(legacy[0].payload).toEqual({ gameId: "g2" })

    // Nothing but the private channel ever carries the view.
    for (const m of rt.sent.filter((m) => "view" in m.payload)) expect(m.private).toBe(true)
  })

  it("stops the legacy nudge at the cutoff", async () => {
    await broadcastArenaUpdate("g3", view("g3"), AFTER)
    expect(rt.sent.some((m) => m.topic === legacyArenaChannelName("g3"))).toBe(false)
  })

  it("the legacy cutoff is a real, near-future date", () => {
    expect(Number.isFinite(LEGACY_NUDGE_UNTIL)).toBe(true)
    // Guard against someone "extending" it indefinitely.
    expect(LEGACY_NUDGE_UNTIL).toBeLessThan(Date.parse("2027-01-01T00:00:00Z"))
  })

  it("sends nothing at all when realtime is off (no secret)", async () => {
    delete process.env.ARENA_CHANNEL_SECRET
    const savedService = process.env.SUPABASE_SERVICE_ROLE_KEY
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    try {
      await broadcastArenaUpdate("g4", view("g4"), BEFORE)
      expect(rt.sent).toHaveLength(0)
    } finally {
      if (savedService !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = savedService
    }
  })
})

describe("registerArenaChannelMember", () => {
  it("records the seat against the game's channel topic", async () => {
    rt.rpc.mockResolvedValue({ data: "completed", error: null })

    expect(await registerArenaChannelMember("g5", "user-1", "P2")).toBe(true)
    expect(rt.rpc).toHaveBeenCalledWith("register_arena_channel_member", {
      p_topic: arenaChannelName("g5"),
      p_game_id: "g5",
      p_user_id: "user-1",
      p_seat: "P2",
    })
  })

  it.each([
    ["an RPC error", { data: null, error: { message: "boom" } }],
    ["a non-completed result", { data: "no_user", error: null }],
  ])("returns false on %s instead of throwing", async (_label, result) => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {})
    rt.rpc.mockResolvedValue(result)
    await expect(registerArenaChannelMember("g6", "user-1", "P1")).resolves.toBe(false)
    log.mockRestore()
  })

  it("returns false if the call itself rejects", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {})
    rt.rpc.mockRejectedValue(new Error("network"))
    await expect(registerArenaChannelMember("g7", "user-1", "P1")).resolves.toBe(false)
    log.mockRestore()
  })

  it("does nothing when realtime is off", async () => {
    delete process.env.ARENA_CHANNEL_SECRET
    const savedService = process.env.SUPABASE_SERVICE_ROLE_KEY
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    try {
      expect(await registerArenaChannelMember("g8", "user-1", "P1")).toBe(false)
      expect(rt.rpc).not.toHaveBeenCalled()
    } finally {
      if (savedService !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = savedService
    }
  })
})
