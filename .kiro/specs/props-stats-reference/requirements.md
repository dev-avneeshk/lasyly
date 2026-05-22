# Requirements Document: Props Stats Reference

## Introduction

A detailed stats reference panel that appears when a user clicks on a prop card on the analysis page. The panel displays raw stats pulled from Basketball Reference tables, derived/calculated stats, a quick-reference mapping of stats to their source tables, and a prop-specific cheat sheet explaining which inputs matter most for each prop type. The goal is to give users full analytical transparency into the data behind each prop line, showing actual player stats alongside formulas and explanations.

## Glossary

- **Stats_Panel**: The slide-out or expandable UI panel that displays detailed stats reference information when a user clicks on a prop card on the analysis page.
- **Raw_Stats**: Player statistics pulled directly from Basketball Reference tables without additional computation, including shooting, rebounding, and playmaking metrics.
- **Derived_Stats**: Statistics calculated from raw table data using defined formulas, such as expected points per shot attempted (ePPS) or self-created FGA per game.
- **Source_Table_Map**: A reference section within the Stats_Panel that maps each statistic to its originating Basketball Reference table (e.g., Per Game, Shooting, Advanced).
- **Cheat_Sheet**: A prop-specific section within the Stats_Panel that identifies which statistical inputs are most relevant for evaluating a given prop type (points, rebounds, assists, PRA).
- **NBA_Scraper**: The existing Python scraper (`scripts/scrape_nba.py`) that pulls game data from Basketball Reference and stores it in Supabase.
- **Stats_Reference_API**: The server-side endpoint that fetches and computes the detailed stats reference data for a given player.
- **ePPS**: Expected Points Per Shot Attempted, a derived efficiency metric computed as total points divided by total field goal attempts plus 0.44 times free throw attempts.
- **Self_Created_FGA**: Field goal attempts that were not assisted, computed as total FGA minus assisted FGA (using assist percentage data).
- **PGA**: Potential Game Assists, a Basketball Reference metric tracking passes that lead to a teammate's shot attempt.

## Requirements

### Requirement 1: Stats Panel Trigger and Display

**User Story:** As a user, I want to click on a prop card to see a detailed stats reference panel, so that I can understand the analytical basis behind the prop line.

#### Acceptance Criteria

1. WHEN a user clicks on a prop card on the analysis page, THE Stats_Panel SHALL open as a slide-out panel from the right side of the screen on desktop viewports (width >= 1024px) or as a full-screen modal on mobile viewports (width < 1024px), completing the open transition within 300ms.
2. WHILE the Stats_Panel is open, THE Stats_Panel SHALL display the player's name, team abbreviation, position, and the prop stat category as a header section at the top of the panel.
3. WHEN the Stats_Panel is open and data is being fetched from the Stats_Reference_API, THE Stats_Panel SHALL display a loading skeleton, and IF the Stats_Reference_API does not respond within 10 seconds, THEN THE Stats_Panel SHALL treat the request as failed and display the error state.
4. WHEN the user clicks outside the Stats_Panel, presses the close button, or presses the Escape key, THE Stats_Panel SHALL close and return focus to the prop card that triggered it.
5. IF the Stats_Reference_API returns an error or times out, THEN THE Stats_Panel SHALL display an error message indicating the data could not be loaded, along with a retry button that re-initiates the data fetch when clicked.
6. WHILE the Stats_Panel is open and data has loaded, THE Stats_Panel SHALL organize content into four collapsible sections: Raw Stats, Derived Stats, Source Table Reference, and Prop Cheat Sheet, with all sections expanded by default.
7. WHEN a user clicks on a different prop card while the Stats_Panel is already open, THE Stats_Panel SHALL replace its content with the newly selected player's data, displaying the loading skeleton until the new data is fetched.

---

### Requirement 2: Raw Stats Display — Shooting Volume and Efficiency

**User Story:** As a user, I want to see a player's shooting volume and efficiency stats from Basketball Reference, so that I can evaluate their scoring patterns and shot selection.

#### Acceptance Criteria

