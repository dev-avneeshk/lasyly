# Requirements Document

## Introduction

The Tennis Scraper is a Python-based data collection system that uses the Scrapling library to scrape tennisabstract.com for professional tennis tournament match data and player performance statistics. The system tracks matches through their lifecycle (upcoming → completed) using a delta-based approach, and collects detailed serve, return, and raw statistics per player, surface, and year. All scraped data is stored in a Supabase PostgreSQL database.

## Glossary

- **Scraper**: The Python application that fetches and parses web pages from tennisabstract.com using the Scrapling library's Fetcher.get() method
- **Tournament_Page**: A tennisabstract.com page containing match data for a specific tournament (e.g., https://www.tennisabstract.com/current/2026ATPRome.html)
- **Player_Profile_Page**: A tennisabstract.com page containing career and seasonal statistics for a single player (e.g., https://www.tennisabstract.com/cgi-bin/player-classic.cgi?p=AlexMichelsen)
- **Match_Record**: A row in the tennis_matches table representing a single match with tournament, round, players, status, winner, score, and timestamps
- **Player_Record**: A row in the tennis_players table representing a player's name and profile URL
- **Serve_Stats_Record**: A row in the tennis_serve_stats table containing serve statistics for a player on a specific surface and year
- **Raw_Stats_Record**: A row in the tennis_raw_stats table containing win/loss and games data for a player on a specific surface and year
- **Return_Stats_Record**: A row in the tennis_return_stats table containing return statistics for a player on a specific surface and year
- **Upcoming_Match**: A match extracted from the upcomingSingles JavaScript variable that has not yet been played
- **Completed_Match**: A match extracted from the completedSingles JavaScript variable that has a winner and score
- **Delta_Detection**: The process of identifying matches that transitioned from upcoming to completed between scraping runs
- **Surface**: One of Hard, Clay, or Grass court types used to categorize player statistics
- **Stat_Year**: A calendar year (e.g., 2023, 2024, 2025) or "Career" used to categorize player statistics
- **Round_Code**: A tournament round identifier (R1, R2, R3, R4, QF, SF, F)
- **Supabase_Database**: The PostgreSQL database hosted on Supabase where scraped data is persisted
- **JS_Variable**: An inline JavaScript variable embedded in the Tournament_Page's script tags containing match data as HTML strings

## Requirements

### Requirement 1: Tournament Page Fetching and JS Variable Extraction

**User Story:** As a data operator, I want to fetch tournament pages and extract the embedded JavaScript variables, so that I can access match data for parsing.

#### Acceptance Criteria

1. WHEN the Scraper is invoked with a tournament URL following the pattern `https://www.tennisabstract.com/current/{year}{tour}{city}.html`, THE Scraper SHALL fetch the page using Scrapling's Fetcher.get() method
2. WHEN a Tournament_Page is fetched successfully (HTTP 200), THE Scraper SHALL extract the values of the following JS_Variables from inline script tags in the HTML head: `upcomingSingles`, `completedSingles`, `upcomingDoubles`, and `completedDoubles`
3. THE Scraper SHALL extract JS_Variable values using regex pattern matching against script tag content, capturing the string value assigned to each variable name
4. WHEN a JS_Variable is not present on the Tournament_Page or its value is an empty string, THE Scraper SHALL treat that variable as containing zero match entries
5. IF the Tournament_Page returns an HTTP error status code or fails to respond within 30 seconds, THEN THE Scraper SHALL log the error with the tournament URL and HTTP status code (or timeout indication) and terminate the tournament scraping operation for that URL
6. IF the Tournament_Page HTML does not contain any recognizable script tags with JS_Variables, THEN THE Scraper SHALL log a warning indicating no match data was found and terminate the tournament scraping operation for that URL

### Requirement 2: Match Data Parsing

**User Story:** As a data operator, I want to parse upcoming and completed match entries from the extracted JS variables, so that I can create structured match records.

#### Acceptance Criteria

1. WHEN parsing the `completedSingles` JS_Variable value, THE Scraper SHALL split the HTML string on `<br>` delimiters and parse each non-empty line using the format: `"{Round_Code}: {Winner_Name} ({Country}) d. {Loser_Name} ({Country}) {Score}"`
2. WHEN parsing the `upcomingSingles` JS_Variable value, THE Scraper SHALL split the HTML string on `<br>` delimiters and parse each non-empty line using the format: `"{Round_Code}: {Player1_Name} ({Country}) vs {Player2_Name} ({Country}) [{H2H_Record}]"` where the H2H_Record in brackets is optional
3. WHEN parsing a completed match line, THE Scraper SHALL extract the Round_Code, winner name, winner country, loser name, loser country, and the full score string (e.g., "6-3 7-5" or "6-4 3-6 7-6(4)")
4. WHEN parsing an upcoming match line, THE Scraper SHALL extract the Round_Code, player 1 name, player 1 country, player 2 name, player 2 country, and the H2H record string if present
5. IF a match line does not conform to the expected format for either completed or upcoming patterns, THEN THE Scraper SHALL log a warning with the raw line content and skip that entry without terminating the parsing of remaining lines
6. WHEN parsing player names from match lines, THE Scraper SHALL preserve the full name as displayed on the page including any diacritical marks or special characters

### Requirement 3: Match Record Persistence

**User Story:** As a data operator, I want parsed match data stored in the database, so that match information is available for tracking and analysis.

#### Acceptance Criteria

1. WHEN upcoming match data is parsed from the `upcomingSingles` variable, THE Scraper SHALL insert a Match_Record in the Supabase_Database tennis_matches table with status set to "upcoming", player1_name and player2_name populated, winner_name and score set to null, and the tournament name and Round_Code populated
2. WHEN completed match data is parsed from the `completedSingles` variable, THE Scraper SHALL insert a Match_Record with status set to "completed", player1_name set to the winner name, player2_name set to the loser name, winner_name set to the winner name, and score set to the full score string
3. WHEN a Match_Record with the same tournament, round, and both player names (in any order) already exists in the database, THE Scraper SHALL update the existing record rather than creating a duplicate
4. WHEN updating an existing Match_Record from "upcoming" to "completed" status, THE Scraper SHALL set the winner_name, score, and completed_at timestamp fields
5. THE Scraper SHALL store the tournament identifier (extracted from the URL filename without the .html extension) in each Match_Record
6. IF a database write operation fails for a match record, THEN THE Scraper SHALL log the error with the tournament, round, and player names, and continue processing remaining matches
7. THE Scraper SHALL populate the scraped_at timestamp on every Match_Record insert or update with the current UTC time

### Requirement 4: Delta Detection for Match Status Changes

**User Story:** As a data operator, I want to detect matches that transitioned from upcoming to completed between scraping runs, so that I can track match results as they happen.

#### Acceptance Criteria

1. WHEN the Scraper processes a Tournament_Page, THE Scraper SHALL compare the current completed matches against Match_Records in the database that have status "upcoming" for the same tournament
2. WHEN a match currently in the `completedSingles` data matches an existing Match_Record with status "upcoming" (matched by tournament, round, and both player names in any order), THE Scraper SHALL update that Match_Record's status to "completed" and populate the winner_name, score, and completed_at fields
3. WHEN Delta_Detection identifies newly completed matches, THE Scraper SHALL log at INFO level the count of matches that transitioned from upcoming to completed in this scraping run
4. THE Scraper SHALL use player name matching that is case-insensitive when comparing match participants between the upcoming and completed data sets
5. IF a match appears in the completed data but has no corresponding upcoming Match_Record in the database, THEN THE Scraper SHALL insert it as a new completed Match_Record (handling cases where the match was never captured as upcoming)

### Requirement 5: Player Record Management

**User Story:** As a data operator, I want to maintain a master list of players with their profile URLs, so that I can scrape individual player statistics.

#### Acceptance Criteria

1. WHEN a player name appears in any parsed match data (upcoming or completed), THE Scraper SHALL ensure a Player_Record exists in the tennis_players table for that player
2. THE Scraper SHALL construct the Player_Profile_Page URL for each player by converting the player name to CamelCase format (removing spaces, capitalizing each word) and appending it to the base URL: `https://www.tennisabstract.com/cgi-bin/player-classic.cgi?p={CamelCaseName}`
3. WHEN a Player_Record with the same player name already exists in the database, THE Scraper SHALL not create a duplicate record
4. IF a player name contains special characters, hyphens, or diacritical marks, THEN THE Scraper SHALL remove those characters when constructing the CamelCase profile URL while preserving them in the stored player_name field
5. THE Scraper SHALL store both the player's display name (as it appears on the tournament page) and the constructed profile URL in the Player_Record

### Requirement 6: Player Profile Page Scraping

**User Story:** As a data operator, I want to scrape player profile pages for detailed statistics, so that serve, return, and raw performance data is available per surface and year.

#### Acceptance Criteria

1. WHEN the Scraper is invoked for player statistics collection, THE Scraper SHALL fetch the Player_Profile_Page for each Player_Record in the tournament's player list using Scrapling's Fetcher.get() method
2. WHEN a Player_Profile_Page is fetched successfully, THE Scraper SHALL parse the statistics tables and extract data broken down by Surface (Hard, Clay, Grass) and Stat_Year (individual years and Career)
3. WHEN parsing serve statistics, THE Scraper SHALL extract: first serve percentage, first serve win percentage, second serve win percentage, aces per match, double faults per match, and hold percentage
4. WHEN parsing raw statistics, THE Scraper SHALL extract: matches played, matches won, sets won, sets lost, games won, and games lost
5. WHEN parsing return statistics, THE Scraper SHALL extract: return points won off first serve percentage, return points won off second serve percentage, break point conversion percentage, and break percentage
6. IF a Player_Profile_Page returns an HTTP error or fails to respond within 30 seconds, THEN THE Scraper SHALL log the error with the player name and profile URL and continue processing remaining players
7. IF a statistics table or specific stat value is missing from the Player_Profile_Page, THEN THE Scraper SHALL store null for that field and continue parsing remaining available statistics
8. THE Scraper SHALL wait at least 3 seconds between consecutive Player_Profile_Page requests to avoid rate limiting

### Requirement 7: Player Statistics Persistence

**User Story:** As a data operator, I want player statistics stored in the database with upsert semantics, so that stats are always current without duplication.

#### Acceptance Criteria

1. WHEN serve statistics are parsed from a Player_Profile_Page, THE Scraper SHALL upsert a Serve_Stats_Record in the tennis_serve_stats table keyed by player_name, surface, and stat_year
2. WHEN raw statistics are parsed from a Player_Profile_Page, THE Scraper SHALL upsert a Raw_Stats_Record in the tennis_raw_stats table keyed by player_name, surface, and stat_year
3. WHEN return statistics are parsed from a Player_Profile_Page, THE Scraper SHALL upsert a Return_Stats_Record in the tennis_return_stats table keyed by player_name, surface, and stat_year
4. WHEN upserting a statistics record, THE Scraper SHALL update all stat fields with the latest scraped values and set the updated_at timestamp to the current UTC time
5. THE Scraper SHALL process statistics for all available Surface and Stat_Year combinations found on the Player_Profile_Page
6. IF a database write operation fails for a player's statistics, THEN THE Scraper SHALL log the error with the player name, surface, and stat_year, and continue processing remaining statistics records

### Requirement 8: Daily Workflow Orchestration

**User Story:** As a data operator, I want a daily workflow that scrapes the tournament page, detects match changes, and updates player stats, so that the database stays current with minimal manual intervention.

#### Acceptance Criteria

1. WHEN invoked in "daily" mode, THE Scraper SHALL execute the following steps in order: (1) fetch and parse the Tournament_Page, (2) perform Delta_Detection to update match statuses, (3) scrape Player_Profile_Pages for all players in the tournament, (4) update player statistics records, (5) log a run summary
2. WHEN the daily workflow completes, THE Scraper SHALL log a summary at INFO level including: total matches processed, matches newly completed (delta count), total players scraped, total stat records upserted, and total errors encountered
3. WHEN invoked in "matches-only" mode, THE Scraper SHALL execute only steps 1 and 2 (tournament page scraping and delta detection) without scraping player profiles
4. WHEN invoked in "stats-only" mode, THE Scraper SHALL scrape Player_Profile_Pages for all players that have at least one Match_Record in the specified tournament and update their statistics records
5. THE Scraper SHALL accept execution mode as a required command-line argument with the value being one of "daily", "matches-only", or "stats-only"
6. THE Scraper SHALL accept the tournament URL as a required command-line argument
7. IF the execution mode argument is missing or is not one of the supported values ("daily", "matches-only", "stats-only"), THEN THE Scraper SHALL exit immediately with a non-zero exit code and print an error message listing the valid mode options

### Requirement 9: Rate Limiting and Error Handling

**User Story:** As a data operator, I want the scraper to handle errors gracefully and respect server resources, so that scraping remains reliable and the source site is not overloaded.

#### Acceptance Criteria

1. THE Scraper SHALL introduce a configurable delay between consecutive HTTP requests to tennisabstract.com with a default of 3 seconds and an allowed range of 1 to 30 seconds
2. IF tennisabstract.com returns an HTTP 429 (Too Many Requests) response, THEN THE Scraper SHALL wait 60 seconds before retrying the request, up to a maximum of 3 retry attempts per URL
3. IF tennisabstract.com returns an HTTP 5xx server error response, THEN THE Scraper SHALL wait for the configured backoff period (default 60 seconds) before retrying the request, up to a maximum of 3 retry attempts per URL
4. IF the maximum retry attempts are exhausted for a URL, THEN THE Scraper SHALL log the failure at ERROR level with the URL, last HTTP status code, and retry count, then continue processing remaining URLs
5. IF the configured delay value is outside the allowed range of 1 to 30 seconds, THEN THE Scraper SHALL reject the configuration and exit with a non-zero exit code indicating the valid range
6. THE Scraper SHALL set a User-Agent header identifying the application on every HTTP request to tennisabstract.com

### Requirement 10: Configuration and Environment

**User Story:** As a data operator, I want the scraper to load configuration from environment variables, so that credentials and settings are not hardcoded.

#### Acceptance Criteria

1. THE Scraper SHALL load the Supabase connection URL and API key from environment variables defined in a `.env.local` file using the python-dotenv library
2. THE Scraper SHALL require the following environment variables to be set: `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
3. IF any required environment variable is missing or empty, THEN THE Scraper SHALL exit immediately with a non-zero exit code and print an error message identifying the missing variable name
4. THE Scraper SHALL reside in the `scripts/` directory of the project repository
5. THE Scraper SHALL use the Supabase Python client library to interact with the Supabase_Database

### Requirement 11: Logging and Observability

**User Story:** As a data operator, I want comprehensive logging from the scraper, so that I can monitor progress and diagnose failures.

#### Acceptance Criteria

1. THE Scraper SHALL log the start and end of each scraping run with a timestamp in ISO 8601 format (YYYY-MM-DDTHH:MM:SSZ) and the execution mode
2. WHEN a Tournament_Page is processed, THE Scraper SHALL log at INFO level the tournament identifier, count of upcoming matches parsed, and count of completed matches parsed
3. WHEN a Player_Profile_Page is processed, THE Scraper SHALL log at INFO level the player name and count of stat records upserted
4. WHEN a scraping run completes, THE Scraper SHALL log a summary at INFO level including: total matches processed, delta matches detected, total players scraped, total stat records upserted, and total errors encountered
5. THE Scraper SHALL write logs to both stdout and a rotating log file located in the `scripts/logs/` directory that rotates when the file reaches 10 MB, retaining a maximum of 5 rotated files
6. IF an HTTP request fails or a database write operation fails, THEN THE Scraper SHALL log the failure at ERROR level including the URL or record identifier and the error description
7. THE Scraper SHALL use the following log levels: ERROR for failed operations, WARNING for retries and skipped entries, and INFO for progress and summary messages
