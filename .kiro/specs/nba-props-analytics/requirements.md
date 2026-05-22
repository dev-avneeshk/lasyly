# Requirements Document: NBA Props Analytics

## Introduction

A complete overhaul of the NBA props analytics pipeline to deliver matchup-scoped, probability-based prop predictions for today's games only. The current engine fetches all player stats globally and makes sequential per-player API calls, resulting in unacceptable page load times. This spec replaces that approach with a matchup-scoped data pipeline, integrates team defensive stats by position from Basketball Reference, builds a multi-factor probability model, and adds a per-prop mini graph showing recent game performance relative to the computed line.

## Glossary

- **Props_Engine**: The server-side computation module (`lib/analytics/engine.ts`) that fetches player data, computes prop lines, and generates prop predictions for the props page.
- **Matchup_Scope**: A data filtering strategy that restricts all prop computations to players from teams playing in today's scheduled NBA games only.
- **Prop_Line**: The predicted stat threshold for a player, computed as the arithmetic mean of the player's last 10 games for a given stat category, rounded to the nearest 0.5.
- **Probability_Model**: A multi-factor statistical model that computes the likelihood a player exceeds a given prop line, using recent form, defensive matchup quality, and pace factors.
- **Defensive_Stats_Scraper**: A Python script that collects team defensive statistics by position from Basketball Reference, including per-36-minute and per-100-possessions data.
- **Mini_Graph**: A visual component on each prop card showing the player's last 5-6 game stat values as bars or points relative to the prop line.
- **Pace_Factor**: A team-level statistic representing possessions per 48 minutes, used to normalize scoring opportunity expectations.
- **Positional_Defense**: Team defensive statistics broken down by opponent position (PG, SG, SF, PF, C), indicating how many stats of a given category that team allows to players at each position.
- **Confidence_Probability**: A percentage (0-100%) representing the model's estimated likelihood that a player hits a specific prop.
- **Today_Games_Filter**: A query constraint that limits all prop generation to games scheduled for the current UTC date.
- **Batch_Query**: A database query pattern that retrieves data for multiple players or teams in a single request rather than sequential per-entity calls.

## Requirements

### Requirement 1: Matchup-Scoped Data Pipeline

**User Story:** As a user, I want the props page to only show props for players in today's NBA games, so that I see relevant predictions without waiting for unnecessary data to load.

#### Acceptance Criteria

1. WHEN the props page loads, THE Props_Engine SHALL query the `nba_games` table for games where `game_date` equals the current UTC date and `status` equals "scheduled" or "in_progress".
2. WHEN today's games are identified, THE Props_Engine SHALL extract the `home_team` and `away_team` values from those games and fetch player stats only for players whose `team` column matches one of today's playing teams.
3. THE Props_Engine SHALL execute a single batch query to retrieve player stats for all players on today's teams, rather than issuing individual queries per player.
4. IF no games are scheduled for today, THEN THE Props_Engine SHALL return a JSON response containing an empty `props` array and a `meta` object with `gamesCount` set to 0.
5. WHEN the user opens the props page for a specific matchup, THE Props_Engine SHALL accept an optional `matchup` query parameter containing two team abbreviations separated by a hyphen (e.g., "SAS-OKC") and restrict results to players from those two teams only.
6. IF the `matchup` query parameter is provided with a value that does not match the format of two valid NBA team abbreviations separated by a hyphen, THEN THE Props_Engine SHALL return a 400 error with a message indicating the expected format.
7. THE Props_Engine SHALL complete all data fetching and computation for today's matchup-scoped props within 2 seconds measured as server-side wall-clock time from request receipt to response dispatch, excluding network latency to the client.

---

### Requirement 2: Optimized Data Fetching

**User Story:** As a user, I want the props page to load quickly, so that I can view predictions without experiencing delays caused by sequential database calls.

#### Acceptance Criteria

