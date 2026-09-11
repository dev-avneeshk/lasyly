import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { withSecurity, validateRequestBody, CACHE_CONTROL } from "@/lib/security/routeHelpers"
import { checkRateLimit, RATE_LIMITS } from "@/lib/rateLimit"
import { createGame, openNextLot } from "@/lib/nfl/auction"
import { driveAI, serverView } from "@/lib/nfl/server"
import { saveGame } from "@/lib/nfl/store"
import { AVAILABLE_SEASONS } from "@/lib/nfl/data"
import { DEFAULT_CONFIG, bidIncrementForBudget, type NflGameConfig } from "@/lib/nfl/types"

const createSchema = z.object({
  season: z.enum(AVAILABLE_SEASONS as [string, ...string[]]).default(DEFAULT_CONFIG.season),
  budget: z.union([z.literal(25), z.literal(50), z.literal(100)]).default(25),
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
  /** "ai" = play vs CPU immediately; "human" = open seat P2 for another player. */
  mode: z.enum(["ai", "human"]).default("ai"),
})

/**
 * POST /api/nfl — create a new server-authoritative NFL auction game.
 * The creator always occupies seat P1; P2 is AI by default. A real second
 * player claims P2 via the join route (state already supports isAI.P2 = false).
 */
export const POST = withSecurity(async (request: Request) => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "You must be logged in to play." }, { status: 401 })
  }

  const rate = await checkRateLimit(`nfl-create:${user.id}`, RATE_LIMITS.roomCreate)
  if (!rate.allowed) {
    return NextResponse.json({ error: "Slow down — too many new games." }, { status: 429 })
  }

  const body = await request.json().catch(() => ({}))
  const [data, err] = validateRequestBody(body, createSchema)
  if (err) return err

  const config: NflGameConfig = {
    ...DEFAULT_CONFIG,
    season: data.season,
    budgetPerPlayer: data.budget,
    bidIncrement: bidIncrementForBudget(data.budget),
    difficulty: data.difficulty,
    aiPersonality: "balanced",
  }

  const gameId = crypto.randomUUID()
  const vsAI = data.mode === "ai"
  const state = createGame({ gameId, config, vsAI })

  if (vsAI) {
    openNextLot(state)
    driveAI(state)
  } else {
    state.isAI.P2 = false
    state.status = "lobby"
  }

  await saveGame({ rev: 1, ownerUserId: user.id, guestUserId: null, state })

  return NextResponse.json(serverView(state, "P1", 1), { status: 201 })
}, { cacheControl: CACHE_CONTROL.SENSITIVE })
