import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { withSecurity, CACHE_CONTROL } from "@/lib/security/routeHelpers"
import { checkRateLimit, RATE_LIMITS } from "@/lib/rateLimit"
import { loadGame, mutateGame, needsServerTick } from "@/lib/arena/store"
import { serverTick, serverView, seatForUser } from "@/lib/arena/server"

/**
 * GET /api/arena/[gameId] — the current authoritative view.
 *
 * ── Why this route is now a read ────────────────────────────────────────────
 * It used to call `mutateGame` unconditionally, which meant every poll took a
 * distributed lock, rewrote the entire game blob and incremented `rev` — five
 * Redis round-trips including a write, to answer a question. With two players
 * polling every 900ms that was ~134 write cycles per minute per game, and,
 * worse, it broke bidding: the bid handler rejected any bid whose `rev` didn't
 * match, so the opponent's polling interval reliably invalidated your bid
 * before it landed (measured: a poll bumps rev 1→2, and a perfectly legal bid
 * then 409s with the lot still unclaimed).
 *
 * The clock only ever has real work in three situations, all captured by
 * `needsServerTick`: no lot is open, the open lot's deadline has passed, or a
 * finished auction never persisted its result. Everything else — AI responses,
 * budgets, ownership — happens inside an explicit action, which locks anyway.
 *
 * So: load once (1 Redis GET). If the clock is idle, return. Only escalate to a
 * locked mutation when time has actually moved the game forward.
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

  const rate = await checkRateLimit(`arena-poll:${user.id}`, RATE_LIMITS.arenaPoll)
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

  const viewer = seatForUser(existing, user.id) ?? "P1" // spectators view as P1

  // Fast path: nothing for the clock to do, so don't take a lock or write.
  if (!needsServerTick(existing.state)) {
    return NextResponse.json(serverView(existing.state, viewer, existing.rev))
  }

  // The clock genuinely needs to advance (lot expired / none open). Serialize so
  // concurrent polls can't double-resolve the same lot. GameBusyError and
  // GameConflictError propagate to withSecurity → 503 (+Retry-After) / 409.
  const { game } = await mutateGame(gameId, (g) => {
    serverTick(g.state)
  })

  return NextResponse.json(serverView(game.state, viewer, game.rev))
}, { cacheControl: CACHE_CONTROL.SENSITIVE })