1. THE Props_Engine SHALL fetch correlations data for all relevant players in a single batch query using an `IN` clause on player-stat identifiers, rather than issuing one query per player in a loop, where a relevant player is one with at least 3 recorded games for the requested stat category.
2. THE Props_Engine SHALL fetch line movement data for all relevant players in a single batch query using an `IN` clause on player name and stat category, rather than issuing one query per player in a loop.
3. THE Props_Engine SHALL execute the player stats query, correlations batch query, and line movement batch query in parallel using `Promise.all`.
4. IF any single query within the `Promise.all` execution fails, THEN THE Props_Engine SHALL return results computed from the remaining successful queries, omitting the data from the failed query and setting the corresponding field to null in each prop card.
5. THE Props_Engine SHALL cache the computed props result for 60 seconds using the existing `cached()` utility, keyed by sport, stat category, direction, and today's date, and SHALL serve stale cached data for up to 120 seconds while refreshing in the background.
6. WHEN the cache contains data whose age is less than or equal to 120 seconds for the current request parameters and date, THE Props_Engine SHALL return the cached result without blocking on any database queries.
7. THE Props_Engine SHALL include a `computeTimeMs` field in the API response metadata as an integer representing the wall-clock milliseconds spent computing the result, measured from the start of the parallel query execution to completion, excluding cache retrieval time.

---

### Requirement 3: Team Defensive Stats Scraping

**User Story:** As a user, I want prop predictions that account for how the opposing team defends against specific positions, so that predictions reflect real matchup difficulty.

#### Acceptance Criteria

1. THE Defensive_Stats_Scraper SHALL collect team defensive statistics for all 30 NBA teams from Basketball Reference at the URL pattern `https://www.basketball-reference.com/leagues/NBA_2026_per_game.html` and related per-36-minute and per-100-possessions pages.
2. THE Defensive_Stats_Scraper SHALL extract opponent stats allowed broken down by position (PG, SG, SF, PF, C) for the following categories: points, rebounds, assists, three-pointers, steals, and blocks.
3. THE Defensive_Stats_Scraper SHALL store scraped defensive stats in a new Supabase table `nba_team_defense_stats` with columns: team (TEXT), position (TEXT), stat_category (TEXT), value_per_game (NUMERIC), value_per_36 (NUMERIC), value_per_100_poss (NUMERIC), pace (NUMERIC), games_played (INTEGER), season (TEXT), and scraped_at (TIMESTAMPTZ).
4. WHEN the box score scraping step completes in the daily scraping workflow (GitHub Actions `scrape-sports.yml`), THE Defensive_Stats_Scraper SHALL execute as the next step within the same job, with a minimum delay of 3 seconds between HTTP requests and a request timeout of 30 seconds per page.
5. THE Defensive_Stats_Scraper SHALL upsert records using the composite key (team, position, stat_category, season) to avoid duplicate entries.
6. IF Basketball Reference returns an HTTP 429 status, THEN THE Defensive_Stats_Scraper SHALL wait 60 seconds and retry the request up to 3 times before logging the error and skipping that page.
7. IF Basketball Reference returns an HTTP error status other than 429 or the expected position-based stats table is not found on the page, THEN THE Defensive_Stats_Scraper SHALL log the error including the URL and HTTP status code, skip the affected page, and preserve all previously stored data unchanged.
8. THE Defensive_Stats_Scraper SHALL collect the team pace factor (possessions per 48 minutes) for each team and store it in the same table with position set to "TEAM" and stat_category set to "pace".
9. IF the scraper successfully parses stats for fewer than 15 of the 30 expected teams, THEN THE Defensive_Stats_Scraper SHALL log a warning indicating a potential page structure change and exit with a non-zero status code without modifying existing records.

---

### Requirement 4: Probability Model Computation

**User Story:** As a user, I want each prop to show a probability percentage indicating how likely the player is to hit the line, so that I can prioritize the highest-confidence picks.

#### Acceptance Criteria

