import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { withSecurity, CACHE_CONTROL } from "@/lib/security/routeHelpers"
import { checkRateLimit, RATE_LIMITS } from "@/lib/rateLimit"
import { loadGame, mutateGame } from "@/lib/arena/store"
import { openNextLot } from "@/lib/arena/auction"
import { serverView } from "@/lib/arena/server"
import { broadcastArenaUpdate, participantView, registerArenaChannelMember } from "@/lib/realtime/arena"
import { afterResponse } from "@/lib/background"
import { chargeArenaStake, refundArenaStake } from "@/lib/economy/wallet"
import { untrackLobby } from "@/lib/arena/matchmaking"
import type { TeamId } from "@/lib/arena/types"

/**
 * POST /api/arena/[gameId]/join — a second human claims seat P2 of a
 * human-vs-human game and kicks off the auction. Idempotent: if the same user
 * is already P1 or P2, it just returns their view.
 *
 * The seat claim itself was already race-safe — the guestUserId re-check happens
 * *inside* the lock, so two simultaneous joiners cannot both be seated. What was
 * missing is a rate limit: join is unauthenticated-adjacent (any logged-in user
 * can call it for any game id), takes the game lock, and was unbounded, so it
 * doubled as a lock-starvation and id-enumeration tool.
 */
export const POST = withSecurity(async (
  _request: Request,
  context?: { params: Promise<{ gameId: string }> }
) => {
  const { gameId } = await context!.params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 })

  const rate = await checkRateLimit(`arena-join:${user.id}`, RATE_LIMITS.arenaJoin)
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many join attempts. Slow down." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rate.retryAfterMs / 1000)) } }
    )
  }

  const existing = await loadGame(gameId)
  if (!existing) return NextResponse.json({ error: "Game not found." }, { status: 404 })

  // Already in the game?
  // Re-registering the channel seat here is idempotent, and it repairs live
  // updates for a player whose first registration failed (they reload → join).
  if (existing.ownerUserId === user.id) {
    await registerArenaChannelMember(gameId, user.id, "P1")
    return NextResponse.json(participantView(serverView(existing.state, "P1", existing.rev)))
  }
  if (existing.guestUserId === user.id) {
    await registerArenaChannelMember(gameId, user.id, "P2")
    return NextResponse.json(participantView(serverView(existing.state, "P2", existing.rev)))
  }

  // Only human-vs-human games with an open P2 can be joined.
  if (existing.state.isAI.P2) {
    return NextResponse.json({ error: "This is a CPU game and can't be joined." }, { status: 409 })
  }
  if (existing.guestUserId) {
    return NextResponse.json({ error: "This game is already full." }, { status: 409 })
  }

  // ── Coin economy ──────────────────────────────────────────────────────────
  // The joiner must match the creator's stake. Charge BEFORE claiming the seat
  // so a player who can't cover the stake never gets seated (and never blocks
  // the game). The debit is idempotent per (user, game): a retry after a
  // successful charge is a no-op, and if the seat claim below then fails for
  // any reason we refund.
  const stake = existing.state.econ?.amount ?? 0
  if (stake > 0) {
    const charge = await chargeArenaStake({
      userId: user.id,
      gameId,
      amount: stake,
      isPvp: true,
    })
    if (charge === "insufficient_funds") {
      return NextResponse.json(
        { error: `Not enough coins. This game's stake is ${stake}.`, code: "INSUFFICIENT_FUNDS" },
        { status: 402 }
      )
    }
    if (charge !== "completed" && charge !== "duplicate") {
      return NextResponse.json({ error: "Couldn't process the stake." }, { status: 500 })
    }
  }

  let game
  let changed
  try {
    ;({ game, changed } = await mutateGame(gameId, (g) => {
      // Authoritative re-check under the lock: the pre-flight read above is only
      // a fast path for friendly error messages.
      if (g.guestUserId && g.guestUserId !== user.id) {
        throw new Error("This game is already full.")
      }
      g.guestUserId = user.id
      g.state.isAI.P2 = false
      // Start the auction now that both seats are filled.
      if (g.state.status === "lobby") {
        g.state.status = "auction"
        openNextLot(g.state)
      }
    }))
  } catch (e) {
    // The seat wasn't committed (lost the race, the game was swept, or the lock
    // stayed busy) after we already charged the stake: give it back, as the
    // matchmake join does. refund is idempotent per (user, game). Re-read first:
    // a concurrent join by the same user may have seated them on this charge.
    if (stake > 0) {
      const now = await loadGame(gameId).catch(() => undefined)
      if (now !== undefined && now?.guestUserId !== user.id) await refundArenaStake({ userId: user.id, gameId })
    }
    if (e instanceof Error && e.message === "This game is already full.") {
      return NextResponse.json({ error: "This game is already full." }, { status: 409 })
    }
    throw e
  }

  // Flip the waiting creator (P1) straight into the auction instead of making
  // them wait for their lobby poll to notice the join. Ship the view so their
  // client transitions in one hop.
  const seat: TeamId = "P2"
  if (changed) {
    await untrackLobby(gameId, game.ownerUserId) // joined: no longer the refund sweep's
    afterResponse(() => broadcastArenaUpdate(gameId, serverView(game.state, seat, game.rev)), "arena broadcast")
  }

  // The caller now holds seat P2: allow them on the private channel before
  // handing them its name (Realtime checks the seat when they subscribe).
  await registerArenaChannelMember(gameId, user.id, seat)
  return NextResponse.json(participantView(serverView(game.state, seat, game.rev)))
}, { cacheControl: CACHE_CONTROL.SENSITIVE })
