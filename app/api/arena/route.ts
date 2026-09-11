import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { withSecurity, validateRequestBody, CACHE_CONTROL } from "@/lib/security/routeHelpers"
import { checkRateLimit, RATE_LIMITS } from "@/lib/rateLimit"
import { createGame, openNextLot } from "@/lib/arena/auction"
import { driveAI, serverView } from "@/lib/arena/server"
import { saveGame } from "@/lib/arena/store"
import { AVAILABLE_SEASONS } from "@/lib/arena/data"
import { DEFAULT_CONFIG, bidIncrementForBudget, bestPersonalityForDifficulty, type ArenaGameConfig } from "@/lib/arena/types"

const createSchema = z.object({
  season: z.enum(AVAILABLE_SEASONS as [string, ...string[]]).default(DEFAULT_CONFIG.season),
  budget: z.union([z.literal(25), z.literal(50), z.literal(100)]).default(25),
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
  /** "ai" = play vs CPU immediately; "human" = open seat P2 for another player. */
  mode: z.enum(["ai", "human"]).default("ai"),
})

/**
 * POST /api/arena — create a new server-authoritative auction game.
 * The creator always occupies seat P1; P2 is AI for the MVP (a real second
 * player would claim P2 via a future join route — the state already supports
 * flipping isAI.P2 to false).
 */
export const POST = withSecurity(async (request: Request) => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "You must be logged in to play." }, { status: 401 })
  }

  const rate = await checkRateLimit(`arena-create:${user.id}`, RATE_LIMITS.roomCreate)
  if (!rate.allowed) {
    return NextResponse.json({ error: "Slow down — too many new games." }, { status: 429 })
  }

  const body = await request.json().catch(() => ({}))
  const [data, err] = validateRequestBody(body, createSchema)
  if (err) return err

  const config: ArenaGameConfig = {
    ...DEFAULT_CONFIG,
    season: data.season,
    budgetPerPlayer: data.budget,
    bidIncrement: bidIncrementForBudget(data.budget),
    difficulty: data.difficulty,
    aiPersonality: bestPersonalityForDifficulty(data.difficulty),
  }

  const gameId = crypto.randomUUID()
  const vsAI = data.mode === "ai"
  const state = createGame({ gameId, config, vsAI })

  if (vsAI) {
    // Start the auction immediately against the CPU.
    openNextLot(state)
    driveAI(state)
  } else {
    // Human vs human: hold in the lobby until P2 joins. Seat P2 is a human.
    state.isAI.P2 = false
    state.status = "lobby"
  }

  await saveGame({ rev: 1, ownerUserId: user.id, guestUserId: null, state })

  return NextResponse.json(serverView(state, "P1", 1), { status: 201 })
}, { cacheControl: CACHE_CONTROL.SENSITIVE })
