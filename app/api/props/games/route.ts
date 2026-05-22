import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { cached } from "@/lib/cache"
import { Game } from "@/lib/props/types"
import { withSecurity, checkQueryParams, CACHE_CONTROL } from "@/lib/security/routeHelpers"

const GAMES_CACHE_TTL = 30_000 // 30 seconds

export const GET = withSecurity(async (request: Request) => {
  const { searchParams } = new URL(request.url)
  const sport = (searchParams.get("sport") ?? "NBA") as string
  const dateParam = searchParams.get("date") // YYYY-MM-DD format, optional

  // Check query params for injection patterns
  const injectionCheck = checkQueryParams({ sport: searchParams.get("sport"), date: dateParam })
  if (injectionCheck) return injectionCheck

  // Use date param or default to today
  const targetDate = dateParam ?? new Date().toISOString().split("T")[0]
  const cacheKey = `games:${sport}:${targetDate}`

  const games = await cached(cacheKey, () => fetchGames(sport, targetDate), GAMES_CACHE_TTL)

  return NextResponse.json({
    games,
    meta: {
      sport,
      date: targetDate,
    },
  })
}, { cacheControl: CACHE_CONTROL.PUBLIC_MEDIUM })

async function fetchGames(sport: string, date: string): Promise<Game[]> {
  const supabase = createAdminClient()

  if (sport === "NBA") {
    const { data, error } = await supabase
      .from("nba_games")
      .select("id, home_team, away_team, game_date, status, home_score, away_score")
      .eq("game_date", date)
      .order("game_date", { ascending: true })
      .limit(20)

    if (error || !data) {
      console.error("Error fetching NBA games:", error)
      return []
    }

    return data.map((g) => ({
      id: String(g.id),
      homeTeam: getNBAAbbrFromName(g.home_team),
      awayTeam: getNBAAbbrFromName(g.away_team),
      gameTime: g.game_date,
      status: mapGameStatus(g.status),
      homeScore: g.home_score ?? undefined,
      awayScore: g.away_score ?? undefined,
      homeLogo: getNBALogo(g.home_team),
      awayLogo: getNBALogo(g.away_team),
    }))
  }

  if (sport === "Tennis") {
    const { data, error } = await supabase
      .from("tennis_matches")
      .select("id, player1_name, player2_name, status, score, tournament, round")
      .eq("status", "upcoming")
      .limit(20)

    if (error || !data) {
      console.error("Error fetching tennis matches:", error)
      return []
    }

    return data.map((m) => ({
      id: String(m.id),
      homeTeam: m.player1_name ?? "TBD",
      awayTeam: m.player2_name ?? "TBD",
      gameTime: m.tournament ?? "",
      status: "scheduled" as const,
    }))
  }

  // Soccer, NFL, NHL — fetch from espn_games table
  if (sport === "Soccer" || sport === "NFL" || sport === "NHL") {
    // Map sport to ESPN league codes
    const leagueMap: Record<string, string[]> = {
      Soccer: ["eng.1", "esp.1", "ger.1", "ita.1", "fra.1", "uefa.champions", "usa.1"],
      NFL: ["nfl"],
      NHL: ["nhl"],
    }
    const leagues = leagueMap[sport] ?? []

    const { data, error } = await supabase
      .from("espn_games")
      .select("id, home_team, away_team, match_date, status, home_score, away_score, league, home_logo, away_logo")
      .in("league", leagues)
      .eq("match_date", date)
      .order("match_date", { ascending: true })
      .limit(20)

    if (error || !data) {
      console.error(`Error fetching ${sport} games:`, error)
      return []
    }

    return data.map((g) => ({
      id: String(g.id),
      homeTeam: g.home_team ?? "TBD",
      awayTeam: g.away_team ?? "TBD",
      gameTime: g.match_date ?? "",
      status: mapGameStatus(g.status),
      homeScore: g.home_score ?? undefined,
      awayScore: g.away_score ?? undefined,
      homeLogo: g.home_logo ?? undefined,
      awayLogo: g.away_logo ?? undefined,
    }))
  }

  // Unknown sport — return empty
  return []
}

