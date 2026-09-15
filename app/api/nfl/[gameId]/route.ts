import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { withSecurity, CACHE_CONTROL } from "@/lib/security/routeHelpers"
import { checkRateLimit, RATE_LIMITS } from "@/lib/rateLimit"
import { loadGame, mutateGame, needsServerTick } from "@/lib/nfl/store"
import { serverTick, serverView, seatForUser } from "@/lib/nfl/server"

/**
 * GET /api/nfl/[gameId] — the current authoritative view.
 *
 * Read-only unless the server clock actually has work to do. See the arena twin
 * (app/api/arena/[gameId]/route.ts) for the full rationale: calling mutateGame
 * on every poll cost 5 Redis round-trips including a write, and the resulting
 * `rev` churn was what made bids fail with 409 STALE under normal two-player
 * play.
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

  const rate = await checkRateLimit(`nfl-poll:${user.id}`, RATE_LIMITS.arenaPoll)
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Polling too fast." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rate.retryAfterMs / 1000)) } }
    )
  }

  const existing = await loadGame(gameId)
  if (!existing) {
    return NextResponse.json({ error: "Game not found." }, { status: 404 })
  }

  const viewer = seatForUser(existing, user.id) ?? "P1"

  if (!needsServerTick(existing.state)) {
    return NextResponse.json(serverView(existing.state, viewer, existing.rev))
  }

  const { game } = await mutateGame(gameId, (g) => {
    serverTick(g.state)
  })

  return NextResponse.json(serverView(game.state, viewer, game.rev))
}, { cacheControl: CACHE_CONTROL.SENSITIVE })
