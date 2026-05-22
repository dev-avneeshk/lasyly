"""
Football Schedule, Match Report & Standings Scraper using Scrapling
Scrapes fbref.com for the 2024-25 season across the top 5 European leagues.

Usage:
  python scrape_football.py <mode> [options]

Modes:
  full             - Scrape all fixtures + all match reports + standings
  schedule-only    - Scrape only fixtures pages for all leagues
  boxscores-only   - Scrape match reports for completed games without stats (max 500)
  daily            - Scrape fixtures + last 2 days match reports + standings
  standings-only   - Scrape only standings pages for all leagues

Options:
  --start-date YYYY-MM-DD  Filter match reports from this date
  --end-date YYYY-MM-DD    Filter match reports until this date
  --delay SECONDS          Delay between requests (default: 3, range: 1-30)
  --league LEAGUE          Filter to a specific league name

Environment variables (from ../.env.local):
  NEXT_PUBLIC_SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
"""

import os
import re
import sys
import time
import argparse
import logging
from logging.handlers import RotatingFileHandler
from datetime import datetime, date, timedelta, timezone
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from scrapling.fetchers import Fetcher, StealthyFetcher
from supabase import create_client, Client

# ============================================================
# Configuration & Constants
# ============================================================

# League configuration: comp_id and url_name for each of the top 5 European leagues
LEAGUES = {
    "Premier League": {"comp_id": 9, "url_name": "Premier-League"},
    "La Liga": {"comp_id": 12, "url_name": "La-Liga"},
    "Bundesliga": {"comp_id": 20, "url_name": "Bundesliga"},
    "Serie A": {"comp_id": 11, "url_name": "Serie-A"},
    "Ligue 1": {"comp_id": 13, "url_name": "Ligue-1"},
}

VALID_LEAGUES = set(LEAGUES.keys())
BASE_URL = "https://fbref.com"
SEASON = "2024-25"

# URL templates for constructing fbref.com page URLs
FIXTURES_URL_TEMPLATE = "{base}/en/comps/{comp_id}/schedule/{url_name}-Scores-and-Fixtures"
STANDINGS_URL_TEMPLATE = "{base}/en/comps/{comp_id}/{url_name}-Stats"
MATCH_REPORT_URL_TEMPLATE = "{base}{match_url}"
PLAYER_URL_TEMPLATE = "{base}/en/players/{player_id}/"


@dataclass
class ScraperConfig:
    """Configuration for the football scraper with sensible defaults."""

    request_delay: float = 3.0              # seconds between requests (1-30)
    backoff_delay: float = 60.0             # seconds to wait on 429/5xx (10-300)
    max_retries: int = 3                    # max retry attempts per URL
    request_timeout: int = 30               # HTTP timeout in seconds
    max_matches_per_run: int = 500          # max match reports per boxscores-only invocation
    season: str = SEASON
    log_dir: str = "scripts/logs"
    log_max_bytes: int = 10 * 1024 * 1024   # 10 MB
    log_backup_count: int = 5

    def validate(self) -> None:
        """Validate config ranges. Raises ValueError if invalid."""
        if not (1 <= self.request_delay <= 30):
            raise ValueError(
                f"request_delay must be between 1 and 30 seconds, got {self.request_delay}"
            )
        if not (10 <= self.backoff_delay <= 300):
            raise ValueError(
                f"backoff_delay must be between 10 and 300 seconds, got {self.backoff_delay}"
            )


# ============================================================
# Logging
# ============================================================

def setup_logging(config: ScraperConfig) -> logging.Logger:
    """Configure dual-output logging (stdout + rotating file in scripts/logs/)."""
    logger = logging.getLogger("football_scraper")
    logger.setLevel(logging.INFO)

    fmt = logging.Formatter(
        "%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%SZ",
    )

    # Stdout handler
    stdout_handler = logging.StreamHandler(sys.stdout)
    stdout_handler.setFormatter(fmt)
    logger.addHandler(stdout_handler)

    # Ensure log directory exists
    log_dir = Path(config.log_dir)
    log_dir.mkdir(parents=True, exist_ok=True)

    # Rotating file handler
    log_path = log_dir / "football_scraper.log"
    file_handler = RotatingFileHandler(
        log_path,
        maxBytes=config.log_max_bytes,
        backupCount=config.log_backup_count,
    )
    file_handler.setFormatter(fmt)
    logger.addHandler(file_handler)

    return logger

# ============================================================
# Data Classes
# ============================================================


@dataclass
class MatchRecord:
    """Represents a single football match record for the football_matches table."""

    match_date: str              # ISO 8601 date (YYYY-MM-DD)
    match_url: str               # FBRef match report URL slug or generated ID
    home_team: str
    away_team: str
    home_score: Optional[int]    # null if not yet played
    away_score: Optional[int]    # null if not yet played
    status: str                  # "completed" | "scheduled"
    league: str                  # e.g., "Premier League"
    comp_id: int                 # e.g., 9
    season: str                  # "2024-25"
    round: Optional[str]         # matchweek/round
    venue: Optional[str]         # stadium name
    kickoff_time: Optional[str]  # HH:MM format or null


@dataclass
class PlayerStatRecord:
    """Represents a player's stats from a single match for the football_player_stats table."""

    player_name: str
    player_fbref_id: str
    team: str                    # full team name
    opponent: str                # opposing team full name
    match_date: str              # ISO 8601 date
    position: Optional[str]
    is_starter: bool
    minutes: Optional[int]
    goals: Optional[int]
    assists: Optional[int]
    shots: Optional[int]
    shots_on_target: Optional[int]
    passes_completed: Optional[int]
    passes_attempted: Optional[int]
    pass_completion_pct: Optional[float]
    key_passes: Optional[int]
    through_balls: Optional[int]
    tackles: Optional[int]
    interceptions: Optional[int]
    blocks: Optional[int]
    clearances: Optional[int]
    aerials_won: Optional[int]
    fouls_committed: Optional[int]
    fouls_drawn: Optional[int]
    yellow_cards: Optional[int]
    red_cards: Optional[int]
    xg: Optional[float]
    xag: Optional[float]
    progressive_carries: Optional[int]
    progressive_passes: Optional[int]


