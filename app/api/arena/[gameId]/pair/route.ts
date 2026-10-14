import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { withSecurity, CACHE_CONTROL } from "@/lib/security/routeHelpers"
import { checkRateLimit, RATE_LIMITS } from "@/lib/rateLimit"
import { loadGame, mutateGame, type StoredGame } from "@/lib/arena/store"
import { serverView } from "@/lib/arena/server"
import { applyConversion, conversionVerdict, type ConversionOutcome } from "@/lib/arena/botMatch"
import { pickPersonaName } from "@/lib/arena/persona"
import { runBotTurns } from "@/lib/arena/botTurns"
import {
  BOT_REFUND_BACKSTOP_MS,
  LOBBY_MAX_AGE_MS,
  queuePendingRefund,
  removeOpenGame,
  retryConvertedRefund,
  startConvertedRefund,
} from "@/lib/arena/matchmaking"
import { broadcastArenaUpdate, participantView } from "@/lib/realtime/arena"
import { afterResponse } from "@/lib/background"

/**
 * Deferred work started here can outlast the response: a refund RPC that hangs
 * to its 30 s deadline, and the opponent runner's 20 s budget, concurrently.
 */
export const maxDuration = 60

/** Ids are server UUIDs; anything else is answered like a missing game. */
const GAME_ID_RE = /^[A-Za-z0-9-]{1,64}$/

/** The same body GET answers for a missing game or a non-player, so ids can't be probed. */
function notFound() {
  return NextResponse.json({ error: "Game not found." }, { status: 404 })
}

/** Every outcome that commits nothing, for the lock-free pre-check and the in-lock verdict alike. */
function respond(outcome: ConversionOutcome, game: StoredGame): NextResponse {
  switch (outcome.kind) {
    case "not_owner":
      return notFound()
    case "already":
      // A repeat request, or a concurrent one that won: the persona is the persisted one.
      retryConvertedRefund(game)
      return NextResponse.json(participantView(serverView(game.state, "P1", game.rev)))
    case "seated": // a real opponent took the seat first: their match, no refund
    case "converted": // only with changed === false, which applyConversion can't produce
      return NextResponse.json(participantView(serverView(game.state, "P1", game.rev)))
    case "not_yet":
      return NextResponse.json(
        { error: "Still looking for an opponent.", code: "NOT_YET", retryAfterMs: outcome.retryAfterMs },
        { status: 409, headers: { "Retry-After": String(Math.ceil(outcome.retryAfterMs / 1000)) } }
      )
    case "unavailable":
      if (outcome.reason === "expired") console.info("[arena/fallback] lobby too old to pair", { gameId: game.state.gameId })
      return NextResponse.json({ error: "This search can't be paired.", code: "UNAVAILABLE" }, { status: 409 })
  }
}

/**
 * POST /api/arena/[gameId]/pair — the owner of an open public lobby that nobody
 * joined in time asks to be paired anyway. No body.
 *
 * The lobby converts in one locked write (lib/arena/botMatch.ts): P2 gets a seat
 * marker, the opponent is the existing engine on a deferred clock, its public
 * name is a checked handle, and the owner's stake is refunded instead of ever
 * being settled. The verdict runs twice: once lock-free, so early, foreign and
 * ineligible requests cost one read, and again inside `mutateGame`, where it
 * decides. A real opponent who took the seat first wins: the owner gets that
 * match's view instead. Every answer for a game the caller doesn't own is GET's
 * 404, so a non-owner learns nothing about the record.
 */
export const POST = withSecurity(async (
  _request: Request,
  context?: { params: Promise<{ gameId: string }> }
) => {
  const { gameId } = await context!.params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 })

  const rate = await checkRateLimit(`arena-pair:${user.id}`, RATE_LIMITS.arenaJoin)
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Slow down." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rate.retryAfterMs / 1000)) } }
    )
  }

  if (!GAME_ID_RE.test(gameId)) return notFound()
  const existing = await loadGame(gameId)
  if (!existing) return notFound()

  // Fast, lock-free check. Ownership comes first, so a non-owner always gets the 404.
  const verdict = conversionVerdict(existing, user.id, Date.now(), LOBBY_MAX_AGE_MS)
  if (verdict.kind !== "eligible") return respond(verdict, existing)

  // Pick the opponent's public name before the lock: the mutator is synchronous
  // and can't do I/O. Nothing has changed yet, so a failure is a plain retry.
  let name: string
  try {
    name = await pickPersonaName()
  } catch {
    console.warn("[arena/fallback] name check failed", { gameId })
    return NextResponse.json(
      { error: "That game is busy right now. Retry in a moment." },
      { status: 503, headers: { "Retry-After": "2" } }
    )
  }

  // `as`, not an annotation: TypeScript must not narrow `outcome` to its initial
  // value, because the mutator reassigns it inside a callback. It is reassigned
  // on every run, so after a lost CAS it reflects the run that committed.
  let outcome = { kind: "unavailable", reason: "not_lobby" } as ConversionOutcome
  const { game, changed } = await mutateGame(gameId, (g) => {
    outcome = applyConversion(g, { userId: user.id, name, now: Date.now(), maxAgeMs: LOBBY_MAX_AGE_MS })
  })

  if (outcome.kind === "converted" && changed) {
    const ownerId = game.ownerUserId
    // Two cheap Redis steps before answering. The backstop is written before the
    // refund starts, so it exists even if the refund never runs.
    await removeOpenGame(gameId)
    await queuePendingRefund(gameId, ownerId, Date.now() + BOT_REFUND_BACKSTOP_MS)
    // The refund RPC runs after the response, never on it: fetchWithRetry gives
    // each attempt a 30 s deadline and retries thrown transport errors only
    // (RETRYABLE_CODES incl. ETIMEDOUT/EPIPE, or a fetch failed/network/getaddrinfo
    // message), up to 3 attempts, never a timeout or abort. A hung RPC would
    // otherwise hold the matched transition for about 30 s.
    afterResponse(async () => {
      const refund = await startConvertedRefund(gameId, ownerId)
      console.info("[arena/fallback] converted", {
        gameId,
        stake: game.state.econ!.amount,
        waitedMs: game.state.botMatch!.waitedMs,
        refund,
      })
    }, "arena stake refund")
    afterResponse(() => broadcastArenaUpdate(gameId, serverView(game.state, "P1", game.rev)), "arena broadcast")
    // The lot-1 move was planned by the conversion; the runner lands it once it's due.
    afterResponse(() => runBotTurns(gameId), "arena opponent turn")
    return NextResponse.json(participantView(serverView(game.state, "P1", game.rev)))
  }

  // ownerUserId changed between the pre-check and the lock. No code does that today.
  if (outcome.kind === "not_owner") console.warn("[arena/fallback] owner mismatch inside the lock", { gameId })
  return respond(outcome, game)
}, { cacheControl: CACHE_CONTROL.SENSITIVE })
