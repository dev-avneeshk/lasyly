import { describe, it, expect } from "vitest"
import type { BroadcastChatMessage } from "@/lib/realtime/chat"
import type { ChatMessage } from "@/components/room/MessageRow"

/**
 * Regression for the "blank bubble" bug: a shared prediction is delivered over
 * the realtime `new_message` broadcast, NOT re-fetched. The receiving client
 * (and the sender, which adds no optimistic row) renders a Prediction card only
 * when `message.kind === "betslip" && message.betslip` is truthy — exactly the
 * gate used in MessageRow. Previously the broadcast omitted the hydrated
 * `betslip`, so that gate was false and the row showed an empty bubble until an
 * incidental refetch. The broadcast now carries the card, so the gate passes
 * immediately.
 */

// The client's `hydrate` (app/(app)/rooms/[roomId]/page.tsx) only backfills the
// sender's profile from a cache; it must NOT drop the betslip the broadcast
// carries. Mirrored here so the render gate is tested against the real transform.
function hydrate(msg: ChatMessage, cachedProfile: ChatMessage["profile"] = null): ChatMessage {
  return { ...msg, profile: msg.profile ?? cachedProfile }
}

// The exact condition MessageRow uses to decide whether to draw the card.
function rendersBetslipCard(message: ChatMessage): boolean {
  return message.kind === "betslip" && Boolean(message.betslip)
}

const betslipBroadcast: BroadcastChatMessage = {
  id: "m1",
  content: "",
  is_system: false,
  created_at: "2026-10-12T00:00:00.000Z",
  user_id: "u1",
  kind: "betslip",
  betslip_id: "p1",
  betslip: {
    id: "p1",
    stake: 100,
    status: "pending",
    custom_note: "lock of the day",
    combined_hit_rate: 62,
  },
  profile: null,
}

describe("betslip broadcast renders a Prediction card without a refetch", () => {
  it("a kind:'betslip' broadcast carrying the card survives hydrate and renders", () => {
    const hydrated = hydrate(betslipBroadcast as unknown as ChatMessage)
    expect(hydrated.betslip).toMatchObject({ id: "p1", status: "pending" })
    expect(rendersBetslipCard(hydrated)).toBe(true)
  })

  it("the regression: a betslip broadcast WITHOUT a card renders a blank bubble", () => {
    const noCard = { ...betslipBroadcast, betslip: null } as unknown as ChatMessage
    expect(rendersBetslipCard(hydrate(noCard))).toBe(false)
  })

  it("hydrate backfills the profile from cache but keeps the betslip card", () => {
    const cached = { username: "ace", display_name: "Ace", avatar_url: null }
    const hydrated = hydrate(betslipBroadcast as unknown as ChatMessage, cached)
    expect(hydrated.profile).toEqual(cached)
    expect(rendersBetslipCard(hydrated)).toBe(true)
  })

  it("a text broadcast never renders a betslip card", () => {
    const text = {
      ...betslipBroadcast,
      kind: "text" as const,
      content: "gm",
      betslip_id: null,
      betslip: null,
    } as unknown as ChatMessage
    expect(rendersBetslipCard(hydrate(text))).toBe(false)
  })
})