@dataclass
class StandingsRecord:
    """Represents a team's league standings entry for the football_standings table."""

    team: str
    league: str
    comp_id: int
    season: str
    position: int
    matches_played: int
    wins: int
    draws: int
    losses: int
    goals_for: int
    goals_against: int
    goal_difference: int
    points: int
    xg: Optional[float]
    xga: Optional[float]
    last_5: Optional[str]        # e.g., "WDWLW"


@dataclass
class PlayerRecord:
    """Represents a player master record for the football_players table."""

    player_fbref_id: str         # max 50 chars
    player_name: str             # max 200 chars
    current_team: str            # max 100 chars
    position: Optional[str]      # max 50 chars
    nationality: Optional[str]   # max 100 chars


# ============================================================
# Validation Helpers
# ============================================================


def validate_match_record(record: dict) -> bool:
    """Validate that a match record has all required fields.

    Required: match_date, match_url, home_team, away_team, league.
    Returns True if valid (all present and non-empty strings), False otherwise.
    """
    required_fields = ("match_date", "match_url", "home_team", "away_team", "league")
    for field in required_fields:
        value = record.get(field)
        if not isinstance(value, str) or not value.strip():
            return False
    return True


def validate_date_range(start_date: Optional[date], end_date: Optional[date]) -> None:
    """Validate date range. Raises ValueError if start_date > end_date."""
    if start_date is not None and end_date is not None:
        if start_date > end_date:
            raise ValueError(
                f"start_date ({start_date.isoformat()}) must be on or before "
                f"end_date ({end_date.isoformat()})"
            )


def validate_leagues(leagues: list[str]) -> None:
    """Validate league names against VALID_LEAGUES set.

    Raises ValueError listing invalid names and allowed values.
    """
    for league in leagues:
        if league not in VALID_LEAGUES:
            raise ValueError(
                f"Invalid league name: '{league}'. "
                f"Allowed values: {sorted(VALID_LEAGUES)}"
            )


def merge_match_records(existing: dict, new: dict) -> dict:
    """Merge new match data into existing record.

    New non-null values overwrite existing.
    New null values preserve existing non-null values.
    Returns the merged dict.
    """
    merged = dict(existing)
    for key, value in new.items():
        if value is not None:
            merged[key] = value
    return merged


def merge_player_records(existing: dict, new: dict) -> dict:
    """Merge new player data into existing player record.

    Updates player_name, current_team, position, nationality
    only when new value is non-null and differs from existing.
    Returns the merged dict.
    """
    merged = dict(existing)
    updatable_fields = ("player_name", "current_team", "position", "nationality")
    for field in updatable_fields:
        new_value = new.get(field)
        if new_value is not None and new_value != existing.get(field):
            merged[field] = new_value
    return merged


def calculate_daily_window() -> tuple[date, date]:
    """Calculate the 2-day inclusive window for daily mode.

    Returns (yesterday_utc, today_utc) based on current UTC time.
    """
    today_utc = datetime.now(timezone.utc).date()
    yesterday_utc = today_utc - timedelta(days=1)
    return (yesterday_utc, today_utc)


def determine_status(
    home_score: Optional[int], away_score: Optional[int]
) -> tuple[str, Optional[int], Optional[int]]:
    """Determine match status from score values.

    Returns (status, home_score, away_score) where:
    - Both non-null non-negative integers: ("completed", home_score, away_score)
    - Both null: ("scheduled", None, None)
    - One present, one null: ("scheduled", None, None)
    """
    if (
        home_score is not None
        and away_score is not None
        and isinstance(home_score, int)
        and isinstance(away_score, int)
        and home_score >= 0
        and away_score >= 0
    ):
        return ("completed", home_score, away_score)
    return ("scheduled", None, None)


def generate_fallback_match_url(match_date: str, home_team: str, away_team: str) -> str:
    """Generate a deterministic match_url when no match report link exists.

    Format: {date}-{home}-{away}
    All lowercase, spaces replaced with hyphens.
    """
    parts = f"{match_date}-{home_team}-{away_team}"
    return parts.lower().replace(" ", "-")


# ============================================================
# HTTP Fetch Helpers
# ============================================================


def calculate_retry_wait(response, config: ScraperConfig) -> float:
    """Calculate wait time from Retry-After header or default backoff.

    Parses Retry-After header value (integer seconds), caps at 300 seconds.
    Falls back to config.backoff_delay if header is absent or unparseable.
    """
    try:
        retry_after = response.headers.get("Retry-After") if response else None
        if retry_after is not None:
            wait = float(retry_after)
            return min(wait, 300.0)
    except (ValueError, TypeError, AttributeError):
        pass
    return config.backoff_delay


def fetch_page(url: str, config: ScraperConfig, logger: logging.Logger):
    """Fetch a page with retry logic.

    Uses StealthyFetcher.fetch() to bypass Cloudflare protection on fbref.com.
    Falls back to Fetcher.get() if StealthyFetcher fails.
    Retries on 429 (respects Retry-After, capped at 300s), 5xx, and network errors.
    Max retries: config.max_retries.
    Returns page response on success, or None on failure.
    """
    retries = 0
    last_status = None

    while retries < config.max_retries:
        try:
            page = StealthyFetcher.fetch(url, headless=True, block_webrtc=True)
            last_status = page.status

            if page.status == 200:
                return page
            elif page.status == 429:
                retries += 1
                wait_time = calculate_retry_wait(page, config)
                logger.warning(
                    f"Rate limited (429) for {url}. "
                    f"Waiting {wait_time:.0f}s (retry {retries}/{config.max_retries})"
                )
                time.sleep(wait_time)
            elif page.status >= 500:
                retries += 1
                logger.warning(
                    f"Server error ({page.status}) for {url}. "
                    f"Waiting {config.backoff_delay:.0f}s (retry {retries}/{config.max_retries})"
                )
                time.sleep(config.backoff_delay)
            elif page.status == 404:
                logger.info(f"404 Not Found: {url}")
                return None
            elif page.status == 403:
                retries += 1
                logger.warning(
                    f"Forbidden (403) for {url}. "
                    f"Waiting {config.backoff_delay:.0f}s (retry {retries}/{config.max_retries})"
                )
                time.sleep(config.backoff_delay)
            else:
                logger.error(f"HTTP {page.status} for {url} - skipping")
                return None
        except Exception as e:
            retries += 1
            last_status = f"error: {type(e).__name__}"
            logger.warning(
                f"Request error for {url}: {e}. "
                f"Waiting {config.backoff_delay:.0f}s (retry {retries}/{config.max_retries})"
            )
            time.sleep(config.backoff_delay)

    logger.error(
        f"Max retries ({config.max_retries}) reached for {url} "
        f"(last status: {last_status})"
    )
    return None


