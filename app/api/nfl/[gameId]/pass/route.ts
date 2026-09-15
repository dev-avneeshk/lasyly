import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { withSecurity, CACHE_CONTROL } from "@/lib/security/routeHelpers"
import { checkRateLimit, RATE_LIMITS } from "@/lib/rateLimit"
import { loadGame, mutateGame } from "@/lib/nfl/store"
import { pass } from "@/lib/nfl/auction"
import { driveAI, serverView, serverTick, seatForUser } from "@/lib/nfl/server"

/**
 * POST /api/nfl/[gameId]/pass — the human passes on the current lot. May resolve
 * the lot; the AI then reacts and the clock is applied.
 *
 * The `rev` guard is gone, and not only for the churn reason that applies to the
 * bid route. Here it was outright dangerous:
 *
 *     const game = await mutateGame(gameId, (g) => {
 *       if (data.rev !== undefined && data.rev !== g.rev) return   // silent!
 *       ...pass(g.state, seat)
 *     })
 *     return NextResponse.json(serverView(...))                    // 200 OK
 *
 * A stale `rev` made the pass a silent no-op that still returned 200. The player
 * saw their pass accepted, the server never recorded it, and the lot then
 * resolved on the timer as though they were still bidding. Passing is
 * idempotent by construction (`if (!state.passed.includes(team)) push`), so it
 * needs no staleness guard at all.
 */
export const POST = withSecurity(async (
  _request: Request,
  context?: { params: Promise<{ gameId: string }> }
) => {
  const { gameId } = await context!.params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 })

  const rate = await checkRateLimit(`nfl-pass:${user.id}`, RATE_LIMITS.arenaAction)
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

  const { game } = await mutateGame(gameId, (g) => {
    serverTick(g.state)
    pass(g.state, seat)
    driveAI(g.state)
    serverTick(g.state)
  })

  return NextResponse.json(serverView(game.state, seat, game.rev))
}, { cacheControl: CACHE_CONTROL.SENSITIVE })
