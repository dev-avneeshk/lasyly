import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { withSecurity, CACHE_CONTROL } from "@/lib/security/routeHelpers"
import { checkRateLimit, RATE_LIMITS } from "@/lib/rateLimit"
import { loadGame, mutateGame } from "@/lib/nfl/store"
import { openNextLot } from "@/lib/nfl/auction"
import { serverView } from "@/lib/nfl/server"
import type { TeamId } from "@/lib/nfl/types"

/**
 * POST /api/nfl/[gameId]/join — a second human claims seat P2 of a
 * human-vs-human game and kicks off the auction. Idempotent: if the same user
 * is already P1 or P2, it just returns their view.
 *
 * The seat claim is race-safe because guestUserId is re-checked inside the lock.
 * Rate limiting is new: join takes the game lock and accepts any game id, so
 * unbounded it doubled as lock starvation and id enumeration.
 */
export const POST = withSecurity(async (
  _request: Request,
  context?: { params: Promise<{ gameId: string }> }
) => {
  const { gameId } = await context!.params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 })

  const rate = await checkRateLimit(`nfl-join:${user.id}`, RATE_LIMITS.arenaJoin)
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many join attempts. Slow down." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rate.retryAfterMs / 1000)) } }
    )
  }

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

  const { game } = await mutateGame(gameId, (g) => {
    // Authoritative re-check under the lock; the reads above are a fast path.
    if (g.guestUserId && g.guestUserId !== user.id) {
      throw new Error("This game is already full.")
    }
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