# ============================================================
# Database
# ============================================================


class FootballDatabase:
    """Database operations for football scraper using Supabase client."""

    def __init__(self, url: str, key: str):
        """Initialize Supabase client."""
        self.client: Client = create_client(url, key)
        self.logger = logging.getLogger("football_scraper")

    def upsert_matches(self, matches: list[dict]) -> int:
        """Upsert match records in batches (conflict on match_url).

        Processes in batches of 100. On batch failure, falls back to
        individual upserts for that batch. Returns count of rows affected.
        """
        count = 0
        batch_size = 100
        for i in range(0, len(matches), batch_size):
            batch = matches[i:i + batch_size]
            try:
                result = self.client.table("football_matches").upsert(
                    batch, on_conflict="match_url"
                ).execute()
                count += len(result.data) if result.data else 0
                self.logger.info(
                    f"  DB: saved batch {i // batch_size + 1} "
                    f"({count}/{len(matches)} matches)"
                )
            except Exception as e:
                self.logger.error(f"DB batch upsert failed at index {i}: {e}")
                # Fallback to individual upserts for this batch
                for match in batch:
                    try:
                        result = self.client.table("football_matches").upsert(
                            match, on_conflict="match_url"
                        ).execute()
                        if result.data:
                            count += 1
                    except Exception as e2:
                        self.logger.error(
                            f"DB upsert failed for {match.get('match_url')}: {e2}"
                        )
        return count

    def get_completed_matches(
        self,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        leagues: Optional[list[str]] = None,
        unscraped_only: bool = False,
        limit: int = 500,
    ) -> list[dict]:
        """Query completed matches matching filters.

        Filters: status='completed', optional date range, optional league list.
        If unscraped_only, excludes matches that already have player stats.
        Ordered by match_date ascending. Paginates with batch_size=1000.
        Returns at most `limit` results.
        """
        if unscraped_only:
            scraped_ids = self._get_scraped_match_ids()

        all_matches = []
        offset = 0
        batch_size = 1000

        while True:
            query = (
                self.client.table("football_matches")
                .select("*")
                .eq("status", "completed")
            )
            if start_date:
                query = query.gte("match_date", start_date.isoformat())
            if end_date:
                query = query.lte("match_date", end_date.isoformat())
            if leagues:
                query = query.in_("league", leagues)
            query = query.order("match_date", desc=False).range(
                offset, offset + batch_size - 1
            )
            result = query.execute()
            rows = result.data or []

            for match in rows:
                if unscraped_only and match["id"] in scraped_ids:
                    continue
                all_matches.append(match)
                if len(all_matches) >= limit:
                    return all_matches

            if len(rows) < batch_size:
                break
            offset += batch_size

        return all_matches

    def _get_scraped_match_ids(self) -> set:
        """Get match IDs that already have player stats.

        Queries football_player_stats for distinct match_id values.
        Paginates to retrieve all.
        """
        all_ids = set()
        offset = 0
        batch_size = 1000
        while True:
            result = (
                self.client.table("football_player_stats")
                .select("match_id")
                .range(offset, offset + batch_size - 1)
                .execute()
            )
            rows = result.data or []
            for row in rows:
                all_ids.add(row["match_id"])
            if len(rows) < batch_size:
                break
            offset += batch_size
        return all_ids

    def get_match_by_url(self, match_url: str) -> Optional[dict]:
        """Look up a single match by match_url. Returns None if not found."""
        try:
            result = (
                self.client.table("football_matches")
                .select("*")
                .eq("match_url", match_url)
                .limit(1)
                .execute()
            )
            rows = result.data or []
            return rows[0] if rows else None
        except Exception as e:
            self.logger.error(f"DB query failed for match_url={match_url}: {e}")
            return None

    def match_has_stats(self, match_id: str) -> bool:
        """Check if player stats exist for a match.

        Returns True if any football_player_stats rows exist for the given match_id.
        """
        try:
            result = (
                self.client.table("football_player_stats")
                .select("id", count="exact")
                .eq("match_id", match_id)
                .limit(1)
                .execute()
            )
            return (result.count or 0) > 0
        except Exception as e:
            self.logger.error(
                f"DB query failed checking stats for match_id={match_id}: {e}"
            )
            return False

    def upsert_standings(self, standings: list[dict]) -> int:
        """Upsert standings records (conflict on team+league+season).

        Processes in batches of 100. Returns count of rows affected.
        """
        count = 0
        batch_size = 100
        for i in range(0, len(standings), batch_size):
            batch = standings[i:i + batch_size]
            try:
                result = self.client.table("football_standings").upsert(
                    batch, on_conflict="team,league,season"
                ).execute()
                count += len(result.data) if result.data else 0
                self.logger.info(
                    f"  DB: saved standings batch {i // batch_size + 1} "
                    f"({count}/{len(standings)} teams)"
                )
            except Exception as e:
                self.logger.error(f"DB standings batch upsert failed at index {i}: {e}")
                # Fallback to individual upserts for this batch
                for record in batch:
                    try:
                        result = self.client.table("football_standings").upsert(
                            record, on_conflict="team,league,season"
                        ).execute()
                        if result.data:
                            count += 1
                    except Exception as e2:
                        self.logger.error(
                            f"DB standings upsert failed for "
                            f"{record.get('team')} ({record.get('league')}): {e2}"
                        )
        return count

    def insert_player_stats(self, match_id: str, stats: list[dict]) -> int:
        """Delete existing stats for match_id and insert new batch (idempotent).

        Implements delete-and-reinsert pattern matching the NBA scraper.
        On failure, logs error and returns 0.
        Returns count of rows inserted.
        """
        try:
            self.client.table("football_player_stats").delete().eq(
                "match_id", match_id
            ).execute()
        except Exception as e:
            self.logger.error(
                f"DB delete failed for match_id={match_id}: {e}"
            )
            return 0

        # Ensure each stat dict includes the match_id
        for stat in stats:
            stat["match_id"] = match_id

        count = 0
        batch_size = 50
        for i in range(0, len(stats), batch_size):
            batch = stats[i:i + batch_size]
            try:
                result = self.client.table("football_player_stats").insert(
                    batch
                ).execute()
                count += len(result.data) if result.data else 0
            except Exception as e:
                self.logger.error(
                    f"DB insert_player_stats failed at batch index {i} "
                    f"for match_id={match_id}: {e}"
                )
                return count
        return count

    def upsert_player(self, player: dict) -> bool:
        """Insert or update player master record (conflict on player_fbref_id).

        Skips if player_fbref_id is empty or whitespace.
        Returns True on success, False on failure.
        """
        player_id = player.get("player_fbref_id", "")
        if not player_id or not player_id.strip():
            self.logger.warning(
                f"Skipping player with empty player_fbref_id: "
                f"{player.get('player_name', 'unknown')}"
            )
            return False

        try:
            self.client.table("football_players").upsert(
                player, on_conflict="player_fbref_id"
            ).execute()
            return True
        except Exception as e:
            self.logger.error(
                f"DB upsert_player failed for "
                f"{player.get('player_name', 'unknown')} "
                f"(fbref_id={player_id}): {e}"
            )
            return False

