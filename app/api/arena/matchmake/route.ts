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

const matchmakeSchema = z.object({
  season: z.enum(AVAILABLE_SEASONS as [string, ...string[]]).default(DEFAULT_CONFIG.season),
  budget: z.union([z.literal(25), z.literal(50), z.literal(100)]).default(25),
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
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
  const openGameId = await dequeueOpenGame(async (id) => {
    const g = await loadGame(id)
    if (!g) return false // expired
    if (g.ownerUserId === user.id) return false // don't match yourself
    if (g.guestUserId) return false // already full
    if (g.state.isAI.P2) return false // not a human game
    if (g.state.status !== "lobby") return false // already started
    return true
  })

  if (openGameId) {
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
      // Flip the waiting creator straight into the auction (they've been sitting
      // on "Finding an opponent…" polling their lobby).
      void broadcastArenaUpdate(openGameId)
      return NextResponse.json(serverView(game.state, "P2", game.rev))
    } catch {
      // The game filled or vanished between the pop and the lock. Fall through
      // and create our own lobby rather than failing the request.
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
  const state = createGame({ gameId, config, vsAI: false })
  state.isAI.P2 = false
  state.status = "lobby"

  await saveGame({ rev: 1, ownerUserId: user.id, guestUserId: null, state })
  await enqueueOpenGame(gameId)

  return NextResponse.json(serverView(state, "P1", 1), { status: 201 })
}, { cacheControl: CACHE_CONTROL.SENSITIVE })
