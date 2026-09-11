import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { withSecurity, validateRequestBody, CACHE_CONTROL } from "@/lib/security/routeHelpers"
import { checkRateLimit, RATE_LIMITS } from "@/lib/rateLimit"
import { loadGame, mutateGame } from "@/lib/nfl/store"
import { pass } from "@/lib/nfl/auction"
import { driveAI, serverView, serverTick, seatForUser } from "@/lib/nfl/server"

const passSchema = z.object({
  rev: z.number().int().optional(),
})

/**
 * POST /api/nfl/[gameId]/pass — the human passes on the current lot. May resolve
 * the lot; the AI then reacts and the clock is applied.
 */
export const POST = withSecurity(async (
  request: Request,
  context?: { params: Promise<{ gameId: string }> }
) => {
  const { gameId } = await context!.params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 })

  const rate = await checkRateLimit(`nfl-bid:${user.id}`, RATE_LIMITS.arenaBid)
  if (!rate.allowed) return NextResponse.json({ error: "Too many actions." }, { status: 429 })

  const body = await request.json().catch(() => ({}))
  const [data, err] = validateRequestBody(body, passSchema)
  if (err) return err

  const existing = await loadGame(gameId)
  if (!existing) return NextResponse.json({ error: "Game not found." }, { status: 404 })

  const seat = seatForUser(existing, user.id)
  if (!seat || existing.state.isAI[seat]) {
    return NextResponse.json({ error: "You don't control a seat in this game." }, { status: 403 })
  }

  const game = await mutateGame(gameId, (g) => {
    if (data.rev !== undefined && data.rev !== g.rev) return
    serverTick(g.state)
    pass(g.state, seat)
    driveAI(g.state)
    serverTick(g.state)
  })

  return NextResponse.json(serverView(game.state, seat, game.rev))
}, { cacheControl: CACHE_CONTROL.SENSITIVE })