# ============================================================
# Fixtures Scraping
# ============================================================


def build_fixtures_url(comp_id: int, url_name: str) -> str:
    """Construct fixtures page URL from league config."""
    return FIXTURES_URL_TEMPLATE.format(
        base=BASE_URL, comp_id=comp_id, url_name=url_name
    )


def scrape_fixtures(config: ScraperConfig, logger: logging.Logger) -> list[dict]:
    """Scrape fixtures pages for all Top 5 leagues.

    Returns list of match record dicts ready for DB insertion.
    Waits config.request_delay between requests.
    """
    all_matches: list[dict] = []

    for league_name, league_info in LEAGUES.items():
        comp_id = league_info["comp_id"]
        url_name = league_info["url_name"]
        url = build_fixtures_url(comp_id, url_name)

        logger.info(f"Fetching fixtures: {league_name}")
        page = fetch_page(url, config, logger)

        if page is None:
            logger.warning(f"Failed to fetch fixtures page for {league_name}")
            continue

        matches = parse_fixtures_page(page, league_name, comp_id, logger)
        logger.info(f"  {league_name}: {len(matches)} matches parsed")
        all_matches.extend(matches)

        # Wait between requests to respect rate limiting
        time.sleep(config.request_delay)

    return all_matches


def parse_fixtures_page(
    page, league_name: str, comp_id: int, logger: logging.Logger
) -> list[dict]:
    """Parse a single fixtures page HTML into match record dicts.

    Extracts: date, kickoff_time, home_team, away_team, scores,
    match_url, round, venue from the fixtures table.
    Uses CSS selectors matching FBRef's table structure.
    """
    matches: list[dict] = []

    # FBRef fixtures tables have an id containing "sched" and class "stats_table"
    tables = page.css('table.stats_table')
    if not len(tables):
        logger.warning(f"  No fixtures table found for {league_name}")
        return matches

    # Use the first stats_table (the main schedule table)
    table = tables.first
    rows = table.css("tbody tr")

    for row in rows:
        # Skip spacer/header rows (rows with th[colspan] or no data cells)
        if len(row.css("th[colspan]")):
            continue

        # Extract date
        date_cells = row.css('td[data-stat="date"]')
        if not len(date_cells):
            # Try th element for date (some tables use th for date)
            date_cells = row.css('th[data-stat="date"]')
            if not len(date_cells):
                continue

        date_cell = date_cells.first
        date_links = date_cell.css("a")
        date_text = (
            date_links.first.text.strip() if len(date_links) else date_cell.text.strip()
        )
        if not date_text:
            continue

        # FBRef dates are in YYYY-MM-DD format
        match_date = date_text.strip()

        # Validate date format (YYYY-MM-DD)
        if not re.match(r"^\d{4}-\d{2}-\d{2}$", match_date):
            continue

        # Extract kickoff time
        kickoff_time = None
        time_cells = row.css('td[data-stat="time"]')
        if len(time_cells):
            time_text = time_cells.first.text.strip()
            if time_text:
                kickoff_time = time_text

        # Extract home team
        home_cells = row.css('td[data-stat="home_team"]')
        if not len(home_cells):
            continue
        home_links = home_cells.first.css("a")
        home_team = (
            home_links.first.text.strip()
            if len(home_links)
            else home_cells.first.text.strip()
        )

        # Extract away team
        away_cells = row.css('td[data-stat="away_team"]')
        if not len(away_cells):
            continue
        away_links = away_cells.first.css("a")
        away_team = (
            away_links.first.text.strip()
            if len(away_links)
            else away_cells.first.text.strip()
        )

        if not home_team or not away_team:
            continue

        # Extract score (format: "X–Y" with en-dash or hyphen, or empty)
        home_score = None
        away_score = None
        score_cells = row.css('td[data-stat="score"]')
        if len(score_cells):
            score_text = score_cells.first.text.strip()
            if score_text:
                # Try en-dash first, then regular hyphen
                score_parts = None
                if "–" in score_text:
                    score_parts = score_text.split("–")
                elif "−" in score_text:
                    score_parts = score_text.split("−")
                elif "-" in score_text:
                    score_parts = score_text.split("-")

                if score_parts and len(score_parts) == 2:
                    try:
                        home_score = int(score_parts[0].strip())
                        away_score = int(score_parts[1].strip())
                    except ValueError:
                        home_score = None
                        away_score = None

        # Determine status from scores
        status, home_score, away_score = determine_status(home_score, away_score)

        # Extract match report URL
        match_url = None
        match_report_cells = row.css('td[data-stat="match_report"]')
        if len(match_report_cells):
            report_links = match_report_cells.first.css("a")
            if len(report_links):
                href = report_links.first.attrib.get("href", "")
                if href:
                    match_url = href

        # Fallback match URL if no match report link
        if not match_url:
            match_url = generate_fallback_match_url(match_date, home_team, away_team)

        # Extract round/matchweek
        round_val = None
        round_cells = row.css('td[data-stat="round"]')
        if len(round_cells):
            round_links = round_cells.first.css("a")
            round_val = (
                round_links.first.text.strip()
                if len(round_links)
                else round_cells.first.text.strip()
            )
            if not round_val:
                round_val = None

        # Extract venue
        venue = None
        venue_cells = row.css('td[data-stat="venue"]')
        if len(venue_cells):
            venue_text = venue_cells.first.text.strip()
            if venue_text:
                venue = venue_text

        # Build match record dict
        record = {
            "match_date": match_date,
            "match_url": match_url,
            "home_team": home_team,
            "away_team": away_team,
            "home_score": home_score,
            "away_score": away_score,
            "status": status,
            "league": league_name,
            "comp_id": comp_id,
            "season": SEASON,
            "round": round_val,
            "venue": venue,
            "kickoff_time": kickoff_time,
        }

        # Validate and skip invalid records
        if not validate_match_record(record):
            logger.warning(
                f"  Skipping invalid row: date={match_date}, "
                f"home={home_team}, away={away_team}"
            )
            continue

        matches.append(record)

    return matches


