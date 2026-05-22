# Requirements Document

## Introduction

The Football Scraper is a Python-based data collection system that uses the Scrapling library to scrape fbref.com (Football Reference) for football/soccer match schedules, match reports with detailed player statistics, league standings, and historical player data. The scraped data is stored in a Supabase PostgreSQL database to power the BetRoom platform with real player performance data across the top 5 European leagues (Premier League, La Liga, Bundesliga, Serie A, Ligue 1) for the 2024-25 season.

## Glossary

- **Scraper**: The Python application that fetches and parses web pages from fbref.com using the Scrapling library
- **FBRef**: Football Reference (fbref.com), a comprehensive football statistics website providing match data, player stats, and league standings
- **Fixtures_Page**: An fbref.com page listing all matches and results for a league season (e.g., https://fbref.com/en/comps/9/schedule/Premier-League-Scores-and-Fixtures)
- **Match_Report_Page**: An fbref.com page containing detailed match statistics including player performance data (e.g., https://fbref.com/en/matches/{match_id}/...)
- **Standings_Page**: An fbref.com page showing the current league table with team rankings and statistics (e.g., https://fbref.com/en/comps/9/Premier-League-Stats)
- **Player_Page**: An fbref.com page containing historical career data for a single player (e.g., https://fbref.com/en/players/{player_id}/...)
- **Match_Record**: A row in the football_matches table representing a single football match with date, teams, scores, league, and status
- **Player_Stat_Record**: A row in the football_player_stats table representing one player's match statistics for a single game
- **Standings_Record**: A row in the football_standings table representing a team's current league position and season statistics
- **Player_Record**: A row in the football_players table representing a player's master record with FBRef ID and metadata
- **Top_Five_Leagues**: The five major European football leagues covered by the scraper: Premier League (comp_id=9), La Liga (comp_id=12), Bundesliga (comp_id=20), Serie A (comp_id=11), Ligue 1 (comp_id=13)
- **Competition_ID**: The numeric identifier FBRef assigns to each league, used in URL construction
- **Supabase_Database**: The PostgreSQL database hosted on Supabase where scraped data is persisted
- **Scrapling**: A Python web scraping library that supports CSS selectors, XPath, and multiple fetcher types with stealthy headers

## Requirements

### Requirement 1: Fixtures Page Scraping

**User Story:** As a data operator, I want to scrape league fixtures pages from fbref.com for each of the top 5 European leagues, so that I can collect all match records for the current season.

#### Acceptance Criteria

1. WHEN the Scraper is invoked for schedule collection, THE Scraper SHALL fetch the fixtures page for each league in Top_Five_Leagues (Premier League comp_id=9, La Liga comp_id=12, Bundesliga comp_id=20, Serie A comp_id=11, Ligue 1 comp_id=13) from fbref.com, waiting at least 3 seconds between consecutive HTTP requests to avoid rate limiting
2. WHEN a Fixtures_Page is fetched successfully, THE Scraper SHALL parse the fixtures table and extract the following fields for each match row: date, kickoff time, home team name, away team name, home score (null if not yet played), away score (null if not yet played), match report URL slug, round/matchweek, and venue
3. WHEN a match row contains a "Match Report" link, THE Scraper SHALL extract the match report URL slug from the href attribute and use it as the match_url identifier
4. IF a match row does not contain a "Match Report" link, THEN THE Scraper SHALL generate a match_url identifier by concatenating the match date in YYYY-MM-DD format, the home team name, and the away team name, each separated by a hyphen, with spaces in team names replaced by hyphens and all characters lowercased, and set the match status to "scheduled"
5. THE Scraper SHALL construct Fixtures_Page URLs using the pattern: `https://fbref.com/en/comps/{comp_id}/schedule/{League-Name}-Scores-and-Fixtures` where comp_id is the league's Competition_ID and League-Name is the hyphenated league name (Premier-League, La-Liga, Bundesliga, Serie-A, Ligue-1)
6. WHEN a match row has non-null home score and away score values, THE Scraper SHALL set the match status to "completed"; WHEN a match row has null scores for both teams, THE Scraper SHALL set the match status to "scheduled"; IF a match row has a score value for one team but null for the other, THEN THE Scraper SHALL set the match status to "scheduled" and set both score fields to null
7. IF a Fixtures_Page returns an HTTP error status code or the request fails to receive a response within 30 seconds, THEN THE Scraper SHALL log the error with the league name and HTTP status code (or timeout indication) and continue processing remaining leagues
8. IF a Fixtures_Page returns HTTP 429 (Too Many Requests), THEN THE Scraper SHALL wait 60 seconds before retrying the request for that league, up to a maximum of 3 retry attempts
9. THE Scraper SHALL use the Scrapling library Fetcher with stealthy_headers set to True for all HTTP requests to fbref.com
10. WHEN all leagues have been processed, THE Scraper SHALL return a list of match record dictionaries, where each dictionary contains the keys: date, kickoff_time, home_team, away_team, home_score, away_score, match_url, round, venue, league_name, comp_id, and status; IF a league's fixtures table contains zero match rows, THEN THE Scraper SHALL return an empty list for that league and log a warning indicating no fixtures were found

### Requirement 2: Match Record Persistence

**User Story:** As a data operator, I want scraped fixtures data to be stored in the football_matches table, so that match information is available for downstream features.

#### Acceptance Criteria

1. WHEN fixtures data is parsed from a Fixtures_Page, THE Scraper SHALL insert or update a Match_Record in the Supabase_Database football_matches table for each match row that contains at minimum a match_date, match_url, home_team, away_team, and league value
2. THE Scraper SHALL map the parsed match data to the football_matches schema: match_date (ISO 8601 date string) from the Date column, match_url (string) from the match report URL slug, home_team (string) from the Home column, away_team (string) from the Away column, home_score (integer or null) from home goals, away_score (integer or null) from away goals, league (string) from the league name, comp_id (integer) from the Competition_ID, season as "2024-25", round (string or null) from the matchweek/round column, and venue (string or null) from the Venue column
3. WHEN a match row has both home and away score values populated as non-negative integers, THE Scraper SHALL set the Match_Record status to "completed"
4. WHEN a match row has no score values populated for either team, THE Scraper SHALL set the Match_Record status to "scheduled" and SHALL store home_score and away_score as null
5. WHEN a match row has only one score value populated (home or away but not both), THE Scraper SHALL set the Match_Record status to "scheduled" and SHALL store both home_score and away_score as null, discarding the partial score value
6. WHEN a Match_Record with the same match_url already exists in the database, THE Scraper SHALL update the existing record's home_score, away_score, status, round, and venue fields with the latest scraped data rather than creating a duplicate; IF a field in the newly scraped data is null but the existing record has a non-null value for that field, THEN THE Scraper SHALL preserve the existing non-null value
7. IF a parsed match row is missing any of the required fields (match_date, match_url, home_team, away_team, or league), THEN THE Scraper SHALL skip that row, log a warning including the available identifying information (any non-null fields from match_date, home_team, away_team), and continue processing remaining matches
8. IF a database write operation fails for a single match record, THEN THE Scraper SHALL log the error with the match_url and the error description, and continue processing remaining matches without rolling back previously successful writes

### Requirement 3: Match Report Link Discovery

**User Story:** As a data operator, I want to identify which matches have match reports available, so that I can scrape detailed player statistics only for completed matches.

#### Acceptance Criteria

1. WHEN the Scraper is invoked for box score collection, THE Scraper SHALL query the Supabase_Database for all Match_Records with status "completed" and return at most 500 Match_Records per invocation, ordered by match_date ascending
2. WHEN constructing Match_Report_Page URLs, THE Scraper SHALL use the match_url value directly as the full relative path, prepending the base URL: `https://fbref.com{match_url}`
3. WHEN a date range filter is provided with both a start_date and end_date in ISO 8601 format (YYYY-MM-DD), THE Scraper SHALL limit match report collection to Match_Records whose match_date falls within the inclusive range [start_date, end_date]
4. IF a date range filter is provided and start_date is after end_date, THEN THE Scraper SHALL reject the invocation with a validation error indicating the start_date must be on or before end_date
5. WHEN the unscraped-only filter is enabled, THE Scraper SHALL return only Match_Records that have zero associated Player_Stat_Records in the database (determined by the absence of any football_player_stats row referencing the Match_Record's id)
6. IF the Supabase_Database query fails or times out after 30 seconds, THEN THE Scraper SHALL terminate the box score collection invocation with an error indicating the database is unreachable and SHALL NOT attempt to scrape any Match_Report_Pages
7. IF no Match_Records match the query criteria, THEN THE Scraper SHALL return an empty collection and log that zero matches were found for the given filters
8. WHEN a league filter is provided with one or more league names from the Top_Five_Leagues set (Premier League, La Liga, Bundesliga, Serie A, Ligue 1), THE Scraper SHALL limit match report collection to Match_Records whose league field matches one of the specified values, applying all active filters (date range, league, unscraped-only) as a logical AND combination
9. IF a league filter contains a value that is not one of the Top_Five_Leagues names (Premier League, La Liga, Bundesliga, Serie A, Ligue 1), THEN THE Scraper SHALL reject the invocation with a validation error indicating the invalid league name and listing the allowed values
10. IF a date range filter is provided with only a start_date (end_date omitted), THEN THE Scraper SHALL return Match_Records with match_date on or after start_date; IF only an end_date is provided (start_date omitted), THEN THE Scraper SHALL return Match_Records with match_date on or before end_date

### Requirement 4: Match Report Data Scraping

**User Story:** As a data operator, I want to scrape detailed player statistics from match report pages, so that player performance data is available for the props feature.

#### Acceptance Criteria

1. WHEN a Match_Report_Page is fetched successfully (HTTP 200 with a parseable HTML response containing at least one player stats table), THE Scraper SHALL parse the player stats tables for both the home team and the away team, setting each Player_Stat_Record's team field to the player's team name and opponent field to the opposing team name
2. WHEN parsing a team's player stats table, THE Scraper SHALL extract each player row containing: player name, player FBRef ID (from the player link href), position, minutes played, goals, assists, shots, shots on target, passes completed, passes attempted, pass completion percentage, key passes, through balls, tackles, interceptions, blocks, clearances, aerials won, fouls committed, fouls drawn, yellow cards, red cards, expected goals (xG), expected assisted goals (xAG), progressive carries, and progressive passes
3. WHEN a stat cell in a player row contains an empty value, a dash character, or non-numeric text (excluding the player name, position, and player link fields), THE Scraper SHALL store null for that field in the Player_Stat_Record
4. WHEN a player appears in the starting lineup section of a team's player stats table (rows before the first separator or substitutes header row), THE Scraper SHALL mark that player as a starter by setting is_starter to true; WHEN a player appears after the substitutes separator, THE Scraper SHALL set is_starter to false
5. WHEN a player row indicates the player did not participate in the match (minutes value is zero, empty, or the player is absent from the stats table), THE Scraper SHALL skip that player row and not create a Player_Stat_Record
6. WHEN creating Player_Stat_Records for a Match_Report_Page, THE Scraper SHALL associate each record with the corresponding football_matches row by matching on the match_url field
7. IF Player_Stat_Records already exist for a given match_id, THEN THE Scraper SHALL delete all existing records for that match_id and re-insert fresh data to ensure data consistency
8. IF a Match_Report_Page returns an HTTP error, is unreachable, or does not respond within 30 seconds, THEN THE Scraper SHALL log the error with the match_url and continue processing remaining match reports
9. WHEN parsing player links from the match report, THE Scraper SHALL extract the FBRef player_id from the href pattern `/en/players/{player_id}/...` and store it in the Player_Stat_Record
10. WHEN storing decimal stat values (xG, xAG, pass completion percentage), THE Scraper SHALL preserve up to 2 decimal places of precision as provided by the source page
11. IF a Match_Report_Page returns HTTP 200 but does not contain any recognizable player stats tables, THEN THE Scraper SHALL log a warning with the match_url indicating the page structure was not parseable and skip to the next match report
12. WHEN the minutes field contains added-time notation (e.g., "45+2"), THE Scraper SHALL parse and store only the base integer value of minutes played (e.g., store 45 for "45+2")

### Requirement 5: Player Statistics Persistence

**User Story:** As a data operator, I want scraped player statistics to be stored in the football_player_stats table, so that player performance data powers the props section.

#### Acceptance Criteria

1. WHEN match report data is parsed from a Match_Report_Page, THE Scraper SHALL insert a Player_Stat_Record in the Supabase_Database football_player_stats table for each player who has a non-zero minutes value in the match report (excluding players with zero minutes or not listed in the stats table)
2. THE Scraper SHALL store the team field as the full team name as displayed on FBRef (maximum 100 characters) and the opponent field as the opposing team's full name (maximum 100 characters)
3. WHEN associating a Player_Stat_Record with a Match_Record, THE Scraper SHALL look up the football_matches row by matching the match_url field and set match_id to that row's UUID
4. IF no football_matches row exists for the given match_url when inserting player stats, THEN THE Scraper SHALL skip stat insertion for that match, log an error at ERROR level indicating the missing match record and match_url, and continue processing the next match
5. WHEN Player_Stat_Records already exist for a given match_id, THE Scraper SHALL delete all existing records for that match_id and re-insert fresh data within a single database transaction; IF the transaction fails, THEN THE Scraper SHALL roll back the entire transaction so that the previously existing records are preserved unchanged
6. IF a database write operation fails for a player stat batch (all players in one match), THEN THE Scraper SHALL log the error at ERROR level with the match_url and the error description, and continue processing remaining matches without terminating the scraping run
7. WHEN inserting a Player_Stat_Record, THE Scraper SHALL populate the following fields from the parsed match report: player_name, player_fbref_id, team, opponent, match_date (copied from the associated Match_Record's match_date), position, is_starter, minutes, goals, assists, shots, shots_on_target, passes_completed, passes_attempted, pass_completion_pct, key_passes, through_balls, tackles, interceptions, blocks, clearances, aerials_won, fouls_committed, fouls_drawn, yellow_cards, red_cards, xg, xag, progressive_carries, and progressive_passes
8. WHEN a stat field value is empty, contains a dash character, or contains non-numeric text in the parsed match report, THE Scraper SHALL store null for that field in the Player_Stat_Record

### Requirement 6: League Standings Scraping

**User Story:** As a data operator, I want to scrape current league standings from fbref.com for each of the top 5 leagues, so that team rankings and form data are available for analysis.

#### Acceptance Criteria

1. WHEN the Scraper is invoked for standings collection, THE Scraper SHALL fetch the standings page for each league in Top_Five_Leagues (Premier League comp_id=9, La Liga comp_id=12, Bundesliga comp_id=20, Serie A comp_id=11, Ligue 1 comp_id=13) from fbref.com, waiting at least 3 seconds between consecutive HTTP requests
2. THE Scraper SHALL construct Standings_Page URLs using the pattern: `https://fbref.com/en/comps/{comp_id}/{League-Name}-Stats` where comp_id is the league's Competition_ID and League-Name is the hyphenated league name
3. WHEN a Standings_Page is fetched successfully (HTTP 200 with a parseable HTML response containing a league table), THE Scraper SHALL parse the league table and extract for each team row: team name, matches played, wins, draws, losses, goals for, goals against, goal difference, points, position/rank, expected goals (xG), expected goals against (xGA), and last 5 match results stored as a string of single-character codes (W for win, D for draw, L for loss) in chronological order (e.g., "WDWLW")
4. WHEN standings data is parsed, THE Scraper SHALL insert or update a Standings_Record in the Supabase_Database football_standings table for each team, using the combination of team name, league, and season as the unique conflict key, updating all fields with the latest scraped data rather than creating a duplicate
5. THE Scraper SHALL store the league name, Competition_ID, and season ("2024-25") with each Standings_Record
6. IF a Standings_Page returns an HTTP error status code or the request fails to receive a response within 30 seconds, THEN THE Scraper SHALL log the error with the league name and HTTP status code (or timeout indication) and continue processing remaining leagues
7. IF a Standings_Page returns HTTP 429 (Too Many Requests), THEN THE Scraper SHALL wait 60 seconds before retrying the request, up to a maximum of 3 retry attempts
8. WHEN a stat cell in a team row contains an empty value, a dash character, or non-numeric text for a numeric field (xG, xGA, goal difference), THE Scraper SHALL store null for that field in the Standings_Record
9. IF a database write operation fails when inserting or updating a Standings_Record, THEN THE Scraper SHALL log the error with the team name and league name and continue processing remaining teams without terminating the standings collection run
10. IF a Standings_Page response contains no parseable league table (missing expected table structure), THEN THE Scraper SHALL log a warning with the league name and skip that league, continuing to process remaining leagues

### Requirement 7: Player Master Record Management

**User Story:** As a data operator, I want to maintain a master list of players with their FBRef IDs, so that player data can be linked across matches and historical records can be retrieved.

#### Acceptance Criteria

1. WHEN a new player_fbref_id is encountered during match report parsing that does not exist in the football_players table, THE Scraper SHALL insert a new Player_Record with the player_name, player_fbref_id, and the current_team set to the team name from the current match
2. WHEN a Player_Record with the same player_fbref_id already exists in the database, THE Scraper SHALL update the player_name, current_team, position, and nationality fields if the newly parsed values differ from the stored values, leaving any field unchanged when the newly parsed value is null
3. THE Scraper SHALL construct Player_Page URLs using the pattern: `https://fbref.com/en/players/{player_fbref_id}/` for historical data retrieval
4. THE Scraper SHALL store the following fields in each Player_Record: player_fbref_id (unique identifier from FBRef, maximum 50 characters), player_name (maximum 200 characters), current_team (maximum 100 characters), position (maximum 50 characters, null when not present in match report data), and nationality (maximum 100 characters, null when not present in match report data)
5. THE Scraper SHALL use player_fbref_id as the unique key for the football_players table, ensuring no two Player_Records share the same player_fbref_id value
6. IF a player_fbref_id extracted from a match report is empty or contains only whitespace, THEN THE Scraper SHALL skip that player's record insertion, log a warning with the player_name and match_url, and continue processing remaining players
7. IF a database write operation fails when inserting or updating a Player_Record, THEN THE Scraper SHALL log the error at ERROR level with the player_fbref_id and player_name and continue processing remaining players without terminating the run

### Requirement 8: Rate Limiting and Polite Scraping

**User Story:** As a data operator, I want the scraper to respect fbref.com's server resources, so that the scraper avoids being blocked and maintains reliable access.

#### Acceptance Criteria

1. THE Scraper SHALL introduce a configurable delay between consecutive HTTP requests to fbref.com with a default of 3 seconds and an allowed range of 1 to 30 seconds
2. THE Scraper SHALL use the Scrapling library Fetcher with stealthy_headers set to True on every HTTP request to fbref.com to present realistic browser-like request headers
3. IF fbref.com returns an HTTP 429 (Too Many Requests) response, THEN THE Scraper SHALL wait for the duration specified in the Retry-After header (capped at a maximum of 300 seconds regardless of the header value) if present, otherwise wait for the configured backoff period (default 60 seconds, allowed range 10 to 300 seconds) before retrying the request
4. IF fbref.com returns an HTTP 5xx server error response, THEN THE Scraper SHALL wait for the configured backoff period before retrying the request, subject to the same maximum retry limit per URL
5. IF a request to fbref.com fails due to a network error (connection timeout, connection refused, or DNS resolution failure), THEN THE Scraper SHALL treat it as a retryable failure, wait for the configured backoff period, and retry subject to the same maximum retry limit per URL
6. THE Scraper SHALL limit the maximum number of retry attempts per URL to 3 before recording a failure entry to the scraper's log output containing the URL, the last HTTP status code or error type received, and the ISO 8601 timestamp, then moving to the next URL
7. IF the configured delay value is outside the allowed range of 1 to 30 seconds or the configured backoff period is outside the allowed range of 10 to 300 seconds, THEN THE Scraper SHALL reject the configuration and report an error indicating the parameter name and its valid range

### Requirement 9: Scraper Execution Modes

**User Story:** As a data operator, I want to run the scraper in different modes, so that I can perform full season imports or incremental daily updates efficiently.

#### Acceptance Criteria

1. WHEN invoked in "full" mode, THE Scraper SHALL first scrape all Fixtures_Pages for Top_Five_Leagues, then scrape all Match_Report_Pages for completed matches (with no upper limit on the number of match reports processed), and finally scrape all Standings_Pages, regardless of whether data already exists in the database
2. WHEN invoked in "schedule-only" mode, THE Scraper SHALL scrape only the Fixtures_Pages for all Top_Five_Leagues without fetching any Match_Report_Pages or Standings_Pages
3. WHEN invoked in "boxscores-only" mode, THE Scraper SHALL scrape only Match_Report_Pages for completed matches that have zero associated Player_Stat_Records in the database, processing at most 500 match reports per invocation ordered by match_date ascending
4. WHEN invoked in "daily" mode, THE Scraper SHALL first scrape all Fixtures_Pages for Top_Five_Leagues, then scrape Match_Report_Pages for completed matches whose match_date falls on the current UTC date or the preceding UTC date (a 2-day inclusive window), and finally scrape all Standings_Pages
5. WHEN invoked in "standings-only" mode, THE Scraper SHALL scrape only the Standings_Pages for all Top_Five_Leagues without fetching any Fixtures_Pages or Match_Report_Pages
6. THE Scraper SHALL accept execution mode as a required positional command-line argument with the value being one of "full", "schedule-only", "boxscores-only", "daily", or "standings-only"
7. IF the execution mode argument is missing or is not one of the five supported values, THEN THE Scraper SHALL exit immediately with a non-zero exit code and print an error message to stderr listing the valid mode options
8. IF no pages match the filtering criteria for the selected mode (zero fixtures rows found, zero match reports to process, or zero standings rows found), THEN THE Scraper SHALL log that zero items matched the criteria and exit with a zero exit code
9. WHEN invoked in "full" or "daily" mode, THE Scraper SHALL complete Fixtures_Page scraping and persist all Match_Records before beginning Match_Report_Page scraping, to ensure match report lookups can resolve the corresponding match_id

### Requirement 10: Logging and Observability

**User Story:** As a data operator, I want comprehensive logging from the scraper, so that I can monitor progress and diagnose failures.

#### Acceptance Criteria

1. THE Scraper SHALL log the start and end of each scraping run at INFO level with a timestamp in ISO 8601 format (YYYY-MM-DDTHH:MM:SSZ) and the execution mode
2. WHEN a Fixtures_Page is processed, THE Scraper SHALL log at INFO level the league name and the count of match rows parsed
3. WHEN a Match_Report_Page is processed, THE Scraper SHALL log at INFO level the match_url and the count of Player_Stat_Records created
4. WHEN a Standings_Page is processed, THE Scraper SHALL log at INFO level the league name and the count of team rows parsed
5. WHEN a scraping run completes, THE Scraper SHALL log a summary at INFO level including: total matches processed, total match reports scraped, total player stats inserted, total standings updated, and total errors encountered
6. THE Scraper SHALL write logs to both stdout and a rotating log file located in the `scripts/logs/` directory that rotates when the file reaches 10 MB, retaining a maximum of 5 rotated files
7. IF an HTTP request fails or a database write operation fails during processing, THEN THE Scraper SHALL log the failure at ERROR level including the URL or record identifier that caused the failure and the error description
8. THE Scraper SHALL use the following log levels: ERROR for failed operations, WARNING for retries and non-fatal issues, and INFO for progress and summary messages
9. THE Scraper SHALL format each log entry with the following fields in order: ISO 8601 timestamp, log level, and message text
10. IF the `scripts/logs/` directory does not exist when the Scraper starts, THEN THE Scraper SHALL create the directory before writing log files
