import { runProjectionRankings, runHistoricalSeasonRankings } from "../lib/rankings/pipeline"
import { createAdminClient } from "../lib/supabase/admin"
import { config } from "dotenv"

config({ path: ".env.local" })

async function main() {
  console.log("=== Running NBA Rankings Pipeline ===")
  const supabase = createAdminClient()

  // Clean up partial runs
  console.log("Cleaning up partial data from previous runs...")
  await supabase.from("nba_player_rankings").delete().eq("ranking_version", "2026-27-v1")

  // 1. Run Historical 2025-26
  console.log("\n[1/2] Generating Historical 2025-26 Rankings...")
  await supabase.from("nba_player_rankings").delete().eq("ranking_version", "2025-26-v1")
  const histResult = await runHistoricalSeasonRankings(undefined, { dryRun: false, version: '2025-26-v1' })
  console.log("Historical Done:", histResult)

  // 2. Run Projected 2026-27
  console.log("\n[2/2] Generating Projected 2026-27 Rankings...")
  const projResult = await runProjectionRankings(undefined, undefined, { dryRun: false, version: '2026-27-v1' })
  console.log("Projection Done:", projResult)
  
  if (projResult.errors.length > 0) {
    console.error("\nErrors encountered:")
    projResult.errors.forEach(e => console.error("-", e))
  }
}

main().catch(console.error)
