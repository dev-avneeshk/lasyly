/**
 * Resolve NBA person ids for the arena pool → lib/arena/data/nba-ids.ts
 *
 * WHY: player headshots come from the NBA CDN, keyed by the official NBA person
 * id (see lib/arena/data/index.ts::headshotUrl). The generated pool only had ids
 * for the original ~38 curated stars, so everyone else fell back to initials.
 *
 * SOURCE: the NBA's public static player-search dataset
 * (https://stats.nba.com/js/data/ptsd/stats_ptsd.js), a JS file assigning
 * `var stats_ptsd = { data: { players: [[id, "Last, First", active, ...], ...] } }`.
 * It lists every player (~5100) with their NBA person id — the same id the CDN
 * headshot URL uses. This endpoint serves fine to browsers/servers (unlike the
 * stats.nba.com JSON API, which blocks non-browser clients).
 *
 * OUTPUT: lib/arena/data/nba-ids.ts, a generated `id → nbaId` map keyed by our
 * slug ids. The player generator imports it so every regeneration re-populates
 * headshots automatically.
 *
 * Run:  npx tsx scripts/resolve-nba-ids.ts
 */

import { writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { PLAYERS_2025_26 } from "../lib/arena/data/players-2025-26"

const PTSD_URL = "https://stats.nba.com/js/data/ptsd/stats_ptsd.js"

/** Normalize a name for matching: lowercase, strip accents + punctuation. */
const norm = (s: string) =>
  (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(jr|sr|ii|iii|iv|v)\b/g, "") // drop suffixes for looser matching
    .replace(/[^a-z0-9]/g, "")

async function main() {
  const res = await fetch(PTSD_URL, {
    headers: { "User-Agent": "Mozilla/5.0", Referer: "https://www.nba.com/" },
  })
  if (!res.ok) throw new Error(`ptsd fetch failed: ${res.status}`)
  let text = await res.text()
  text = text.replace(/^var stats_ptsd = /, "").replace(/;?\s*$/, "")
  const data = JSON.parse(text)
  const players: any[][] = data.data.players
  console.log("NBA player dataset rows:", players.length)

  // Build normalized "First Last" → id map (dataset stores "Last, First").
  // Later entries (more recent) win over older duplicates via active flag.
  const byName = new Map<string, number>()
  for (const row of players) {
    const id = row[0] as number
    const lastFirst = String(row[1] ?? "")
    const active = row[2] === 1
    const comma = lastFirst.indexOf(",")
    if (comma === -1) continue
    const last = lastFirst.slice(0, comma).trim()
    const first = lastFirst.slice(comma + 1).trim()
    const key = norm(`${first} ${last}`)
    if (!key) continue
    // Prefer active players when the same normalized name repeats.
    if (!byName.has(key) || active) byName.set(key, id)
  }

  // Match our pool.
  const idMap: Record<string, number> = {}
  const unmatched: string[] = []
  for (const p of PLAYERS_2025_26) {
    const key = norm(p.name)
    const nbaId = byName.get(key)
    if (nbaId != null) idMap[p.id] = nbaId
    else unmatched.push(`${p.name} (${p.id})`)
  }

  const matched = Object.keys(idMap).length
  console.log(`matched ${matched}/${PLAYERS_2025_26.length} players`)
  if (unmatched.length) {
    console.log(`unmatched (${unmatched.length}):`)
    for (const u of unmatched.slice(0, 40)) console.log("  -", u)
    if (unmatched.length > 40) console.log(`  ...and ${unmatched.length - 40} more`)
  }

  writeFile(idMap)
  console.log("wrote lib/arena/data/nba-ids.ts")
}

function writeFile(idMap: Record<string, number>) {
  const entries = Object.entries(idMap)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([id, nbaId]) => `  ${JSON.stringify(id)}: ${nbaId},`)
    .join("\n")

  const out = `/**
 * NBA person ids for the arena pool (GENERATED — do not hand-edit).
 *
 * Maps our slug id → official NBA person id, used to build CDN headshot URLs
 * (see ./index.ts::headshotUrl). Produced by scripts/resolve-nba-ids.ts from the
 * NBA's public static player dataset. Regenerate after adding players:
 *
 *     npx tsx scripts/resolve-nba-ids.ts
 */

export const NBA_IDS: Record<string, number> = {
${entries}
}
`
  writeFileSync(resolve("lib/arena/data/nba-ids.ts"), out)
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
