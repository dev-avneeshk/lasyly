#!/usr/bin/env node
/**
 * Schema drift check.
 *
 * Migrations in this repo are applied by hand, so the live database can silently
 * fall behind `supabase/migrations/`. That drift is not always visible: the
 * room chat broke because `can_post_subchannel()` (used by an RLS policy)
 * called `is_room_muted()`, which had never been created. The policy raised at
 * evaluation time and every message insert failed with a generic 500.
 *
 * This script probes the tables and functions the app actually depends on and
 * exits non-zero if any are missing.
 *
 * Usage: node scripts/db/check-schema.mjs
 * Reads NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from .env.local.
 */

import { readFileSync } from "node:fs"

function loadEnv(file = ".env.local") {
  let raw
  try {
    raw = readFileSync(file, "utf8")
  } catch {
    console.error(`Could not read ${file}`)
    process.exit(1)
  }
  return Object.fromEntries(
    raw
      .split("\n")
      .filter((line) => line.includes("=") && !line.trimStart().startsWith("#"))
      .map((line) => {
        const i = line.indexOf("=")
        return [line.slice(0, i).trim(), line.slice(i + 1).trim().replace(/^["']|["']$/g, "")]
      })
  )
}

const env = loadEnv()
const URL_BASE = env.NEXT_PUBLIC_SUPABASE_URL
const KEY = env.SUPABASE_SERVICE_ROLE_KEY

if (!URL_BASE || !KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local")
  process.exit(1)
}

const headers = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" }

const TABLES = [
  "rooms",
  "room_members",
  "messages",
  "message_reactions",
  "room_channels",
  "room_subchannels",
  "subchannel_join_requests",
  "pinned_messages",
  "room_mutes",
  "room_bans",
  "room_audit_log",
  "parlays",
  "profiles",
]

// Functions are probed with deliberately non-existent UUIDs. We only care
// whether the function resolves, not what it returns.
const NIL = "00000000-0000-0000-0000-000000000000"
const FUNCTIONS = [
  ["is_room_member", { p_room_id: NIL, p_user_id: NIL }],
  ["is_room_admin", { p_room_id: NIL, p_user_id: NIL }],
  ["is_room_muted", { p_room_id: NIL, p_user_id: NIL }],
  ["is_room_banned", { p_room_id: NIL, p_user_id: NIL }],
  ["room_is_public", { p_room_id: NIL }],
  ["can_view_subchannel", { p_subchannel_id: NIL, p_user_id: NIL }],
  ["can_post_subchannel", { p_subchannel_id: NIL, p_user_id: NIL }],
  ["can_create_room", { p_user_id: NIL }],
  ["room_ensure_default_subchannel", { p_room_id: NIL }],
  ["room_set_member_role", { p_room_id: NIL, p_target_user_id: NIL, p_new_role: "member" }],
  ["room_kick_member", { p_room_id: NIL, p_target_user_id: NIL }],
  ["room_ban_member", { p_room_id: NIL, p_target_user_id: NIL }],
  ["room_unban_member", { p_room_id: NIL, p_target_user_id: NIL }],
]

const missing = []

console.log("Tables")
for (const table of TABLES) {
  const res = await fetch(`${URL_BASE}/rest/v1/${table}?select=*&limit=1`, { headers })
  const ok = res.ok
  if (!ok) missing.push(`table ${table}`)
  console.log(`  ${ok ? "ok     " : "MISSING"} ${table}`)
}

console.log("\nFunctions")
for (const [name, args] of FUNCTIONS) {
  const res = await fetch(`${URL_BASE}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers,
    body: JSON.stringify(args),
  })
  const body = await res.text()
  let code = null
  try {
    code = JSON.parse(body).code
  } catch {
    /* non-JSON body means it resolved */
  }
  // PGRST202 = not found in schema cache. 42883 = referenced function missing,
  // which is the failure mode that broke chat: the outer function exists but
  // something it calls does not.
  const absent = code === "PGRST202" || code === "42883"
  if (absent) missing.push(`function ${name}${code === "42883" ? " (calls a missing function)" : ""}`)
  console.log(`  ${absent ? "MISSING" : "ok     "} ${name}${absent ? `  ${body.slice(0, 120)}` : ""}`)
}

console.log("\nRooms without a default sub-channel")
const rooms = await fetch(`${URL_BASE}/rest/v1/rooms?select=id,name`, { headers })
const subs = await fetch(`${URL_BASE}/rest/v1/room_subchannels?select=room_id,is_default`, { headers })
if (rooms.ok && subs.ok) {
  const roomList = await rooms.json()
  const subList = await subs.json()
  const withDefault = new Set(subList.filter((s) => s.is_default).map((s) => s.room_id))
  const orphans = roomList.filter((r) => !withDefault.has(r.id))
  if (orphans.length === 0) {
    console.log(`  ok      all ${roomList.length} room(s) have one`)
  } else {
    for (const r of orphans) console.log(`  MISSING ${r.name} (${r.id})`)
    missing.push(`${orphans.length} room(s) without a default sub-channel`)
  }
} else {
  console.log("  could not check (rooms or room_subchannels unreadable)")
}

if (missing.length > 0) {
  console.error(`\n${missing.length} problem(s) found:`)
  for (const m of missing) console.error(`  - ${m}`)
  console.error("\nApply the pending migrations in supabase/migrations/, then re-run.")
  process.exit(1)
}

console.log("\nSchema looks complete.")
