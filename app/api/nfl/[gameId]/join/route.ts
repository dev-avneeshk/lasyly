import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { withSecurity, CACHE_CONTROL } from "@/lib/security/routeHelpers"
import { loadGame, mutateGame } from "@/lib/nfl/store"
import { openNextLot } from "@/lib/nfl/auction"
import { serverView } from "@/lib/nfl/server"
import type { TeamId } from "@/lib/nfl/types"

/**
 * POST /api/nfl/[gameId]/join — a second human claims seat P2 of a
 * human-vs-human game and kicks off the auction. Idempotent: if the same user
 * is already P1 or P2, it just returns their view.
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

  if (existing.ownerUserId === user.id) {
    return NextResponse.json(serverView(existing.state, "P1", existing.rev))
  }
  if (existing.guestUserId === user.id) {
    return NextResponse.json(serverView(existing.state, "P2", existing.rev))
  }

  if (existing.state.isAI.P2) {
    return NextResponse.json({ error: "This is a CPU game and can't be joined." }, { status: 409 })
  }
  if (existing.guestUserId) {
    return NextResponse.json({ error: "This game is already full." }, { status: 409 })
  }

  const game = await mutateGame(gameId, (g) => {
    if (g.guestUserId) throw new Error("This game is already full.")
    g.guestUserId = user.id
    g.state.isAI.P2 = false
    if (g.state.status === "lobby") {
      g.state.status = "auction"
      openNextLot(g.state)
    }
  })

  const seat: TeamId = "P2"
  return NextResponse.json(serverView(game.state, seat, game.rev))
}, { cacheControl: CACHE_CONTROL.SENSITIVE })
