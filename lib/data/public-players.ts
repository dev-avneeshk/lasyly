import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
import { cached } from "@/lib/cache"
import { playerNameToSlug } from "@/lib/seo/player-slug"
import { computeHitRates } from "@/lib/analytics/hit-rates"
import { computeMatchupGrade, type MatchupGrade } from "@/lib/analytics/matchup-grades"

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PublicPlayerData {
  slug: string
  name: string
  team: string
  sport: string
  position?: string
  propLine: number | null
  statCategory: string | null
  /**
   * Human-readable stat name for display.
   *
   * `statCategory` is the raw database key, and for NFL those keys are the
   * literal column names the scraper read ("pass_yds"), which is not something
   * to put in a page title. Use this for anything user-facing.
   */
  statLabel: string | null
  hitRate: { l5: number; l10: number; season: number } | null
  matchupGrade: string | null // A-F
  trend: "up" | "down" | "neutral" | null
  trendPct: number | null
  streak: ("over" | "under")[] // last 10 games
}

// ─── Constants ──────────────────────────────────────────────────────────────

/**
 * `prop_line_history.stat_category` → `nba_player_stats` column.
 *
 * This doubles as an allowlist. The value is interpolated into a `select()`
 * string, so an unrecognised category must never be passed through verbatim —
 * previously the code fell back to `statCategory.toLowerCase()`, which would
 * hand an arbitrary string to PostgREST as a column list.
 */
const NBA_STAT_COLUMNS: Record<string, string> = {
  pts: "pts",
  trb: "trb",
  reb: "trb",
  ast: "ast",
  tp: "tp",
  "3pm": "tp",
  stl: "stl",
  blk: "blk",
  tov: "tov",
  fg: "fg",
  fga: "fga",
  ft: "ft",
  fta: "fta",
}

/**
 * `prop_line_history.stat_category` → `nfl_player_stats` column.
 *
 * scripts/scrape_nfl.py records lines under the raw column names it read
 * (NFL_STAT_CATEGORIES), so these map one-to-one. Listed explicitly anyway to
 * keep this an allowlist rather than a passthrough.
 */
const NFL_STAT_COLUMNS: Record<string, string> = {
  pass_yds: "pass_yds",
  pass_td: "pass_td",
  pass_att: "pass_att",
  rush_yds: "rush_yds",
  rush_td: "rush_td",
  rush_att: "rush_att",
  rec: "rec",
  rec_yds: "rec_yds",
  rec_td: "rec_td",
}

/** Display names for the raw stat keys stored in prop_line_history. */
const STAT_LABELS: Record<string, string> = {
  // NBA
  pts: "Points",
  trb: "Rebounds",
  reb: "Rebounds",
  ast: "Assists",
  tp: "3-Pointers Made",
  "3pm": "3-Pointers Made",
  stl: "Steals",
  blk: "Blocks",
  tov: "Turnovers",
  fg: "Field Goals Made",
  fga: "Field Goals Attempted",
  ft: "Free Throws Made",
  fta: "Free Throws Attempted",
  pra: "Points + Rebounds + Assists",
  // NFL
  pass_yds: "Passing Yards",
  pass_td: "Passing Touchdowns",
  pass_att: "Pass Attempts",
  rush_yds: "Rushing Yards",
  rush_td: "Rushing Touchdowns",
  rush_att: "Carries",
  rec: "Receptions",
  rec_yds: "Receiving Yards",
  rec_td: "Receiving Touchdowns",
  // Tennis
  aces: "Aces",
  double_faults: "Double Faults",
  win_pct: "Match Win %",
  first_serve_pct: "1st Serve %",
  sets_won: "Sets Won",
  games_won: "Games Won",
}

