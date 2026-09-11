import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { withSecurity, CACHE_CONTROL } from "@/lib/security/routeHelpers"
import { loadGame, mutateGame } from "@/lib/nfl/store"
import { serverTick, serverView, seatForUser } from "@/lib/nfl/server"

/**
 * GET /api/nfl/[gameId] — return the current authoritative view, applying the
 * server clock (resolve expired lots, advance AI). Poll while the auction is
 * live. Any participant may read (open-information 1v1); non-owners still need
 * to be authenticated.
 */
export const GET = withSecurity(async (
  _request: Request,
  context?: { params: Promise<{ gameId: string }> }
) => {
  const { gameId } = await context!.params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 })
  }

  const existing = await loadGame(gameId)
  if (!existing) {
    return NextResponse.json({ error: "Game not found." }, { status: 404 })
  }

  const game = await mutateGame(gameId, (g) => {
    serverTick(g.state)
  })

  const viewer = seatForUser(game, user.id) ?? "P1"
  return NextResponse.json(serverView(game.state, viewer, game.rev))
}, { cacheControl: CACHE_CONTROL.SENSITIVE })
