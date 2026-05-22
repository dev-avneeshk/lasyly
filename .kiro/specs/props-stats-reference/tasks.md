# Implementation Plan: Props Stats Reference

## Overview

This plan implements a detailed stats reference panel triggered by clicking prop cards on the analysis page. The implementation covers: database migration, derived stats computation module, cheat sheet configuration, API endpoint, UI components (StatsPanel + sub-components), extended Python scraper (advanced-stats mode), and integration with the analysis page. Property-based tests validate derived stat formulas and API input validation.

## Tasks

- [x] 1. Database migration and schema setup
  - [x] 1.1 Create Supabase migration for `nba_player_advanced_stats` table
    - Create `supabase/migrations/20250521_create_nba_player_advanced_stats.sql`
    - Define table with columns: id (UUID PK), player_name (TEXT NOT NULL), season (TEXT NOT NULL), games_played (INTEGER), fga_pct_0_3ft, fga_pct_3_10ft, fga_pct_10_16ft, fga_pct_16_3pt, fga_pct_3pt, pct_2p_assisted, pct_3p_assisted, trb_pct, orb_pct, drb_pct, ast_pct, pga (all NUMERIC), scraped_at (TIMESTAMPTZ NOT NULL DEFAULT now()), created_at (TIMESTAMPTZ NOT NULL DEFAULT now())
    - Add unique constraint on (player_name, season) with DO block for idempotency
    - Add index on (player_name) with IF NOT EXISTS
    - Enable RLS with public SELECT policy using existence check
    - Use IF NOT EXISTS guards on all DDL statements
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

- [x] 2. Derived stats computation module
  - [x] 2.1 Implement `lib/analytics/derived-stats.ts` with pure computation functions
    - Export `computeEPPS(pts, fga, fta)` — returns pts / (fga + 0.44 * fta), guarded against division by zero
    - Export `computeSelfCreatedFGA(fga, pct2pAssisted, pct3pAssisted, fgaPct3pt)` — computes assisted percentage then fga * (1 - assistedPct)
    - Export `computePGAConversionRate(ast, pga)` — returns null when pga is 0
    - Export `computeProjectedRebounds(trbPct, teamTotalReb)` — (trbPct/100) * teamTotalReb
    - Export `computeStocks(stl, blk)` — stl + blk
    - Export `computeFoulsDrawn(fta)` — fta / 1.8
    - Export `computeDerivedStats(input: DerivedStatsInput)` — orchestrates all computations, returns DerivedStatsData with formula strings
    - Export `roundTo(value, decimals)` — rounding utility
    - Export `getColorCode(playerValue, leagueAverage)` — returns "green" | "red" | "default" based on 10% threshold
    - Define `DerivedStatsInput` and `DerivedStatsData` interfaces matching the design
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10, 4.11, 4.12_

  - [ ]* 2.2 Write property test: Stat Display Rounding Correctness (Property 1)
    - **Property 1: Stat Display Rounding Correctness**
    - Generate random floats, verify `roundTo(value, decimals)` matches `parseFloat(value.toFixed(decimals))`
    - Use fast-check with minimum 100 iterations
    - **Validates: Requirements 2.1, 2.2, 3.1, 3.2**

  - [ ]* 2.3 Write property test: Color-Coding Threshold Classification (Property 2)
    - **Property 2: Color-Coding Threshold Classification**
    - Generate random (playerValue, leagueAverage) pairs where leagueAverage > 0
    - Verify: green when playerValue > leagueAverage * 1.10, red when < leagueAverage * 0.90, default otherwise
    - Use fast-check with minimum 100 iterations
    - **Validates: Requirements 2.4**

  - [ ]* 2.4 Write property test: Derived Stat Formula Correctness (Property 3)
    - **Property 3: Derived Stat Formula Correctness**
    - Generate random non-negative stat inputs, verify all formula computations match expected results
    - Test ePPS, selfCreatedFGA, pgaConversion, projectedReb, stocks, foulsDrawn, midRangeAttempts, rimAttempts
    - Use fast-check with minimum 100 iterations
    - **Validates: Requirements 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9**

  - [ ]* 2.5 Write property test: Formula String Representation (Property 4)
    - **Property 4: Derived Stat Formula String Representation**
    - Generate inputs, verify formula strings contain actual numeric input values used in computation
    - Verify formulaResult equals the computed value
    - Use fast-check with minimum 100 iterations
    - **Validates: Requirements 4.10**

