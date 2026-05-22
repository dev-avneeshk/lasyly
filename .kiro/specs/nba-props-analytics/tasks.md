# Implementation Plan: NBA Props Analytics

## Overview

This plan implements the matchup-scoped NBA props analytics pipeline. The approach is bottom-up: database schema first, then pure computation modules, then the engine that wires them together, then the scraper, then the API route update, and finally the UI components. Each step builds on the previous, ensuring no orphaned code.

## Tasks

- [x] 1. Database migration and schema setup
  - [x] 1.1 Create Supabase migration for `nba_team_defense_stats` table and `position` column
    - Create file `supabase/migrations/20250520_create_nba_team_defense_stats.sql`
    - Add `nba_team_defense_stats` table with IF NOT EXISTS guard (columns: id UUID PK, team TEXT NOT NULL, position TEXT NOT NULL with CHECK constraint for PG/SG/SF/PF/C/TEAM, stat_category TEXT NOT NULL, value_per_game NUMERIC, value_per_36 NUMERIC, value_per_100_poss NUMERIC, pace NUMERIC, games_played INTEGER, season TEXT NOT NULL, scraped_at TIMESTAMPTZ NOT NULL DEFAULT now())
    - Add unique constraint on (team, position, stat_category, season)
    - Add index on (team, position, stat_category)
    - Enable RLS with public SELECT policy
    - Add `position` TEXT nullable column to `nba_player_stats` using DO $$ IF NOT EXISTS guard for idempotency
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_

- [x] 2. Pure computation modules
  - [x] 2.1 Implement position parser (`lib/analytics/position.ts`)
    - Export `Position` type as union of "PG" | "SG" | "SF" | "PF" | "C"
    - Export `parsePosition(raw: string | null): Position | null` — splits on "-" or "/" and returns first valid position
    - Export `isValidPosition(pos: string): pos is Position` — type guard
    - Handle null/empty/undefined inputs returning null
    - _Requirements: 8.1, 8.2_

  - [x] 2.2 Implement probability model (`lib/analytics/probability.ts`)
    - Export `ProbabilityInput` and `ProbabilityOutput` interfaces as defined in design
    - Export `computeRecentForm(games: number[], propLine: number): number` — proportion of games >= propLine, using last min(10, length) games
    - Export `minMaxNormalize(value: number, allValues: number[]): number` — returns 0.5 if max === min, else (value - min) / (max - min)
    - Export `computePropLine(games: number[]): number` — arithmetic mean of last min(10, length) games, rounded to nearest 0.5 (Math.round(mean * 2) / 2)
    - Export `computeL5Average(games: number[]): number` — mean of last min(5, length) games, rounded to 1 decimal
    - Export `computeL10Average(games: number[]): number` — mean of last min(10, length) games, rounded to 1 decimal
    - Export `computeProbability(input: ProbabilityInput): ProbabilityOutput` — weighted formula with fallback logic (form-only if no defense, 57/43 if no pace, full 40/35/25 otherwise)
    - All functions must be pure with no side effects or database calls
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.7, 4.8, 5.1, 5.2, 5.5, 5.6_

  - [ ]* 2.3 Write property tests for probability model (`__tests__/analytics/probability.property.test.ts`)
    - **Property 6: Probability Formula Correctness** — for any valid inputs (recentForm, defensiveMatchup, paceAdjustment all in [0,1]), output equals weighted sum * 100 rounded to 1 decimal, always in [0, 100]
    - **Validates: Requirements 4.1, 4.5**

  - [ ]* 2.4 Write property tests for recent form and normalization
    - **Property 7: Recent Form Factor Computation** — for any array of game values (length >= 3) and propLine > 0, result is count(values >= propLine) / total, in [0, 1]
    - **Property 8: Min-Max Normalization Bounds** — for any value and array (length >= 2) where max != min, result in [0, 1]; if max == min, result is 0.5
    - **Validates: Requirements 4.2, 4.3, 4.4**

  - [ ]* 2.5 Write property tests for prop line and averages
    - **Property 12: Prop Line Computation** — for any array (length >= 3), prop line equals mean of last min(10, length) values rounded to nearest 0.5
    - **Property 14: L5 and L10 Average Computation** — L5 = mean of last min(5, length) rounded to 1 decimal; L10 = mean of last min(10, length) rounded to 1 decimal
    - **Validates: Requirements 5.1, 5.2, 5.5, 5.6**

  - [ ]* 2.6 Write property tests for position parsing
    - **Property 16: Position Parsing** — for any multi-position string (e.g., "PG-SG"), returns first listed position; for null/empty returns null; result always in {PG, SG, SF, PF, C} or null
    - **Validates: Requirements 8.1, 8.2**