function mapGameStatus(status: string | null): "scheduled" | "live" | "completed" {
  if (!status) return "scheduled"
  const s = status.toLowerCase()
  if (s === "completed" || s === "final") return "completed"
  if (s === "live" || s === "in_progress" || s === "in progress") return "live"
  return "scheduled"
}

const NBA_LOGO_MAP: Record<string, string> = {
  // Abbreviations
  SAS: "sa", PHX: "phx", NYK: "ny", NOP: "no", GSW: "gs", OKC: "okc",
  LAC: "lac", LAL: "lal", MIL: "mil", BOS: "bos", DEN: "den", MIN: "min",
  CLE: "cle", DAL: "dal", MEM: "mem", MIA: "mia", ATL: "atl", CHI: "chi",
  HOU: "hou", IND: "ind", ORL: "orl", PHI: "phi", POR: "por", SAC: "sac",
  TOR: "tor", UTA: "utah", WAS: "wsh", BKN: "bkn", CHA: "cha", DET: "det",
  // Full team names
  "San Antonio Spurs": "sa",
  "Phoenix Suns": "phx",
  "New York Knicks": "ny",
  "New Orleans Pelicans": "no",
  "Golden State Warriors": "gs",
  "Oklahoma City Thunder": "okc",
  "Los Angeles Clippers": "lac",
  "LA Clippers": "lac",
  "Los Angeles Lakers": "lal",
  "LA Lakers": "lal",
  "Milwaukee Bucks": "mil",
  "Boston Celtics": "bos",
  "Denver Nuggets": "den",
  "Minnesota Timberwolves": "min",
  "Cleveland Cavaliers": "cle",
  "Dallas Mavericks": "dal",
  "Memphis Grizzlies": "mem",
  "Miami Heat": "mia",
  "Atlanta Hawks": "atl",
  "Chicago Bulls": "chi",
  "Houston Rockets": "hou",
  "Indiana Pacers": "ind",
  "Orlando Magic": "orl",
  "Philadelphia 76ers": "phi",
  "Portland Trail Blazers": "por",
  "Sacramento Kings": "sac",
  "Toronto Raptors": "tor",
  "Utah Jazz": "utah",
  "Washington Wizards": "wsh",
  "Brooklyn Nets": "bkn",
  "Charlotte Hornets": "cha",
  "Detroit Pistons": "det",
}

function getNBALogo(team: string): string {
  const slug = NBA_LOGO_MAP[team] ?? NBA_LOGO_MAP[team.toUpperCase()] ?? team.toLowerCase().split(" ").pop()?.slice(0, 3) ?? team.toLowerCase()
  return `https://a.espncdn.com/i/teamlogos/nba/500/${slug}.png`
}

const NBA_NAME_TO_ABBR: Record<string, string> = {
  "Atlanta Hawks": "ATL", "Boston Celtics": "BOS", "Brooklyn Nets": "BKN",
  "Charlotte Hornets": "CHA", "Chicago Bulls": "CHI", "Cleveland Cavaliers": "CLE",
  "Dallas Mavericks": "DAL", "Denver Nuggets": "DEN", "Detroit Pistons": "DET",
  "Golden State Warriors": "GSW", "Houston Rockets": "HOU", "Indiana Pacers": "IND",
  "Los Angeles Clippers": "LAC", "LA Clippers": "LAC", "Los Angeles Lakers": "LAL",
  "LA Lakers": "LAL", "Memphis Grizzlies": "MEM", "Miami Heat": "MIA",
  "Milwaukee Bucks": "MIL", "Minnesota Timberwolves": "MIN", "New Orleans Pelicans": "NOP",
  "New York Knicks": "NYK", "Oklahoma City Thunder": "OKC", "Orlando Magic": "ORL",
  "Philadelphia 76ers": "PHI", "Phoenix Suns": "PHX", "Portland Trail Blazers": "POR",
  "Sacramento Kings": "SAC", "San Antonio Spurs": "SAS", "Toronto Raptors": "TOR",
  "Utah Jazz": "UTA", "Washington Wizards": "WAS",
}

function getNBAAbbrFromName(name: string): string {
  return NBA_NAME_TO_ABBR[name] ?? name
}