- [x] 3. Cheat sheet configuration module
  - [x] 3.1 Implement `lib/analytics/cheat-sheet.ts` with static prop-type mappings
    - Export `getCheatSheet(propType: string): CheatSheetConfig | null`
    - Define configurations for "points", "rebounds", "assists", "pra" prop types
    - Each config lists stats with key, label, category (primary/secondary/context), and explanation (max 120 chars)
    - Return null for unsupported prop types
    - Ensure stats are ordered: all primary before secondary, all secondary before context
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

  - [ ]* 3.2 Write property test: Cheat Sheet Category Ordering (Property 5)
    - **Property 5: Cheat Sheet Category Ordering**
    - For each supported prop type, verify all "primary" stats appear before "secondary", and "secondary" before "context"
    - Verify no stat in a later category appears before any stat in an earlier category
    - Use fast-check with minimum 100 iterations
    - **Validates: Requirements 6.1, 6.6**

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Stats Reference API endpoint
  - [x] 5.1 Implement `app/api/props/stats-reference/route.ts` GET handler
    - Accept `player` (max 100 chars) and `stat` (one of: pts, trb, ast, tp, stl, blk, pra) query params
    - Return 400 for missing/invalid params with descriptive error messages
    - Return 404 when player not found in `nba_player_stats`
    - Query last 20 games from `nba_player_stats` ordered by game date descending, compute per-game averages
    - Query `nba_player_advanced_stats` for shooting distribution and advanced metrics
    - Query `nba_team_defense_stats` for league averages by position (fallback to all-position mean)
    - Call `computeDerivedStats()` server-side with assembled inputs
    - Call `getCheatSheet()` for the stat category
    - Return `insufficientData: true` with raw stats only when player has < 3 games
    - Use `cached()` utility with 5-minute TTL keyed by player+stat
    - Use `withSecurity` wrapper and `checkQueryParams` following existing route patterns
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 7.10_

  - [ ]* 5.2 Write property test: API Input Validation (Property 6)
    - **Property 6: API Input Validation**
    - Generate valid/invalid player strings and stat values
    - Verify: missing/empty/too-long player → 400, invalid stat → 400, valid params → not 400
    - Use fast-check with minimum 100 iterations
    - **Validates: Requirements 7.1, 7.2**

  - [ ]* 5.3 Write property test: Statistical Aggregation Correctness (Property 7)
    - **Property 7: Statistical Aggregation Correctness**
    - Generate random arrays of game stat values (length ≥ 1), verify per-game average equals arithmetic mean
    - Generate random arrays of league defensive values, verify league average equals sum/count
    - Use fast-check with minimum 100 iterations
    - **Validates: Requirements 7.3, 7.4**

