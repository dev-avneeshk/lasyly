import { createAdminClient } from "../lib/supabase/admin"
import { config } from "dotenv"
config({ path: ".env.local" })

async function main() {
  const supabase = createAdminClient()
  const { data } = await supabase.from("nba_player_rankings").select("player_name, score, games_played, minutes_per_game, ranking_type, season, is_new").eq("ranking_version", "2026-27-v1").eq("ranking_type", "overall").order("rank", { ascending: true }).limit(20)
  console.log(data)
  
  const { data: hdata } = await supabase.from("nba_player_rankings").select("player_name, score, games_played, minutes_per_game, ranking_type, season, is_new").eq("ranking_version", "2025-26-v1").eq("ranking_type", "overall").order("rank", { ascending: true }).limit(20)
  console.log("Historical", hdata)
}
main()
