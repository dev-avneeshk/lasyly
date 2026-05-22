# Implementation Plan: Football Scraper

## Overview

Build a Python CLI scraper (`scripts/scrape_football.py`) that collects football match schedules, player statistics, and league standings from fbref.com for the top 5 European leagues (2024-25 season) and persists data to Supabase PostgreSQL. The implementation follows the single-file architecture pattern established by `scrape_nba.py`, using Scrapling for HTTP requests and supabase-py for database operations.

## Tasks

- [x] 1. Database migration and schema setup
  - [x] 1.1 Create SQL migration file for football tables
    - Create `supabase/migrations/20250601_create_football_tables.sql`
    - Define `football_matches` table with UUID PK, match_date, match_url (UNIQUE), home_team, away_team, scores, status CHECK constraint, league, comp_id, season, round, venue, kickoff_time, timestamps
    - Define `football_player_stats` table with UUID PK, match_id FK (CASCADE), all 30 stat columns, timestamps
    - Define `football_standings` table with UUID PK, team/league/season UNIQUE constraint, all standings columns, timestamps
    - Define `football_players` table with UUID PK, player_fbref_id (UNIQUE), player_name, current_team, position, nationality, timestamps
    - Create indexes: status, league, match_date on matches; match_id, player_fbref_id, match_date on player_stats; player_fbref_id, current_team on players
    - Add `updated_at` trigger function for auto-updating timestamps
    - _Requirements: 2.1, 2.2, 5.7, 6.4, 6.5, 7.4, 7.5_

- [x] 2. Configuration, constants, and project scaffolding
  - [x] 2.1 Create the scraper file with imports, constants, and ScraperConfig
    - Create `scripts/scrape_football.py`
    - Define LEAGUES dict with comp_id and url_name for all 5 leagues
    - Define VALID_LEAGUES, BASE_URL, SEASON constants
    - Define URL templates (FIXTURES_URL_TEMPLATE, STANDINGS_URL_TEMPLATE, MATCH_REPORT_URL_TEMPLATE, PLAYER_URL_TEMPLATE)
    - Implement `ScraperConfig` dataclass with all fields (request_delay, backoff_delay, max_retries, request_timeout, max_matches_per_run, season, log_dir, log_max_bytes, log_backup_count)
    - Implement `ScraperConfig.validate()` method enforcing request_delay in [1,30] and backoff_delay in [10,300]
    - _Requirements: 1.5, 6.2, 8.1, 8.7_

  - [x] 2.2 Implement data classes (MatchRecord, PlayerStatRecord, StandingsRecord, PlayerRecord)
    - Define all four dataclasses with proper type annotations and Optional fields
    - Ensure field names match the database schema exactly
    - _Requirements: 1.10, 2.2, 5.7, 6.3, 7.4_

- [x] 3. Logging setup and validation helpers
  - [x] 3.1 Implement logging setup function
    - Implement `setup_logging(config)` with dual output: stdout StreamHandler + RotatingFileHandler in `scripts/logs/`
    - Configure rotating file: 10 MB max, 5 backup files
    - Create `scripts/logs/` directory if it doesn't exist
    - Format: ISO 8601 timestamp, log level, message
    - _Requirements: 10.6, 10.8, 10.9, 10.10_

  - [x] 3.2 Implement validation helper functions
    - Implement `validate_match_record(record)` — checks required fields (match_date, match_url, home_team, away_team, league)
    - Implement `validate_date_range(start_date, end_date)` — raises ValueError if start > end
    - Implement `validate_leagues(leagues)` — raises ValueError for invalid league names
    - Implement `merge_match_records(existing, new)` — preserves existing non-null when new is null
    - Implement `merge_player_records(existing, new)` — updates only non-null differing fields
    - Implement `calculate_daily_window()` — returns (yesterday_utc, today_utc) tuple
    - _Requirements: 2.6, 2.7, 3.4, 3.9, 3.10, 7.2, 9.4_

- [x] 4. HTTP fetch helper with retry logic
  - [x] 4.1 Implement fetch_page and retry helpers
    - Implement `fetch_page(url, config, logger)` using `Fetcher.get(url, stealthy_headers=True, timeout=config.request_timeout)`
    - Implement retry logic: retry on HTTP 429, 5xx, and network errors up to config.max_retries
    - Implement `calculate_retry_wait(response, config)` — parse Retry-After header capped at 300s, fallback to config.backoff_delay
    - Log retries at WARNING level, final failures at ERROR level with URL and status/error type
    - Wait config.request_delay between consecutive requests
    - _Requirements: 1.1, 1.7, 1.8, 1.9, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

