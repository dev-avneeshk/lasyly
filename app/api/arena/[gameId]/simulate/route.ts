import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { withSecurity, CACHE_CONTROL } from "@/lib/security/routeHelpers"
import { checkRateLimit, RATE_LIMITS } from "@/lib/rateLimit"
import { loadGame, mutateGame } from "@/lib/arena/store"
import { startSimulation, serverView, seatForUser } from "@/lib/arena/server"

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
  const { game } = await mutateGame(gameId, (g) => {
    if (g.state.status !== "lineup" && g.state.status !== "complete") {
      throw new Error("Rosters are not complete yet.")
    }
    startSimulation(g.state)
  })

  return NextResponse.json(serverView(game.state, seat, game.rev))
}, { cacheControl: CACHE_CONTROL.SENSITIVE })
