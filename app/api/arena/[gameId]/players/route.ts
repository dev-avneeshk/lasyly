import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { withSecurity, CACHE_CONTROL } from "@/lib/security/routeHelpers"
import { checkRateLimit, RATE_LIMITS } from "@/lib/rateLimit"
import { loadGame } from "@/lib/arena/store"
import { seatForUser } from "@/lib/arena/server"
import { personaCard } from "@/lib/arena/persona"
import { levelProgress } from "@/lib/economy/arena"
import type { TeamId } from "@/lib/arena/types"

/**
 * GET /api/arena/[gameId]/players — profile cards for both seats of a game, for
 * the 1v1 "VS" header (avatar, username, level, arena W/L). Only the game's own
 * players may call it.
 *
 * Only seats that are humans are returned; the CPU seat is reported as such. A
 * converted lobby's opponent gets a human-shaped card with stable generated
 * stats (lib/arena/persona.ts), answered before any query. No card carries a
 * user id. Arena win/loss is DERIVED from the append-only transactions ledger
 * (no separate stats table needed):
 *   - a 1v1 win = one ARENA_WINNINGS row (only the winner is paid).
 *   - a 1v1 played = one ARENA_STAKE row (every entrant is charged) with no
 *     ARENA_REFUND for the same game: a refunded stake (an abandoned lobby, or
 *     a converted lobby's owner) is no game played.
 *   - a CPU win = one positive-amount ARENA_REWARD row.
 *   - a CPU played = one ARENA_REWARD row (written win or lose).
 *
 * Ledger reads use the service-role admin client because RLS restricts
 * transactions to the owning user (a player must be able to see their
 * OPPONENT's record here). Only public, non-sensitive aggregates are returned —
 * never balances or individual ledger rows.
 */
export const GET = withSecurity(async (
  _request: Request,
  context?: { params: Promise<{ gameId: string }> }
) => {
  const { gameId } = await context!.params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 })

  const rate = await checkRateLimit(`arena-players:${user.id}`, RATE_LIMITS.arenaPoll)
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Polling too fast." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rate.retryAfterMs / 1000)) } }
    )
  }

  const game = await loadGame(gameId)
  // Private to the game's two players, like the game view itself. Same 404 for
  // "no such game" and "not your game" so outsiders can't probe gameIds.
  if (!game || !seatForUser(game, user.id)) {
    return NextResponse.json({ error: "Game not found." }, { status: 404 })
  }

  const admin = createAdminClient()

  // An arrow, not a function declaration, so `game` keeps its non-null narrowing inside.
  const seatCard = async (seat: TeamId, userId: string | null, isAI: boolean) => {
    // A converted lobby's opponent has no profile or ledger rows: a persona card, before any query.
    if (seat === "P2" && game.state.botMatch) return personaCard(game.state.gameId, game.state.seatNames?.P2 ?? "Opponent")
    if (isAI || !userId) {
      return { seat, isAI: true, username: "CPU", display_name: "CPU", avatar_url: null, level: null, record: null }
    }

    const [{ data: profile }, { data: ledger }] = await Promise.all([
      admin
        .from("profiles")
        .select("id, username, display_name, avatar_url, level, xp, is_verified")
        .eq("id", userId)
        .maybeSingle(),
      admin
        .from("transactions")
        .select("type, amount, reference_id")
        .eq("user_id", userId)
        .in("type", ["ARENA_STAKE", "ARENA_WINNINGS", "ARENA_REWARD", "ARENA_REFUND"]),
    ])

    const rows = ledger ?? []
    // reference_id is the game id on every arena row. A refunded stake is no game played.
    const refunded = new Set(rows.filter((r) => r.type === "ARENA_REFUND").map((r) => r.reference_id))
    const pvpPlayed = rows.filter((r) => r.type === "ARENA_STAKE" && !refunded.has(r.reference_id)).length
    const pvpWins = rows.filter((r) => r.type === "ARENA_WINNINGS").length
    const cpuPlayed = rows.filter((r) => r.type === "ARENA_REWARD").length
    const cpuWins = rows.filter((r) => r.type === "ARENA_REWARD" && Number(r.amount) > 0).length

    const wins = pvpWins + cpuWins
    const played = pvpPlayed + cpuPlayed
    const xp = Number(profile?.xp ?? 0)

    return {
      seat,
      isAI: false,
      username: profile?.username ?? null,
      display_name: profile?.display_name ?? profile?.username ?? "Player",
      avatar_url: profile?.avatar_url ?? null,
      is_verified: profile?.is_verified ?? false,
      level: Number(profile?.level ?? levelProgress(xp).level),
      record: { wins, losses: Math.max(0, played - wins), played },
    }
  }

  const [p1, p2] = await Promise.all([
    seatCard("P1", game.ownerUserId, game.state.isAI.P1),
    seatCard("P2", game.guestUserId ?? null, game.state.isAI.P2),
  ])

  return NextResponse.json({ gameId, players: { P1: p1, P2: p2 } })
}, { cacheControl: CACHE_CONTROL.SENSITIVE })
