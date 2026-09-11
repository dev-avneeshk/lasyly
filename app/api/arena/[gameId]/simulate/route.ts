import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { withSecurity, CACHE_CONTROL } from "@/lib/security/routeHelpers"
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

  const existing = await loadGame(gameId)
  if (!existing) return NextResponse.json({ error: "Game not found." }, { status: 404 })

  const seat = seatForUser(existing, user.id) ?? "P1"

  const game = await mutateGame(gameId, (g) => {
    if (g.state.status !== "lineup" && g.state.status !== "complete") {
      throw new Error("Rosters are not complete yet.")
    }
    startSimulation(g.state)
  })

  return NextResponse.json(serverView(game.state, seat, game.rev))
}, { cacheControl: CACHE_CONTROL.SENSITIVE })
