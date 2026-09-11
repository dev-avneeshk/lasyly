import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { withSecurity, validateRequestBody, CACHE_CONTROL } from "@/lib/security/routeHelpers"
import { checkRateLimit, RATE_LIMITS } from "@/lib/rateLimit"
import { loadGame, mutateGame } from "@/lib/arena/store"
import { placeBid } from "@/lib/arena/auction"
import { driveAI, serverView, serverTick, seatForUser } from "@/lib/arena/server"

const bidSchema = z.object({
  amount: z.number().int().min(1).max(200),
  /** Optimistic concurrency guard — reject if the client's view is stale. */
  rev: z.number().int().optional(),
})

/**
 * POST /api/arena/[gameId]/bid — the human proposes a bid. Fully validated by
 * the pure engine (budget, roster feasibility, over-bid, duplicate). On success
 * the AI responds and the clock is applied. This is the ONLY way ownership /
 * budgets change — the client is never trusted with the outcome.
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
  if (!rate.allowed) return NextResponse.json({ error: "Bidding too fast." }, { status: 429 })

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
  const game = await mutateGame(gameId, (g) => {
    // Stale-view guard.
    if (data.rev !== undefined && data.rev !== g.rev) {
      bidError = "STALE"
      return
    }
    // Apply clock first so we're bidding on the live lot.
    serverTick(g.state)
    if (bidError) return
    const res = placeBid(g.state, seat, data.amount)
    if (!res.ok) {
      bidError = res.error ?? "Illegal bid."
      return
    }
    driveAI(g.state)
    serverTick(g.state)
  })

  if (bidError === "STALE") {
    return NextResponse.json(
      { error: "Your view was out of date — refresh and retry.", ...serverView(game.state, seat, game.rev) },
      { status: 409 }
    )
  }
  if (bidError) {
    // Return the fresh view alongside the error so the client re-syncs.
    return NextResponse.json({ error: bidError, ...serverView(game.state, seat, game.rev) }, { status: 400 })
  }

  return NextResponse.json(serverView(game.state, seat, game.rev))
}, { cacheControl: CACHE_CONTROL.SENSITIVE })