1. THE Stats_Panel SHALL display the following shooting stats for the selected player's current season: FGA per game, FTA per game, FTM per game, FT%, 3PA per game, 3PM per game, and 3P%, with per-game values rounded to 1 decimal place and percentages rounded to 1 decimal place.
2. THE Stats_Panel SHALL display shot distribution stats: percentage of FGA near the rim (0-3 ft), mid-range percentage of FGA, percentage of 2-point FG that are assisted, and percentage of 3-point FG that are assisted, each rounded to 1 decimal place.
3. WHEN displaying each raw stat, THE Stats_Panel SHALL show the stat label, the player's actual value, and the league average for that stat at the player's position in a single row. IF the player's position is unknown, THEN THE Stats_Panel SHALL use the overall league average across all positions for comparison.
4. THE Stats_Panel SHALL color-code each stat value as green when the player's value exceeds the league average by more than 10%, red when the player's value is below the league average by more than 10%, and the default text color (no highlight) when the player's value is within 10% of the league average inclusive.
5. IF shooting distribution data (rim %, mid-range %, assisted %) is unavailable for the player, THEN THE Stats_Panel SHALL display "N/A" for those fields and show a tooltip explaining the data is not yet available.
6. IF league average data is unavailable for a stat, THEN THE Stats_Panel SHALL display the player's value without color-coding and show a dash ("—") in the league average column.

---

### Requirement 3: Raw Stats Display — Rebounding and Playmaking

**User Story:** As a user, I want to see a player's rebounding and playmaking stats, so that I can evaluate their contributions beyond scoring.

#### Acceptance Criteria

1. THE Stats_Panel SHALL display the following rebounding stats for the selected player: TRB% (total rebound percentage), ORB% (offensive rebound percentage), and DRB% (defensive rebound percentage), each displayed as a percentage value rounded to one decimal place.
2. THE Stats_Panel SHALL display the following playmaking stats for the selected player: AST% (assist percentage) rounded to one decimal place, AST/TOV ratio rounded to two decimal places, and PGA (Potential Game Assists) per game rounded to one decimal place.
3. WHEN displaying rebounding and playmaking stats, THE Stats_Panel SHALL show each stat with its label, the player's value, and an inline description of no more than 100 characters explaining what the stat measures.
4. IF PGA data is unavailable for the player, THEN THE Stats_Panel SHALL display "N/A" for the PGA field and omit it from derived stat calculations that depend on it.
5. IF any rebounding or playmaking stat other than PGA is unavailable for the player, THEN THE Stats_Panel SHALL display "N/A" for that stat's value field and retain the stat label and inline description.

---

### Requirement 4: Derived Stats Computation and Display

**User Story:** As a user, I want to see calculated stats derived from raw data, so that I can understand advanced metrics that inform prop predictions.

#### Acceptance Criteria

1. THE Stats_Panel SHALL compute and display the following derived stats: mid-range attempts per game, rim attempts per game, expected points per shot attempted (ePPS), self-created FGA per game, AST/TOV ratio, PGA conversion rate, projected rebounds per game, stocks per game (STL + BLK), and fouls drawn per game (FTA as proxy).
2. THE Stats_Panel SHALL compute mid-range attempts per game as: FGA per game multiplied by mid-range percentage of FGA, displayed to one decimal place.
3. THE Stats_Panel SHALL compute rim attempts per game as: FGA per game multiplied by percentage of FGA near the rim (0-3 ft), displayed to one decimal place.
4. THE Stats_Panel SHALL compute ePPS as: PTS per game divided by (FGA per game + 0.44 * FTA per game), displayed to two decimal places.
5. THE Stats_Panel SHALL compute self-created FGA per game as: FGA per game multiplied by (1 minus assisted percentage), where assisted percentage equals ((pct_2p_assisted * (1 - fga_pct_3pt)) + (pct_3p_assisted * fga_pct_3pt)), displayed to one decimal place.
6. THE Stats_Panel SHALL compute PGA conversion rate as: AST per game divided by PGA per game, displayed as a percentage rounded to one decimal place.
7. THE Stats_Panel SHALL compute projected rebounds per game as: (TRB% / 100) multiplied by the player's team total rebounds per game as stored in the nba_team_defense_stats table, displayed to one decimal place.
8. THE Stats_Panel SHALL compute stocks per game as: STL per game plus BLK per game, displayed to one decimal place.
9. THE Stats_Panel SHALL compute fouls drawn per game as: FTA per game divided by 1.8 (league average free throws per foul), displayed to one decimal place.
10. WHEN displaying each derived stat, THE Stats_Panel SHALL show the stat label, the computed numeric value, and a text representation of the formula with input values substituted (e.g., "18.5 / (16.2 + 0.44 × 8.1) = 0.92").
11. IF any input stat required for a derived computation is unavailable, THEN THE Stats_Panel SHALL omit that derived stat row and display "Insufficient data" with the name of the missing input stat.
12. IF PGA per game is zero, THEN THE Stats_Panel SHALL display "N/A" for PGA conversion rate instead of computing a division by zero.

