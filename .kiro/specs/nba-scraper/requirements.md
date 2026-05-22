# Requirements Document

## Introduction

The NBA Scraper is a Python-based data collection system that uses the Scrapling library to scrape basketball-reference.com for NBA game schedules, box score links, and detailed player statistics. The scraped data is stored in a Supabase PostgreSQL database to power the BetRoom props section with real player performance data for the 2025-26 NBA season.

## Glossary

- **Scraper**: The Python application that fetches and parses web pages from basketball-reference.com using the Scrapling library
- **Schedule_Page**: A basketball-reference.com page listing all NBA games for a given month (e.g., https://www.basketball-reference.com/leagues/NBA_2026_games-october.html)
- **Box_Score_Page**: A basketball-reference.com page containing detailed game statistics for a single NBA game (e.g., https://www.basketball-reference.com/boxscores/202510210OKC.html)
- **Game_Record**: A row in the nba_games table representing a single NBA game with date, teams, scores, and status
- **Player_Stat_Record**: A row in the nba_player_stats table representing one player's box score statistics for a single game
- **Season_Months**: The months October through May that comprise the NBA regular season and playoffs
- **Supabase_Database**: The PostgreSQL database hosted on Supabase where scraped data is persisted
- **Scrapling**: A Python web scraping library that supports CSS selectors, XPath, and multiple fetcher types (Fetcher, DynamicFetcher, StealthyFetcher)

## Requirements

### Requirement 1: Schedule Page Scraping

**User Story:** As a data operator, I want to scrape NBA schedule pages from basketball-reference.com for each month of the season, so that I can collect all game records for the 2025-26 season.

#### Acceptance Criteria

1. WHEN the Scraper is invoked for schedule collection, THE Scraper SHALL fetch the schedule page for each month in Season_Months (October, November, December, January, February, March, April, May) from basketball-reference.com, waiting at least 3 seconds between consecutive HTTP requests to avoid rate limiting
2. WHEN a Schedule_Page is fetched successfully, THE Scraper SHALL parse the schedule table and extract the following columns for each row: Date, Start (ET), Visitor/Neutral team name, visitor points (null if not yet played), Home/Neutral team name, home points (null if not yet played), and the box score URL slug
3. WHEN a game row contains a "Box Score" link, THE Scraper SHALL extract the box score URL slug from the href attribute and use it as the game_url identifier
4. IF a game row does not contain a "Box Score" link, THEN THE Scraper SHALL generate a game_url identifier from the game date and team names and set the game status to "scheduled"
5. THE Scraper SHALL construct Schedule_Page URLs using the pattern: `https://www.basketball-reference.com/leagues/NBA_2026_games-{month}.html` where month is the lowercase full month name
6. WHEN a game row has non-null visitor points and home points, THE Scraper SHALL set the game status to "completed"; WHEN a game row has null points for both teams, THE Scraper SHALL set the game status to "scheduled"
7. IF a Schedule_Page returns an HTTP error status code or the request fails to receive a response within 30 seconds, THEN THE Scraper SHALL log the error with the month name and HTTP status code (or timeout indication) and continue processing remaining months
8. IF a Schedule_Page returns HTTP 429 (Too Many Requests), THEN THE Scraper SHALL wait 60 seconds before retrying the request for that month, up to a maximum of 3 retry attempts

### Requirement 2: Game Record Persistence

**User Story:** As a data operator, I want scraped schedule data to be stored in the nba_games table, so that game information is available for downstream features.

#### Acceptance Criteria

1. WHEN schedule data is parsed from a Schedule_Page, THE Scraper SHALL insert or update a Game_Record in the Supabase_Database nba_games table for each game row that contains at minimum a game_date, game_url, home_team, and away_team value
2. THE Scraper SHALL map the parsed game data to the nba_games schema: game_date from Date column, game_url from the box score URL slug, home_team from Home/Neutral column, away_team from Visitor/Neutral column, home_score from home points, away_score from visitor points, and season as "2025-26"
3. WHEN a game row has both home and visitor point values populated, THE Scraper SHALL set the Game_Record status to "completed"
4. WHEN a game row has no point values populated for either team, THE Scraper SHALL set the Game_Record status to "scheduled"
5. WHEN a game row has only one point value populated (home or visitor but not both), THE Scraper SHALL set the Game_Record status to "scheduled" and SHALL NOT store the partial score value
6. WHEN a Game_Record with the same game_url already exists in the database, THE Scraper SHALL update the existing record's home_score, away_score, and status fields with the latest scraped data rather than creating a duplicate
7. IF a parsed game row is missing any of the required fields (game_date, game_url, home_team, or away_team), THEN THE Scraper SHALL skip that row, log a warning including the available identifying information, and continue processing remaining games
8. IF a database write operation fails, THEN THE Scraper SHALL log the error with the game_url and continue processing remaining games without rolling back previously successful writes

### Requirement 3: Box Score Link Discovery

**User Story:** As a data operator, I want to identify which games have box scores available, so that I can scrape detailed player statistics only for completed games.

#### Acceptance Criteria

1. WHEN the Scraper is invoked for box score collection, THE Scraper SHALL query the Supabase_Database for all Game_Records with status "completed" and return at most 500 Game_Records per invocation, ordered by game_date ascending
2. WHEN constructing Box_Score_Page URLs, THE Scraper SHALL use the pattern: `https://www.basketball-reference.com/boxscores/{game_url}.html` where game_url is the value from the Game_Record's game_url field
3. WHEN a date range filter is provided with a start_date and end_date in ISO 8601 format (YYYY-MM-DD), THE Scraper SHALL limit box score collection to Game_Records whose game_date falls within the inclusive range [start_date, end_date]
4. IF a date range filter is provided and start_date is after end_date, THEN THE Scraper SHALL reject the invocation with a validation error indicating the start_date must be on or before end_date
5. WHEN the unscraped-only filter is enabled, THE Scraper SHALL return only Game_Records that have zero associated Player_Stat_Records in the database (determined by the absence of any nba_player_stats row referencing the Game_Record's id)
6. IF the Supabase_Database query fails or times out after 30 seconds, THEN THE Scraper SHALL terminate the box score collection invocation with an error indicating the database is unreachable and SHALL NOT attempt to scrape any Box_Score_Pages
7. IF no Game_Records match the query criteria, THEN THE Scraper SHALL return an empty collection and log that zero games were found for the given filters

### Requirement 4: Box Score Data Scraping

**User Story:** As a data operator, I want to scrape detailed player statistics from box score pages, so that player performance data is available for the props feature.

#### Acceptance Criteria

1. WHEN a Box_Score_Page is fetched successfully (HTTP 200 with a parseable HTML response), THE Scraper SHALL parse the box score tables for both the home team and the away team, setting each Player_Stat_Record's team field to the player's team name and opponent field to the opposing team name as displayed in the table headers
2. WHEN parsing a team's box score table, THE Scraper SHALL extract each player row containing: player name, minutes played, field goals made, field goals attempted, field goal percentage, three-pointers made, three-pointers attempted, three-point percentage, free throws made, free throws attempted, free throw percentage, offensive rebounds, defensive rebounds, total rebounds, assists, steals, blocks, turnovers, personal fouls, points, plus/minus, and game score
3. WHEN a stat cell in a player row contains an empty value, a dash character, or non-numeric text, THE Scraper SHALL store null for that field in the Player_Stat_Record
4. WHEN a player appears in the first five rows of a team's box score table (before the "Reserves" separator), THE Scraper SHALL mark that player as a starter by setting is_starter to true
5. WHEN a player row contains "Did Not Play" or "Did Not Dress" or "Not With Team" in the minutes column, THE Scraper SHALL skip that player row and not create a Player_Stat_Record
6. WHEN creating Player_Stat_Records for a Box_Score_Page, THE Scraper SHALL associate each record with the corresponding nba_games row by matching on the game_url field
7. IF Player_Stat_Records already exist for a given game_id, THEN THE Scraper SHALL skip that game and not insert duplicate records
8. IF a Box_Score_Page returns an HTTP error, is unreachable, or does not respond within 30 seconds, THEN THE Scraper SHALL log the error with the game_url and continue processing remaining box scores

### Requirement 5: Player Statistics Persistence

**User Story:** As a data operator, I want scraped player statistics to be stored in the nba_player_stats table, so that player performance data powers the props section.

#### Acceptance Criteria

1. WHEN box score data is parsed from a Box_Score_Page, THE Scraper SHALL insert a Player_Stat_Record in the Supabase_Database nba_player_stats table for each player who has a non-empty minutes value in the box score (excluding players listed as "Did Not Play" or with no recorded minutes)
2. THE Scraper SHALL set the team field to the standard NBA 3-character uppercase team abbreviation (e.g., "LAL", "BOS") of the player's team and the opponent field to the opposing team's 3-character uppercase abbreviation
3. WHEN associating a Player_Stat_Record with a Game_Record, THE Scraper SHALL look up the nba_games row by matching the game_url field and set game_id to that row's UUID
4. IF no nba_games row exists for the given game_url when inserting player stats, THEN THE Scraper SHALL skip stat insertion for that game, log an error indicating the missing game record and game_url, and continue processing the next game
5. WHEN Player_Stat_Records already exist for a given game_id, THE Scraper SHALL delete all existing records for that game_id and re-insert fresh data within a single database transaction to prevent partial data states
6. IF a database write operation fails for a player stat batch (all players in one game), THEN THE Scraper SHALL log the error with the game_url and player_name and continue processing remaining games without terminating the scraping run
7. WHEN inserting a Player_Stat_Record, THE Scraper SHALL populate the following fields from the parsed box score: player_name, team, opponent, is_starter, minutes, fg, fga, fg_pct, tp, tpa, tp_pct, ft, fta, ft_pct, orb, drb, trb, ast, stl, blk, tov, pf, pts, plus_minus, and game_score

### Requirement 6: Rate Limiting and Polite Scraping

**User Story:** As a data operator, I want the scraper to respect basketball-reference.com's server resources, so that the scraper avoids being blocked and maintains reliable access.

#### Acceptance Criteria

1. THE Scraper SHALL introduce a configurable delay between consecutive HTTP requests to basketball-reference.com with a default of 3 seconds and an allowed range of 1 to 30 seconds
2. THE Scraper SHALL set a User-Agent header that includes the application name and version string on every HTTP request to basketball-reference.com
3. IF basketball-reference.com returns an HTTP 429 (Too Many Requests) response, THEN THE Scraper SHALL wait for the duration specified in the Retry-After header if present, otherwise wait for a configurable backoff period (default 60 seconds, allowed range 10 to 300 seconds) before retrying the request
4. IF basketball-reference.com returns an HTTP 5xx server error response, THEN THE Scraper SHALL wait for the configured backoff period before retrying the request, subject to the same maximum retry limit per URL
5. THE Scraper SHALL limit the maximum number of retry attempts per URL to 3 before recording a failure entry containing the URL, the last HTTP status code received, and the timestamp, then moving to the next URL
6. IF the configured delay value is outside the allowed range of 1 to 30 seconds, THEN THE Scraper SHALL reject the configuration and report an error indicating the valid range

### Requirement 7: Scraper Execution Modes

**User Story:** As a data operator, I want to run the scraper in different modes, so that I can perform full season imports or incremental daily updates efficiently.

#### Acceptance Criteria

1. WHEN invoked in "full" mode, THE Scraper SHALL scrape all Schedule_Pages for Season_Months and all Box_Score_Pages for completed games regardless of whether Player_Stat_Records already exist for those games
2. WHEN invoked in "schedule-only" mode, THE Scraper SHALL scrape only the Schedule_Pages for all Season_Months without fetching any Box_Score_Pages
3. WHEN invoked in "boxscores-only" mode, THE Scraper SHALL scrape only Box_Score_Pages for completed games that have zero associated Player_Stat_Records in the database
4. WHEN invoked in "daily" mode, THE Scraper SHALL scrape only the current month's Schedule_Page and Box_Score_Pages for games with a game_date within the last 2 calendar days (based on UTC date at invocation time)
5. THE Scraper SHALL accept execution mode as a required command-line argument with the value being one of "full", "schedule-only", "boxscores-only", or "daily"
6. IF the execution mode argument is missing or is not one of the supported values ("full", "schedule-only", "boxscores-only", "daily"), THEN THE Scraper SHALL exit immediately with a non-zero exit code and print an error message listing the valid mode options
7. IF no games match the filtering criteria for the selected mode (e.g., no completed games lacking stats in "boxscores-only" mode, or no games in the last 2 days in "daily" mode), THEN THE Scraper SHALL log that zero items matched the criteria and exit with a zero exit code

### Requirement 8: Logging and Observability

**User Story:** As a data operator, I want comprehensive logging from the scraper, so that I can monitor progress and diagnose failures.

#### Acceptance Criteria

1. THE Scraper SHALL log the start and end of each scraping run with a timestamp in ISO 8601 format (YYYY-MM-DDTHH:MM:SSZ) and the execution mode (one of "full", "schedule-only", "boxscores-only", or "daily")
2. WHEN a Schedule_Page is processed, THE Scraper SHALL log at INFO level the month name and the count of game rows parsed
3. WHEN a Box_Score_Page is processed, THE Scraper SHALL log at INFO level the game_url and the count of Player_Stat_Records created
4. WHEN a scraping run completes, THE Scraper SHALL log a summary at INFO level including: total games processed, total box scores scraped, total player stats inserted, and total errors encountered
5. THE Scraper SHALL write logs to both stdout and a rotating log file that rotates when the file reaches 10 MB, retaining a maximum of 5 rotated files
6. IF an HTTP request fails or a database write operation fails during processing, THEN THE Scraper SHALL log the failure at ERROR level including the URL or record identifier that caused the failure and the error description
7. THE Scraper SHALL use the following log levels: ERROR for failed operations, WARNING for retries and non-fatal issues, and INFO for progress and summary messages