# ============================================================
# Match Report Scraping
# ============================================================


def parse_stat_value(cell_text: str, is_decimal: bool = False) -> Optional[int | float]:
    """Parse a stat cell value.

    Returns None for empty strings, dashes, or non-numeric text.
    Returns int for integer stats, float (2 decimal places) for decimal stats
    when is_decimal=True.
    """
    text = cell_text.strip()
    if not text or text == "-" or text == "—":
        return None

    try:
        if is_decimal:
            return round(float(text), 2)
        else:
            return int(text)
    except (ValueError, TypeError):
        # Try float conversion for integers that might have decimals
        if not is_decimal:
            try:
                return int(float(text))
            except (ValueError, TypeError):
                pass
        return None


def parse_minutes(minutes_text: str) -> Optional[int]:
    """Parse minutes field, handling added-time notation.

    "90" → 90
    "45+2" → 45
    "" → None
    "0" → None (triggers player exclusion)
    """
    text = minutes_text.strip()
    if not text:
        return None

    # Handle added-time notation (e.g., "45+2")
    if "+" in text:
        base_part = text.split("+")[0].strip()
        try:
            value = int(base_part)
            return value if value > 0 else None
        except (ValueError, TypeError):
            return None

    try:
        value = int(text)
        return value if value > 0 else None
    except (ValueError, TypeError):
        return None


def extract_player_fbref_id(href: str) -> Optional[str]:
    """Extract player ID from href pattern /en/players/{player_id}/...

    Returns None if pattern doesn't match or ID is empty/whitespace.
    """
    match = re.search(r"/en/players/([^/]+)", href)
    if match:
        player_id = match.group(1).strip()
        return player_id if player_id else None
    return None


def parse_team_stats_table(
    table, team: str, opponent: str, logger: logging.Logger
) -> list[dict]:
    """Parse a single team's player stats table from a match report.

    FBRef match reports have tables with id like "stats_{team_id}_summary".
    Each player row has stats in td/th elements with data-stat attributes.

    Rows before a separator (class "spacer" or "thead" mid-table) are starters
    (is_starter=True), rows after are subs (is_starter=False).
    Skip players with 0 or empty minutes.
    """
    players: list[dict] = []
    is_starter = True

    # Get all rows from tbody
    rows = table.css("tbody tr")

    for row in rows:
        # Check for separator rows (spacer, thead, or divider rows)
        row_classes = row.attrib.get("class", "")
        if "spacer" in row_classes or "thead" in row_classes:
            is_starter = False
            continue

        # Skip rows that are mid-table headers (contain th[colspan])
        if len(row.css("th[colspan]")):
            is_starter = False
            continue

        # Extract player name and link
        player_cell = row.css('th[data-stat="player"]')
        if not len(player_cell):
            player_cell = row.css('td[data-stat="player"]')
        if not len(player_cell):
            continue

        player_links = player_cell.first.css("a")
        if not len(player_links):
            continue

        player_name = player_links.first.text.strip()
        if not player_name:
            continue

        # Extract player fbref_id from href
        href = player_links.first.attrib.get("href", "")
        player_fbref_id = extract_player_fbref_id(href)
        if not player_fbref_id:
            logger.warning(
                f"  Could not extract player ID for {player_name} (href: {href})"
            )
            continue

        # Extract minutes
        minutes_cells = row.css('td[data-stat="minutes"]')
        minutes_text = minutes_cells.first.text.strip() if len(minutes_cells) else ""
        minutes = parse_minutes(minutes_text)

        # Skip players with 0 or empty minutes
        if minutes is None:
            continue

        # Extract position
        position = None
        pos_cells = row.css('td[data-stat="position"]')
        if len(pos_cells):
            pos_text = pos_cells.first.text.strip()
            if pos_text:
                position = pos_text

        # Helper to get stat value from a row
        def get_stat(data_stat: str, is_decimal: bool = False) -> Optional[int | float]:
            cells = row.css(f'td[data-stat="{data_stat}"]')
            if not len(cells):
                return None
            return parse_stat_value(cells.first.text.strip(), is_decimal=is_decimal)

        # Extract all stats
        player_stat = {
            "player_name": player_name,
            "player_fbref_id": player_fbref_id,
            "team": team,
            "opponent": opponent,
            "position": position,
            "is_starter": is_starter,
            "minutes": minutes,
            "goals": get_stat("goals"),
            "assists": get_stat("assists"),
            "shots": get_stat("shots"),
            "shots_on_target": get_stat("shots_on_target"),
            "passes_completed": get_stat("passes_completed"),
            "passes_attempted": get_stat("passes"),
            "pass_completion_pct": get_stat("passes_pct", is_decimal=True),
            "key_passes": get_stat("key_passes"),
            "through_balls": get_stat("through_balls"),
            "tackles": get_stat("tackles"),
            "interceptions": get_stat("interceptions"),
            "blocks": get_stat("blocks"),
            "clearances": get_stat("clearances"),
            "aerials_won": get_stat("aerials_won"),
            "fouls_committed": get_stat("fouls"),
            "fouls_drawn": get_stat("fouled"),
            "yellow_cards": get_stat("cards_yellow"),
            "red_cards": get_stat("cards_red"),
            "xg": get_stat("xg", is_decimal=True),
            "xag": get_stat("xg_assist", is_decimal=True),
            "progressive_carries": get_stat("progressive_carries"),
            "progressive_passes": get_stat("progressive_passes"),
        }

        players.append(player_stat)

    return players