---

### Requirement 5: Source Table Quick Reference

**User Story:** As a user, I want to know which Basketball Reference table each stat comes from, so that I can verify the data or explore further on my own.

#### Acceptance Criteria

1. THE Stats_Panel SHALL display a "Source Table Reference" section mapping each stat to its Basketball Reference source table, with all group headers collapsed by default.
2. THE Stats_Panel SHALL map stats to the following source tables: Per Game table (FGA, FTA, FTM, FT%, 3PA, 3PM, 3P%, AST, STL, BLK, TRB, PTS), Shooting table (% of FGA by distance, % of FG assisted), Advanced table (TRB%, ORB%, DRB%, AST%, PGA), and Opponent Stats table (team defensive stats by position).
3. THE Stats_Panel SHALL display each source table as a collapsible group header with the stats it contains listed as comma-separated labels beneath it.
4. WHEN the user taps on a source table group header, THE Stats_Panel SHALL toggle that group between expanded and collapsed states independently of other groups.
5. IF a source table group contains no stats for the current view, THEN THE Stats_Panel SHALL hide that group header entirely.

---

### Requirement 6: Prop-Specific Cheat Sheet

**User Story:** As a user, I want to see which stats matter most for each prop type, so that I can quickly assess the key factors driving a specific prop line.

#### Acceptance Criteria

1. THE Stats_Panel SHALL display a "Prop Cheat Sheet" section that lists the most relevant inputs for the prop type currently being viewed, grouped by category in the order: primary, secondary, context.
2. WHEN the prop type is "points", THE Cheat_Sheet SHALL highlight: FGA per game (primary), FTA per game (primary), 3PA per game (secondary), ePPS (secondary), rim attempts per game (context), and self-created FGA (context), with a one-sentence explanation (maximum 120 characters) for each stat describing its relevance to the prop type.
3. WHEN the prop type is "rebounds", THE Cheat_Sheet SHALL highlight: TRB% (primary), ORB% (primary), DRB% (secondary), projected rebounds per game (secondary), and opponent pace (context), with a one-sentence explanation (maximum 120 characters) for each stat describing its relevance to the prop type.
4. WHEN the prop type is "assists", THE Cheat_Sheet SHALL highlight: AST% (primary), PGA per game (primary), PGA conversion rate (secondary), AST/TOV ratio (secondary), and team pace (context), with a one-sentence explanation (maximum 120 characters) for each stat describing its relevance to the prop type.
5. WHEN the prop type is "PRA" (points + rebounds + assists combo), THE Cheat_Sheet SHALL highlight: ePPS (primary), TRB% (primary), AST% (primary), FGA per game (secondary), minutes per game (secondary), and opponent pace (context), with a one-sentence explanation (maximum 120 characters) for each stat describing its relevance to the prop type.
6. THE Cheat_Sheet SHALL categorize each highlighted stat as "primary" (strongest signal), "secondary" (supporting signal), or "context" (environmental factor), and display them in that priority order within each category.
7. IF the prop type does not match points, rebounds, assists, or PRA, THEN THE Cheat_Sheet SHALL display a message indicating that a cheat sheet is not available for this prop type.
8. IF a stat listed in the cheat sheet has no data available for the current player, THEN THE Cheat_Sheet SHALL display that stat with a "No data" indicator in place of its value while still showing the stat name, category, and explanation.

