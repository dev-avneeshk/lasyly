/**
 * Server-side arena game broadcast.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 * A 1v1 auction is server-authoritative: both clients POST their actions and
 * poll GET /api/arena/:id for the resulting view. Polling alone means the
 * opponent doesn't see your bid until their next poll fires — up to 2.5s during
 * a live lot, longer under backoff. That is the "I bid, they see it 5s later"
 * lag.
 *
 * The fix mirrors chat/members (see lib/realtime/chat.ts, members.ts): the
 * SERVER broadcasts in the same request that mutated the game. Clients
 * subscribed to the game's channel receive it in ~100-300ms. Polling stays on
 * as a slow fallback, so a dropped push self-heals rather than stalling.
 *
 * ── Who can listen ──────────────────────────────────────────────────────────
 * Every push carries the full game view, so the channel is PRIVATE (Supabase
 * Realtime Authorization). A client may join only if an RLS policy on
 * realtime.messages says so, and that policy checks the caller holds a seat in
 * public.arena_game_members — rows this module writes when a seat is taken
 * (registerArenaChannelMember). No client may broadcast on it at all; only this
 * server can. See supabase/migrations/20260926_arena_realtime_authorization.sql.
 *
 * Transport: `channel.httpSend()` posts to Realtime's HTTP broadcast endpoint
 * without opening (and leaking) a WebSocket per serverless invocation. See the
 * transport note in lib/realtime/chat.ts for the full reasoning. The admin
 * client authenticates as service_role, which bypasses RLS, so the server can
 * send to private channels.
 */

import { createHmac } from "node:crypto"
import { createAdminClient } from "@/lib/supabase/admin"
import type { ArenaServerView } from "@/lib/arena/server"
import type { TeamId } from "@/lib/arena/types"
import { ARENA_UPDATE_EVENT, type ArenaBroadcast, type ParticipantView } from "./arena-shared"

export { ARENA_UPDATE_EVENT, type ArenaBroadcast, type ParticipantView } from "./arena-shared"

/**
 * ── Channel names ───────────────────────────────────────────────────────────
 * The topic is an HMAC of the gameId under a server secret. Authorization is
 * the RLS policy; the unguessable name is a second layer, so a misconfigured
 * policy or a public channel that happens to share the name still leaks
 * nothing to someone who only has the gameId from an invite link.
 *
 * The key is ARENA_CHANNEL_SECRET, falling back to SUPABASE_SERVICE_ROLE_KEY
 * (safe as an HMAC key — the output doesn't reveal it — and always present
 * where broadcasting works). With neither set there is no channel: nothing is
 * broadcast and clients poll, which is private.
 *
 * The seat table stores this topic, so rotating the secret orphans the seats of
 * games in flight: they lose live updates and poll until they finish.
 */
function channelSecret(): string | null {
  const secret = process.env.ARENA_CHANNEL_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY
  return secret && secret.length >= 32 ? secret : null
}

/**
 * The private realtime topic for a game, or null when no secret is configured.
 * Always starts with `arena-`, which the RLS policy keys on.
 * Server-only: never compute this from client input.
 */
export function arenaChannelName(gameId: string): string | null {
  const secret = channelSecret()
  if (!secret) return null
  const mac = createHmac("sha256", secret).update(`arena-channel:v1:${gameId}`).digest("hex")
  // 128 bits is plenty for an unguessable topic and keeps the name short.
  return `arena-${mac.slice(0, 32)}`
}

/**
 * The view to return to a VERIFIED player of the game (never a broadcast). It
 * is the ordinary view plus the channel name, so the client can subscribe.
 * Only call this after checking the caller's seat.
 */
export function participantView(view: ArenaServerView): ParticipantView {
  return { ...view, channel: arenaChannelName(view.gameId) }
}

/**
 * Grant a user permission to join the game's private channel, by recording
 * their seat where the Realtime RLS policy can see it.
 *
 * MUST be awaited before the response that hands the client its `channel`:
 * Realtime checks permissions when the client joins, so a client that
 * subscribes before its seat row exists is refused for the life of that
 * subscription.
 *
 * Best-effort: returns false (and logs) on failure rather than throwing. The
 * seat itself lives in the game store and is already committed; a failure here
 * only costs this player live updates — their client is refused the channel and
 * keeps polling. It never turns a successful create/join into an error.
 */