1. THE Probability_Model SHALL compute a hit probability for each player-stat prop by combining the following weighted factors: recent form weight (40%), defensive matchup weight (35%), and pace adjustment weight (25%).
2. THE Probability_Model SHALL compute the recent form factor as the proportion of the player's last 10 games where the stat value met or exceeded the prop line, expressed as a value between 0.0 and 1.0. IF the player has fewer than 10 but at least 3 games of data, THEN THE Probability_Model SHALL compute the recent form factor using all available games.
3. THE Probability_Model SHALL compute the defensive matchup factor by comparing the opposing team's positional defensive stat (points/rebounds/assists allowed to the player's position per game) against the league average for that position-stat combination, where a team allowing more than league average yields a factor above 0.5 and a team allowing less yields a factor below 0.5, scaled linearly between 0.0 and 1.0 using min-max normalization across all teams. IF all teams have the same positional defensive stat value (max equals min), THEN THE Probability_Model SHALL assign a defensive matchup factor of 0.5.
4. THE Probability_Model SHALL compute the pace adjustment factor by comparing the opposing team's pace to the league average pace, where a faster-paced team yields a factor above 0.5 and a slower-paced team yields a factor below 0.5, scaled linearly between 0.0 and 1.0 using min-max normalization across all teams. IF all teams have the same pace value (max equals min), THEN THE Probability_Model SHALL assign a pace adjustment factor of 0.5.
5. THE Probability_Model SHALL output the final probability as a percentage between 0% and 100%, computed as: (recent_form * 0.40 + defensive_matchup * 0.35 + pace_adjustment * 0.25) * 100, rounded to one decimal place.
6. THE Props_Engine SHALL sort all props by probability descending; IF two or more props have the same probability value, THEN THE Props_Engine SHALL sort those tied props alphabetically by player name ascending.
7. IF defensive stats are unavailable for the opposing team or the player's position is unknown, THEN THE Probability_Model SHALL fall back to using only the recent form factor (weighted at 100%) for that prop's probability.
8. IF pace data is unavailable for the opposing team, THEN THE Probability_Model SHALL compute the probability using only recent form weight (57%) and defensive matchup weight (43%), omitting the pace adjustment factor.

---

### Requirement 5: Prop Line Computation

**User Story:** As a user, I want each player's prop line to reflect their recent performance average, so that the over/under threshold is meaningful and current.

#### Acceptance Criteria

1. THE Props_Engine SHALL compute the prop line for each player-stat combination as the arithmetic mean of the player's last 10 game values for that stat, rounded to the nearest 0.5 using standard rounding (values exactly halfway between two 0.5 increments round up, e.g., 22.25 rounds to 22.5).
2. IF a player has fewer than 10 but at least 3 games of data, THEN THE Props_Engine SHALL compute the prop line using all available games and apply the same rounding rule.
3. IF a player has fewer than 3 games of data, THEN THE Props_Engine SHALL exclude that player-stat combination from the props results by not generating a prop card for it.
4. THE Props_Engine SHALL use the last 10 games in chronological order (most recent first) regardless of opponent or venue.
5. WHEN the prop line is computed, THE Props_Engine SHALL also compute the L5 average (arithmetic mean of the most recent 5 games, rounded to 1 decimal place) and L10 average (arithmetic mean of the most recent 10 games, rounded to 1 decimal place) for display on the prop card.
6. IF a player has fewer than 5 games of data but at least 3, THEN THE Props_Engine SHALL compute the L5 average using all available games and label it accordingly.
7. WHEN the Props_Engine computes a prop line, THE Props_Engine SHALL return the result within 2 seconds of the API request for a single sport and stat category combination.

---

### Requirement 6: Mini Graph Visualization

**User Story:** As a user, I want to see a small graph on each prop card showing the player's last 5-6 games relative to the prop line, so that I can visually assess recent trends at a glance.

#### Acceptance Criteria

