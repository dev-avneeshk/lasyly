import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { withSecurity, validateRequestBody, CACHE_CONTROL } from "@/lib/security/routeHelpers"
import { checkRateLimit, RATE_LIMITS } from "@/lib/rateLimit"
import { loadGame, mutateGame } from "@/lib/arena/store"
import { placeBid } from "@/lib/arena/auction"
import { driveAI, serverView, serverTick, seatForUser } from "@/lib/arena/server"
import { broadcastArenaUpdate } from "@/lib/realtime/arena"

const bidSchema = z.object({
  amount: z.number().int().min(1).max(200),
  /**
   * The player the user believes they are bidding on. This is the guard that
   * actually matters (see the note below); `rev` is kept only for telemetry.
   */
  lotPlayerId: z.string().min(1).max(120).optional(),
  rev: z.number().int().optional(),
})

/**
 * POST /api/arena/[gameId]/bid — the human proposes a bid.
 *
 * Fully validated by the pure engine (budget, roster feasibility, over-bid,
 * duplicate, self-outbid). This is the ONLY way ownership and budgets change;
 * the client is never trusted with the outcome.
 *
 * ── Staleness: guard the LOT, not a global counter ──────────────────────────
 * This route used to reject any bid whose `rev` didn't equal the stored `rev`:
 *
 *     if (data.rev !== undefined && data.rev !== g.rev) { bidError = "STALE" }
 *
 * `rev` was incremented by every write, and every read-only poll was a write,
 * so with two players polling at 900ms it advanced about twice a second. The
 * window between the client's last poll and its bid landing is at least one
 * poll interval plus a round-trip, so the check failed far more often than it
 * succeeded — and it got worse as latency rose, i.e. exactly under load.
 * Rejected bids also bumped `rev`, so one player's illegal bid would 409 the
 * other player's legal one, and a retrying client could 409 indefinitely.
 *
 * The hazard a staleness check should actually prevent is narrow and concrete:
 * you click Bid on Curry, the lot resolves mid-flight, and your bid lands on
 * Jokić instead. That is a question about *lot identity*, so we check lot
 * identity. It is immune to poll churn, and it is strictly more precise than
 * `rev` ever was — a matching `rev` never guaranteed the lot hadn't changed.
 *
 * Price movement needs no guard at all: the engine already requires
 * `amount > currentBid`, so a bid computed against a lower price is rejected on
 * its merits with the fresh view attached, and the client re-renders.
 */
export const POST = withSecurity(async (
  request: Request,
  context?: { params: Promise<{ gameId: string }> }
) => {
  const { gameId } = await context!.params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 })

  const rate = await checkRateLimit(`arena-bid:${user.id}`, RATE_LIMITS.arenaBid)
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Bidding too fast." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rate.retryAfterMs / 1000)) } }
    )
  }

  const body = await request.json().catch(() => ({}))
  const [data, err] = validateRequestBody(body, bidSchema)
  if (err) return err

  const existing = await loadGame(gameId)
  if (!existing) return NextResponse.json({ error: "Game not found." }, { status: 404 })

  const seat = seatForUser(existing, user.id)
  if (!seat || existing.state.isAI[seat]) {
    return NextResponse.json({ error: "You don't control a seat in this game." }, { status: 403 })
  }

  let bidError: string | null = null
  let lotChanged = false

  const { game, changed } = await mutateGame(gameId, (g) => {
    // Apply the clock first so we're bidding on the live lot.
    serverTick(g.state)

    // Lot-identity guard: refuse to spend money on a different player than the
    // one the user was looking at.
    if (data.lotPlayerId && g.state.lot?.player.id !== data.lotPlayerId) {
      lotChanged = true
      return
    }

    const res = placeBid(g.state, seat, data.amount)
    if (!res.ok) {
      bidError = res.error ?? "Illegal bid."
      return
    }
    driveAI(g.state)
    serverTick(g.state)
  })

  // Both rejection paths below leave the stored game untouched — the store no
  // longer persists a rev bump for a mutator that changed nothing, so a refused
  // bid can't invalidate the opponent's view.
  if (lotChanged) {
    return NextResponse.json(
      {
        error: "That player is no longer up for auction — here's the current lot.",
        ...serverView(game.state, seat, game.rev),
      },
      { status: 409 }
    )
  }
  if (bidError) {
    // Return the fresh view alongside the error so the client re-syncs.
    return NextResponse.json({ error: bidError, ...serverView(game.state, seat, game.rev) }, { status: 400 })
  }

  // Push the new state to the opponent immediately instead of waiting for their
  // next poll. Only when something actually moved — a no-op mutate broadcasts
  // nothing. Best-effort: the bid already succeeded, so we don't await failures.
  if (changed) void broadcastArenaUpdate(gameId)

  return NextResponse.json(serverView(game.state, seat, game.rev))
}, { cacheControl: CACHE_CONTROL.SENSITIVE })