- [x] 5. Fixtures page scraping and parsing
  - [x] 5.1 Implement fixtures scraping functions
    - Implement `build_fixtures_url(comp_id, url_name)` using FIXTURES_URL_TEMPLATE
    - Implement `scrape_fixtures(config, logger)` — iterates all 5 leagues, fetches each fixtures page with delay
    - Implement `parse_fixtures_page(page, league_name, comp_id, logger)` — extracts match rows from fixtures table
    - Extract fields: date, kickoff_time, home_team, away_team, home_score, away_score, match_url, round, venue
    - Implement `determine_status(home_score, away_score)` — returns (status, score, score) tuple
    - Implement `generate_fallback_match_url(match_date, home_team, away_team)` — lowercase, hyphens, format: `{date}-{home}-{away}`
    - Log league name and match count at INFO level after each page
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10, 10.2_

- [x] 6. Match record persistence (FootballDatabase - matches)
  - [x] 6.1 Implement FootballDatabase class with match operations
    - Create `FootballDatabase` class with Supabase client initialization
    - Implement `upsert_matches(matches)` — upsert on match_url conflict, preserve existing non-null values when new is null
    - Implement `get_match_by_url(match_url)` — single match lookup
    - Implement `get_completed_matches(start_date, end_date, leagues, unscraped_only, limit)` — query with AND filters, ordered by match_date ASC
    - Implement `match_has_stats(match_id)` — check if player_stats exist for a match
    - Skip records failing validation, log warnings with identifying info
    - Log errors at ERROR level for failed DB writes, continue processing
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 3.1, 3.2, 3.3, 3.5, 3.6, 3.7, 3.8, 3.10_

- [x] 7. Match report scraping and player stats parsing
  - [x] 7.1 Implement match report scraping and parsing functions
    - Implement `scrape_boxscores(db, config, logger, start_date, end_date, leagues, unscraped_only)` — orchestrates match report collection
    - Implement `parse_match_report(page, home_team, away_team, logger)` — finds both team stat tables, returns list of PlayerStatRecord
    - Implement `parse_team_stats_table(table, team, opponent, logger)` — extracts player rows, identifies starters vs subs
    - Implement `parse_stat_value(cell_text, is_decimal)` — returns None for empty/dash/non-numeric, int or float otherwise
    - Implement `parse_minutes(minutes_text)` — handles "45+2" notation, returns base int, None for 0/empty
    - Implement `extract_player_fbref_id(href)` — extracts ID from `/en/players/{id}/...` pattern
    - Skip players with 0 or empty minutes
    - Log match_url and player stat count at INFO level
    - _Requirements: 3.1, 3.2, 3.3, 3.5, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.8, 4.9, 4.10, 4.11, 4.12, 10.3_

- [x] 8. Player stats and player master record persistence
  - [x] 8.1 Implement FootballDatabase player stats and player operations
    - Implement `insert_player_stats(match_id, stats)` — delete existing + insert new in a single transaction, rollback on failure
    - Implement `upsert_player(player)` — upsert on player_fbref_id conflict, update only non-null differing fields
    - Skip players with empty/whitespace player_fbref_id, log warning
    - Log errors at ERROR level for failed writes, continue processing
    - _Requirements: 4.7, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

- [x] 9. Standings scraping and persistence
  - [x] 9.1 Implement standings scraping, parsing, and persistence
    - Implement `build_standings_url(comp_id, url_name)` using STANDINGS_URL_TEMPLATE
    - Implement `scrape_standings(config, logger)` — iterates all 5 leagues with delay
    - Implement `parse_standings_page(page, league_name, comp_id, logger)` — extracts team rows from league table
    - Extract: team, position, MP, W, D, L, GF, GA, GD, Pts, xG, xGA, last_5
    - Implement `upsert_standings(standings)` in FootballDatabase — conflict on (team, league, season)
    - Handle null xG/xGA gracefully, log warnings for unparseable pages
    - Log league name and team count at INFO level
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 6.10, 10.4_

- [x] 10. Checkpoint - Ensure all core scraping logic works
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. CLI entry point with argparse and mode orchestration
  - [x] 11.1 Implement CLI argument parsing and main function
    - Implement `parse_args()` with positional mode argument (full, schedule-only, boxscores-only, daily, standings-only)
    - Add optional flags: --start-date, --end-date, --delay, --league
    - Exit with code 1 and stderr message for invalid/missing mode
    - Implement `main()` function orchestrating modes:
      - **full**: fixtures → persist → boxscores (all completed) → standings
      - **schedule-only**: fixtures only
      - **boxscores-only**: match reports (unscraped, max 500)
      - **daily**: fixtures → persist → boxscores (2-day window) → standings
      - **standings-only**: standings only
    - Log run start/end at INFO level with timestamp and mode
    - Log summary at INFO level: total matches, reports, stats, standings, errors
    - Wire `if __name__ == "__main__": sys.exit(main())`
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9, 10.1, 10.5_