def parse_match_report(
    page, home_team: str, away_team: str, match_date: str, logger: logging.Logger
) -> list[dict]:
    """Parse a match report page into player stat dicts.

    Finds both team stat tables on the match report page.
    FBRef has multiple tables; look for tables with id containing "stats"
    and "summary". Parse each team's table.
    Returns combined list of player stat dicts.
    """
    all_stats: list[dict] = []

    # Find all tables with id containing "stats" and "summary"
    tables = page.css("table")
    summary_tables = []

    for table in tables:
        table_id = table.attrib.get("id", "")
        if "stats" in table_id and "summary" in table_id:
            summary_tables.append(table)

    if not summary_tables:
        logger.warning(
            f"  No player stats summary tables found in match report"
        )
        return all_stats

    # FBRef typically has 2 summary tables: one for each team
    # First table is home team, second is away team
    if len(summary_tables) >= 1:
        home_stats = parse_team_stats_table(
            summary_tables[0], home_team, away_team, logger
        )
        for stat in home_stats:
            stat["match_date"] = match_date
        all_stats.extend(home_stats)

    if len(summary_tables) >= 2:
        away_stats = parse_team_stats_table(
            summary_tables[1], away_team, home_team, logger
        )
        for stat in away_stats:
            stat["match_date"] = match_date
        all_stats.extend(away_stats)

    return all_stats


def scrape_boxscores(
    db: FootballDatabase,
    config: ScraperConfig,
    logger: logging.Logger,
    start_date=None,
    end_date=None,
    leagues=None,
    unscraped_only: bool = False,
) -> tuple[int, int]:
    """Orchestrate match report collection.

    Calls db.get_completed_matches() with filters.
    For each match, checks if stats already exist (skip if so).
    Constructs URL using MATCH_REPORT_URL_TEMPLATE.
    Fetches page, parses stats.
    Logs match_url and player stat count at INFO level.
    Returns (success_count, error_count).
    Waits config.request_delay between requests.
    """
    success_count = 0
    error_count = 0

    # Get completed matches from DB
    matches = db.get_completed_matches(
        start_date=start_date,
        end_date=end_date,
        leagues=leagues,
        unscraped_only=unscraped_only,
        limit=config.max_matches_per_run,
    )

    if not matches:
        logger.info("No matches found for box score scraping")
        return (0, 0)

    logger.info(f"Found {len(matches)} matches for box score scraping")

    for match in matches:
        match_url = match.get("match_url", "")
        match_id = match.get("id")
        home_team = match.get("home_team", "")
        away_team = match.get("away_team", "")
        match_date = match.get("match_date", "")

        # Skip if stats already exist for this match
        if match_id and db.match_has_stats(match_id):
            continue

        # Skip matches without a proper match report URL (fallback URLs)
        if not match_url or not match_url.startswith("/"):
            continue

        # Construct full URL
        url = MATCH_REPORT_URL_TEMPLATE.format(base=BASE_URL, match_url=match_url)

        # Fetch the match report page
        page = fetch_page(url, config, logger)

        if page is None:
            logger.error(f"Failed to fetch match report: {match_url}")
            error_count += 1
            time.sleep(config.request_delay)
            continue

        # Parse player stats from the page
        try:
            stats = parse_match_report(
                page, home_team, away_team, match_date, logger
            )

            logger.info(
                f"  Match report {match_url}: {len(stats)} player stats parsed"
            )

            if stats:
                success_count += 1
            else:
                logger.warning(f"  No player stats found in match report: {match_url}")
                error_count += 1

        except Exception as e:
            logger.error(f"Error parsing match report {match_url}: {e}")
            error_count += 1

        # Wait between requests to respect rate limiting
        time.sleep(config.request_delay)

    return (success_count, error_count)

# ============================================================
# Standings Scraping
# ============================================================


def build_standings_url(comp_id: int, url_name: str) -> str:
    """Construct standings page URL from league config."""
    return STANDINGS_URL_TEMPLATE.format(
        base=BASE_URL, comp_id=comp_id, url_name=url_name
    )


def scrape_standings(config: ScraperConfig, logger: logging.Logger) -> list[dict]:
    """Scrape standings pages for all Top 5 leagues.

    Returns combined list of standings record dicts ready for DB insertion.
    Waits config.request_delay between requests.
    """
    all_standings: list[dict] = []

    for league_name, league_info in LEAGUES.items():
        comp_id = league_info["comp_id"]
        url_name = league_info["url_name"]
        url = build_standings_url(comp_id, url_name)

        logger.info(f"Fetching standings: {league_name}")
        page = fetch_page(url, config, logger)

        if page is None:
            logger.warning(f"Failed to fetch standings page for {league_name}")
            continue

        standings = parse_standings_page(page, league_name, comp_id, logger)
        logger.info(f"  {league_name}: {len(standings)} teams parsed")
        all_standings.extend(standings)

        # Wait between requests to respect rate limiting
        time.sleep(config.request_delay)

    return all_standings


