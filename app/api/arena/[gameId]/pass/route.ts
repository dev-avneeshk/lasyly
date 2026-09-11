import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { withSecurity, CACHE_CONTROL } from "@/lib/security/routeHelpers"
import { loadGame, mutateGame } from "@/lib/arena/store"
import { pass } from "@/lib/arena/auction"
import { driveAI, serverView, serverTick, seatForUser } from "@/lib/arena/server"

/**
 * POST /api/arena/[gameId]/pass — the human passes on the current lot. If the
 * other side is leading, the lot resolves; AI then reacts to the next lot.
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

  const seat = seatForUser(existing, user.id)
  if (!seat || existing.state.isAI[seat]) {
    return NextResponse.json({ error: "You don't control a seat in this game." }, { status: 403 })
  }

  const game = await mutateGame(gameId, (g) => {
    serverTick(g.state)
    pass(g.state, seat)
    driveAI(g.state)
    serverTick(g.state)
  })

  return NextResponse.json(serverView(game.state, seat, game.rev))
}, { cacheControl: CACHE_CONTROL.SENSITIVE })