- [x] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Engine V2 implementation
  - [x] 4.1 Create engine V2 types and interfaces (`lib/analytics/engine-v2.ts` — types section)
    - Define `TodayGame` interface (homeTeam, awayTeam, gameTime, status)
    - Define `MatchupScopedProp` interface extending PropCardData with position, probability, graphData, defensiveMatchup
    - Define `GraphDataPoint` interface (value, date, opponent, overLine)
    - Define `DefensiveMatchupInfo` interface (opponentTeam, statAllowedPerGame, leagueAverage, grade, paceRating)
    - Define internal helper types for batch query results
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

  - [x] 4.2 Implement batch data fetching functions in engine V2
    - `fetchTodayGames(date: string)` — query `nba_games` where game_date = date AND status IN ('scheduled', 'in_progress')
    - `fetchBatchPlayerStats(teams: string[], stat: string)` — single query with `.in('team', teams)` filter, minimum 3 games per player
    - `fetchBatchCorrelations(playerStatIds: string[])` — single query with `.in('prop_a', ids).or(...)` pattern
    - `fetchBatchLineMovement(playerStats: {name: string, stat: string}[])` — single batch query on prop_line_history
    - `fetchPositionalDefense(teams: string[], stat: string)` — query `nba_team_defense_stats` with `.in('team', teams)`
    - All functions use `createAdminClient()` from existing Supabase setup
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 3.3_

  - [x] 4.3 Implement `computeMatchupScopedProps` orchestrator function
    - Accept params: sport, stat, options (direction, matchup?, todayDate?)
    - Validate matchup parameter format (two 3-letter abbreviations separated by hyphen)
    - Execute `Promise.allSettled` for parallel queries: todayGames, playerStats, correlations, lineMovement, defensiveStats
    - Handle partial failures gracefully (null fields for failed queries)
    - For each player: compute propLine, probability (using `computeProbability` from probability.ts), graphData, defensiveMatchup info
    - Sort results by probability descending, then alphabetically by player name for ties
    - Compute `computeTimeMs` as wall-clock time of the parallel execution
    - Return `{ props, todayGames, computeTimeMs }`
    - _Requirements: 1.4, 1.5, 1.7, 2.3, 2.4, 2.7, 4.5, 4.6, 5.3, 5.4, 6.1_

  - [x] 4.4 Implement graph data builder and defensive matchup grading
    - `buildGraphData(games, propLine)` — last min(6, length) games in chronological order (oldest to newest), each with value, date, opponent, overLine boolean
    - `computeDefensiveGrade(statAllowed, leagueAvg)` — assign A/B/C/D/F based on quintiles
    - `computePaceRating(pace, leagueAvgPace)` — assign "fast"/"average"/"slow"
    - _Requirements: 6.1, 9.4_

  - [ ]* 4.5 Write property tests for engine V2 logic
    - **Property 9: Probability Sort Order** — output sorted by probability descending; ties sorted alphabetically by player name ascending
    - **Property 10: Fallback Without Defensive Stats** — when defense is null, probability = recentForm * 100 rounded to 1 decimal
    - **Property 11: Fallback Without Pace Data** — when pace is null but defense available, probability = (recentForm * 0.57 + defensiveMatchup * 0.43) * 100 rounded to 1 decimal
    - **Property 13: Minimum Games Exclusion** — players with < 3 games never appear in output
    - **Property 15: GraphData Construction** — last min(6, gamesPlayed) entries in chronological order, overLine correctly reflects value >= propLine
    - **Property 17: Position Fallback Mean** — when position unknown, defensive input = mean of team's value_per_game across all 5 positions
    - **Validates: Requirements 4.6, 4.7, 4.8, 5.3, 6.1, 8.4**

- [x] 5. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Defensive stats scraper
  - [x] 6.1 Create `scripts/scrape_defense_stats.py`
    - Use Scrapling (same as existing `scrape_nba.py`) with `Fetcher.get()`
    - Scrape team defensive stats from Basketball Reference URL pattern for 2025-26 season
    - Extract positional defensive stats (PG, SG, SF, PF, C) for: points, rebounds, assists, three-pointers, steals, blocks
    - Extract team pace factor and store with position="TEAM", stat_category="pace"
    - Implement rate limiting: minimum 3 seconds between requests, 30 second timeout per page
    - Implement HTTP 429 handling: wait 60s, retry up to 3 times
    - Implement non-429 error handling: log error with URL + status, skip page, preserve existing data
    - Implement safety check: if fewer than 15 teams parsed, log warning and exit non-zero without modifying records
    - Upsert to `nba_team_defense_stats` using composite key (team, position, stat_category, season)
    - Also extract and store player position data in `nba_player_stats.position` column via upsert
    - Load env from `../.env.local` (same pattern as `scrape_nba.py`)
    - Support CLI args: `--delay` (default 3), `--season` (default "2025-26")
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 8.5_

  - [x] 6.2 Update GitHub Actions workflow to include defensive stats scraping
    - Add a new step in the `scrape-nba` job after "Backfill missing box scores" step
    - Step name: "Scrape team defensive stats"
    - Command: `python scripts/scrape_defense_stats.py --delay 3`
    - Add timeout-minutes: 15 for this step
    - Upload defense scraper logs as artifact alongside existing NBA scraper logs
    - _Requirements: 3.4_

