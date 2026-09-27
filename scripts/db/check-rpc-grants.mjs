#!/usr/bin/env node
/**
 * Service-only RPC exposure check.
 *
 * Calls each service-only function with the PUBLIC anon key (the key in every
 * browser bundle) and fails if any of them runs. These functions move coins or
 * XP and trust their grants instead of checking the caller, so a public grant
 * is a free-money bug. See
 * supabase/migrations/20260927_revoke_public_execute_on_service_rpcs.sql.
 *
 * WHY BEHAVIOURAL: PostgREST can't read pg_catalog, and on Supabase the grants
 * that matter come from default privileges, not from anything in a migration
 * file. Asking the live API is the only check that sees what's really there.
 *
 * SAFE TO RUN AGAINST PRODUCTION: every probe uses inputs that make the
 * function return before any write (amount 0, or a user id that doesn't exist),
 * so even a still-exposed function changes nothing. cleanup_old_chat_data is
 * deliberately NOT probed: it has no harmless input.
 *
 * Usage: node scripts/db/check-rpc-grants.mjs
 * Requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in
 * .env.local. Exits non-zero if anything is callable.
 */

import { readFileSync } from "node:fs"

function loadEnv(file = ".env.local") {
  let raw
  try { raw = readFileSync(file, "utf8") } catch {
    console.error(`Could not read ${file}`); process.exit(1)
  }
  return Object.fromEntries(
    raw.split("\n")
      .filter((l) => l.includes("=") && !l.trimStart().startsWith("#"))
      .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] })
  )
}

const env = loadEnv()
const DB = env.NEXT_PUBLIC_SUPABASE_URL
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
if (!DB || !ANON) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY")
  process.exit(1)
}

const NOBODY = "00000000-0000-0000-0000-000000000000"

/** [function, no-op arguments, why those arguments write nothing] */
const PROBES = [
  ["process_stripe_topup", { p_user_id: NOBODY, p_amount: 0, p_stripe_session_id: "grant-probe" }, "amount 0 → invalid_amount"],
  ["award_cpu_reward", { p_user_id: NOBODY, p_game_id: "grant-probe", p_reward: 0, p_xp: 0 }, "no such user → no_profile"],
  ["settle_1v1_stake", { p_game_id: "grant-probe", p_winner_id: NOBODY, p_loser_id: null, p_payout: 0, p_winner_xp: 0, p_loser_xp: 0 }, "no such user → no_profile"],
  ["grant_weekly_level_bonus", { p_user_id: NOBODY, p_week_key: "grant-probe", p_amount: 0 }, "amount 0 → invalid_amount"],
  ["start_arena_stake", { p_user_id: NOBODY, p_game_id: "grant-probe", p_amount: 0, p_is_pvp: false }, "amount 0 / no caller"],
  ["refund_arena_stake", { p_user_id: NOBODY, p_game_id: "grant-probe" }, "no such user → nothing_to_refund"],
  ["apply_xp", { p_user_id: NOBODY, p_xp: 0 }, "no such user → updates 0 rows"],
  ["register_arena_channel_member", { p_topic: "not-arena", p_game_id: "grant-probe", p_user_id: NOBODY, p_seat: "P1" }, "bad topic → invalid"],
]

const headers = { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" }
const exposed = []

for (const [fn, args] of PROBES) {
  const res = await fetch(`${DB}/rest/v1/rpc/${fn}`, { method: "POST", headers, body: JSON.stringify(args) })
  const body = (await res.text()).slice(0, 80)
  if (res.ok) {
    exposed.push(fn)
    console.log(`  EXPOSED  ${fn.padEnd(30)} anon call ran (${res.status} ${body})`)
  } else {
    console.log(`  ok       ${fn.padEnd(30)} blocked (${res.status})`)
  }
}

if (exposed.length) {
  console.error(`\n${exposed.length} service-only function(s) callable with the public key.`)
  console.error("Apply supabase/migrations/20260927_revoke_public_execute_on_service_rpcs.sql.")
  process.exit(1)
}
console.log("\nall service-only functions are blocked for the public key")
