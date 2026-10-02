/**
 * Generate lib/analytics/nfl/week2-2026.ts from the parsed Week-2 JSON.
 * Mirrors the structure/exports of lib/analytics/nfl/week1-2026.ts so the same
 * engine + derive functions consume it unchanged.
 */
import { readFileSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..")
const data = JSON.parse(
  readFileSync(join(ROOT, "scripts/data/week2-2026.parsed.json"), "utf8")
)

/** Serialize a JS value as a TS literal (objects one-per-line-ish, arrays inline). */
function lit(v) {
  if (v === null) return "null"
  if (typeof v === "number") return String(v)
  if (typeof v === "boolean") return String(v)
  if (typeof v === "string") return JSON.stringify(v)
  throw new Error("unexpected value: " + typeof v)
}

/** One object literal on a single line, keys in the given order. */
function obj(o, keys) {
  const parts = keys.map((k) => `${k}: ${lit(o[k])}`)
  return `  { ${parts.join(", ")} }`
}

function arr(name, items, keys) {
  if (items.length === 0) return `const ${name}: ${TYPE[name]} = []`
  return `const ${name}: ${TYPE[name]} = [\n${items.map((o) => obj(o, keys)).join(",\n")},\n]`
}

const TYPE = {
  games: "NflGameMeta[]",
  teamGameStats: "NflTeamGameStat[]",
  playerGameStats: "NflPlayerGameStat[]",
  advReceiving: "NflAdvReceiving[]",
  advRushing: "NflAdvRushing[]",
  advPassing: "NflAdvPassing[]",
  snapCounts: "NflSnapCount[]",
  drives: "NflDrive[]",
  teamOffense: "NflTeamSeasonUnit[]",
  teamDefense: "NflTeamSeasonUnit[]",
}

const GAME_KEYS = [
  "game_id", "season", "week", "date", "home_team", "away_team",
  "home_score", "away_score", "stadium", "roof", "surface", "attendance",
  "duration", "temperature_f", "humidity_pct", "wind_mph", "spread",
  "spread_favorite", "over_under", "total_result", "went_to_ot",
]
const TGS_KEYS = [
  "game_id", "team", "opponent", "is_home", "first_downs", "rush_att",
  "rush_yds", "rush_td", "pass_cmp", "pass_att", "pass_yds", "pass_td",
  "pass_int", "sacked", "sacked_yds", "net_pass_yds", "total_yds", "fumbles",
  "fumbles_lost", "turnovers", "penalties", "penalty_yds", "third_down_att",
  "third_down_conv", "fourth_down_att", "fourth_down_conv", "top",
]
const PGS_KEYS = [
  "game_id", "player", "team", "opponent", "pass_cmp", "pass_att", "pass_yds",
  "pass_td", "pass_int", "pass_sacked", "pass_sacked_yds", "pass_long",
  "pass_rating", "rush_att", "rush_yds", "rush_td", "rush_long", "targets",
  "rec", "rec_yds", "rec_td", "rec_long", "fumbles", "fumbles_lost",
]
const ADVREC_KEYS = [
  "game_id", "player", "team", "targets", "rec", "yds", "td", "first_downs",
  "ybc", "ybc_per_rec", "yac", "yac_per_rec", "adot", "broken_tackles",
  "rec_per_broken", "drops", "drop_pct", "int_on_target", "rating_when_targeted",
]
const ADVRUSH_KEYS = [
  "game_id", "player", "team", "att", "yds", "td", "first_downs", "ybc",
  "ybc_per_att", "yac", "yac_per_att", "broken_tackles", "att_per_broken",
]
const ADVPASS_KEYS = [
  "game_id", "player", "team", "cmp", "att", "yds", "first_downs",
  "first_down_pct", "iay", "iay_per_att", "cay", "cay_per_cmp", "cay_per_att",
  "yac", "yac_per_cmp", "drops", "drop_pct", "bad_throws", "bad_throw_pct",
  "sacked", "blitzed", "hurried", "hits", "pressured", "pressured_pct",
  "scrambles", "yds_per_scramble",
]

const header = `/**
 * NFL Week 2, 2026 — structured dataset.
 *
 * Source: Pro-Football-Reference box scores (2026 Week 2). GENERATED from
 * docs/product/week2.md by scripts/parse-week2.mjs + scripts/gen-week2-ts.mjs.
 * Do not hand-edit; re-run the scripts to regenerate. Only values literally
 * present in the source are recorded; omitted fields are \`null\` (never
 * fabricated).
 *
 * Coverage note (honest scope): the Week-2 dump is the per-game box-score pages
 * only. It therefore provides game meta, team game stats, standard player box
 * scores, and PFR advanced passing/rushing/receiving. It does NOT contain snap
 * counts, drive logs, or the league-wide Team Offense/Defense tables, so those
 * arrays are intentionally empty (unlike Week 1, whose source included them).
 *
 * Every team line is reconciled by __tests__/analytics/nfl-week2.test.ts:
 * player receiving must sum to the team passing line for all 16 games.
 */

import type {
  NflAdvPassing,
  NflAdvReceiving,
  NflAdvRushing,
  NflDrive,
  NflGameMeta,
  NflPlayerGameStat,
  NflSnapCount,
  NflTeamGameStat,
  NflTeamSeasonUnit,
  NflWeekDataset,
} from "./types"

export const SEASON = ${data.season}
export const WEEK = ${data.week}
export const SOURCE = ${JSON.stringify(data.source)}

/** Deterministic game id: "{season}-{week}-{away}-{home}" with lowercased abbrs. */
export function gameId(away: string, home: string): string {
  return \`\${SEASON}-\${WEEK}-\${away.toLowerCase()}-\${home.toLowerCase()}\`
}
`

const body = [
  "// ─── Game meta (all 16 games) ───────────────────────────────────────────────",
  arr("games", data.games, GAME_KEYS),
  "",
  "// ─── Team game stats (one row per team per game) ─────────────────────────────",
  arr("teamGameStats", data.teamGameStats, TGS_KEYS),
  "",
  "// ─── Player box scores (Passing / Rushing / Receiving / Fumbles) ─────────────",
  arr("playerGameStats", data.playerGameStats, PGS_KEYS),
  "",
  "// ─── Advanced receiving ──────────────────────────────────────────────────────",
  arr("advReceiving", data.advReceiving, ADVREC_KEYS),
  "",
  "// ─── Advanced rushing ────────────────────────────────────────────────────────",
  arr("advRushing", data.advRushing, ADVRUSH_KEYS),
  "",
  "// ─── Advanced passing ────────────────────────────────────────────────────────",
  arr("advPassing", data.advPassing, ADVPASS_KEYS),
  "",
  "// ─── Not present in the Week-2 source (never fabricated) ─────────────────────",
  arr("snapCounts", data.snapCounts, []),
  arr("drives", data.drives, []),
  arr("teamOffense", data.teamOffense, []),
  arr("teamDefense", data.teamDefense, []),
].join("\n")

const footer = `

// ─── Exported dataset ───────────────────────────────────────────────────────

export const week2_2026: NflWeekDataset = {
  season: SEASON,
  week: WEEK,
  source: SOURCE,
  games,
  teamGameStats,
  playerGameStats,
  advReceiving,
  advRushing,
  advPassing,
  snapCounts,
  drives,
  teamOffense,
  teamDefense,
}

export default week2_2026
`

const ts = header + "\n" + body + footer
const dest = join(ROOT, "lib/analytics/nfl/week2-2026.ts")
writeFileSync(dest, ts)
console.log(`wrote ${dest} (${ts.split("\\n").length} lines)`)