- [x] 7. API route update
  - [x] 7.1 Update `app/api/props/route.ts` to use engine V2
    - Add `matchup` query parameter parsing and validation (format: two 3-letter alpha abbreviations separated by hyphen)
    - Return 400 with error message for invalid matchup format or unrecognized teams
    - Return 400 for invalid sport or stat values
    - Switch from `computeEnhancedProps` to `computeMatchupScopedProps` for NBA sport
    - Keep existing Tennis path using the old engine
    - Update cache key to include today's UTC date: `matchup-props:${sport}:${stat}:${direction}:${todayDate}`
    - Implement stale-while-revalidate: serve cached data up to 120s while refreshing in background
    - Return enhanced response structure: `{ props, todayGames, meta: { sport, stat, total, timestamp, computeTimeMs, gamesCount } }`
    - Preserve existing security middleware (`withSecurity`, `checkQueryParams`)
    - Preserve existing advanced filter application for non-matchup filters
    - _Requirements: 1.4, 1.5, 1.6, 2.5, 2.6, 2.7, 7.1, 9.1, 9.5, 9.6, 9.7_

  - [ ]* 7.2 Write unit tests for API route parameter validation
    - Test invalid matchup formats return 400 (e.g., "LAL", "LAL-", "LAKERS-GSW", "LAL-GSW-BOS")
    - Test valid matchup formats pass validation (e.g., "LAL-GSW", "SAS-OKC")
    - Test invalid sport values return 400
    - Test invalid stat values for given sport return 400
    - **Property 4: Invalid Input Rejection**
    - **Validates: Requirements 1.6, 9.6, 9.7**

- [x] 8. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. UI components
  - [x] 9.1 Create `components/props/MiniGraph.tsx`
    - Accept props: `graphData: GraphDataPoint[]`, `propLine: number`, `height?: number` (default 64)
    - Render horizontal reference line at prop line value with numeric label
    - Render vertical bars for each game, height proportional to value relative to Y-axis scale (0 to max(propLine * 1.5, maxValue))
    - Color bars lime when value >= propLine, white at 20% opacity when below
    - Handle 3-5 games by distributing bars evenly across available width
    - Do not render if graphData has fewer than 3 entries
    - Fixed height of 64px, full card width minus padding
    - _Requirements: 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

  - [x] 9.2 Create `components/props/MatchupStrip.tsx`
    - Accept props: `games: TodayGame[]`, `selectedMatchup: string | null`, `onSelectMatchup: (matchup: string | null) => void`
    - Render horizontally scrollable strip of matchup cards (max 15)
    - Each card shows home team abbreviation vs away team abbreviation, game time, and status
    - Apply distinct border/background to selected matchup card
    - Tapping selected card deselects it (returns to all-games view)
    - Hide the strip entirely if games array is empty
    - Display "No games scheduled" message when no games exist
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

  - [ ]* 9.3 Write unit tests for MiniGraph and MatchupStrip components
    - Test MiniGraph renders correct number of bars for varying game counts
    - Test MiniGraph applies correct colors based on overLine boolean
    - Test MiniGraph does not render with fewer than 3 data points
    - Test MatchupStrip renders all games as cards
    - Test MatchupStrip selection/deselection toggle behavior
    - Test MatchupStrip hides when no games provided
    - _Requirements: 6.2, 6.3, 6.6, 7.2, 7.5, 7.6_

- [x] 10. Integration wiring and final tests
  - [x] 10.1 Wire MiniGraph and MatchupStrip into the props page
    - Import and render MatchupStrip above prop results in the props page
    - Add matchup state management (selected matchup passed as query param to API)
    - Render MiniGraph inside each prop card using the graphData from API response
    - Handle loading/error states for the matchup strip
    - Preserve existing filter UI (stat type, search, direction)
    - _Requirements: 7.2, 7.3, 7.4, 7.7_

  - [ ]* 10.2 Write integration tests for the full pipeline
    - Test full API request → response with mock Supabase data
    - Test batch query execution (verify single queries, not loops)
    - Test graceful degradation when correlations query fails
    - Test graceful degradation when defensive stats query fails
    - Test cache behavior (60s fresh, 120s stale-while-revalidate)
    - **Property 5: Graceful Degradation on Partial Query Failure**
    - **Validates: Requirements 2.4, 2.5, 2.6**

- [x] 11. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- Engine V2 is created alongside V1 (`engine.ts`) to allow rollback — the API route switches to V2 for NBA only
- The Python scraper follows the same patterns as the existing `scrape_nba.py` (Scrapling, env loading, logging, retry logic)
- The GitHub Actions workflow update adds a step after box score scraping, not a separate job

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1", "2.2"] },
    { "id": 2, "tasks": ["2.3", "2.4", "2.5", "2.6", "4.1"] },
    { "id": 3, "tasks": ["4.2", "6.1"] },
    { "id": 4, "tasks": ["4.3", "4.4", "6.2"] },
    { "id": 5, "tasks": ["4.5", "7.1"] },
    { "id": 6, "tasks": ["7.2", "9.1", "9.2"] },
    { "id": 7, "tasks": ["9.3", "10.1"] },
    { "id": 8, "tasks": ["10.2"] }
  ]
}
```
