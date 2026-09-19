import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { withSecurity, CACHE_CONTROL } from "@/lib/security/routeHelpers"
import { checkRateLimit, RATE_LIMITS } from "@/lib/rateLimit"
import { loadGame, mutateGame } from "@/lib/arena/store"
import { startSimulation, serverView, seatForUser } from "@/lib/arena/server"
import { broadcastArenaUpdate } from "@/lib/realtime/arena"
import { awardCpuReward, settle1v1 } from "@/lib/economy/wallet"
import { XP_REWARDS, stakePayout } from "@/lib/economy/arena"
import type { TeamId } from "@/lib/arena/types"

/**
 * POST /api/arena/[gameId]/simulate — once both rosters are complete (status
 * "lineup"), run the authoritative, seeded simulation and mark the game
 * complete. The result is computed & stored server-side so both participants
 * see the identical outcome.
 */
export const POST = withSecurity(async (
  _request: Request,
  context?: { params: Promise<{ gameId: string }> }
) => {
  const { gameId } = await context!.params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 })

  const rate = await checkRateLimit(`arena-sim:${user.id}`, RATE_LIMITS.arenaAction)
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many actions. Slow down." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rate.retryAfterMs / 1000)) } }
    )
  }

  const existing = await loadGame(gameId)
  if (!existing) return NextResponse.json({ error: "Game not found." }, { status: 404 })

  const seat = seatForUser(existing, user.id) ?? "P1"

  // startSimulation is idempotent: a game already at "complete" produces no
  // change, so the store writes nothing and `rev` stays put. Spamming this
  // endpoint therefore cannot churn state — which is what makes it safe to also
  // re-run the simulation cheaply for a client that lost its response.
  // We settle coins AFTER the mutate, but need to know if this call is the one
  // that first drove the game to "complete" (so settlement runs exactly once)
  // and mark econ.settled inside the lock. The DB RPCs are themselves
  // idempotent per game, so even a lost response can't double-pay.
  let shouldSettle = false
  const { game, changed } = await mutateGame(gameId, (g) => {
    if (g.state.status !== "lineup" && g.state.status !== "complete") {
      throw new Error("Rosters are not complete yet.")
    }
    startSimulation(g.state)
    if (
      g.state.status === "complete" &&
      g.state.econ &&
      !g.state.econ.settled &&
      g.state.result
    ) {
      g.state.econ.settled = true
      shouldSettle = true
    }
  })

  if (shouldSettle) {
    await settleGameEconomy(game)
  }

  // Push the final result to the opponent so both flip to the summary together.
  if (changed) void broadcastArenaUpdate(gameId, serverView(game.state, seat, game.rev))

  return NextResponse.json(serverView(game.state, seat, game.rev))
}, { cacheControl: CACHE_CONTROL.SENSITIVE })

/**
 * Settle the coin economy for a just-completed game. Called exactly once
 * (guarded by econ.settled inside the game lock), and every underlying RPC is
 * itself idempotent per game, so this is safe against retries.
 *
 *   cpu → the human (P1) beat the CPU? pay cpuReward + win XP; else 0 + play XP.
 *   pvp → pay the winning seat's human 2*stake*0.9; both get play XP, winner
 *         gets the extra win XP.
 */
async function settleGameEconomy(game: import("@/lib/arena/store").StoredGame): Promise<void> {
  const { state } = game
  const econ = state.econ
  const result = state.result
  if (!econ || !result) return

  const winner: TeamId = result.winner

  if (econ.mode === "cpu") {
    // Only P1 is human in a CPU game.
    const p1Won = winner === "P1"
    await awardCpuReward({
      userId: game.ownerUserId,
      gameId: state.gameId,
      reward: p1Won ? (econ.cpuReward ?? 0) : 0,
      xp: XP_REWARDS.play + (p1Won ? XP_REWARDS.cpuWin : 0),
    })
    return
  }

  // pvp: map seats to users.
  const winnerUserId = winner === "P1" ? game.ownerUserId : game.guestUserId
  const loserUserId = winner === "P1" ? game.guestUserId : game.ownerUserId
  if (!winnerUserId) return // shouldn't happen for a completed 1v1

  await settle1v1({
    gameId: state.gameId,
    winnerId: winnerUserId,
    loserId: loserUserId ?? null,
    payout: stakePayout(econ.amount),
    winnerXp: XP_REWARDS.play + XP_REWARDS.pvpWin,
    loserXp: XP_REWARDS.play,
  })
}
