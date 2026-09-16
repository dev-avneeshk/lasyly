import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { withSecurity, CACHE_CONTROL } from "@/lib/security/routeHelpers"
import { checkRateLimit, RATE_LIMITS } from "@/lib/rateLimit"
import { loadGame, mutateGame } from "@/lib/arena/store"
import { pass } from "@/lib/arena/auction"
import { driveAI, serverView, serverTick, seatForUser } from "@/lib/arena/server"
import { broadcastArenaUpdate } from "@/lib/realtime/arena"

/**
 * POST /api/arena/[gameId]/pass — the human passes on the current lot. If the
 * other side is leading, the lot resolves; AI then reacts to the next lot.
 *
 * Rate limited (it wasn't — the NFL twin was, the arena one wasn't, which is the
 * kind of drift that duplicated route files produce). Passing takes the game
 * lock, so an unthrottled pass loop was a cheap way to starve a game's lock and
 * make the opponent's actions fail.
 */
export const POST = withSecurity(async (
  _request: Request,
  context?: { params: Promise<{ gameId: string }> }
) => {
  const { gameId } = await context!.params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 })

  const rate = await checkRateLimit(`arena-pass:${user.id}`, RATE_LIMITS.arenaAction)
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many actions. Slow down." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rate.retryAfterMs / 1000)) } }
    )
  }

  const existing = await loadGame(gameId)
  if (!existing) return NextResponse.json({ error: "Game not found." }, { status: 404 })

  const seat = seatForUser(existing, user.id)
  if (!seat || existing.state.isAI[seat]) {
    return NextResponse.json({ error: "You don't control a seat in this game." }, { status: 403 })
  }

  const { game, changed } = await mutateGame(gameId, (g) => {
    serverTick(g.state)
    pass(g.state, seat)
    driveAI(g.state)
    serverTick(g.state)
  })

  // Push the new lot / resolution to the opponent right away.
  if (changed) void broadcastArenaUpdate(gameId)

  return NextResponse.json(serverView(game.state, seat, game.rev))
}, { cacheControl: CACHE_CONTROL.SENSITIVE })