/** Display name for a stat key, falling back to a tidied version of the key. */
function statLabelFor(statCategory: string): string {
  const known = STAT_LABELS[statCategory.toLowerCase()]
  if (known) return known
  return statCategory.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

/** How long a resolved public player page is cached. Matches the page's ISR window. */
const PLAYER_TTL_MS = 60 * 60_000

/** Rows of recent line history scanned when resolving a slug the fast way. */
const SLUG_SCAN_LIMIT = 5000

/** One game row, normalised across the per-sport stat tables. */
interface NormalisedGame {
  team: string
  opponent: string | null
  position: string | null
  value: number
}

/** Escape LIKE metacharacters so a player name can't act as a pattern. */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`)
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Resolve a slug to a player name + sport using `prop_line_history`.
 *
 * Two passes, because neither alone is both fast and correct:
 *
 *  - The bounded scan of recent rows is cheap and covers anyone with a current
 *    prop line, which is the overwhelming majority of traffic.
 *  - It also silently 404'd anyone whose most recent line fell outside that
 *    window. NBA, NFL and Tennis scrapers all append here, so a player can drop
 *    out of the newest 5000 rows within a day. The surname lookup is the
 *    fallback that makes those pages resolve.
 */
async function resolveSlug(
  slug: string
): Promise<{ playerName: string; sport: string } | null> {
  const supabase = createAdminClient()

  const { data: recent, error } = await supabase
    .from("prop_line_history")
    .select("player_name, sport")
    .order("recorded_at", { ascending: false })
    .limit(SLUG_SCAN_LIMIT)

  if (error) {
    console.error("[public-players] prop_line_history scan failed:", error.message)
  }

  const hit = (recent ?? []).find(
    (row: { player_name: string }) => playerNameToSlug(row.player_name) === slug
  )
  if (hit) return { playerName: hit.player_name, sport: hit.sport }

  // Fallback: the last slug segment is the surname for essentially every name we
  // store, so it narrows the table to a handful of candidates we can slug-match
  // exactly.
  const surname = slug.split("-").filter(Boolean).at(-1)
  if (!surname) return null

  const { data: candidates } = await supabase
    .from("prop_line_history")
    .select("player_name, sport")
    .ilike("player_name", `%${escapeLike(surname)}%`)
    .limit(500)

  const match = (candidates ?? []).find(
    (row: { player_name: string }) => playerNameToSlug(row.player_name) === slug
  )
  return match ? { playerName: match.player_name, sport: match.sport } : null
}

/**
 * Per-game values for a player, read from whichever table holds that sport.
 *
 * Returns null when the sport has no analytics table wired up here, which is
 * different from "the player has no games" — the caller renders the identity and
 * prop line either way, just without the charts.
 */
async function fetchGamesForSport(
  sport: string,
  playerName: string,
  statCategory: string
): Promise<{ games: NormalisedGame[]; table: string; statColumn: string } | null> {
  const supabase = createAdminClient()
  const key = statCategory.toLowerCase()

  if (sport === "NBA") {
    const statColumn = NBA_STAT_COLUMNS[key]
    if (!statColumn) return null

    const { data, error } = await supabase
      .from("nba_player_stats")
      .select(`team, opponent, position, ${statColumn}, nba_games!inner(game_date)`)
      .eq("player_name", playerName)
      .order("nba_games(game_date)", { ascending: false })
      .limit(82) // one season

    if (error || !data) return { games: [], table: "nba_player_stats", statColumn }

    return {
      table: "nba_player_stats",
      statColumn,
      games: (data as any[]).map((row) => ({
        team: row.team ?? "",
        opponent: row.opponent ?? null,
        position: row.position ?? null,
        value: Number(row[statColumn]) || 0,
      })),
    }
  }

  if (sport === "NFL") {
    // NFL stats live in their own flat table with a real `game_date` column, so
    // there is no join. Reading nba_player_stats for these players — which is
    // what this function replaces — always returned zero rows, which is why NFL
    // player pages rendered with no hit rate, trend or matchup grade at all.
    const statColumn = NFL_STAT_COLUMNS[key]
    if (!statColumn) return null

    const { data, error } = await supabase
      .from("nfl_player_stats")
      .select(`team, opponent, position, game_date, ${statColumn}`)
      .eq("player_name", playerName)
      .order("game_date", { ascending: false })
      .limit(34) // two seasons of a 17-game schedule

    if (error || !data) return { games: [], table: "nfl_player_stats", statColumn }

    return {
      table: "nfl_player_stats",
      statColumn,
      games: (data as any[]).map((row) => ({
        team: row.team ?? "",
        opponent: row.opponent ?? null,
        position: row.position ?? null,
        value: Number(row[statColumn]) || 0,
      })),
    }
  }

  // Tennis, Soccer and NHL have no flat per-game table wired up here yet.
  return null
}

/**
 * Grade the player's most recent opponent by how much that defence allows in
 * this stat, relative to the rest of the league.
 *
 * Cached league-wide: the aggregate is identical for every player sharing a
 * stat, and it reads several thousand rows.
 */
async function computeOpponentGrade(
  table: string,
  statColumn: string,
  opponent: string
): Promise<MatchupGrade | null> {
  const averages = await cached(
    `public-defense:${table}:${statColumn}`,
    async () => {
      const supabase = createAdminClient()
      const { data } = await supabase
        .from(table)
        .select(`opponent, ${statColumn}`)
        .limit(5000)

      const totals = new Map<string, { total: number; games: number }>()
      for (const row of (data ?? []) as any[]) {
        const opp = row.opponent as string
        if (!opp) continue
        const existing = totals.get(opp) ?? { total: 0, games: 0 }
        existing.total += Number(row[statColumn]) || 0
        existing.games += 1
        totals.set(opp, existing)
      }

      // Plain object so it survives the JSON round trip through Redis.
      const out: Record<string, { avg: number; games: number }> = {}
      for (const [opp, { total, games }] of totals) {
        out[opp] = { avg: games > 0 ? total / games : 0, games }
      }
      return out
    },
    PLAYER_TTL_MS
  )

  const own = averages[opponent]
  const allValues = Object.values(averages).map((entry) => entry.avg)
  if (!own || allValues.length < 5) return null

  return computeMatchupGrade(own.avg, allValues, own.games)
}

/**
 * Fetch a single player's public data by slug.
 *
 * Resolves the latest prop line from prop_line_history, then reads game-by-game
 * values from the table that actually holds that sport's stats to compute hit
 * rates, trend, streak and a matchup grade.
 *
 * Returns null if no player matches the slug.
 */
export async function getPublicPlayerBySlug(
  slug: string
): Promise<PublicPlayerData | null> {
  // Cached because the page calls this twice per render — once in
  // generateMetadata, once in the component — and it is several queries deep.
  //
  // The result is wrapped in an envelope so that "no such player" is cacheable
  // too. `cached()` treats a bare null as a miss, which would mean every request
  // for an unknown slug re-ran the full resolution — and this is a public,
  // unauthenticated route where the slug is attacker-controlled.
  const { player } = await cached(
    `public-player:${slug}`,
    async () => ({ player: await loadPublicPlayer(slug) }),
    PLAYER_TTL_MS
  )
  return player
}

async function loadPublicPlayer(slug: string): Promise<PublicPlayerData | null> {
  const supabase = createAdminClient()

  const resolved = await resolveSlug(slug)
  if (!resolved) return null

  const { playerName, sport } = resolved

  /** Identity-only result, used whenever analytics aren't available. */
  const minimal = (
    propLine: number | null,
    statCategory: string | null
  ): PublicPlayerData => ({
    slug,
    name: playerName,
    team: "",
    sport,
    propLine,
    statCategory,
    statLabel: statCategory ? statLabelFor(statCategory) : null,
    hitRate: null,
    matchupGrade: null,
    trend: null,
    trendPct: null,
    streak: [],
  })

  // Latest prop line. Scoped by sport as well as name so that two players
  // sharing a name across sports can't pick up each other's line.
  const { data: latestProp, error: latestPropError } = await supabase
    .from("prop_line_history")
    .select("stat_category, line_value, recorded_at")
    .eq("player_name", playerName)
    .eq("sport", sport)
    .order("recorded_at", { ascending: false })
    .limit(1)

  if (latestPropError || !latestProp || latestProp.length === 0) {
    return minimal(null, null)
  }

  const propLine = Number(latestProp[0].line_value)
  const statCategory = latestProp[0].stat_category

  const resolvedGames = await fetchGamesForSport(sport, playerName, statCategory)
  if (!resolvedGames || resolvedGames.games.length === 0) {
    return minimal(propLine, statCategory)
  }

  const { games, table, statColumn } = resolvedGames
  const team = games[0].team
  const position = games[0].position ?? undefined

  // Most recent first.
  const gameValues = games.map((g) => g.value)

  const hitRateWindows = computeHitRates(gameValues, propLine)
  const l5Window = hitRateWindows.find((w) => w.window === "L5")
  const l10Window = hitRateWindows.find((w) => w.window === "L10")
  const seasonWindow = hitRateWindows.find((w) => w.window === "Season")

  const hitRate =
    l5Window?.available || l10Window?.available || seasonWindow?.available
      ? {
          l5: l5Window?.available ? l5Window.hitRate : 0,
          l10: l10Window?.available ? l10Window.hitRate : 0,
          season: seasonWindow?.available ? seasonWindow.hitRate : 0,
        }
      : null

  // Trend: L5 average vs L10 average.
  const recentGames = gameValues.slice(0, 10)
  const l5Values = gameValues.slice(0, 5)
  const l5Avg = l5Values.length > 0 ? l5Values.reduce((s, v) => s + v, 0) / l5Values.length : 0
  const l10Avg = recentGames.length > 0 ? recentGames.reduce((s, v) => s + v, 0) / recentGames.length : 0
  const trendPct = l10Avg > 0 ? Math.round(((l5Avg - l10Avg) / l10Avg) * 100) : 0
  const trend: "up" | "down" | "neutral" =
    trendPct > 5 ? "up" : trendPct < -5 ? "down" : "neutral"

  // Streak: last 10 games, over or under the line.
  const streak: ("over" | "under")[] = gameValues
    .slice(0, 10)
    .map((v) => (v >= propLine ? "over" : "under"))

  // Matchup grade against the most recent opponent, read from the same table the
  // game rows came from.
  const mostRecentOpponent = games[0].opponent
  const matchupGrade: MatchupGrade | null = mostRecentOpponent
    ? await computeOpponentGrade(table, statColumn, mostRecentOpponent)
    : null

  return {
    slug,
    name: playerName,
    team,
    sport,
    position,
    propLine,
    statCategory,
    statLabel: statLabelFor(statCategory),
    hitRate,
    matchupGrade,
    trend,
    trendPct: Math.abs(trendPct),
    streak,
  }
}

/**
 * Fetch all player slugs for sitemap generation.
 * Returns distinct players with their most recent game date.
 */
export async function getAllPlayerSlugs(): Promise<{ slug: string; lastGameDate: string }[]> {
  const supabase = createAdminClient()

  // Get all distinct players from prop_line_history
  const { data: propPlayers, error } = await supabase
    .from("prop_line_history")
    .select("player_name, recorded_at")
    .order("recorded_at", { ascending: false })

  if (error || !propPlayers) {
    console.error("[public-players] Failed to fetch players for sitemap:", error?.message)
    return []
  }

  // Deduplicate by player name, keeping the most recent recorded_at
  const playerMap = new Map<string, string>()

  for (const row of propPlayers) {
    const name = row.player_name as string
    const recordedAt = row.recorded_at as string

    if (!playerMap.has(name)) {
      playerMap.set(name, recordedAt)
    }
  }

  // Try to get actual game dates from nba_player_stats for more accurate lastModified
  const playerNames = [...playerMap.keys()]
  const gameDataMap = new Map<string, string>()

  // Fetch game dates in batches to avoid query limits
  const batchSize = 100
  for (let i = 0; i < playerNames.length; i += batchSize) {
    const batch = playerNames.slice(i, i + batchSize)
    const { data: gameData } = await supabase
      .from("nba_player_stats")
      .select("player_name, nba_games!inner(game_date)")
      .in("player_name", batch)
      .order("nba_games(game_date)", { ascending: false })
      .limit(batch.length) // one row per player is enough (most recent)

    if (gameData) {
      for (const row of gameData as any[]) {
        const name = row.player_name as string
        const gameDate = row.nba_games?.game_date as string
        if (gameDate && !gameDataMap.has(name)) {
          gameDataMap.set(name, gameDate)
        }
      }
    }
  }

  // Build result: use game date if available, fall back to prop recorded_at
  const results: { slug: string; lastGameDate: string }[] = []

  for (const [name, recordedAt] of playerMap) {
    const slug = playerNameToSlug(name)
    const lastGameDate = gameDataMap.get(name) ?? recordedAt.split("T")[0]
    results.push({ slug, lastGameDate })
  }

  return results
}
