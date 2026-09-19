import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { withSecurity, validateRequestBody, CACHE_CONTROL } from "@/lib/security/routeHelpers"
import { checkRateLimit, RATE_LIMITS } from "@/lib/rateLimit"
import { createGame, openNextLot } from "@/lib/arena/auction"
import { serverView } from "@/lib/arena/server"
import { saveGame, loadGame, mutateGame } from "@/lib/arena/store"
import { enqueueOpenGame, dequeueOpenGame, removeOpenGame } from "@/lib/arena/matchmaking"
import { broadcastArenaUpdate } from "@/lib/realtime/arena"
import { AVAILABLE_SEASONS } from "@/lib/arena/data"
import {
  DEFAULT_CONFIG,
  bidIncrementForBudget,
  bestPersonalityForDifficulty,
  type ArenaGameConfig,
} from "@/lib/arena/types"

import { MIN_STAKE } from "@/lib/economy/arena"
import { chargeArenaStake, refundArenaStake } from "@/lib/economy/wallet"

const matchmakeSchema = z.object({
  season: z.enum(AVAILABLE_SEASONS as [string, ...string[]]).default(DEFAULT_CONFIG.season),
  budget: z.union([z.literal(25), z.literal(50), z.literal(100)]).default(25),
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
  /** Stake per player for this public 1v1, in coins. */
  stake: z.number().int().min(MIN_STAKE).default(MIN_STAKE),
})

/**
 * POST /api/arena/matchmake — the "play anyone" (public) 1v1 path.
 *
 * Unlike POST /api/arena (which for a human game always creates a lobby to be
 * shared by link), this tries to pair the caller with a stranger who is already
 * waiting:
 *
 *   1. Pop an open public game off the shared queue. If one exists and is still
 *      joinable, seat the caller as P2 and start the auction — same effect as
 *      following an invite link, but no link changed hands.
 *   2. Otherwise, create a fresh public lobby, register it in the queue, and
 *      return P1's view. The client waits (see the "Finding an opponent" state)
 *      until a later matchmaker pops this id.
 *
 * Matchmaking is deliberately best-effort: a queue miss just means "you're
 * first", never an error.
 */
export const POST = withSecurity(async (request: Request) => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "You must be logged in to play." }, { status: 401 })
  }

  const rate = await checkRateLimit(`arena-matchmake:${user.id}`, RATE_LIMITS.arenaJoin)
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many matchmaking attempts. Slow down." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rate.retryAfterMs / 1000)) } }
    )
  }

  const body = await request.json().catch(() => ({}))
  const [data, err] = validateRequestBody(body, matchmakeSchema)
  if (err) return err

  // ── 1. Try to join a stranger who is already waiting ──────────────────────
  // Only match players who chose the SAME stake — an uneven pot isn't a fair
  // winner-take-all 1v1.
  const openGameId = await dequeueOpenGame(async (id) => {
    const g = await loadGame(id)
    if (!g) return false // expired
    if (g.ownerUserId === user.id) return false // don't match yourself
    if (g.guestUserId) return false // already full
    if (g.state.isAI.P2) return false // not a human game
    if (g.state.status !== "lobby") return false // already started
    if ((g.state.econ?.amount ?? 0) !== data.stake) return false // stake mismatch
    return true
  })

  if (openGameId) {
    // Charge the joiner's stake before claiming the seat; refund if we lose the
    // race for it. Idempotent per (user, game).
    const joinCharge = await chargeArenaStake({
      userId: user.id,
      gameId: openGameId,
      amount: data.stake,
      isPvp: true,
    })
    if (joinCharge === "insufficient_funds") {
      return NextResponse.json(
        { error: `Not enough coins. This match's stake is ${data.stake}.`, code: "INSUFFICIENT_FUNDS" },
        { status: 402 }
      )
    }
    if (joinCharge === "completed" || joinCharge === "duplicate") {
      try {
        const { game } = await mutateGame(openGameId, (g) => {
          // Authoritative re-check under the lock — the dequeue check above is a
          // fast path, this is the one that actually decides the seat.
          if (g.guestUserId && g.guestUserId !== user.id) {
            throw new Error("already-full")
          }
          g.guestUserId = user.id
          g.state.isAI.P2 = false
          if (g.state.status === "lobby") {
            g.state.status = "auction"
            openNextLot(g.state)
          }
        })
        // Make sure a claimed game never lingers in the queue.
        await removeOpenGame(openGameId)
        // Flip the waiting creator straight into the auction (they've been
        // sitting on "Finding an opponent…" polling their lobby). Ship the view
        // so they transition in one hop.
        void broadcastArenaUpdate(openGameId, serverView(game.state, "P2", game.rev))
        return NextResponse.json(serverView(game.state, "P2", game.rev))
      } catch {
        // The game filled or vanished between the pop and the lock. Refund the
        // stake we just charged and fall through to create our own lobby.
        await refundArenaStake({ userId: user.id, gameId: openGameId })
        await removeOpenGame(openGameId)
      }
    } else {
      // Charge failed for a non-funds reason; don't strand the popped game.
      await removeOpenGame(openGameId)
    }
  }

  // ── 2. Nobody waiting → open a public lobby and get in the queue ──────────
  const config: ArenaGameConfig = {
    ...DEFAULT_CONFIG,
    season: data.season,
    budgetPerPlayer: data.budget,
    bidIncrement: bidIncrementForBudget(data.budget),
    difficulty: data.difficulty,
    aiPersonality: bestPersonalityForDifficulty(data.difficulty),
  }

  const gameId = crypto.randomUUID()

  // Charge the creator's stake before the lobby exists.
  const charge = await chargeArenaStake({
    userId: user.id,
    gameId,
    amount: data.stake,
    isPvp: true,
  })
  if (charge === "insufficient_funds") {
    return NextResponse.json(
      { error: `Not enough coins. You need ${data.stake} to play.`, code: "INSUFFICIENT_FUNDS" },
      { status: 402 }
    )
  }
  if (charge !== "completed" && charge !== "duplicate") {
    return NextResponse.json({ error: "Couldn't process the stake." }, { status: 500 })
  }

  const state = createGame({ gameId, config, vsAI: false })
  state.isAI.P2 = false
  state.status = "lobby"
  state.econ = { mode: "pvp", amount: data.stake, settled: false }

  await saveGame({ rev: 1, ownerUserId: user.id, guestUserId: null, state })
  await enqueueOpenGame(gameId)

  return NextResponse.json(serverView(state, "P1", 1), { status: 201 })
}, { cacheControl: CACHE_CONTROL.SENSITIVE })
