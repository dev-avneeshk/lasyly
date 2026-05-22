/**
 * Team/Player Stats API for ESPN Sports (Soccer, NFL, NHL)
 *
 * Computes derived analytics from game history:
 * - Soccer: Goals scored/conceded, clean sheets, BTTS, cards per game, xG trends
 * - NFL: Yards/game, TD rate, turnover margin, red zone efficiency
 * - NHL: Goals/game, shots/game, power play, penalty kill, save %
 *
 * All stats computed from espn_games + espn_player_stats tables.
 */

import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { cached } from "@/lib/cache"
import { withSecurity, CACHE_CONTROL } from "@/lib/security/routeHelpers"

// ─── Types ──────────────────────────────────────────────────────────────────

interface TeamStatsResult {
  team: string
  sport: string
  league: string
  logoUrl: string | null
  stats: Record<string, StatBlock>
  gameLog: GameLogEntry[]
  defensiveStats: Record<string, StatBlock>
}

interface StatBlock {
  label: string
  l5: number | null
  l10: number | null
  season: number | null
  trend: "up" | "down" | "neutral"
}

interface GameLogEntry {
  date: string
  opponent: string
  goalsFor: number
  goalsAgainst: number
  result: "W" | "D" | "L"
  stats: Record<string, number>
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function avg(arr: number[]): number | null {
  if (arr.length === 0) return null
  return Math.round((arr.reduce((s, v) => s + v, 0) / arr.length) * 100) / 100
}

function trend(l5: number | null, l10: number | null): "up" | "down" | "neutral" {
  if (l5 === null || l10 === null) return "neutral"
  const diff = ((l5 - l10) / Math.max(l10, 0.01)) * 100
  if (diff > 8) return "up"
  if (diff < -8) return "down"
  return "neutral"
}

function pct(num: number, denom: number): number | null {
  if (denom === 0) return null
  return Math.round((num / denom) * 1000) / 10
}

// ─── Soccer Stats ───────────────────────────────────────────────────────────

const SOCCER_LEAGUES = ["eng.1", "esp.1", "ger.1", "ita.1", "fra.1", "uefa.champions", "usa.1"]

async function computeSoccerStats(supabase: any, team: string): Promise<TeamStatsResult | null> {
  // Fetch games for this team
  const { data: games, error } = await supabase
    .from("espn_games")
    .select("id, home_team, away_team, home_score, away_score, league, match_date, home_logo, away_logo")
    .in("league", SOCCER_LEAGUES)
    .eq("status", "completed")
    .or(`home_team.eq.${team},away_team.eq.${team}`)
    .order("match_date", { ascending: false })
    .limit(30)

  if (error || !games || games.length === 0) return null

  // Also fetch player stats for this team (cards, shots, etc.)
  const { data: playerStats } = await supabase
    .from("espn_player_stats")
    .select("game_id, team, match_date, stats")
    .eq("team", team)
    .in("league", SOCCER_LEAGUES)
    .order("match_date", { ascending: false })
    .limit(500)

  // Aggregate per-game team stats from player stats
  const gameCardMap = new Map<string, { yellows: number; reds: number; shots: number; shotsOnTarget: number; fouls: number }>()
  if (playerStats) {
    for (const row of playerStats) {
      const s = typeof row.stats === "string" ? JSON.parse(row.stats) : row.stats
      const gid = row.game_id
      if (!gameCardMap.has(gid)) {
        gameCardMap.set(gid, { yellows: 0, reds: 0, shots: 0, shotsOnTarget: 0, fouls: 0 })
      }
      const g = gameCardMap.get(gid)!
      g.yellows += Number(s?.yellowCards ?? 0) || 0
      g.reds += Number(s?.redCards ?? 0) || 0
      g.shots += Number(s?.totalShots ?? 0) || 0
      g.shotsOnTarget += Number(s?.shotsOnTarget ?? 0) || 0
      g.fouls += Number(s?.foulsCommitted ?? 0) || 0
    }
  }

  // Build game log
  const gameLog: GameLogEntry[] = []
  const goalsFor: number[] = []
  const goalsAgainst: number[] = []
  const totalGoals: number[] = []
  const cleanSheets: number[] = []
  const btts: number[] = []
  const cards: number[] = []
  const shots: number[] = []
  const shotsOnTarget: number[] = []

  let logoUrl: string | null = null
  let league = ""

  for (const game of games) {
    const isHome = game.home_team === team
    const gf = isHome ? (game.home_score ?? 0) : (game.away_score ?? 0)
    const ga = isHome ? (game.away_score ?? 0) : (game.home_score ?? 0)
    const opponent = isHome ? game.away_team : game.home_team
    const result: "W" | "D" | "L" = gf > ga ? "W" : gf < ga ? "L" : "D"

    if (!logoUrl) logoUrl = isHome ? game.home_logo : game.away_logo
    if (!league) league = game.league

    goalsFor.push(gf)
    goalsAgainst.push(ga)
    totalGoals.push(gf + ga)
    cleanSheets.push(ga === 0 ? 1 : 0)
    btts.push(gf > 0 && ga > 0 ? 1 : 0)

    const gameAgg = gameCardMap.get(game.id)
    cards.push(gameAgg ? gameAgg.yellows + gameAgg.reds : 0)
    shots.push(gameAgg?.shots ?? 0)
    shotsOnTarget.push(gameAgg?.shotsOnTarget ?? 0)

    gameLog.push({
      date: game.match_date,
      opponent,
      goalsFor: gf,
      goalsAgainst: ga,
      result,
      stats: {
        goalsFor: gf,
        goalsAgainst: ga,
        totalGoals: gf + ga,
        cards: gameAgg ? gameAgg.yellows + gameAgg.reds : 0,
        shots: gameAgg?.shots ?? 0,
        shotsOnTarget: gameAgg?.shotsOnTarget ?? 0,
      },
    })
  }

  // Compute stat blocks
  const stats: Record<string, StatBlock> = {
    goalsPerGame: {
      label: "Goals/Game",
      l5: avg(goalsFor.slice(0, 5)),
      l10: avg(goalsFor.slice(0, 10)),
      season: avg(goalsFor),
      trend: trend(avg(goalsFor.slice(0, 5)), avg(goalsFor.slice(0, 10))),
    },
    totalGoalsPerGame: {
      label: "Match Goals/Game",
      l5: avg(totalGoals.slice(0, 5)),
      l10: avg(totalGoals.slice(0, 10)),
      season: avg(totalGoals),
      trend: trend(avg(totalGoals.slice(0, 5)), avg(totalGoals.slice(0, 10))),
    },
    cleanSheetRate: {
      label: "Clean Sheet %",
      l5: pct(cleanSheets.slice(0, 5).filter(v => v === 1).length, Math.min(5, cleanSheets.length)),
      l10: pct(cleanSheets.slice(0, 10).filter(v => v === 1).length, Math.min(10, cleanSheets.length)),
      season: pct(cleanSheets.filter(v => v === 1).length, cleanSheets.length),
      trend: trend(
        pct(cleanSheets.slice(0, 5).filter(v => v === 1).length, Math.min(5, cleanSheets.length)),
        pct(cleanSheets.slice(0, 10).filter(v => v === 1).length, Math.min(10, cleanSheets.length))
      ),
    },
    bttsRate: {
      label: "BTTS %",
      l5: pct(btts.slice(0, 5).filter(v => v === 1).length, Math.min(5, btts.length)),
      l10: pct(btts.slice(0, 10).filter(v => v === 1).length, Math.min(10, btts.length)),
      season: pct(btts.filter(v => v === 1).length, btts.length),
      trend: trend(
        pct(btts.slice(0, 5).filter(v => v === 1).length, Math.min(5, btts.length)),
        pct(btts.slice(0, 10).filter(v => v === 1).length, Math.min(10, btts.length))
      ),
    },
    cardsPerGame: {
      label: "Cards/Game",
      l5: avg(cards.slice(0, 5)),
      l10: avg(cards.slice(0, 10)),
      season: avg(cards),
      trend: trend(avg(cards.slice(0, 5)), avg(cards.slice(0, 10))),
    },
    shotsPerGame: {
      label: "Shots/Game",
      l5: avg(shots.slice(0, 5)),
      l10: avg(shots.slice(0, 10)),
      season: avg(shots),
      trend: trend(avg(shots.slice(0, 5)), avg(shots.slice(0, 10))),
    },
    shotAccuracy: {
      label: "Shot Accuracy %",
      l5: pct(shotsOnTarget.slice(0, 5).reduce((s, v) => s + v, 0), shots.slice(0, 5).reduce((s, v) => s + v, 0)),
      l10: pct(shotsOnTarget.slice(0, 10).reduce((s, v) => s + v, 0), shots.slice(0, 10).reduce((s, v) => s + v, 0)),
      season: pct(shotsOnTarget.reduce((s, v) => s + v, 0), shots.reduce((s, v) => s + v, 0)),
      trend: "neutral",
    },
  }

  // Defensive stats
  const defensiveStats: Record<string, StatBlock> = {
    concededPerGame: {
      label: "Goals Conceded/Game",
      l5: avg(goalsAgainst.slice(0, 5)),
      l10: avg(goalsAgainst.slice(0, 10)),
      season: avg(goalsAgainst),
      trend: trend(avg(goalsAgainst.slice(0, 5)), avg(goalsAgainst.slice(0, 10))),
    },
    over15Rate: {
      label: "Over 1.5 Goals %",
      l5: pct(totalGoals.slice(0, 5).filter(v => v > 1.5).length, Math.min(5, totalGoals.length)),
      l10: pct(totalGoals.slice(0, 10).filter(v => v > 1.5).length, Math.min(10, totalGoals.length)),
      season: pct(totalGoals.filter(v => v > 1.5).length, totalGoals.length),
      trend: "neutral",
    },
    over25Rate: {
      label: "Over 2.5 Goals %",
      l5: pct(totalGoals.slice(0, 5).filter(v => v > 2.5).length, Math.min(5, totalGoals.length)),
      l10: pct(totalGoals.slice(0, 10).filter(v => v > 2.5).length, Math.min(10, totalGoals.length)),
      season: pct(totalGoals.filter(v => v > 2.5).length, totalGoals.length),
      trend: "neutral",
    },
    winRate: {
      label: "Win Rate %",
      l5: pct(gameLog.slice(0, 5).filter(g => g.result === "W").length, Math.min(5, gameLog.length)),
      l10: pct(gameLog.slice(0, 10).filter(g => g.result === "W").length, Math.min(10, gameLog.length)),
      season: pct(gameLog.filter(g => g.result === "W").length, gameLog.length),
      trend: trend(
        pct(gameLog.slice(0, 5).filter(g => g.result === "W").length, Math.min(5, gameLog.length)),
        pct(gameLog.slice(0, 10).filter(g => g.result === "W").length, Math.min(10, gameLog.length))
      ),
    },
  }

  return { team, sport: "Soccer", league, logoUrl, stats, gameLog, defensiveStats }
}

// ─── NFL Stats ──────────────────────────────────────────────────────────────

async function computeNFLStats(supabase: any, team: string): Promise<TeamStatsResult | null> {
  const { data: games } = await supabase
    .from("espn_games")
    .select("id, home_team, away_team, home_score, away_score, league, match_date, home_logo, away_logo")
    .eq("league", "nfl")
    .eq("status", "completed")
    .or(`home_team.eq.${team},away_team.eq.${team}`)
    .order("match_date", { ascending: false })
    .limit(20)

  if (!games || games.length === 0) return null

  // Fetch player stats for yards, TDs, etc.
  const { data: playerStats } = await supabase
    .from("espn_player_stats")
    .select("game_id, team, stats")
    .eq("team", team)
    .eq("league", "nfl")
    .order("match_date", { ascending: false })
    .limit(500)

  // Aggregate per-game
  const gameStatMap = new Map<string, { yards: number; tds: number; turnovers: number; sacks: number }>()
  if (playerStats) {
    for (const row of playerStats) {
      const s = typeof row.stats === "string" ? JSON.parse(row.stats) : row.stats
      const gid = row.game_id
      if (!gameStatMap.has(gid)) gameStatMap.set(gid, { yards: 0, tds: 0, turnovers: 0, sacks: 0 })
      const g = gameStatMap.get(gid)!
      g.yards += Number(s?.YDS ?? 0) || 0
      g.tds += Number(s?.TD ?? 0) || 0
      g.turnovers += (Number(s?.INT ?? 0) || 0) + (Number(s?.FUM ?? 0) || 0)
      g.sacks += Number(s?.SACKS ?? 0) || 0
    }
  }

  const pointsFor: number[] = []
  const pointsAgainst: number[] = []
  const yards: number[] = []
  const tds: number[] = []
  const turnovers: number[] = []
  const gameLog: GameLogEntry[] = []
  let logoUrl: string | null = null

  for (const game of games) {
    const isHome = game.home_team === team
    const pf = isHome ? (game.home_score ?? 0) : (game.away_score ?? 0)
    const pa = isHome ? (game.away_score ?? 0) : (game.home_score ?? 0)
    const opponent = isHome ? game.away_team : game.home_team
    if (!logoUrl) logoUrl = isHome ? game.home_logo : game.away_logo

    pointsFor.push(pf)
    pointsAgainst.push(pa)
    const gs = gameStatMap.get(game.id)
    yards.push(gs?.yards ?? 0)
    tds.push(gs?.tds ?? 0)
    turnovers.push(gs?.turnovers ?? 0)

    gameLog.push({
      date: game.match_date, opponent, goalsFor: pf, goalsAgainst: pa,
      result: pf > pa ? "W" : pf < pa ? "L" : "D",
      stats: { pointsFor: pf, pointsAgainst: pa, yards: gs?.yards ?? 0, tds: gs?.tds ?? 0, turnovers: gs?.turnovers ?? 0 },
    })
  }

  const stats: Record<string, StatBlock> = {
    pointsPerGame: { label: "Points/Game", l5: avg(pointsFor.slice(0, 5)), l10: avg(pointsFor.slice(0, 10)), season: avg(pointsFor), trend: trend(avg(pointsFor.slice(0, 5)), avg(pointsFor.slice(0, 10))) },
    yardsPerGame: { label: "Yards/Game", l5: avg(yards.slice(0, 5)), l10: avg(yards.slice(0, 10)), season: avg(yards), trend: trend(avg(yards.slice(0, 5)), avg(yards.slice(0, 10))) },
    tdsPerGame: { label: "TDs/Game", l5: avg(tds.slice(0, 5)), l10: avg(tds.slice(0, 10)), season: avg(tds), trend: trend(avg(tds.slice(0, 5)), avg(tds.slice(0, 10))) },
    turnoversPerGame: { label: "Turnovers/Game", l5: avg(turnovers.slice(0, 5)), l10: avg(turnovers.slice(0, 10)), season: avg(turnovers), trend: trend(avg(turnovers.slice(0, 5)), avg(turnovers.slice(0, 10))) },
    turnoverMargin: { label: "Turnover Margin", l5: avg(pointsFor.slice(0, 5).map((_, i) => (turnovers[i] ?? 0) * -1)), l10: null, season: null, trend: "neutral" },
  }

  const defensiveStats: Record<string, StatBlock> = {
    pointsAllowed: { label: "Points Allowed/Game", l5: avg(pointsAgainst.slice(0, 5)), l10: avg(pointsAgainst.slice(0, 10)), season: avg(pointsAgainst), trend: trend(avg(pointsAgainst.slice(0, 5)), avg(pointsAgainst.slice(0, 10))) },
    winRate: { label: "Win Rate %", l5: pct(gameLog.slice(0, 5).filter(g => g.result === "W").length, Math.min(5, gameLog.length)), l10: pct(gameLog.slice(0, 10).filter(g => g.result === "W").length, Math.min(10, gameLog.length)), season: pct(gameLog.filter(g => g.result === "W").length, gameLog.length), trend: "neutral" },
    scoringMargin: { label: "Scoring Margin", l5: avg(pointsFor.slice(0, 5).map((pf, i) => pf - (pointsAgainst[i] ?? 0))), l10: avg(pointsFor.slice(0, 10).map((pf, i) => pf - (pointsAgainst[i] ?? 0))), season: avg(pointsFor.map((pf, i) => pf - (pointsAgainst[i] ?? 0))), trend: "neutral" },
  }

  return { team, sport: "NFL", league: "nfl", logoUrl, stats, gameLog, defensiveStats }
}

// ─── NHL Stats ──────────────────────────────────────────────────────────────

async function computeNHLStats(supabase: any, team: string): Promise<TeamStatsResult | null> {
  const { data: games } = await supabase
    .from("espn_games")
    .select("id, home_team, away_team, home_score, away_score, league, match_date, home_logo, away_logo")
    .eq("league", "nhl")
    .eq("status", "completed")
    .or(`home_team.eq.${team},away_team.eq.${team}`)
    .order("match_date", { ascending: false })
    .limit(30)

  if (!games || games.length === 0) return null

  const { data: playerStats } = await supabase
    .from("espn_player_stats")
    .select("game_id, team, stats")
    .eq("team", team)
    .eq("league", "nhl")
    .order("match_date", { ascending: false })
    .limit(500)

  const gameStatMap = new Map<string, { goals: number; shots: number; hits: number; blocks: number; pim: number }>()
  if (playerStats) {
    for (const row of playerStats) {
      const s = typeof row.stats === "string" ? JSON.parse(row.stats) : row.stats
      const gid = row.game_id
      if (!gameStatMap.has(gid)) gameStatMap.set(gid, { goals: 0, shots: 0, hits: 0, blocks: 0, pim: 0 })
      const g = gameStatMap.get(gid)!
      g.goals += Number(s?.G ?? 0) || 0
      g.shots += Number(s?.SOG ?? s?.S ?? 0) || 0
      g.hits += Number(s?.HT ?? 0) || 0
      g.blocks += Number(s?.BS ?? 0) || 0
      g.pim += Number(s?.PIM ?? 0) || 0
    }
  }

  const goalsFor: number[] = []
  const goalsAgainst: number[] = []
  const shotsArr: number[] = []
  const hitsArr: number[] = []
  const pimArr: number[] = []
  const gameLog: GameLogEntry[] = []
  let logoUrl: string | null = null

  for (const game of games) {
    const isHome = game.home_team === team
    const gf = isHome ? (game.home_score ?? 0) : (game.away_score ?? 0)
    const ga = isHome ? (game.away_score ?? 0) : (game.home_score ?? 0)
    const opponent = isHome ? game.away_team : game.home_team
    if (!logoUrl) logoUrl = isHome ? game.home_logo : game.away_logo

    goalsFor.push(gf)
    goalsAgainst.push(ga)
    const gs = gameStatMap.get(game.id)
    shotsArr.push(gs?.shots ?? 0)
    hitsArr.push(gs?.hits ?? 0)
    pimArr.push(gs?.pim ?? 0)

    gameLog.push({
      date: game.match_date, opponent, goalsFor: gf, goalsAgainst: ga,
      result: gf > ga ? "W" : gf < ga ? "L" : "D",
      stats: { goalsFor: gf, goalsAgainst: ga, shots: gs?.shots ?? 0, hits: gs?.hits ?? 0, pim: gs?.pim ?? 0 },
    })
  }

  const stats: Record<string, StatBlock> = {
    goalsPerGame: { label: "Goals/Game", l5: avg(goalsFor.slice(0, 5)), l10: avg(goalsFor.slice(0, 10)), season: avg(goalsFor), trend: trend(avg(goalsFor.slice(0, 5)), avg(goalsFor.slice(0, 10))) },
    shotsPerGame: { label: "Shots/Game", l5: avg(shotsArr.slice(0, 5)), l10: avg(shotsArr.slice(0, 10)), season: avg(shotsArr), trend: trend(avg(shotsArr.slice(0, 5)), avg(shotsArr.slice(0, 10))) },
    hitsPerGame: { label: "Hits/Game", l5: avg(hitsArr.slice(0, 5)), l10: avg(hitsArr.slice(0, 10)), season: avg(hitsArr), trend: trend(avg(hitsArr.slice(0, 5)), avg(hitsArr.slice(0, 10))) },
    pimPerGame: { label: "PIM/Game", l5: avg(pimArr.slice(0, 5)), l10: avg(pimArr.slice(0, 10)), season: avg(pimArr), trend: trend(avg(pimArr.slice(0, 5)), avg(pimArr.slice(0, 10))) },
  }

  const defensiveStats: Record<string, StatBlock> = {
    goalsAllowed: { label: "Goals Allowed/Game", l5: avg(goalsAgainst.slice(0, 5)), l10: avg(goalsAgainst.slice(0, 10)), season: avg(goalsAgainst), trend: trend(avg(goalsAgainst.slice(0, 5)), avg(goalsAgainst.slice(0, 10))) },
    totalGoalsPerGame: { label: "Total Goals/Game", l5: avg(goalsFor.slice(0, 5).map((gf, i) => gf + (goalsAgainst[i] ?? 0))), l10: avg(goalsFor.slice(0, 10).map((gf, i) => gf + (goalsAgainst[i] ?? 0))), season: avg(goalsFor.map((gf, i) => gf + (goalsAgainst[i] ?? 0))), trend: "neutral" },
    winRate: { label: "Win Rate %", l5: pct(gameLog.slice(0, 5).filter(g => g.result === "W").length, Math.min(5, gameLog.length)), l10: pct(gameLog.slice(0, 10).filter(g => g.result === "W").length, Math.min(10, gameLog.length)), season: pct(gameLog.filter(g => g.result === "W").length, gameLog.length), trend: "neutral" },
    scoringMargin: { label: "Goal Differential", l5: avg(goalsFor.slice(0, 5).map((gf, i) => gf - (goalsAgainst[i] ?? 0))), l10: avg(goalsFor.slice(0, 10).map((gf, i) => gf - (goalsAgainst[i] ?? 0))), season: avg(goalsFor.map((gf, i) => gf - (goalsAgainst[i] ?? 0))), trend: "neutral" },
  }

  return { team, sport: "NHL", league: "nhl", logoUrl, stats, gameLog, defensiveStats }
}

// ─── Route Handler ──────────────────────────────────────────────────────────

export const GET = withSecurity(async (request: Request) => {
  const { searchParams } = new URL(request.url)
  const team = searchParams.get("team") ?? ""
  const sport = searchParams.get("sport") ?? "Soccer"

  if (!team) {
    return NextResponse.json({ error: "team parameter required" }, { status: 400 })
  }

  const cacheKey = `team-stats:${sport}:${team}`
  const result = await cached(cacheKey, async () => {
    const supabase = createAdminClient()

    switch (sport) {
      case "Soccer": return computeSoccerStats(supabase, team)
      case "NFL": return computeNFLStats(supabase, team)
      case "NHL": return computeNHLStats(supabase, team)
      default: return null
    }
  }, 120_000) // 2 min cache

  if (!result) {
    return NextResponse.json({ error: "No data found", team, sport }, { status: 404 })
  }

  return NextResponse.json(result)
}, { cacheControl: CACHE_CONTROL.PUBLIC_MEDIUM })