---

### Requirement 7: Stats Reference Data Fetching

**User Story:** As a developer, I want a dedicated API endpoint for stats reference data, so that the panel can load detailed stats without slowing down the main props page.

#### Acceptance Criteria

1. THE Stats_Reference_API SHALL expose a `GET /api/props/stats-reference` endpoint accepting a `player` query parameter (player name, maximum 100 characters) and a `stat` query parameter (stat category restricted to one of: pts, trb, ast, tp, stl, blk, pra).
2. IF the `player` or `stat` query parameter is missing, empty, or the `stat` value is not one of the allowed categories, THEN THE Stats_Reference_API SHALL return a 400 status code with a message indicating which parameter is invalid.
3. WHEN the endpoint receives a valid request, THE Stats_Reference_API SHALL query the `nba_player_stats` table for the player's last 20 games (ordered by game date descending) and compute per-game averages for the following raw stats: pts, trb, ast, tp, stl, blk.
4. WHEN computing league averages, THE Stats_Reference_API SHALL query the `nba_team_defense_stats` table and calculate the arithmetic mean of `value_per_game` across all teams for the player's position and the requested stat category.
5. IF the player's position is not available in the `nba_player_stats` table, THEN THE Stats_Reference_API SHALL compute league averages using the arithmetic mean of `value_per_game` across all five positions (PG, SG, SF, PF, C) for the requested stat category.
6. THE Stats_Reference_API SHALL compute all derived stats as defined in Requirement 4 server-side and return them in the response alongside raw stat averages and league averages.
7. THE Stats_Reference_API SHALL return the response within 1 second of receiving the request, measured as server-side wall-clock time.
8. THE Stats_Reference_API SHALL cache the computed stats reference data for 5 minutes (300,000 ms TTL) using the existing `cached()` utility, keyed by the combination of player name and stat category.
9. IF the player name does not match any records in the `nba_player_stats` table, THEN THE Stats_Reference_API SHALL return a 404 status code with a message indicating the player was not found.
10. IF the player has fewer than 3 games of data in the `nba_player_stats` table, THEN THE Stats_Reference_API SHALL return a 200 response with an `insufficientData` flag set to true, include the available raw stat averages, and omit derived stats from the response.

---

### Requirement 8: Extended Scraper Data Collection

**User Story:** As a developer, I want the NBA scraper to collect additional shooting and advanced stats from Basketball Reference, so that the stats reference panel has the data it needs.

#### Acceptance Criteria

1. THE NBA_Scraper SHALL scrape the Basketball Reference Shooting table for each player found in the `nba_player_stats` table for the current season, collecting: percentage of FGA by distance (0-3 ft, 3-10 ft, 10-16 ft, 16-3PT, 3PT), percentage of 2P FG assisted, and percentage of 3P FG assisted.
2. THE NBA_Scraper SHALL scrape the Basketball Reference Advanced table for each player found in the `nba_player_stats` table for the current season, collecting: TRB%, ORB%, DRB%, AST%, and PGA (Potential Assists).
3. IF a stat field (including PGA) is not present on a player's Basketball Reference page, THEN THE NBA_Scraper SHALL store NULL for that column and continue processing the remaining fields for that player.
4. WHEN the scraper collects extended stats, THE NBA_Scraper SHALL store them in a new `nba_player_advanced_stats` table with columns: player_name (TEXT), season (TEXT), games_played (INTEGER), fga_pct_0_3ft (NUMERIC), fga_pct_3_10ft (NUMERIC), fga_pct_10_16ft (NUMERIC), fga_pct_16_3pt (NUMERIC), fga_pct_3pt (NUMERIC), pct_2p_assisted (NUMERIC), pct_3p_assisted (NUMERIC), trb_pct (NUMERIC), orb_pct (NUMERIC), drb_pct (NUMERIC), ast_pct (NUMERIC), pga (NUMERIC), scraped_at (TIMESTAMPTZ).
5. THE NBA_Scraper SHALL upsert records in `nba_player_advanced_stats` using the composite key (player_name, season) to avoid duplicates.
6. THE NBA_Scraper SHALL execute the extended stats scraping as a separate mode (`advanced-stats`) that can be run independently or as part of the `full` scraping mode, where it runs after schedule and box score scraping completes.
7. IF Basketball Reference returns an HTTP 429 status during advanced stats scraping, THEN THE NBA_Scraper SHALL wait 60 seconds and retry up to 3 times before logging the error and skipping that player.
8. IF Basketball Reference returns an HTTP 5xx status or the request times out (30 second timeout) during advanced stats scraping, THEN THE NBA_Scraper SHALL wait 60 seconds and retry up to 3 times before logging the error and skipping that player.
9. THE NBA_Scraper SHALL maintain a minimum delay of 3 seconds between HTTP requests during advanced stats scraping to respect rate limits.

