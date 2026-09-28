import { createClient } from "@/lib/supabase/server"
import AnalysisClient from "./AnalysisClient"

/**
 * Resolve "is this a real signed-in user?" without a network round-trip.
 *
 * This page used `auth.getUser()`, which always calls Supabase's Auth server:
 * measured at 195-395ms, serialized ahead of anything this page renders. Because
 * the value is only used to decide whether interactions are enabled, the whole
 * page — and therefore the client bundle that kicks off the props request — sat
 * behind that call for no reason.
 *
 * `getClaims()` verifies the session JWT locally with WebCrypto when the project
 * signs with asymmetric keys, which this one does (the JWKS endpoint publishes an
 * ES256 key), so this costs no network at all. It falls back to a server call on
 * symmetric projects, so it is never slower than what it replaces.
 *
 * On the difference that matters: `getUser()` additionally confirms with the Auth
 * server that the account still exists and the token has not been revoked, which
 * local verification cannot. That is not a downgrade here, for two reasons.
 * First, proxy.ts already decides whether this page is reachable at all using
 * `getClaims()` — so page access is governed by a locally-verified claim either
 * way, and calling `getUser()` afterwards re-validated something the gate had
 * already accepted. Second, this flag only toggles UI affordances: every write it
 * guards (/api/props/parlay, /api/props/votes, /api/bets) authenticates
 * independently on the server, so a stale token buys a dialog, not access.
 *
 * Note this is NOT simply `true` despite the route being auth-gated: the proxy
 * admits signed guest cookies as well as real accounts, and guests must still get
 * the sign-up prompt. `sub` is present only for a real Supabase user.
 */
async function isRealUser(): Promise<boolean> {
  const supabase = await createClient()
  try {
    const { data } = await supabase.auth.getClaims()
    return typeof data?.claims?.sub === "string"
  } catch {
    // Treat a verification failure as "guest". The route is already gated, so
    // the cost of being wrong is a sign-up prompt, not exposure.
    return false
  }
}

export default async function AnalysisPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; sport?: string }>
}) {
  const [isAuthenticated, { search, sport }] = await Promise.all([
    isRealUser(),
    searchParams,
  ])

  return (
    <AnalysisClient
      isAuthenticated={isAuthenticated}
      initialSearch={search ?? ""}
      initialSport={sport ?? "NFL"}
    />
  )
}
