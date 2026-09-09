/**
 * Audits NULL coverage for every stat the LPI v2 ranking engine consumes.
 *
 * Usage: node scripts/audit-ranking-nulls.mjs [season]
 *
 * Read-only. Reports per-metric null counts across the league and lists every
 * qualified player who is missing any LPI input, so scraper gaps are visible
 * before they silently distort a ranking run.
 */
import { createClient } from "@supabase/supabase-js"
import { config } from "dotenv"
config({ path: ".env.local" })

const SEASON = process.argv[2] ?? "2025-26"
const MIN_GAMES = 20
const MIN_MINUTES = 400

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// Mirrors selectCanonicalPlayerRows() in lib/rankings/engine/historical.ts
function canonical(rows) {
  const byPlayer = new Map()
  for (const row of rows) {
    if (!row.player_name || row.player_name === "League Average") continue
    const g = byPlayer.get(row.player_name) ?? []
    g.push(row)
    byPlayer.set(row.player_name, g)
  }
  return Array.from(byPlayer.values()).map(
    (g) => g.find((r) => r.team === "TOT" || /^\d+TM$/.test(r.team ?? "")) ?? g[0]
  )
}

async function load(statType) {
  const { data, error } = await supabase
    .from("nba_player_season_stats")
    .select("player_name, team, games, stats")
    .eq("season", SEASON)
    .eq("stat_type", statType)
    .eq("is_playoff", false)
  if (error) throw new Error(`${statType}: ${error.message}`)
  return canonical(data ?? [])
}

const perGame = await load("per_game")
const advanced = await load("advanced")
const perPoss = await load("per_poss")

const advMap = new Map(advanced.map((r) => [r.player_name, r.stats ?? {}]))
const possMap = new Map(perPoss.map((r) => [r.player_name, r.stats ?? {}]))

// LPI v2 inputs grouped by the component that owns them.
const COMPONENTS = {
  impact:     [["bpm", "adv"], ["vorp", "adv"], ["ws_per_48", "adv"]],
  offense:    [["obpm", "adv"], ["ts_pct", "adv"], ["usg_pct", "adv"], ["pts_per_poss", "poss"]],
  defense:    [["dbpm", "adv"], ["dws", "adv"], ["stl_pct", "adv"], ["blk_pct", "adv"], ["drb_pct", "adv"]],
  playmaking: [["ast_pct", "adv"], ["ast_tov", "derived"]],
  roleVolume: [["mp_per_g", "pg"]],
}

const rows = []
for (const pg of perGame) {
  const name = pg.player_name
  const adv = advMap.get(name) ?? {}
  const poss = possMap.get(name) ?? {}
  const pgStats = pg.stats ?? {}
  const games = Number(pg.games) || 0
  const mpg = Number(pgStats.mp_per_g) || 0
  const minutes = games * mpg

  const get = (metric, source) => {
    if (source === "adv") return adv[metric]
    if (source === "poss") return poss[metric]
    if (source === "pg") return pgStats[metric]
    // ast_tov is derived: needs both ast_per_g and a non-zero tov_per_g
    const a = pgStats.ast_per_g, t = pgStats.tov_per_g
    return a != null && t != null && t > 0 ? a / t : null
  }

  const missingByComponent = {}
  for (const [comp, metrics] of Object.entries(COMPONENTS)) {
    const miss = metrics.filter(([m, s]) => get(m, s) == null).map(([m]) => m)
    if (miss.length) missingByComponent[comp] = miss
  }

  // A component is fully dead when EVERY one of its metrics is missing —
  // that is when the engine drops it and redistributes its weight.
  const deadComponents = Object.entries(COMPONENTS)
    .filter(([comp, metrics]) => (missingByComponent[comp]?.length ?? 0) === metrics.length)
    .map(([comp]) => comp)

  rows.push({
    name, team: pg.team, games, mpg, minutes,
    qualified: games >= MIN_GAMES && minutes >= MIN_MINUTES,
    missingByComponent, deadComponents,
    totalMissing: Object.values(missingByComponent).flat().length,
  })
}

const qualified = rows.filter((r) => r.qualified)

console.log(`\n${"=".repeat(78)}`)
console.log(`LPI NULL AUDIT — season ${SEASON}`)
console.log(`${"=".repeat(78)}`)
console.log(`distinct players: ${rows.length}   qualified (>=${MIN_GAMES}g & >=${MIN_MINUTES}min): ${qualified.length}`)

// ── Per-metric null counts among qualified players ──────────────────────────
console.log(`\n--- null count per metric (qualified players only) ---`)
for (const [comp, metrics] of Object.entries(COMPONENTS)) {
  console.log(`\n  ${comp}:`)
  for (const [metric] of metrics) {
    const n = qualified.filter((r) => (r.missingByComponent[comp] ?? []).includes(metric)).length
    const pct = ((n / qualified.length) * 100).toFixed(1)
    const flag = n === 0 ? "" : n / qualified.length > 0.5 ? "   <-- MOSTLY MISSING" : "   <-- gaps"
    console.log(`    ${metric.padEnd(14)} ${String(n).padStart(4)} null  (${pct.padStart(5)}%)${flag}`)
  }
}

// ── Players whose whole component died ─────────────────────────────────────
const dead = qualified.filter((r) => r.deadComponents.length > 0)
console.log(`\n${"=".repeat(78)}`)
console.log(`CRITICAL — qualified players missing an ENTIRE LPI component: ${dead.length}`)
console.log(`(engine drops the component and redistributes its weight; player is flagged low_confidence)`)
console.log(`${"=".repeat(78)}`)
if (dead.length === 0) console.log("  none")
for (const r of dead.sort((a, b) => b.minutes - a.minutes)) {
  console.log(`  ${r.name.padEnd(30)} ${String(r.team).padEnd(5)} ${String(r.games).padStart(3)}g ${String(Math.round(r.minutes)).padStart(5)}min  dead: ${r.deadComponents.join(", ")}`)
}

// ── Any qualified player with any missing metric ───────────────────────────
const partial = qualified.filter((r) => r.totalMissing > 0)
console.log(`\n${"=".repeat(78)}`)
console.log(`ALL qualified players with at least one NULL LPI input: ${partial.length}`)
console.log(`${"=".repeat(78)}`)
if (partial.length === 0) console.log("  none")
for (const r of partial.sort((a, b) => b.totalMissing - a.totalMissing || b.minutes - a.minutes)) {
  const detail = Object.entries(r.missingByComponent)
    .map(([c, m]) => `${c}[${m.join(",")}]`)
    .join(" ")
  console.log(`  ${r.name.padEnd(30)} ${String(r.team).padEnd(5)} ${String(r.games).padStart(3)}g  ${String(r.totalMissing).padStart(2)} null  ${detail}`)
}

// ── Unqualified-but-notable (played real minutes, still excluded) ──────────
const nearMiss = rows
  .filter((r) => !r.qualified && r.minutes >= 200)
  .sort((a, b) => b.minutes - a.minutes)
console.log(`\n--- excluded from rankings despite >=200 minutes: ${nearMiss.length} ---`)
for (const r of nearMiss.slice(0, 15)) {
  const why = []
  if (r.games < MIN_GAMES) why.push(`games ${r.games}<${MIN_GAMES}`)
  if (r.minutes < MIN_MINUTES) why.push(`min ${Math.round(r.minutes)}<${MIN_MINUTES}`)
  console.log(`  ${r.name.padEnd(30)} ${String(r.team).padEnd(5)} ${why.join(", ")}`)
}
console.log()