1. THE Props_Engine SHALL include a `graphData` array in each prop response containing the player's last 6 game values in chronological order (oldest to newest), with each entry containing the stat value as a non-negative number, game date in ISO 8601 format, opponent abbreviation as a string of 3-5 characters, and a boolean indicating whether the value met or exceeded the prop line.
2. THE Mini_Graph SHALL render the prop line as a horizontal reference line across the full width of the graph area.
3. THE Mini_Graph SHALL render each game value as a vertical bar whose height is proportional to the stat value relative to a Y-axis scale ranging from 0 to the greater of (prop line × 1.5) or the maximum game value in the dataset, colored with the lime accent color when the value meets or exceeds the prop line, and colored with a muted/dim color (white at 20% opacity) when the value falls below the prop line.
4. THE Mini_Graph SHALL label the horizontal reference line with the prop line value displayed as a numeric label positioned to the right or left edge of the graph area.
5. IF a player has fewer than 6 games of data but at least 3, THEN THE Mini_Graph SHALL render all available games without padding or placeholder entries, distributing bars evenly across the available graph width.
6. IF a player has fewer than 3 games of data, THEN THE Mini_Graph SHALL not be rendered, and the graph area within the prop card SHALL remain empty or hidden.
7. THE Mini_Graph SHALL be rendered within the prop card layout at a fixed height of 64 pixels, occupying the full card width minus the card's horizontal padding.

---

### Requirement 7: Today's Games Display

**User Story:** As a user, I want to see which NBA games are happening today and filter props by specific matchups, so that I can focus on the games I care about.

#### Acceptance Criteria

1. WHEN the props page loads, THE Props_Engine SHALL return a `todayGames` array in the API response containing all NBA games scheduled for the current UTC date, with each entry including home team abbreviation, away team abbreviation, game time (ISO 8601 format), and game status (one of: "scheduled", "live", "final").
2. THE props page SHALL display today's games as a horizontally scrollable strip of matchup cards above the prop results, showing a maximum of 15 matchup cards.
3. WHEN the user taps a specific matchup card in the games strip, THE Props_Engine SHALL filter the displayed props to show only players from the two teams in that matchup, while preserving any other active filters (stat type, search query, direction).
4. WHEN no specific matchup is selected, THE Props_Engine SHALL display props for all players across all of today's games.
5. IF no NBA games are scheduled for today, THEN THE props page SHALL display a message indicating no games are scheduled and hide the games strip and prop results entirely.
6. THE games strip SHALL apply a distinct border or background color to the currently selected matchup card that differs from unselected cards, and WHEN the user taps the already-selected matchup card, THE props page SHALL deselect it and return to the all-games view.
7. IF the Props_Engine fails to retrieve today's games data, THEN THE props page SHALL hide the games strip and display all available props without matchup filtering.

---

### Requirement 8: Player Position Mapping

**User Story:** As a user, I want predictions that account for my player's position when evaluating defensive matchups, so that a guard's props are compared against how the opponent defends guards specifically.

#### Acceptance Criteria

1. THE Props_Engine SHALL maintain a player-to-position mapping that associates each NBA player with exactly one primary position from the set (PG, SG, SF, PF, C), sourced from the `position` column in the `nba_player_stats` table.
2. WHEN a player's source data lists multiple positions (e.g., "PG-SG" or "SF-PF"), THE Props_Engine SHALL use the first listed position as the player's primary position for defensive matchup lookups.
3. WHEN computing the defensive matchup factor for a player, THE Probability_Model SHALL query the `nba_team_defense_stats` table for the opposing team's row matching the player's primary position and the relevant stat category, and use the `value_per_game` column as the positional defensive stat.
4. IF a player's position is not available in the mapping, THEN THE Probability_Model SHALL compute the opposing team's overall defensive average for the relevant stat category as the arithmetic mean of that team's `value_per_game` across all five positions (PG, SG, SF, PF, C) in the `nba_team_defense_stats` table, and use that value as the defensive matchup input.
5. THE Defensive_Stats_Scraper SHALL extract player position data from Basketball Reference box score pages and store it in the `nba_player_stats` table as a `position` column (TEXT, nullable), updating the value on each daily scraping cycle via upsert on the existing player-game composite key.

---

### Requirement 9: API Response Structure

**User Story:** As a frontend developer, I want a well-structured API response that includes all data needed to render prop cards with graphs and probabilities, so that the UI can render without additional API calls.

#### Acceptance Criteria

