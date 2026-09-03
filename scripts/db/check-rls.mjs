#!/usr/bin/env node
/**
 * RLS leak detector.
 *
 * Verifies that the PUBLIC anon key — the key shipped in the browser bundle,
 * so effectively available to anyone — cannot read private data.
 *
 * WHY BEHAVIOURAL, NOT STATIC: PostgREST cannot reach pg_catalog, so we cannot
 * read pg_policies from here. Postgres also ORs policies together, meaning a
 * single leftover `USING (true)` policy silently defeats every correct policy
 * beside it. That is exactly what happened: the named policies from the
 * security baseline were all present and correct, while legacy permissive
 * policies under different names kept private rooms, messages and memberships
 * world-readable. Only probing actual behaviour catches that.
 *
 * HOW: creates a temporary PRIVATE room with a known secret, tries to read it
 * with the anon key, then deletes the room. Cleanup runs even on failure.
 *
 * Usage: node scripts/db/check-rls.mjs
 * Requires NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and
 * SUPABASE_SERVICE_ROLE_KEY in .env.local. Exits non-zero on any leak.
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
const SVC = env.SUPABASE_SERVICE_ROLE_KEY

if (!DB || !ANON || !SVC) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY")
  process.exit(1)
}

const svc = { apikey: SVC, Authorization: `Bearer ${SVC}`, "Content-Type": "application/json" }
const anon = { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" }

const SECRET = `RLS_PROBE_SECRET_${Date.now()}`
const leaks = []
let roomId = null

const asService = async (path, init = {}) => {
  const r = await fetch(`${DB}/rest/v1/${path}`, { headers: svc, ...init })
  const t = await r.text()
  try { return JSON.parse(t) } catch { return t }
}

try {
  // A real user id is needed for creator_id / user_id FKs.
  const profiles = await asService("profiles?select=id&limit=1")
  const uid = profiles?.[0]?.id
  if (!uid) { console.error("No profiles in the database; cannot run the probe."); process.exit(1) }

  const room = await asService("rooms", {
    method: "POST",
    headers: { ...svc, Prefer: "return=representation" },
    body: JSON.stringify({
      name: `ZZ RLS PROBE ${SECRET}`,
      description: SECRET,
      type: "Private",
      sport_tag: "Mixed",
      creator_id: uid,
    }),
  })
  roomId = room?.[0]?.id
  if (!roomId) { console.error("Could not create the probe room:", JSON.stringify(room)); process.exit(1) }

  await asService("room_members", {
    method: "POST",
    body: JSON.stringify({ room_id: roomId, user_id: uid, role: "owner" }),
  })

  // The AFTER INSERT trigger should have created the default sub-channel.
  const subs = await asService(`room_subchannels?select=id&room_id=eq.${roomId}`)
  const subId = subs?.[0]?.id
  if (subId) {
    await asService("messages", {
      method: "POST",
      body: JSON.stringify({
        room_id: roomId, subchannel_id: subId, user_id: uid,
        content: SECRET, is_system: false,
      }),
    })
  }

  console.log("Probing a PRIVATE room with the public anon key")
  console.log("-".repeat(66))

  const reads = [
    ["rooms", `rooms?select=id,name&id=eq.${roomId}`],
    ["messages", `messages?select=content&room_id=eq.${roomId}`],
    ["room_members", `room_members?select=user_id,role&room_id=eq.${roomId}`],
    ["room_subchannels", `room_subchannels?select=name,invite_token&room_id=eq.${roomId}`],
    ["pinned_messages", `pinned_messages?select=message_id&room_id=eq.${roomId}`],
    ["room_bans", `room_bans?select=user_id&room_id=eq.${roomId}`],
    ["room_mutes", `room_mutes?select=user_id&room_id=eq.${roomId}`],
    ["room_audit_log", `room_audit_log?select=action&room_id=eq.${roomId}`],
  ]

  for (const [table, query] of reads) {
    const r = await fetch(`${DB}/rest/v1/${query}`, { headers: anon })
    const body = await r.text()
    if (!r.ok) { console.log(`  n/a       ${table.padEnd(20)} ${body.slice(0, 60)}`); continue }
    let rows
    try { rows = JSON.parse(body) } catch { rows = [] }
    const n = Array.isArray(rows) ? rows.length : 0
    if (n > 0) {
      leaks.push({ table, rows: n, sample: JSON.stringify(rows).slice(0, 160) })
      console.log(`  LEAK      ${table.padEnd(20)} ${n} row(s) readable by anon`)
    } else {
      console.log(`  ok        ${table.padEnd(20)} filtered`)
    }
  }

  // Writes must affect zero rows. Prefer: return=representation makes the
  // affected-row count visible; a bare 204 is ambiguous.
  console.log("\nProbing writes with the anon key")
  console.log("-".repeat(66))
  const writes = [
    ["UPDATE rooms", `rooms?id=eq.${roomId}`, "PATCH", { name: "RLS_PROBE_TAMPERED" }],
    ["DELETE rooms", `rooms?id=eq.${roomId}`, "DELETE", null],
    ["UPDATE messages", `messages?room_id=eq.${roomId}`, "PATCH", { content: "RLS_PROBE_TAMPERED" }],
    ["INSERT membership", "room_members", "POST", { room_id: roomId, user_id: uid, role: "owner" }],
  ]
  for (const [label, path, method, body] of writes) {
    const r = await fetch(`${DB}/rest/v1/${path}`, {
      method,
      headers: { ...anon, Prefer: "return=representation" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
    const t = await r.text()
    let n = 0
    try { const j = JSON.parse(t); n = Array.isArray(j) ? j.length : 0 } catch { n = 0 }
    if (n > 0) {
      leaks.push({ table: label, rows: n, sample: t.slice(0, 160) })
      console.log(`  LEAK      ${label.padEnd(20)} wrote ${n} row(s)`)
    } else {
      console.log(`  ok        ${label.padEnd(20)} 0 rows affected`)
    }
  }

  // The private room must not surface in public listings.
  console.log("\nPrivate room must not appear in public room listings")
  console.log("-".repeat(66))
  const listed = await fetch(`${DB}/rest/v1/rooms?select=id,name&type=eq.Private`, { headers: anon })
  const listedRows = listed.ok ? JSON.parse(await listed.text()) : []
  if (Array.isArray(listedRows) && listedRows.length > 0) {
    leaks.push({ table: "rooms (type=Private enumeration)", rows: listedRows.length, sample: JSON.stringify(listedRows).slice(0, 160) })
    console.log(`  LEAK      ${listedRows.length} private room(s) enumerable by anon`)
  } else {
    console.log("  ok        no private rooms enumerable")
  }
} finally {
  if (roomId) {
    await asService(`rooms?id=eq.${roomId}`, { method: "DELETE" })
    const left = await asService(`rooms?select=id&id=eq.${roomId}`)
    const gone = Array.isArray(left) && left.length === 0
    console.log(`\ncleanup: probe room ${gone ? "deleted" : "STILL PRESENT — remove manually: " + roomId}`)
  }

  console.log("=".repeat(66))
  if (leaks.length === 0) {
    console.log("No leaks. The anon key cannot read or write private room data.")
  } else {
    console.error(`${leaks.length} LEAK(S) FOUND:`)
    for (const l of leaks) console.error(`  - ${l.table}: ${l.rows} row(s)\n      ${l.sample}`)
    console.error("\nApply supabase/migrations/20260905_fix_permissive_rls_policies.sql,")
    console.error("then inspect policies with scripts/db/audit-rls.sql in the SQL editor.")
    process.exitCode = 1
  }
}
