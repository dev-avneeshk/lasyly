/**
 * Player Stats API for ESPN Sports (NHL, NFL)
 *
 * Fetches per-game stats for a specific player and computes:
 * - Per-game averages (L5, L10, Season)
 * - Game log with all stats
 * - Derived metrics (shooting %, shift time, points, etc.)
 * - Hit rates for each stat vs a prop line
 */

import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { cached } from "@/lib/cache"
import { withSecurity, CACHE_CONTROL } from "@/lib/security/routeHelpers"

// ─── Types ──────────────────────────────────────────────────────────────────

interface PlayerStatsResult {
  player: string
  team: string
  sport: string
  position: string | null
  headshotUrl: string | null
  gameLog: GameEntry[]
  averages: Record<string, { label: string; l5: number | null; l10: number | null; season: number | null }>
  splits: Record<string, number | null>
}

interface GameEntry {
  date: string
  opponent: string
  result: string
  stats: Record<string, number | null>
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function avg(arr: (number | null)[], n?: number): number | null {
  const slice = n ? arr.slice(0, n) : arr
  const valid = slice.filter((v): v is number => v !== null && !isNaN(v))
  if (valid.length === 0) return null
  return Math.round((valid.reduce((s, v) => s + v, 0) / valid.length) * 100) / 100
}

function num(val: unknown): number | null {
  if (val === null || val === undefined || val === "" || val === "--" || val === "N/A") return null
  const n = Number(val)
  return isNaN(n) ? null : n
}

// ─── NHL Stats Computation ──────────────────────────────────────────────────

async function computeNHLPlayerStats(supabase: any, playerName: string): Promise<PlayerStatsResult | null> {
  const { data, error } = await supabase
    .from("espn_player_stats")
    .select("player_name, team, match_date, stats, game_id")
    .eq("league", "nhl")
    .ilike("player_name", `%${playerName}%`)
    .order("match_date", { ascending: false })
    .limit(50)

  if (error || !data || data.length === 0) return null

  // Get player info
  const player = data[0].player_name
  const team = data[0].team

  // Fetch headshot
  let headshotUrl: string | null = null
  let position: string | null = null
  try {
    const { data: playerRow } = await supabase
      .from("espn_players")
      .select("headshot_url, position, espn_id")
      .ilike("name", `%${playerName}%`)
      .eq("league", "nhl")
      .limit(1)
    if (playerRow?.[0]) {
      headshotUrl = playerRow[0].headshot_url || `https://a.espncdn.com/i/headshots/nhl/players/full/${playerRow[0].espn_id}.png`
      position = playerRow[0].position
    }
  } catch {}

  // Fetch game results for W/L
  const gameIds = [...new Set(data.map((r: any) => r.game_id).filter(Boolean))]
  const gameResultMap = new Map<string, string>()
  if (gameIds.length > 0) {
    try {
      const { data: games } = await supabase
        .from("espn_games")
        .select("id, home_team, away_team, home_score, away_score")
        .in("id", gameIds.slice(0, 50))
      if (games) {
        for (const g of games) {
          const isHome = g.home_team === team
          const won = isHome ? (g.home_score ?? 0) > (g.away_score ?? 0) : (g.away_score ?? 0) > (g.home_score ?? 0)
          gameResultMap.set(g.id, won ? "W" : "L")
        }
      }
    } catch {}
  }

  // Build game log
  const gameLog: GameEntry[] = []
  const statArrays: Record<string, (number | null)[]> = {
    G: [], A: [], PTS: [], SOG: [], HT: [], BS: [], TK: [], GV: [],
    plusMinus: [], TOI: [], PPTOI: [], SHTOI: [], ESTOI: [], SHFT: [],
    FW: [], FL: [], FO_PCT: [], PIM: [], ShootPct: [], ShiftTime: [],
  }

  for (const row of data) {
    const s = typeof row.stats === "string" ? JSON.parse(row.stats) : row.stats

    const goals = num(s.G) ?? 0
    const assists = num(s.A) ?? 0
    const points = goals + assists
    const sog = num(s.SOG)
    const hits = num(s.HT)
    const blocks = num(s.BS)
    const takeaways = num(s.TK)
    const giveaways = num(s.GV)
    const plusMinus = num(s["+/-"])
    const toi = num(s.TOI)
    const pptoi = num(s.PPTOI)
    const shtoi = num(s.SHTOI)
    const estoi = num(s.ESTOI)
    const shifts = num(s.SHFT)
    const fw = num(s.FW)
    const fl = num(s.FL)
    const foPct = num(s["FO%"])
    const pim = num(s.PIM)
    const shootPct = sog && sog > 0 ? Math.round((goals / sog) * 1000) / 10 : null
    const shiftTime = toi && shifts && shifts > 0 ? Math.round((toi / shifts) * 100) / 100 : null

    // Determine opponent from game
    let opponent = ""
    if (row.game_id) {
      // Extract from game_id format or fetch
      opponent = row.game_id.split("-").slice(-1)[0] ?? ""
    }

    const result = gameResultMap.get(row.game_id) ?? ""

    gameLog.push({
      date: row.match_date,
      opponent,
      result,
      stats: {
        G: goals, A: assists, PTS: points, SOG: sog, HT: hits, BS: blocks,
        TK: takeaways, GV: giveaways, "+/-": plusMinus, TOI: toi,
        PPTOI: pptoi, SHTOI: shtoi, ESTOI: estoi, SHFT: shifts,
        FW: fw, FL: fl, "FO%": foPct, PIM: pim,
        "SH%": shootPct, "SHIFT_TIME": shiftTime,
      },
    })

    statArrays.G.push(goals)
    statArrays.A.push(assists)
    statArrays.PTS.push(points)
    statArrays.SOG.push(sog)
    statArrays.HT.push(hits)
    statArrays.BS.push(blocks)
    statArrays.TK.push(takeaways)
    statArrays.GV.push(giveaways)
    statArrays.plusMinus.push(plusMinus)
    statArrays.TOI.push(toi)
    statArrays.PPTOI.push(pptoi)
    statArrays.SHTOI.push(shtoi)
    statArrays.ESTOI.push(estoi)
    statArrays.SHFT.push(shifts)
    statArrays.FW.push(fw)
    statArrays.FL.push(fl)
    statArrays.FO_PCT.push(foPct)
    statArrays.PIM.push(pim)
    statArrays.ShootPct.push(shootPct)
    statArrays.ShiftTime.push(shiftTime)
  }

  // Compute averages
  const averages: Record<string, { label: string; l5: number | null; l10: number | null; season: number | null }> = {
    PTS: { label: "Points", l5: avg(statArrays.PTS, 5), l10: avg(statArrays.PTS, 10), season: avg(statArrays.PTS) },
    G: { label: "Goals", l5: avg(statArrays.G, 5), l10: avg(statArrays.G, 10), season: avg(statArrays.G) },
    A: { label: "Assists", l5: avg(statArrays.A, 5), l10: avg(statArrays.A, 10), season: avg(statArrays.A) },
    SOG: { label: "Shots on Goal", l5: avg(statArrays.SOG, 5), l10: avg(statArrays.SOG, 10), season: avg(statArrays.SOG) },
    HT: { label: "Hits", l5: avg(statArrays.HT, 5), l10: avg(statArrays.HT, 10), season: avg(statArrays.HT) },
    BS: { label: "Blocked Shots", l5: avg(statArrays.BS, 5), l10: avg(statArrays.BS, 10), season: avg(statArrays.BS) },
    TK: { label: "Takeaways", l5: avg(statArrays.TK, 5), l10: avg(statArrays.TK, 10), season: avg(statArrays.TK) },
    GV: { label: "Giveaways", l5: avg(statArrays.GV, 5), l10: avg(statArrays.GV, 10), season: avg(statArrays.GV) },
    plusMinus: { label: "+/-", l5: avg(statArrays.plusMinus, 5), l10: avg(statArrays.plusMinus, 10), season: avg(statArrays.plusMinus) },
    TOI: { label: "TOI (min)", l5: avg(statArrays.TOI, 5), l10: avg(statArrays.TOI, 10), season: avg(statArrays.TOI) },
    PPTOI: { label: "PP TOI", l5: avg(statArrays.PPTOI, 5), l10: avg(statArrays.PPTOI, 10), season: avg(statArrays.PPTOI) },
    ESTOI: { label: "ES TOI", l5: avg(statArrays.ESTOI, 5), l10: avg(statArrays.ESTOI, 10), season: avg(statArrays.ESTOI) },
    SHFT: { label: "Shifts", l5: avg(statArrays.SHFT, 5), l10: avg(statArrays.SHFT, 10), season: avg(statArrays.SHFT) },
    ShiftTime: { label: "Shift Time", l5: avg(statArrays.ShiftTime, 5), l10: avg(statArrays.ShiftTime, 10), season: avg(statArrays.ShiftTime) },
    FO_PCT: { label: "Faceoff %", l5: avg(statArrays.FO_PCT, 5), l10: avg(statArrays.FO_PCT, 10), season: avg(statArrays.FO_PCT) },
    PIM: { label: "PIM", l5: avg(statArrays.PIM, 5), l10: avg(statArrays.PIM, 10), season: avg(statArrays.PIM) },
    ShootPct: { label: "Shooting %", l5: avg(statArrays.ShootPct, 5), l10: avg(statArrays.ShootPct, 10), season: avg(statArrays.ShootPct) },
  }

  // Season splits (per-game averages)
  const splits: Record<string, number | null> = {
    Points: avg(statArrays.PTS),
    Goals: avg(statArrays.G),
    Assists: avg(statArrays.A),
    Shots: avg(statArrays.SOG),
    Hits: avg(statArrays.HT),
    "Blocked Shots": avg(statArrays.BS),
    Takeaways: avg(statArrays.TK),
    Giveaways: avg(statArrays.GV),
    "Faceoffs Won": avg(statArrays.FW),
    "Faceoffs Lost": avg(statArrays.FL),
    "+/-": avg(statArrays.plusMinus),
    PIM: avg(statArrays.PIM),
    "Shooting %": avg(statArrays.ShootPct),
  }

  return { player, team, sport: "NHL", position, headshotUrl, gameLog, averages, splits }
}

// ─── NFL Stats Computation ──────────────────────────────────────────────────

async function computeNFLPlayerStats(supabase: any, playerName: string): Promise<PlayerStatsResult | null> {
  const { data, error } = await supabase
    .from("espn_player_stats")
    .select("player_name, team, match_date, stats, game_id")
    .eq("league", "nfl")
    .ilike("player_name", `%${playerName}%`)
    .order("match_date", { ascending: false })
    .limit(30)

  if (error || !data || data.length === 0) return null

  const player = data[0].player_name
  const team = data[0].team

  let headshotUrl: string | null = null
  let position: string | null = null
  try {
    const { data: playerRow } = await supabase
      .from("espn_players")
      .select("headshot_url, position, espn_id")
      .ilike("name", `%${playerName}%`)
      .eq("league", "nfl")
      .limit(1)
    if (playerRow?.[0]) {
      headshotUrl = playerRow[0].headshot_url || `https://a.espncdn.com/i/headshots/nfl/players/full/${playerRow[0].espn_id}.png`
      position = playerRow[0].position
    }
  } catch {}

  const gameLog: GameEntry[] = []
  const statArrays: Record<string, (number | null)[]> = {
    YDS: [], TD: [], REC: [], CAR: [], TGTS: [], INT: [], SACKS: [], FUM: [],
  }

  for (const row of data) {
    const s = typeof row.stats === "string" ? JSON.parse(row.stats) : row.stats

    const yds = num(s.YDS)
    const td = num(s.TD)
    const rec = num(s.REC)
    const car = num(s.CAR)
    const tgts = num(s.TGTS)
    const int = num(s.INT)
    const sacks = num(s.SACKS)
    const fum = num(s.FUM)

    gameLog.push({
      date: row.match_date, opponent: "", result: "",
      stats: { YDS: yds, TD: td, REC: rec, CAR: car, TGTS: tgts, INT: int, SACKS: sacks, FUM: fum },
    })

    statArrays.YDS.push(yds)
    statArrays.TD.push(td)
    statArrays.REC.push(rec)
    statArrays.CAR.push(car)
    statArrays.TGTS.push(tgts)
    statArrays.INT.push(int)
    statArrays.SACKS.push(sacks)
    statArrays.FUM.push(fum)
  }

  const averages: Record<string, { label: string; l5: number | null; l10: number | null; season: number | null }> = {
    YDS: { label: "Yards", l5: avg(statArrays.YDS, 5), l10: avg(statArrays.YDS, 10), season: avg(statArrays.YDS) },
    TD: { label: "Touchdowns", l5: avg(statArrays.TD, 5), l10: avg(statArrays.TD, 10), season: avg(statArrays.TD) },
    REC: { label: "Receptions", l5: avg(statArrays.REC, 5), l10: avg(statArrays.REC, 10), season: avg(statArrays.REC) },
    CAR: { label: "Carries", l5: avg(statArrays.CAR, 5), l10: avg(statArrays.CAR, 10), season: avg(statArrays.CAR) },
    TGTS: { label: "Targets", l5: avg(statArrays.TGTS, 5), l10: avg(statArrays.TGTS, 10), season: avg(statArrays.TGTS) },
    INT: { label: "Interceptions", l5: avg(statArrays.INT, 5), l10: avg(statArrays.INT, 10), season: avg(statArrays.INT) },
    SACKS: { label: "Sacks", l5: avg(statArrays.SACKS, 5), l10: avg(statArrays.SACKS, 10), season: avg(statArrays.SACKS) },
    FUM: { label: "Fumbles", l5: avg(statArrays.FUM, 5), l10: avg(statArrays.FUM, 10), season: avg(statArrays.FUM) },
  }

  const splits: Record<string, number | null> = {
    Yards: avg(statArrays.YDS),
    Touchdowns: avg(statArrays.TD),
    Receptions: avg(statArrays.REC),
    Carries: avg(statArrays.CAR),
    Targets: avg(statArrays.TGTS),
    Interceptions: avg(statArrays.INT),
    Sacks: avg(statArrays.SACKS),
    Fumbles: avg(statArrays.FUM),
  }

  return { player, team, sport: "NFL", position, headshotUrl, gameLog, averages, splits }
}

// ─── Route Handler ──────────────────────────────────────────────────────────

export const GET = withSecurity(async (request: Request) => {
  const { searchParams } = new URL(request.url)
  const player = searchParams.get("player") ?? ""
  const sport = searchParams.get("sport") ?? "NHL"

  if (!player || player.length < 2) {
    return NextResponse.json({ error: "player parameter required" }, { status: 400 })
  }

  const cacheKey = `player-stats:${sport}:${player.toLowerCase().slice(0, 30)}`
  const result = await cached(cacheKey, async () => {
    const supabase = createAdminClient()
    switch (sport) {
      case "NHL": return computeNHLPlayerStats(supabase, player)
      case "NFL": return computeNFLPlayerStats(supabase, player)
      default: return null
    }
  }, 120_000)

  if (!result) {
    return NextResponse.json({ error: "No data found", player, sport }, { status: 404 })
  }

  return NextResponse.json(result)
}, { cacheControl: CACHE_CONTROL.PUBLIC_MEDIUM })