1. THE `/api/props` endpoint SHALL return a JSON response containing: `props` (array of prop objects, maximum 100 elements), `todayGames` (array of today's game objects), and `meta` (object with sport, stat, total count, timestamp as ISO 8601 string, computeTimeMs as integer milliseconds, and gamesCount as integer).
2. WHEN the `sport` parameter is "NBA", each prop object SHALL include: id (string, URL-safe slug), player (string, max 100 characters), team (string, 3-letter abbreviation), position (string), statCategory (string), propLine (number, rounded to nearest 0.5), l5Avg (number, 1 decimal place), l10Avg (number, 1 decimal place), probability (number, 0 to 1), matchup (3-letter opponent abbreviation), graphData (array of the last 6 games, or fewer if the player has fewer than 6 games on record), hitRate (object with over, total, and label), trend (one of "up", "down", "neutral"), trendPct (integer, 0 to 100), and defensiveMatchup (object with opponentTeam, statAllowedPerGame, leagueAverage, and grade).
3. THE `graphData` field SHALL contain an array of objects each with: value (number), date (ISO 8601 date string in YYYY-MM-DD format), opponent (3-letter team abbreviation string), and overLine (boolean indicating whether value met or exceeded the prop line).
4. THE `defensiveMatchup` field SHALL contain: opponentTeam (3-letter abbreviation string), statAllowedPerGame (number, 1 decimal place), leagueAverage (number, 1 decimal place), grade (string, one of "A", "B", "C", "D", "F"), and paceRating (string, one of "fast", "average", "slow").
5. THE endpoint SHALL accept query parameters: sport (one of "NBA" or "Tennis"), stat (string matching a supported stat category for the given sport), matchup (optional, format: two 3-letter team abbreviations separated by a single hyphen, e.g. "LAL-GSW"), search (optional, string, minimum 2 characters to activate filtering), limit (optional, integer between 1 and 100, default 50), and direction (one of "over" or "under", default "over").
6. IF the `matchup` parameter is provided with a value that does not match the format of two 3-letter alphabetic abbreviations separated by a hyphen, or contains team abbreviations not found in the system, THEN THE endpoint SHALL return a 400 status code with a JSON body containing an error message indicating the invalid matchup format or unrecognized team.
7. IF the `sport` parameter is not one of the supported values or the `stat` parameter does not correspond to a valid stat category for the specified sport, THEN THE endpoint SHALL return a 400 status code with a JSON body containing an error message indicating the unsupported sport or stat value.

---

### Requirement 10: Database Schema for Defensive Stats

**User Story:** As a developer, I want a dedicated table for team defensive stats by position, so that the probability model can efficiently query positional matchup data.

#### Acceptance Criteria

1. THE system SHALL create a Supabase migration adding the `nba_team_defense_stats` table (using IF NOT EXISTS) with columns: id (UUID, primary key, default uuid_generate_v4()), team (TEXT, NOT NULL), position (TEXT, NOT NULL, CHECK constraint limiting values to 'PG', 'SG', 'SF', 'PF', 'C', or 'TEAM'), stat_category (TEXT, NOT NULL), value_per_game (NUMERIC), value_per_36 (NUMERIC), value_per_100_poss (NUMERIC), pace (NUMERIC), games_played (INTEGER), season (TEXT, NOT NULL, format 'YYYY-YY' matching existing nba_games convention e.g. '2025-26'), and scraped_at (TIMESTAMPTZ, NOT NULL, default now()).
2. THE migration SHALL create a unique constraint on (team, position, stat_category, season) to support upsert operations.
3. THE migration SHALL create an index on (team, position, stat_category) for efficient lookups during prop computation.
4. THE migration SHALL enable Row Level Security on the `nba_team_defense_stats` table with a policy allowing public SELECT access (USING true).
5. THE migration SHALL add a `position` column (TEXT, nullable) to the existing `nba_player_stats` table only if the column does not already exist, ensuring the migration is idempotent.
6. IF the migration is executed against a database where the `nba_team_defense_stats` table already exists, THEN THE system SHALL complete without error due to the IF NOT EXISTS guard on table creation.