def parse_standings_page(
    page, league_name: str, comp_id: int, logger: logging.Logger
) -> list[dict]:
    """Parse a standings page HTML into standings record dicts.

    Extracts: team, position, MP, W, D, L, GF, GA, GD, Pts, xG, xGA, last_5.
    FBRef standings pages have a table with id containing "results" or class "stats_table".
    """
    standings: list[dict] = []

    # Find the league standings table
    # FBRef uses tables with id containing "results" or class "stats_table"
    tables = page.css('table.stats_table')
    if not len(tables):
        logger.warning(f"  No standings table found for {league_name}")
        return standings

    # Use the first stats_table (the main league table)
    table = tables.first
    rows = table.css("tbody tr")

    for row in rows:
        # Skip spacer/header rows
        if len(row.css("th[colspan]")):
            continue

        # Extract position/rank
        rank_cells = row.css('td[data-stat="rank"]')
        if not len(rank_cells):
            # Try th element for rank
            rank_cells = row.css('th[data-stat="rank"]')
            if not len(rank_cells):
                continue

        rank_text = rank_cells.first.text.strip()
        position = _parse_int(rank_text)
        if position is None:
            continue

        # Extract team name (from <a> tag inside data-stat="team" cell)
        team_cells = row.css('td[data-stat="team"]')
        if not len(team_cells):
            team_cells = row.css('th[data-stat="team"]')
            if not len(team_cells):
                continue

        team_cell = team_cells.first
        team_links = team_cell.css("a")
        team_name = (
            team_links.first.text.strip()
            if len(team_links)
            else team_cell.text.strip()
        )
        if not team_name:
            continue

        # Extract matches played
        matches_played = _extract_int_stat(row, "games")

        # Extract wins, draws, losses
        wins = _extract_int_stat(row, "wins")
        draws = _extract_int_stat(row, "ties")
        losses = _extract_int_stat(row, "losses")

        # Extract goals for, goals against, goal difference
        goals_for = _extract_int_stat(row, "goals_for")
        goals_against = _extract_int_stat(row, "goals_against")
        goal_difference = _extract_int_stat(row, "goal_diff")

        # Extract points
        points = _extract_int_stat(row, "points")

        # Skip rows where essential fields are missing
        if any(v is None for v in [matches_played, wins, draws, losses,
                                    goals_for, goals_against, points]):
            logger.warning(
                f"  Skipping incomplete standings row: team={team_name}, "
                f"league={league_name}"
            )
            continue

        # If goal_difference is None, calculate it
        if goal_difference is None:
            goal_difference = goals_for - goals_against

        # Extract xG (optional, may not be available)
        # FBRef may use "xg_for" or "xg" depending on the page variant
        xg = _extract_float_stat(row, "xg_for")
        if xg is None:
            xg = _extract_float_stat(row, "xg")

        # Extract xGA (optional, may not be available)
        # FBRef may use "xg_against" depending on the page variant
        xga = _extract_float_stat(row, "xg_against")

        # Extract last 5 results (may not be in a single cell)
        last_5 = None
        last5_cells = row.css('td[data-stat="last_5"]')
        if not len(last5_cells):
            # Try alternative data-stat names used by FBRef
            last5_cells = row.css('td[data-stat="form"]')
        if len(last5_cells):
            last5_text = last5_cells.first.text.strip()
            if last5_text:
                # Normalize to single-character codes (W, D, L)
                last_5 = last5_text

        # Build standings record dict
        record = {
            "team": team_name,
            "league": league_name,
            "comp_id": comp_id,
            "season": SEASON,
            "position": position,
            "matches_played": matches_played,
            "wins": wins,
            "draws": draws,
            "losses": losses,
            "goals_for": goals_for,
            "goals_against": goals_against,
            "goal_difference": goal_difference,
            "points": points,
            "xg": xg,
            "xga": xga,
            "last_5": last_5,
        }

        standings.append(record)

    return standings


def _parse_int(text: str) -> Optional[int]:
    """Parse an integer from text. Returns None if not parseable."""
    if not text or text.strip() in ("", "-", "—"):
        return None
    try:
        return int(text.strip())
    except (ValueError, TypeError):
        return None


def _parse_float(text: str) -> Optional[float]:
    """Parse a float from text. Returns None if not parseable."""
    if not text or text.strip() in ("", "-", "—"):
        return None
    try:
        return round(float(text.strip()), 2)
    except (ValueError, TypeError):
        return None


def _extract_int_stat(row, data_stat: str) -> Optional[int]:
    """Extract an integer stat value from a row by data-stat attribute."""
    cells = row.css(f'td[data-stat="{data_stat}"]')
    if not len(cells):
        cells = row.css(f'th[data-stat="{data_stat}"]')
        if not len(cells):
            return None
    return _parse_int(cells.first.text.strip())


def _extract_float_stat(row, data_stat: str) -> Optional[float]:
    """Extract a float stat value from a row by data-stat attribute."""
    cells = row.css(f'td[data-stat="{data_stat}"]')
    if not len(cells):
        cells = row.css(f'th[data-stat="{data_stat}"]')
        if not len(cells):
            return None
    return _parse_float(cells.first.text.strip())


# ============================================================
# CLI Entry Point
# ============================================================


def parse_args() -> argparse.Namespace:
    """Parse and validate CLI arguments.

    Positional: mode (full|schedule-only|boxscores-only|daily|standings-only)
    Optional: --start-date, --end-date, --delay, --league
    """
    parser = argparse.ArgumentParser(description="Football 2024-25 Scraper (Top 5 European Leagues)")
    parser.add_argument(
        "mode",
        choices=["full", "schedule-only", "boxscores-only", "daily", "standings-only"],
    )
    parser.add_argument("--start-date", type=str, default=None, help="Filter from date (YYYY-MM-DD)")
    parser.add_argument("--end-date", type=str, default=None, help="Filter until date (YYYY-MM-DD)")
    parser.add_argument("--delay", type=float, default=3.0, help="Delay between requests in seconds (1-30)")
    parser.add_argument("--league", type=str, action="append", default=None, help="Filter to specific league(s)")

    args = parser.parse_args()

    if args.delay < 1 or args.delay > 30:
        parser.error("--delay must be between 1 and 30")

    if args.start_date:
        try:
            args.start_date = date.fromisoformat(args.start_date)
        except ValueError:
            parser.error("--start-date must be YYYY-MM-DD")

    if args.end_date:
        try:
            args.end_date = date.fromisoformat(args.end_date)
        except ValueError:
            parser.error("--end-date must be YYYY-MM-DD")

    if args.start_date and args.end_date and args.start_date > args.end_date:
        parser.error("--start-date must be on or before --end-date")

    if args.league:
        try:
            validate_leagues(args.league)
        except ValueError as e:
            parser.error(str(e))

    return args


