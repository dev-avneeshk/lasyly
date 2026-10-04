/**
 * Verify the parsed Week-2 data reconciles: for every team in every game, the
 * sum of player receiving must match the team passing line (the same invariant
 * lib/analytics/nfl/derive.ts#reconcileTeamPassing enforces). Also spot-check
 * that final scores and game count look right. Exits non-zero on any issue.
 */
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const __dirname = dirname(fileURLToPath(import.meta.url))
const data = JSON.parse(
  readFileSync(join(__dirname, "data/week2-2026.parsed.json"), "utf8")
)

const issues = []

for (const team of data.teamGameStats) {
  const players = data.playerGameStats.filter(
    (p) => p.game_id === team.game_id && p.team === team.team
  )
  const recSum = players.reduce((s, p) => s + (p.rec || 0), 0)
  const recYdsSum = players.reduce((s, p) => s + (p.rec_yds || 0), 0)
  const passCmpSum = players.reduce((s, p) => s + (p.pass_cmp || 0), 0)
  const passYdsSum = players.reduce((s, p) => s + (p.pass_yds || 0), 0)

  if (recSum !== team.pass_cmp)
    issues.push(`${team.game_id} ${team.team}: rec ${recSum} != team cmp ${team.pass_cmp}`)
  if (passCmpSum !== team.pass_cmp)
    issues.push(`${team.game_id} ${team.team}: QB cmp ${passCmpSum} != team cmp ${team.pass_cmp}`)
  if (recYdsSum !== team.pass_yds)
    issues.push(`${team.game_id} ${team.team}: rec yds ${recYdsSum} != team pass yds ${team.pass_yds}`)
  if (passYdsSum !== team.pass_yds)
    issues.push(`${team.game_id} ${team.team}: pass yds ${passYdsSum} != team pass yds ${team.pass_yds}`)
}

// Meta sanity
for (const g of data.games) {
  if (g.home_score == null || g.away_score == null)
    issues.push(`${g.game_id}: missing score`)
  if (!/^2026-2-[a-z]{2,3}-[a-z]{2,3}$/.test(g.game_id))
    issues.push(`${g.game_id}: bad id format`)
}

if (issues.length) {
  console.error(`RECONCILIATION FAILED (${issues.length}):`)
  for (const i of issues) console.error("  - " + i)
  process.exit(1)
}
console.log(`OK: ${data.games.length} games, ${data.teamGameStats.length} team lines, ${data.playerGameStats.length} players reconcile cleanly.`)
