import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
import { fetchPagedParallel } from "@/lib/supabase/paged"
import { playerNameToSlug } from "@/lib/seo/player-slug"

export interface PublicPropEntry {
  playerSlug: string
  playerName: string
  team: string
  sport: string
  game: { homeTeam: string; awayTeam: string; startTime: string }
  statCategory: string
  propLine: number
  l10HitRate: number
  matchupGrade: string // A-F
}

/**
 * Get today's date in US Eastern Time as YYYY-MM-DD.
 */
function getTodayEastern(): string {
  const now = new Date()
  const eastern = new Date(
    now.toLocaleString("en-US", { timeZone: "America/New_York" })
  )
  const year = eastern.getFullYear()
  const month = String(eastern.getMonth() + 1).padStart(2, "0")
  const day = String(eastern.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

/**
 * NBA stat category to column name mapping.
 */
const NBA_STAT_COLUMNS: Record<string, string> = {
  points: "pts",
  rebounds: "trb",
  assists: "ast",
  "3-pointers": "tp",
  steals: "stl",
  blocks: "blk",
  pts: "pts",
  trb: "trb",
  ast: "ast",
  tp: "tp",
  stl: "stl",
  blk: "blk",
}

/**
 * Fetch all props for today, grouped by sport then game.
 *
 * Returns props ordered: sports alphabetically, games by start time ascending.
 * Uses US Eastern Time boundary for "today".
 *
 * Requirements: 2.1, 2.2, 2.6, 2.8, 2.9, 2.10
 */
export async function getTodaysPublicProps(): Promise<{
  props: PublicPropEntry[]
  totalCount: number
  sports: string[]
}> {
  const supabase = createAdminClient()
  const today = getTodayEastern()

  // Fetch today's NBA games
  const { data: nbaGames } = await supabase
    .from("nba_games")
    .select("home_team, away_team, game_date, status")
    .eq("game_date", today)

  // Fetch today's ESPN games (all other sports)
  const { data: espnGames } = await supabase
    .from("espn_games")
    .select("home_team, away_team, match_date, start_time, sport, league, status")
    .eq("match_date", today)

  // Build team-to-game lookup for NBA
  const nbaTeamToGame = new Map<
    string,
    { homeTeam: string; awayTeam: string; startTime: string }
  >()
  if (nbaGames) {
    for (const game of nbaGames) {
      const gameInfo = {
        homeTeam: game.home_team,
        awayTeam: game.away_team,
        startTime: game.game_date ?? today,
      }
      nbaTeamToGame.set(game.home_team, gameInfo)
      nbaTeamToGame.set(game.away_team, gameInfo)
    }
  }

  // Build team-to-game lookup for ESPN sports
  const espnTeamToGame = new Map<
    string,
    { homeTeam: string; awayTeam: string; startTime: string; sport: string }
  >()
  if (espnGames) {
    for (const game of espnGames) {
      const gameInfo = {
        homeTeam: game.home_team,
        awayTeam: game.away_team,
        startTime: game.start_time ?? game.match_date ?? today,
        sport: game.sport ?? "",
      }
      espnTeamToGame.set(game.home_team, gameInfo)
      espnTeamToGame.set(game.away_team, gameInfo)
    }
  }

  // Fetch recent prop lines (recorded today or most recent for active players)
  // Get the most recent prop line for each player/stat combination
  const startOfDay = `${today}T00:00:00.000Z`

  // Paged. This query carried no `.limit()` at all, which does not mean
  // "unlimited" — PostgREST caps a response at 1000 rows and reports success.
  // Since the dedupe below keeps the most recent line per player+stat, any prop
  // whose rows fell past row 1000 vanished from the page entirely.
  const propLines = await fetchPagedParallel<{
    player_name: string
    sport: string
    stat_category: string
    line_value: number
    recorded_at: string
  }>(
    async () => {
      const { count } = await supabase
        .from("prop_line_history")
        .select("id", { count: "exact", head: true })
        .gte("recorded_at", startOfDay)
      return count ?? null
    },
    async (from, to) => {
      const { data, error } = await supabase
        .from("prop_line_history")
        .select("player_name, sport, stat_category, line_value, recorded_at")
        .gte("recorded_at", startOfDay)
        .order("recorded_at", { ascending: false })
        .order("id", { ascending: true })
        .range(from, to)
      if (error) {
        console.error("[public-props] prop_line_history scan failed:", error.message)
        return []
      }
      return (data ?? []) as any[]
    }
  )

  if (!propLines || propLines.length === 0) {
    return { props: [], totalCount: 0, sports: [] }
  }

  // Deduplicate: keep only the most recent line per player+stat
  const seen = new Set<string>()
  const uniqueProps: typeof propLines = []
  for (const prop of propLines) {
    const key = `${prop.player_name}::${prop.stat_category}`
    if (!seen.has(key)) {
      seen.add(key)
      uniqueProps.push(prop)
    }
  }

  // Get player teams from nba_player_stats (for NBA players)
  const nbaPlayerNames = uniqueProps
    .filter((p) => p.sport === "NBA")
    .map((p) => p.player_name)

  const playerTeamMap = new Map<string, string>()

  if (nbaPlayerNames.length > 0) {
    // Team as of the player's most recent game.
    //
    // Was `.in(names.slice(0, 200)).limit(1000)` with no `order` — so it dropped
    // every player past the first 200, took whatever 1000 rows PostgREST
    // returned, and then relied on "most recent due to ordering" that no clause
    // established. Ordering by the primary key descending is the recency proxy
    // the old comment assumed: nba_player_stats has no date column of its own,
    // and rows are appended per scrape, so the highest id for a player is their
    // latest game.
    const uniqueNbaNames = [...new Set(nbaPlayerNames)]
    for (const names of chunk(uniqueNbaNames, PLAYER_CHUNK)) {
      const playerTeams = await fetchPagedParallel<{ player_name: string; team: string }>(
        async () => {
          const { count } = await supabase
            .from("nba_player_stats")
            .select("id", { count: "exact", head: true })
            .in("player_name", names)
          return count ?? null
        },
        async (from, to) => {
          const { data, error } = await supabase
            .from("nba_player_stats")
            .select("player_name, team")
            .in("player_name", names)
            .order("id", { ascending: false })
            .range(from, to)
          if (error) {
            console.error("[public-props] nba team lookup failed:", error.message)
            return []
          }
          return (data ?? []) as { player_name: string; team: string }[]
        }
      )

      for (const row of playerTeams) {
        if (!playerTeamMap.has(row.player_name)) {
          playerTeamMap.set(row.player_name, row.team)
        }
      }
    }
  }

  // Compute L10 hit rates for NBA players
  const l10HitRateMap = await computeL10HitRates(supabase, uniqueProps)

  // Build the public prop entries
  const entries: PublicPropEntry[] = []

  for (const prop of uniqueProps) {
    const playerName = prop.player_name
    const sport = prop.sport ?? "NBA"
    const team = playerTeamMap.get(playerName) ?? ""

    // Find the game for this player
    let game: { homeTeam: string; awayTeam: string; startTime: string } | null = null

    if (sport === "NBA") {
      // Look up by team abbreviation in NBA games
      game = nbaTeamToGame.get(team) ?? null
      // Also try full team name lookup
      if (!game) {
        for (const [teamName, gameInfo] of nbaTeamToGame) {
          if (teamName.includes(team) || team.includes(teamName)) {
            game = gameInfo
            break
          }
        }
      }
    } else {
      // For other sports, try ESPN games
      game = espnTeamToGame.get(team) ?? null
    }

    // Skip props without a matching game today
    if (!game) continue

    const key = `${playerName}::${prop.stat_category}`
    const l10HitRate = l10HitRateMap.get(key) ?? 0
    const matchupGrade = computeSimpleMatchupGrade(l10HitRate)

    entries.push({
      playerSlug: playerNameToSlug(playerName),
      playerName,
      team,
      sport,
      game: {
        homeTeam: game.homeTeam,
        awayTeam: game.awayTeam,
        startTime: game.startTime,
      },
      statCategory: prop.stat_category,
      propLine: Number(prop.line_value),
      l10HitRate,
      matchupGrade,
    })
  }

  // Sort: sports alphabetically, then games by start time ascending
  entries.sort((a, b) => {
    // First sort by sport alphabetically
    const sportCompare = a.sport.localeCompare(b.sport)
    if (sportCompare !== 0) return sportCompare

    // Then sort by game start time ascending
    const timeA = new Date(a.game.startTime).getTime()
    const timeB = new Date(b.game.startTime).getTime()
    if (timeA !== timeB) return timeA - timeB

    // Within same game, sort by player name for consistency
    return a.playerName.localeCompare(b.playerName)
  })

  // Extract unique sports
  const sports = [...new Set(entries.map((e) => e.sport))].sort()

  return {
    props: entries,
    totalCount: entries.length,
    sports,
  }
}

/** How many player names go into a single `.in(...)` filter. */
const PLAYER_CHUNK = 100

/** Split an array into fixed-size chunks. */
function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

/**
 * Compute L10 hit rates for a batch of props.
 *
 * For NBA players, reads nba_player_stats (which has no date of its own — the
 * date lives on nba_games) and takes each player's 10 most recent values.
 *
 * Three things were wrong with the previous implementation, all of which
 * produced wrong percentages rather than missing ones:
 *
 *  - `.limit(2000)` was capped at 1000 rows by PostgREST with no error. Those
 *    1000 rows were the most recent across the *whole batch*, not per player, so
 *    a player low in the ordering could contribute zero games and a high-volume
 *    player could absorb the entire budget.
 *  - `playerNames.slice(0, 100)` discarded every player past the first 100 in
 *    each stat group; they silently scored 0%.
 *  - It ran one query per stat group over the same players, re-reading the same
 *    rows up to six times to pick a different column each time.
 *
 * Measured over 100 real players: the old read returned 1000 rows and saw only
 * 87 of them at all (the missing 13 scored 0%), with a median of 9 games each and
 * just 43 reaching the 10 games the "L10" label claims. Paged, the same 100
 * players return 6,482 rows — all 100 present, median 70 games, 99 with 10+.
 *
 * Now: one paged read of every column this batch needs, for every player in it,
 * then each prop is scored from that single result.
 */
async function computeL10HitRates(
  supabase: ReturnType<typeof createAdminClient>,
  props: { player_name: string; stat_category: string; line_value: number; sport: string }[]
): Promise<Map<string, number>> {
  const hitRateMap = new Map<string, number>()

  // Only compute for NBA players (we have game-level stats)
  const nbaProps = props.filter((p) => p.sport === "NBA")
  if (nbaProps.length === 0) return hitRateMap

  // NBA_STAT_COLUMNS doubles as an allowlist: the resolved value is interpolated
  // into `select()`, and stat_category comes from scraped rows. An unmapped
  // category is scored as "no data" rather than passed through to the query.
  const columnFor = (statCategory: string): string | null =>
    NBA_STAT_COLUMNS[statCategory.toLowerCase()] ?? null

  const players = [...new Set(nbaProps.map((p) => p.player_name))]
  const columns = [
    ...new Set(nbaProps.map((p) => columnFor(p.stat_category)).filter((c): c is string => !!c)),
  ]
  if (players.length === 0 || columns.length === 0) return hitRateMap

  const select = `id, player_name, ${columns.join(", ")}, nba_games!inner(game_date)`

  // Most-recent-first, with the primary key as tiebreaker so the sort is total —
  // parallel pages are separate queries, and a non-unique sort lets Postgres
  // order equal dates differently per page, duplicating and dropping rows.
  const rows: Record<string, any>[] = []
  for (const names of chunk(players, PLAYER_CHUNK)) {
    const part = await fetchPagedParallel<Record<string, any>>(
      async () => {
        const { count } = await supabase
          .from("nba_player_stats")
          .select("id, nba_games!inner(game_date)", { count: "exact", head: true })
          .in("player_name", names)
        return count ?? null
      },
      async (from, to) => {
        const { data, error } = await supabase
          .from("nba_player_stats")
          .select(select)
          .in("player_name", names)
          .order("nba_games(game_date)", { ascending: false })
          .order("id", { ascending: true })
          .range(from, to)
        if (error) {
          console.error("[public-props] nba_player_stats scan failed:", error.message)
          return []
        }
        return (data ?? []) as Record<string, any>[]
      }
    )
    rows.push(...part)
  }

  const byPlayer = new Map<string, Record<string, any>[]>()
  for (const row of rows) {
    const name = row.player_name as string
    if (!name) continue
    const list = byPlayer.get(name)
    if (list) list.push(row)
    else byPlayer.set(name, [row])
  }

  for (const prop of nbaProps) {
    const key = `${prop.player_name}::${prop.stat_category}`
    const column = columnFor(prop.stat_category)
    const games = column ? byPlayer.get(prop.player_name) : undefined

    if (!column || !games || games.length < 3) {
      hitRateMap.set(key, 0)
      continue
    }

    const l10 = games.slice(0, 10)
    const line = Number(prop.line_value)
    const over = l10.filter((g) => (Number(g[column]) || 0) >= line).length
    hitRateMap.set(key, Math.round((over / l10.length) * 100))
  }

  return hitRateMap
}

/**
 * Simplified matchup grade based on L10 hit rate.
 * A full matchup grade requires defensive stats which are expensive to compute
 * for a public listing page. This provides a reasonable approximation.
 *
 * A: 80-100% hit rate (favorable matchup implied)
 * B: 60-79%
 * C: 40-59%
 * D: 20-39%
 * F: 0-19%
 */
function computeSimpleMatchupGrade(l10HitRate: number): string {
  if (l10HitRate >= 80) return "A"
  if (l10HitRate >= 60) return "B"
  if (l10HitRate >= 40) return "C"
  if (l10HitRate >= 20) return "D"
  return "F"
}