def main() -> int:
    """Main orchestration function. Returns exit code (0=success, 1=error)."""
    # Load env vars
    load_dotenv(Path(__file__).resolve().parent.parent / ".env.local")

    supabase_url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

    if not supabase_url or not supabase_key:
        print("ERROR: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY", file=sys.stderr)
        return 1

    # Parse args and create config
    args = parse_args()
    config = ScraperConfig(request_delay=args.delay)
    config.validate()

    # Setup logging
    logger = setup_logging(config)

    logger.info("=" * 60)
    logger.info(
        f"Football Scraper | Mode: {args.mode} | "
        f"{datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')}"
    )
    logger.info("=" * 60)

    # Initialize database
    db = FootballDatabase(supabase_url, supabase_key)

    # Counters for summary
    total_matches = 0
    total_reports_scraped = 0
    total_player_stats = 0
    total_standings = 0
    total_errors = 0

    try:
        # --- FIXTURES ---
        if args.mode in ("full", "schedule-only", "daily"):
            logger.info("\n--- Fixtures Scraping ---")
            matches = scrape_fixtures(config, logger)
            total_matches = len(matches)

            if matches:
                saved = db.upsert_matches(matches)
                logger.info(f"Fixtures: {total_matches} parsed, {saved} saved to DB")
            else:
                logger.info("Fixtures: 0 matches found")

        # --- BOXSCORES ---
        if args.mode in ("full", "boxscores-only", "daily"):
            logger.info("\n--- Match Report Scraping ---")

            start_date = args.start_date
            end_date = args.end_date

            if args.mode == "daily":
                start_date, end_date = calculate_daily_window()

            if args.mode == "full":
                # Full mode: scrape all completed matches, not just unscraped
                unscraped_only = False
            else:
                # boxscores-only and daily: only unscraped matches
                unscraped_only = True

            leagues_filter = args.league if args.league else None

            # Get completed matches from DB
            targets = db.get_completed_matches(
                start_date=start_date,
                end_date=end_date,
                leagues=leagues_filter,
                unscraped_only=unscraped_only,
                limit=config.max_matches_per_run,
            )

            if targets:
                logger.info(f"Found {len(targets)} matches for box score scraping")

                for match in targets:
                    match_url = match.get("match_url", "")
                    match_id = match.get("id")
                    home_team = match.get("home_team", "")
                    away_team = match.get("away_team", "")
                    match_date_str = match.get("match_date", "")

                    # Skip if stats already exist for this match (unless full mode)
                    if match_id and unscraped_only and db.match_has_stats(match_id):
                        continue

                    # Skip matches without a proper match report URL (fallback URLs)
                    if not match_url or not match_url.startswith("/"):
                        continue

                    # Construct full URL
                    url = MATCH_REPORT_URL_TEMPLATE.format(base=BASE_URL, match_url=match_url)

                    # Fetch the match report page
                    page = fetch_page(url, config, logger)

                    if page is None:
                        logger.error(f"Failed to fetch match report: {match_url}")
                        total_errors += 1
                        time.sleep(config.request_delay)
                        continue

                    # Parse player stats from the page
                    try:
                        stats = parse_match_report(
                            page, home_team, away_team, match_date_str, logger
                        )

                        if stats and match_id:
                            # Persist player stats to DB
                            inserted = db.insert_player_stats(match_id, stats)
                            total_player_stats += inserted

                            # Upsert player master records
                            for stat in stats:
                                player_record = {
                                    "player_fbref_id": stat.get("player_fbref_id", ""),
                                    "player_name": stat.get("player_name", ""),
                                    "current_team": stat.get("team", ""),
                                    "position": stat.get("position"),
                                    "nationality": None,
                                }
                                db.upsert_player(player_record)

                            total_reports_scraped += 1
                            logger.info(
                                f"  Match report {match_url}: "
                                f"{len(stats)} player stats inserted"
                            )
                        elif stats and not match_id:
                            logger.error(
                                f"  No match_id for {match_url}, cannot persist stats"
                            )
                            total_errors += 1
                        else:
                            logger.warning(
                                f"  No player stats found in match report: {match_url}"
                            )
                            total_errors += 1

                    except Exception as e:
                        logger.error(f"Error parsing match report {match_url}: {e}")
                        total_errors += 1

                    # Wait between requests to respect rate limiting
                    time.sleep(config.request_delay)
            else:
                logger.info("No matches found for box score scraping")

        # --- STANDINGS ---
        if args.mode in ("full", "daily", "standings-only"):
            logger.info("\n--- Standings Scraping ---")
            standings = scrape_standings(config, logger)

            if standings:
                saved = db.upsert_standings(standings)
                total_standings = saved
                logger.info(f"Standings: {len(standings)} parsed, {saved} saved to DB")
            else:
                logger.info("Standings: 0 teams found")

    except Exception as e:
        logger.error(f"Fatal error: {e}", exc_info=True)
        return 1

    # Log summary
    logger.info(f"\n{'=' * 60}")
    logger.info(
        f"Done | Matches: {total_matches} | Reports: {total_reports_scraped} | "
        f"Player stats: {total_player_stats} | Standings: {total_standings} | "
        f"Errors: {total_errors}"
    )
    logger.info("=" * 60)
    return 0


if __name__ == "__main__":
    sys.exit(main())