- [x] 6. StatsPanel UI component and sub-components
  - [x] 6.1 Create `components/props/StatsPanel.tsx` — main panel container
    - Implement slide-out from right on desktop (≥1024px, w-[480px]) and full-screen modal on mobile (<1024px)
    - Add `role="dialog"`, `aria-labelledby` referencing player name header
    - Implement focus trap: initial focus on close button, Tab/Shift+Tab cycle within panel
    - Handle Escape key to close, click-outside to close
    - Animate open/close with 300ms CSS transition-transform
    - Manage data fetching via useEffect when playerName changes (fetch from `/api/props/stats-reference`)
    - Implement 10-second timeout → error state
    - Show loading skeleton within 100ms of open
    - Fade-in content (200ms) when data loads
    - Return focus to trigger element on close
    - Handle content replacement when different prop card clicked while open
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 10.1, 10.2, 10.3, 10.5, 10.6, 10.7_

  - [x] 6.2 Create `components/props/StatsPanelHeader.tsx` — header with player info and close button
    - Display player name, team abbreviation, position, stat category
    - Include accessible close button (first focusable element)
    - _Requirements: 1.2_

  - [x] 6.3 Create `components/props/CollapsibleSection.tsx` — reusable collapsible section
    - Accept title, defaultExpanded, children props
    - Toggle expanded/collapsed on click or Enter key
    - Add `aria-expanded` attribute on header button
    - _Requirements: 1.6, 5.4, 10.1_

  - [x] 6.4 Create `components/props/RawStatsSection.tsx` — shooting, rebounding, playmaking stats display
    - Display shooting stats: FGA/g, FTA/g, FTM/g, FT%, 3PA/g, 3PM/g, 3P% (1dp)
    - Display shot distribution: rim %, mid-range %, 2P assisted %, 3P assisted % (1dp)
    - Display rebounding: TRB%, ORB%, DRB% with inline descriptions (≤100 chars)
    - Display playmaking: AST%, AST/TOV (2dp), PGA/g (1dp) with inline descriptions
    - Show player value, league average, and color-coding (green/red/default) per stat row
    - Show "N/A" for unavailable stats, "—" for unavailable league averages
    - Use monospace font for stat values
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.1, 3.2, 3.3, 3.4, 3.5, 10.4_

  - [x] 6.5 Create `components/props/DerivedStatsSection.tsx` — computed metrics with formula display
    - Display each derived stat: label, computed value, formula with substituted values (e.g., "18.5 / (16.2 + 0.44 × 8.1) = 0.92")
    - Omit rows where inputs are missing, show "Insufficient data — missing [stat name]"
    - Show "N/A" for PGA conversion rate when PGA is 0
    - _Requirements: 4.1, 4.10, 4.11, 4.12_

  - [x] 6.6 Create `components/props/SourceTableSection.tsx` — source table quick reference
    - Map stats to source tables: Per Game, Shooting, Advanced, Opponent Stats
    - Display as collapsible groups (collapsed by default) with comma-separated stat labels
    - Hide groups with no stats for current view
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [x] 6.7 Create `components/props/CheatSheetSection.tsx` — prop-specific cheat sheet display
    - Display stats grouped by category: primary → secondary → context
    - Show stat name, category badge, value (or "No data"), and explanation (≤120 chars)
    - Show "Cheat sheet not available" message for unsupported prop types
    - _Requirements: 6.1, 6.6, 6.7, 6.8_

- [x] 7. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Extended NBA scraper (advanced-stats mode)
  - [x] 8.1 Add `advanced-stats` mode to `scripts/scrape_nba.py`
    - Add "advanced-stats" to argparse mode choices
    - Implement `scrape_advanced_stats()` function that:
      - Queries `nba_player_stats` for distinct player names in current season
      - For each player, scrapes Basketball Reference Shooting table (% FGA by distance, % assisted)
      - For each player, scrapes Basketball Reference Advanced table (TRB%, ORB%, DRB%, AST%, PGA)
      - Stores NULL for missing stat fields, continues processing remaining fields
      - Upserts into `nba_player_advanced_stats` on (player_name, season) composite key
    - Implement retry logic: HTTP 429 → wait 60s, retry up to 3 times, then skip
    - Implement retry logic: HTTP 5xx / timeout (30s) → wait 60s, retry up to 3 times, then skip
    - Maintain minimum 3-second delay between requests
    - Integrate into `full` mode (runs after schedule + boxscores)
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9_

- [x] 9. Integration with analysis page
  - [x] 9.1 Wire StatsPanel into the analysis page with prop card click handler
    - Add StatsPanel state (isOpen, selectedPlayer, selectedStat) to `app/(app)/analysis/page.tsx`
    - Add `onPropCardClick` handler that sets panel state and opens StatsPanel
    - Pass handler to PropCardGrid (or individual prop cards) as an onClick callback
    - Store triggerRef for focus return on close
    - Ensure clicking a different prop card while panel is open replaces content
    - _Requirements: 1.1, 1.4, 1.7_

- [x] 10. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The design uses TypeScript for all frontend/API code and Python for the scraper — no language selection needed
- The `cached()` utility and `withSecurity` wrapper are existing patterns in the codebase (see `app/api/props/route.ts`)
- fast-check and vitest are already in devDependencies

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1", "3.1"] },
    { "id": 1, "tasks": ["2.2", "2.3", "2.4", "2.5", "3.2"] },
    { "id": 2, "tasks": ["5.1"] },
    { "id": 3, "tasks": ["5.2", "5.3", "6.1", "6.2", "6.3"] },
    { "id": 4, "tasks": ["6.4", "6.5", "6.6", "6.7"] },
    { "id": 5, "tasks": ["8.1"] },
    { "id": 6, "tasks": ["9.1"] }
  ]
}
```