---

### Requirement 9: Database Schema for Advanced Player Stats

**User Story:** As a developer, I want a dedicated table for advanced player stats, so that the stats reference panel can efficiently query shooting distribution and advanced metrics.

#### Acceptance Criteria

1. THE system SHALL create a Supabase migration adding the `nba_player_advanced_stats` table with columns: id (UUID, primary key, default uuid_generate_v4()), player_name (TEXT, NOT NULL), season (TEXT, NOT NULL), games_played (INTEGER), fga_pct_0_3ft (NUMERIC), fga_pct_3_10ft (NUMERIC), fga_pct_10_16ft (NUMERIC), fga_pct_16_3pt (NUMERIC), fga_pct_3pt (NUMERIC), pct_2p_assisted (NUMERIC), pct_3p_assisted (NUMERIC), trb_pct (NUMERIC), orb_pct (NUMERIC), drb_pct (NUMERIC), ast_pct (NUMERIC), pga (NUMERIC), scraped_at (TIMESTAMPTZ, NOT NULL, default now()), and created_at (TIMESTAMPTZ, NOT NULL, default now()).
2. THE migration SHALL create a unique constraint on (player_name, season) to support upsert operations, using a DO block or equivalent idempotent check so that re-running the migration does not fail if the constraint already exists.
3. THE migration SHALL create an index on (player_name) using IF NOT EXISTS for efficient lookups during stats reference computation.
4. THE migration SHALL enable Row Level Security on the `nba_player_advanced_stats` table with a policy allowing public SELECT access, using an existence check so that re-running the migration does not create a duplicate policy.
5. IF the migration is executed against a database where the `nba_player_advanced_stats` table already exists, THEN THE system SHALL complete without error due to IF NOT EXISTS guards on table creation, constraint addition, index creation, and policy creation.
6. WHEN the migration completes successfully, THE system SHALL have a table where all NUMERIC columns store percentage values in the range 0.0 to 100.0 and games_played stores non-negative integers, as enforced by the column types and expected input domain.

---

### Requirement 10: Stats Panel Accessibility and Performance

**User Story:** As a user, I want the stats panel to be fast, accessible, and easy to navigate, so that I can quickly find the information I need regardless of my device or abilities.

#### Acceptance Criteria

1. THE Stats_Panel SHALL be navigable using keyboard controls: Escape to close, Tab to move focus to the next focusable element, Shift+Tab to move focus to the previous focusable element, and Enter to expand or collapse collapsible section headers.
2. THE Stats_Panel SHALL include appropriate ARIA labels: role="dialog" on the panel container, aria-labelledby referencing the player name header, and aria-expanded on collapsible section headers.
3. WHEN the Stats_Panel opens, THE Stats_Panel SHALL place initial focus on the close button and trap focus within the panel such that Tab from the last focusable element cycles to the first focusable element, and Shift+Tab from the first focusable element cycles to the last focusable element, until the panel is closed.
4. THE Stats_Panel SHALL render all stat values using a monospace font for alignment and readability.
5. WHEN the user clicks a prop card, THE Stats_Panel SHALL complete its initial render with the skeleton visible within 100 milliseconds of the click event.
6. WHEN the Stats_Panel data loads, THE Stats_Panel SHALL animate the transition from skeleton to content using a fade-in animation lasting no more than 200 milliseconds.
7. WHEN the Stats_Panel closes, THE Stats_Panel SHALL return focus to the prop card element that triggered the panel to open.
