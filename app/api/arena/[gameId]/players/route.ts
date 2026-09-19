import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { withSecurity, CACHE_CONTROL } from "@/lib/security/routeHelpers"
import { checkRateLimit, RATE_LIMITS } from "@/lib/rateLimit"
import { loadGame } from "@/lib/arena/store"
import { levelProgress } from "@/lib/economy/arena"
import type { TeamId } from "@/lib/arena/types"

/**
 * GET /api/arena/[gameId]/players — public profile cards for both seats of a
 * game, for the 1v1 "VS" header (avatar, username, level, arena W/L).
 *
 * Only seats that are humans are returned; the CPU seat is reported as such.
 * Arena win/loss is DERIVED from the append-only transactions ledger (no
 * separate stats table needed):
 *   - a 1v1 win = one ARENA_WINNINGS row (only the winner is paid).
 *   - a 1v1 played = one ARENA_STAKE row (every entrant is charged).
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
  if (!game) return NextResponse.json({ error: "Game not found." }, { status: 404 })

  const admin = createAdminClient()

  async function seatCard(seat: TeamId, userId: string | null, isAI: boolean) {
    if (isAI || !userId) {
      return { seat, isAI: true, userId: null, username: "CPU", display_name: "CPU", avatar_url: null, level: null, record: null }
    }

    const [{ data: profile }, { data: ledger }] = await Promise.all([
      admin
        .from("profiles")
        .select("id, username, display_name, avatar_url, level, xp, is_verified")
        .eq("id", userId)
        .maybeSingle(),
      admin
        .from("transactions")
        .select("type, amount")
        .eq("user_id", userId)
        .in("type", ["ARENA_STAKE", "ARENA_WINNINGS", "ARENA_REWARD"]),
    ])

    const rows = ledger ?? []
    const pvpPlayed = rows.filter((r) => r.type === "ARENA_STAKE").length
    const pvpWins = rows.filter((r) => r.type === "ARENA_WINNINGS").length
    const cpuPlayed = rows.filter((r) => r.type === "ARENA_REWARD").length
    const cpuWins = rows.filter((r) => r.type === "ARENA_REWARD" && Number(r.amount) > 0).length

    const wins = pvpWins + cpuWins
    const played = pvpPlayed + cpuPlayed
    const xp = Number(profile?.xp ?? 0)

    return {
      seat,
      isAI: false,
      userId,
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