export async function registerArenaChannelMember(
  gameId: string,
  userId: string,
  seat: TeamId
): Promise<boolean> {
  const topic = arenaChannelName(gameId)
  if (!topic) return false // realtime off
  try {
    const admin = createAdminClient()
    const { data, error } = await admin.rpc("register_arena_channel_member", {
      p_topic: topic,
      p_game_id: gameId,
      p_user_id: userId,
      p_seat: seat,
    })
    if (error || data !== "completed") {
      console.error("[arena] channel seat registration failed:", error?.message ?? data)
      return false
    }
    return true
  } catch (err) {
    console.error("[arena] channel seat registration failed:", err)
    return false
  }
}

/*
 * ── Why the view rides along in the push ────────────────────────────────────
 * Originally the push carried only `{ gameId }` — a pure "something changed"
 * nudge — and every client answered it with a second authoritative GET. That
 * doubled the perceived latency of a bid: push (~100-300ms) + a full round-trip
 * GET before the opponent's UI moved.
 *
 * The view is the same projection the GET route hands both players (it's an
 * open-information 1v1 auction). `viewer` is the ONLY seat-specific scalar, so
 * each client re-points it at its own seat on receipt. The payload comes from
 * `serverView` over committed, locked state, so the client is rendering what the
 * server decided, exactly as it would from the GET.
 *
 * `view` is optional so the bare-nudge fallback still works: a client that gets
 * a payload without a view falls back to a GET.
 */

/**
 * ── Legacy nudge for tabs opened before this deploy ─────────────────────────
 * Clients built before private channels subscribe to the old PUBLIC topic
 * `arena-game-<gameId>` and never learn the new one, so without this they'd get
 * no live updates until they reload. Until the cutoff below we also send them a
 * BARE nudge there — `{ gameId }`, no view. Old clients answer a bare nudge with
 * a GET, which is authorized, so they stay live without anything private going
 * out on a public channel. What a listener on that topic learns is only that
 * the game changed, and when.
 *
 * Two weeks outlasts any realistic open tab (games expire after 3 hours; an old
 * tab can only still matter if it's sitting on a game in progress). After the
 * cutoff this is a no-op; delete it, and LEGACY_NUDGE_UNTIL, in a later cleanup.
 */
export const LEGACY_NUDGE_UNTIL = Date.parse("2026-10-10T00:00:00Z")

export function legacyArenaChannelName(gameId: string): string {
  return `arena-game-${gameId}`
}

async function send(topic: string, isPrivate: boolean, payload: ArenaBroadcast): Promise<void> {
  try {
    const supabase = createAdminClient()
    const channel = supabase.channel(topic, { config: { private: isPrivate } })
    const res = await channel.httpSend(ARENA_UPDATE_EVENT, payload)
    if (!res.success) {
      console.error("[arena] realtime broadcast failed:", topic.slice(0, 12), res)
    }
    await supabase.removeChannel(channel)
  } catch (err) {
    console.error("[arena] realtime broadcast failed:", err)
  }
}

/**
 * Push a game change to both players (a bid, pass, lot resolution, join, or
 * simulation).
 *
 * Best-effort by design: the state is already committed to the store, so a
 * Realtime hiccup must never turn a successful action into an error. The
 * client's fallback poll covers anything a dropped push misses.
 */
export async function broadcastArenaUpdate(
  gameId: string,
  view?: ArenaServerView,
  now: number = Date.now()
): Promise<void> {
  const topic = arenaChannelName(gameId)
  if (!topic) return // No secret configured → realtime off, clients poll.

  const payload: ArenaBroadcast = { gameId }
  if (view) {
    payload.view = view
    // Only meaningful in development; harmless in production. Lets the client
    // compute server→client transit time for the latency HUD.
    if (process.env.NODE_ENV !== "production") payload.sentAt = now
  }

  const sends = [send(topic, true, payload)]
  if (now < LEGACY_NUDGE_UNTIL) {
    // Bare nudge only. Never put `payload` (with its view) on a public topic.
    sends.push(send(legacyArenaChannelName(gameId), false, { gameId }))
  }
  await Promise.all(sends)
}