- [x] 12. Checkpoint - Full integration verification
  - Ensure all tests pass, ask the user if questions arise.

- [x] 13. Test infrastructure and property-based tests
  - [x] 13.1 Set up test infrastructure
    - Create `scripts/tests/__init__.py`, `scripts/tests/conftest.py`
    - Define shared Hypothesis strategies in conftest.py: match_dates, team_names, stat_cells, minutes_strings, player_hrefs
    - Add test dependencies: pytest, hypothesis, pytest-mock
    - _Requirements: All (testing infrastructure)_

  - [ ]* 13.2 Write property tests for fixtures parsing (Properties 1, 2, 3, 4)
    - **Property 1: Fixtures parsing extracts all required fields**
    - **Property 2: Fallback match_url generation is deterministic and correctly formatted**
    - **Property 3: Status determination from scores**
    - **Property 4: Match record validation rejects incomplete records**
    - **Validates: Requirements 1.2, 1.3, 1.4, 1.6, 1.10, 2.3, 2.4, 2.5, 2.7**

  - [ ]* 13.3 Write property tests for match report parsing (Properties 8, 9, 10, 11, 12)
    - **Property 8: Stat value parsing handles all cell content types**
    - **Property 9: Starter detection based on table position**
    - **Property 10: Zero-minutes players are excluded**
    - **Property 11: Player FBRef ID extraction from href**
    - **Property 12: Minutes added-time parsing**
    - **Validates: Requirements 4.3, 4.4, 4.5, 4.9, 4.10, 4.12, 5.1, 5.8, 6.8**

  - [ ]* 13.4 Write property tests for validation and merge logic (Properties 5, 6, 7, 14, 15)
    - **Property 5: Match record merge preserves existing non-null values**
    - **Property 6: Date range filtering correctness**
    - **Property 7: League filter validation**
    - **Property 14: Player record merge preserves existing non-null values**
    - **Property 15: Configuration validation enforces ranges**
    - **Validates: Requirements 2.6, 3.3, 3.4, 3.9, 3.10, 7.2, 8.1, 8.7**

  - [ ]* 13.5 Write property tests for retry logic and daily mode (Properties 16, 17)
    - **Property 16: Retry-After header parsing with cap**
    - **Property 17: Daily mode date window calculation**
    - **Validates: Requirements 8.3, 9.4**

  - [ ]* 13.6 Write property test for standings parsing (Property 13)
    - **Property 13: Standings parsing extracts all fields with metadata**
    - **Validates: Requirements 6.3, 6.5**

  - [ ]* 13.7 Write unit tests for URL construction and CLI parsing
    - Test all URL template constructions (fixtures, standings, match report, player)
    - Test CLI argument parsing: valid modes, invalid modes, missing args, optional flags
    - Test log message format verification
    - _Requirements: 1.5, 6.2, 9.6, 9.7, 10.9_

  - [ ]* 13.8 Write integration tests with mocked HTTP and DB
    - Mock Fetcher.get() for 429 retries, 5xx handling, timeouts, network errors
    - Mock Supabase client for upsert, insert, query, transaction rollback
    - Test mode orchestration (execution order: fixtures before boxscores)
    - Test end-to-end flow with mocked external dependencies
    - _Requirements: 8.3, 8.4, 8.5, 8.6, 9.1, 9.9_

- [x] 14. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The scraper follows the single-file architecture pattern of `scrape_nba.py`
- All HTTP requests use Scrapling's `Fetcher.get()` with `stealthy_headers=True`
- Database operations use `supabase-py` client matching existing project patterns

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["2.2", "3.1"] },
    { "id": 3, "tasks": ["3.2", "4.1"] },
    { "id": 4, "tasks": ["5.1", "6.1"] },
    { "id": 5, "tasks": ["7.1", "9.1"] },
    { "id": 6, "tasks": ["8.1"] },
    { "id": 7, "tasks": ["11.1"] },
    { "id": 8, "tasks": ["13.1"] },
    { "id": 9, "tasks": ["13.2", "13.3", "13.4", "13.5", "13.6"] },
    { "id": 10, "tasks": ["13.7", "13.8"] }
  ]
}
```
