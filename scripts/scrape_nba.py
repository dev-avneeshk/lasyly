"""
NBA Schedule & Box Score Scraper using Scrapling
Scrapes basketball-reference.com for the 2025-26 NBA season.

Usage:
  python scrape_nba.py <mode> [options]

Modes:
  full            - Scrape all schedule pages + all box scores + advanced stats + season stats
  schedule-only   - Scrape only schedule pages (Oct-May)
  boxscores-only  - Scrape box scores for completed games without stats
  daily           - Scrape current month schedule + last 2 days box scores
  advanced-stats  - Scrape shooting distribution + advanced metrics per player
  season-stats    - Scrape league-wide season stats (totals, per-game, per-36, per-100, advanced)
                    Includes both regular season and playoffs

Options:
  --start-date YYYY-MM-DD  Filter box scores from this date
  --end-date YYYY-MM-DD    Filter box scores until this date
  --delay SECONDS          Delay between requests (default: 3, range: 1-30)
  --limit N                Max number of box scores to scrape
  --stat-type TYPE         For season-stats mode: totals, per_game, per_36, per_poss, advanced, all (default: all)
  --dry-run                For season-stats mode: print demo data without writing to DB

Environment variables (from ../.env.local):
  NEXT_PUBLIC_SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
"""

import os
import re
import sys
import time
import math
import json
import argparse
import logging
from logging.handlers import RotatingFileHandler
from datetime import datetime, date, timedelta, timezone
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from scrapling.fetchers import Fetcher
from supabase import create_client, Client

# ============================================================
# Configuration
# ============================================================

BASE_URL = "https://www.basketball-reference.com"
SEASON = "2025-26"
SEASON_MONTHS = [
    "october", "november", "december",
    "january", "february", "march", "april", "may"
]

TEAM_ABBREVIATIONS = {
    "Atlanta Hawks": "ATL",
    "Boston Celtics": "BOS",
    "Brooklyn Nets": "BKN",
    "Charlotte Hornets": "CHA",
    "Chicago Bulls": "CHI",
    "Cleveland Cavaliers": "CLE",
    "Dallas Mavericks": "DAL",
    "Denver Nuggets": "DEN",
    "Detroit Pistons": "DET",
    "Golden State Warriors": "GSW",
    "Houston Rockets": "HOU",
    "Indiana Pacers": "IND",
    "Los Angeles Clippers": "LAC",
    "Los Angeles Lakers": "LAL",
    "Memphis Grizzlies": "MEM",
    "Miami Heat": "MIA",
    "Milwaukee Bucks": "MIL",
    "Minnesota Timberwolves": "MIN",
    "New Orleans Pelicans": "NOP",
    "New York Knicks": "NYK",
    "Oklahoma City Thunder": "OKC",
    "Orlando Magic": "ORL",
    "Philadelphia 76ers": "PHI",
    "Phoenix Suns": "PHX",
    "Portland Trail Blazers": "POR",
    "Sacramento Kings": "SAC",
    "San Antonio Spurs": "SAS",
    "Toronto Raptors": "TOR",
    "Utah Jazz": "UTA",
    "Washington Wizards": "WAS",
}


def get_team_abbr(team_name: str) -> str:
    """Get 3-letter abbreviation for a team name."""
    return TEAM_ABBREVIATIONS.get(team_name, team_name[:3].upper())


# ============================================================
# Logging
# ============================================================

def setup_logging() -> logging.Logger:
    """Configure logging with stdout + rotating file."""
    logger = logging.getLogger("nba_scraper")
    logger.setLevel(logging.INFO)

    fmt = logging.Formatter("%(asctime)s [%(levelname)s] %(message)s", datefmt="%Y-%m-%dT%H:%M:%SZ")

    stdout_handler = logging.StreamHandler(sys.stdout)
    stdout_handler.setFormatter(fmt)
    logger.addHandler(stdout_handler)

    log_path = Path(__file__).resolve().parent / "nba_scraper.log"
    file_handler = RotatingFileHandler(log_path, maxBytes=10_000_000, backupCount=5)
    file_handler.setFormatter(fmt)
    logger.addHandler(file_handler)

    return logger


# ============================================================
# Database
# ============================================================

class NBADatabase:
    def __init__(self, url: str, key: str):
        self.client: Client = create_client(url, key)
        self.logger = logging.getLogger("nba_scraper")

    def upsert_games(self, games: list[dict]) -> int:
        """Upsert game records in batches. Returns count saved."""
        count = 0
        batch_size = 100
        for i in range(0, len(games), batch_size):
            batch = games[i:i + batch_size]
            try:
                result = self.client.table("nba_games").upsert(
                    batch, on_conflict="game_url"
                ).execute()
                count += len(result.data) if result.data else 0
                self.logger.info(f"  DB: saved batch {i//batch_size + 1} ({count}/{len(games)} games)")
            except Exception as e:
                self.logger.error(f"DB batch upsert failed at index {i}: {e}")
                # Fallback to individual inserts for this batch
                for game in batch:
                    try:
                        result = self.client.table("nba_games").upsert(
                            game, on_conflict="game_url"
                        ).execute()
                        if result.data:
                            count += 1
                    except Exception as e2:
                        self.logger.error(f"DB upsert failed for {game.get('game_url')}: {e2}")
        return count

    def get_completed_games(
        self,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        unscraped_only: bool = False,
        limit: int = 500,
    ) -> list[dict]:
        """Query completed games matching filters."""
        if unscraped_only:
            scraped_ids = self._get_scraped_game_ids()

        # Fetch in batches to handle large result sets when filtering
        all_games = []
        offset = 0
        batch_size = 1000

        while True:
            query = self.client.table("nba_games").select("*").eq("status", "completed")
            if start_date:
                query = query.gte("game_date", start_date.isoformat())
            if end_date:
                query = query.lte("game_date", end_date.isoformat())
            query = query.order("game_date", desc=False).range(offset, offset + batch_size - 1)
            result = query.execute()
            rows = result.data or []

            for g in rows:
                if unscraped_only and g["id"] in scraped_ids:
                    continue
                all_games.append(g)
                if len(all_games) >= limit:
                    return all_games

            if len(rows) < batch_size:
                break
            offset += batch_size

        return all_games

    def _get_scraped_game_ids(self) -> set:
        """Get game IDs that already have player stats."""
        # Supabase default limit is 1000, need to paginate
        all_ids = set()
        offset = 0
        batch_size = 1000
        while True:
            result = (
                self.client.table("nba_player_stats")
                .select("game_id")
                .range(offset, offset + batch_size - 1)
                .execute()
            )
            rows = result.data or []
            for row in rows:
                all_ids.add(row["game_id"])
            if len(rows) < batch_size:
                break
            offset += batch_size
        return all_ids

    def insert_player_stats(self, game_id: str, stats: list[dict]) -> int:
        """Delete existing stats for game_id and insert new batch (idempotent)."""
        self.client.table("nba_player_stats").delete().eq("game_id", game_id).execute()
        count = 0
        for i in range(0, len(stats), 50):
            batch = stats[i:i + 50]
            result = self.client.table("nba_player_stats").insert(batch).execute()
            count += len(result.data) if result.data else 0
        return count

    def game_has_stats(self, game_id: str) -> bool:
        """Check if player stats exist for a game."""
        result = (
            self.client.table("nba_player_stats")
            .select("id", count="exact")
            .eq("game_id", game_id)
            .limit(1)
            .execute()
        )
        return (result.count or 0) > 0

    def record_line_history(self, player_name: str, sport: str, stat_category: str, line_value: float) -> bool:
        """
        Append a row to prop_line_history for a player-stat combination.
        Append-only: never updates existing rows.

        Requirements: 8.1, 8.5
        """
        try:
            self.client.table("prop_line_history").insert({
                "player_name": player_name,
                "sport": sport,
                "stat_category": stat_category,
                "line_value": line_value,
            }).execute()
            return True
        except Exception as e:
            self.logger.error(f"Failed to record line history for {player_name}/{stat_category}: {e}")
            return False

    def get_player_recent_stats(self, player_name: str, limit: int = 10) -> list[dict]:
        """Fetch the most recent game stats for a player, ordered by game date descending."""
        try:
            result = (
                self.client.table("nba_player_stats")
                .select("pts, trb, ast, tp, stl, blk, game_id")
                .eq("player_name", player_name)
                .order("game_id", desc=True)
                .limit(limit)
                .execute()
            )
            return result.data or []
        except Exception as e:
            self.logger.error(f"Failed to fetch recent stats for {player_name}: {e}")
            return []

    def get_distinct_player_names(self) -> list[str]:
        """Get distinct player names from nba_player_stats for the current season."""
        all_names = set()
        offset = 0
        batch_size = 1000
        while True:
            result = (
                self.client.table("nba_player_stats")
                .select("player_name")
                .range(offset, offset + batch_size - 1)
                .execute()
            )
            rows = result.data or []
            for row in rows:
                if row.get("player_name"):
                    all_names.add(row["player_name"])
            if len(rows) < batch_size:
                break
            offset += batch_size
        return sorted(all_names)

    def upsert_advanced_stats(self, record: dict) -> bool:
        """Upsert a single advanced stats record. Returns True on success."""
        try:
            self.client.table("nba_player_advanced_stats").upsert(
                record, on_conflict="player_name,season"
            ).execute()
            return True
        except Exception as e:
            self.logger.error(f"Failed to upsert advanced stats for {record.get('player_name')}: {e}")
            return False


# ============================================================
# Line History Recording
# ============================================================

# Stat categories that map to prop lines (matches TypeScript constants)
NBA_STAT_CATEGORIES = ["pts", "trb", "ast", "tp", "stl", "blk", "pra"]


def compute_median(values: list[float]) -> float:
    """Compute the median of a list of numbers."""
    if not values:
        return 0.0
    sorted_vals = sorted(values)
    n = len(sorted_vals)
    if n % 2 == 0:
        return (sorted_vals[n // 2 - 1] + sorted_vals[n // 2]) / 2
    return sorted_vals[n // 2]


def round_to_half(value: float) -> float:
    """Round a value to the nearest 0.5 (matches TypeScript Math.round(value * 2) / 2)."""
    return math.floor(value * 2 + 0.5) / 2


def get_stat_value(stat_row: dict, stat: str) -> float:
    """Extract a stat value from a player stats row."""
    if stat == "pts":
        return float(stat_row.get("pts") or 0)
    elif stat == "trb":
        return float(stat_row.get("trb") or 0)
    elif stat == "ast":
        return float(stat_row.get("ast") or 0)
    elif stat == "tp":
        return float(stat_row.get("tp") or 0)
    elif stat == "stl":
        return float(stat_row.get("stl") or 0)
    elif stat == "blk":
        return float(stat_row.get("blk") or 0)
    elif stat == "pra":
        return float(stat_row.get("pts") or 0) + float(stat_row.get("trb") or 0) + float(stat_row.get("ast") or 0)
    return 0.0


def record_prop_lines_for_players(players: list[str], db: NBADatabase, logger: logging.Logger) -> int:
    """
    Compute and record prop lines for a list of players.
    For each player-stat combination, computes the median of the last 10 games
    (rounded to nearest 0.5) and inserts into prop_line_history.

    Append-only: only inserts new rows, never updates existing ones.

    Returns the number of line history records inserted.
    """
    recorded = 0

    for player_name in players:
        recent_stats = db.get_player_recent_stats(player_name, limit=10)
        if len(recent_stats) < 3:
            # Skip players with insufficient data (matches TypeScript MIN_GAMES)
            continue

        for stat in NBA_STAT_CATEGORIES:
            values = [get_stat_value(row, stat) for row in recent_stats]
            prop_line = round_to_half(compute_median(values))

            # Skip meaningless prop lines (0 or negative)
            if prop_line <= 0:
                continue

            if db.record_line_history(player_name, "NBA", stat, prop_line):
                recorded += 1

    return recorded


# ============================================================
# Schedule Scraping
# ============================================================

def scrape_schedule(months: list[str], delay: float, logger: logging.Logger) -> list[dict]:
    """Scrape schedule pages for given months."""
    all_games = []

    for month in months:
        url = f"{BASE_URL}/leagues/NBA_2026_games-{month}.html"
        logger.info(f"Fetching schedule: {month.capitalize()}")

        retries = 0
        while retries < 3:
            try:
                page = Fetcher.get(url, stealthy_headers=True, timeout=30)

                if page.status == 200:
                    games = parse_schedule_page(page, logger)
                    logger.info(f"  {month.capitalize()}: {len(games)} games parsed")
                    all_games.extend(games)
                    break
                elif page.status == 429:
                    retries += 1
                    logger.warning(f"  Rate limited. Waiting 60s (retry {retries}/3)")
                    time.sleep(60)
                elif page.status >= 500:
                    retries += 1
                    logger.warning(f"  Server error {page.status}. Waiting 60s (retry {retries}/3)")
                    time.sleep(60)
                else:
                    logger.error(f"  HTTP {page.status} for {month} - skipping")
                    break
            except Exception as e:
                logger.error(f"  Error fetching {month}: {e}")
                break

        time.sleep(delay)

    return all_games


def parse_schedule_page(page, logger: logging.Logger) -> list[dict]:
    """Parse a schedule page HTML into game dicts."""
    games = []

    tables = page.css("table#schedule")
    if not len(tables):
        logger.warning("  No schedule table found")
        return games

    table = tables.first
    rows = table.css("tbody tr:not(.thead)")

    for row in rows:
        # Skip mid-table header rows
        if len(row.css("th[colspan]")):
            continue

        date_cells = row.css('th[data-stat="date_game"]')
        if not len(date_cells):
            continue

        date_cell = date_cells.first

        # Date text is inside <a> tag
        date_links = date_cell.css("a")
        date_text = date_links.first.text.strip() if len(date_links) else date_cell.text.strip()
        if not date_text:
            continue

        # Parse date
        try:
            game_date = datetime.strptime(date_text, "%a, %b %d, %Y").strftime("%Y-%m-%d")
        except ValueError:
            try:
                game_date = datetime.strptime(date_text, "%B %d, %Y").strftime("%Y-%m-%d")
            except ValueError:
                continue

        # Teams (text inside <a> tags)
        away_cells = row.css('td[data-stat="visitor_team_name"]')
        home_cells = row.css('td[data-stat="home_team_name"]')
        if not len(away_cells) or not len(home_cells):
            continue

        away_links = away_cells.first.css("a")
        home_links = home_cells.first.css("a")
        away_team = away_links.first.text.strip() if len(away_links) else away_cells.first.text.strip()
        home_team = home_links.first.text.strip() if len(home_links) else home_cells.first.text.strip()

        if not away_team or not home_team:
            continue

        # Scores (plain text)
        away_score = None
        home_score = None
        pts_v = row.css('td[data-stat="visitor_pts"]')
        pts_h = row.css('td[data-stat="home_pts"]')
        if len(pts_v) and pts_v.first.text.strip():
            try:
                away_score = int(pts_v.first.text.strip())
            except ValueError:
                pass
        if len(pts_h) and pts_h.first.text.strip():
            try:
                home_score = int(pts_h.first.text.strip())
            except ValueError:
                pass

        # Status
        if away_score is not None and home_score is not None:
            status = "completed"
        else:
            status = "scheduled"
            away_score = None
            home_score = None

        # Box score URL slug
        box_links = row.css('td[data-stat="box_score_text"] a')
        if len(box_links):
            href = box_links.first.attrib.get("href", "")
            # /boxscores/202510210OKC.html -> 202510210OKC
            game_url = href.replace("/boxscores/", "").replace(".html", "")
        else:
            # Generate fallback
            home_abbr = get_team_abbr(home_team)
            game_url = f"{game_date.replace('-', '')}0{home_abbr}"

        games.append({
            "game_date": game_date,
            "game_url": game_url,
            "home_team": home_team,
            "away_team": away_team,
            "home_score": home_score,
            "away_score": away_score,
            "status": status,
            "season": SEASON,
        })

    return games


# ============================================================
# Box Score Scraping
# ============================================================

def scrape_boxscores(
    games: list[dict], delay: float, db: NBADatabase, logger: logging.Logger
) -> tuple[int, int]:
    """Scrape box scores. Returns (success_count, error_count)."""
    success_count = 0
    error_count = 0
    players_to_record: set[str] = set()

    for i, game in enumerate(games):
        game_url = game["game_url"]
        game_id = game["id"]

        if db.game_has_stats(game_id):
            logger.info(f"  [{i+1}/{len(games)}] Skip {game_url} (has stats)")
            continue

        full_url = f"{BASE_URL}/boxscores/{game_url}.html"
        logger.info(f"  [{i+1}/{len(games)}] {game['away_team']} @ {game['home_team']} ({game['game_date']})")

        retries = 0
        while retries < 3:
            try:
                page = Fetcher.get(full_url, stealthy_headers=True, timeout=30)

                if page.status == 200:
                    stats = parse_boxscore_page(page, game_id, game["home_team"], game["away_team"])
                    if stats:
                        count = db.insert_player_stats(game_id, stats)
                        logger.info(f"    ✓ {count} player stats saved")
                        success_count += 1
                        # Collect player names for line history recording
                        for s in stats:
                            if s.get("player_name"):
                                players_to_record.add(s["player_name"])
                    else:
                        logger.warning(f"    ⚠ No stats found")
                    break
                elif page.status == 429:
                    retries += 1
                    logger.warning(f"    429 rate limited. Waiting 60s ({retries}/3)")
                    time.sleep(60)
                elif page.status >= 500:
                    retries += 1
                    logger.warning(f"    {page.status} server error. Waiting 60s ({retries}/3)")
                    time.sleep(60)
                else:
                    logger.error(f"    HTTP {page.status} - skipping")
                    error_count += 1
                    break
            except Exception as e:
                logger.error(f"    Error: {e}")
                error_count += 1
                break

        if retries >= 3:
            logger.error(f"    Max retries for {game_url}")
            error_count += 1

        time.sleep(delay)

    # Record prop line history for all players whose stats were updated
    if players_to_record:
        logger.info(f"\n--- Recording Line History for {len(players_to_record)} players ---")
        recorded = record_prop_lines_for_players(list(players_to_record), db, logger)
        logger.info(f"  Recorded {recorded} prop line history entries")

    return success_count, error_count


def parse_boxscore_page(page, game_id: str, home_team: str, away_team: str) -> list[dict]:
    """Parse box score page into player stat dicts."""
    player_stats = []

    tables = page.css("table[id*='game-basic']")
    if not len(tables):
        return player_stats

    for table_idx in range(min(len(tables), 2)):
        table = tables[table_idx]

        # First table = away, second = home
        if table_idx == 0:
            team, opponent = away_team, home_team
        else:
            team, opponent = home_team, away_team

        team_abbr = get_team_abbr(team)
        opp_abbr = get_team_abbr(opponent)

        tbody_list = table.css("tbody")
        if not len(tbody_list):
            continue

        rows = tbody_list.first.css("tr")
        starter_count = 0

        for row in rows:
            # Skip separator rows
            if len(row.css("td[colspan]")) or len(row.css("th[colspan]")):
                continue

            # Player name (inside <a> tag)
            player_cells = row.css('th[data-stat="player"]')
            if not len(player_cells):
                continue

            player_cell = player_cells.first
            player_links = player_cell.css("a")
            player_name = player_links.first.text.strip() if len(player_links) else player_cell.text.strip()

            if not player_name or player_name in ("Reserves", "Team Totals"):
                continue

            # Check DNP reason
            reason_cells = row.css('td[data-stat="reason"]')
            if len(reason_cells) and reason_cells.first.text.strip():
                continue

            # Minutes
            mp_cells = row.css('td[data-stat="mp"]')
            minutes = mp_cells.first.text.strip() if len(mp_cells) else ""

            if not minutes or minutes in ("Did Not Play", "Did Not Dress", "Not With Team", "Player Suspended"):
                continue

            # Starter = first 5 players
            is_starter = starter_count < 5
            starter_count += 1

            # Stat extraction helper
            def get_stat(stat_name: str, as_int: bool = True):
                cells = row.css(f'td[data-stat="{stat_name}"]')
                if not len(cells):
                    return None
                text = cells.first.text.strip()
                if not text or text == "-":
                    return None
                try:
                    return int(text) if as_int else float(text)
                except (ValueError, TypeError):
                    return None

            player_stats.append({
                "game_id": game_id,
                "player_name": player_name,
                "team": team_abbr,
                "opponent": opp_abbr,
                "is_starter": is_starter,
                "minutes": minutes,
                "fg": get_stat("fg") or 0,
                "fga": get_stat("fga") or 0,
                "fg_pct": get_stat("fg_pct", as_int=False),
                "tp": get_stat("fg3") or 0,
                "tpa": get_stat("fg3a") or 0,
                "tp_pct": get_stat("fg3_pct", as_int=False),
                "ft": get_stat("ft") or 0,
                "fta": get_stat("fta") or 0,
                "ft_pct": get_stat("ft_pct", as_int=False),
                "orb": get_stat("orb") or 0,
                "drb": get_stat("drb") or 0,
                "trb": get_stat("trb") or 0,
                "ast": get_stat("ast") or 0,
                "stl": get_stat("stl") or 0,
                "blk": get_stat("blk") or 0,
                "tov": get_stat("tov") or 0,
                "pf": get_stat("pf") or 0,
                "pts": get_stat("pts") or 0,
                "plus_minus": get_stat("plus_minus"),
                "game_score": get_stat("game_score", as_int=False),
            })

    return player_stats


# ============================================================
# Advanced Stats Scraping
# ============================================================

def name_to_player_id(player_name: str) -> str:
    """
    Convert a player name to a Basketball Reference player ID.
    
    Basketball Reference uses the format: first 5 chars of last name + first 2 chars of first name + suffix.
    Example: "LeBron James" -> "jamesle01"
    Example: "Stephen Curry" -> "curryst01"
    
    We use the suffix "01" as default. If the page 404s, we don't retry with other suffixes
    since we can't know the correct one without a lookup table.
    """
    parts = player_name.strip().split()
    if len(parts) < 2:
        return ""
    
    first_name = parts[0]
    last_name = parts[-1]
    
    # Remove non-alpha characters (accents handled by keeping ascii-compatible chars)
    first_clean = re.sub(r"[^a-zA-Z]", "", first_name).lower()
    last_clean = re.sub(r"[^a-zA-Z]", "", last_name).lower()
    
    if not first_clean or not last_clean:
        return ""
    
    # Standard format: first 5 of last + first 2 of first + "01"
    player_id = last_clean[:5] + first_clean[:2] + "01"
    return player_id


def get_player_letter(player_name: str) -> str:
    """Get the first letter of the player's last name for URL construction."""
    parts = player_name.strip().split()
    if len(parts) < 2:
        return ""
    last_name = parts[-1]
    clean = re.sub(r"[^a-zA-Z]", "", last_name).lower()
    return clean[0] if clean else ""


def fetch_with_retry(url: str, logger: logging.Logger, timeout: int = 30):
    """
    Fetch a URL with retry logic for 429 and 5xx errors.
    Returns the page object on success, or None on failure.
    """
    retries = 0
    while retries < 3:
        try:
            page = Fetcher.get(url, stealthy_headers=True, timeout=timeout)

            if page.status == 200:
                return page
            elif page.status == 429:
                retries += 1
                logger.warning(f"    Rate limited (429). Waiting 60s (retry {retries}/3)")
                time.sleep(60)
            elif page.status >= 500:
                retries += 1
                logger.warning(f"    Server error ({page.status}). Waiting 60s (retry {retries}/3)")
                time.sleep(60)
            elif page.status == 404:
                logger.info(f"    404 Not Found: {url}")
                return None
            else:
                logger.error(f"    HTTP {page.status} for {url} - skipping")
                return None
        except Exception as e:
            # Treat timeouts and connection errors as retryable
            retries += 1
            logger.warning(f"    Request error: {e}. Waiting 60s (retry {retries}/3)")
            time.sleep(60)

    logger.error(f"    Max retries (3) reached for {url}")
    return None


def parse_shooting_stats(page, logger: logging.Logger) -> dict:
    """
    Parse the Basketball Reference Shooting page for a player.
    Extracts: % of FGA by distance and % assisted for 2P and 3P.
    
    Returns dict with keys matching nba_player_advanced_stats columns.
    Missing values are None.
    """
    stats = {
        "fga_pct_0_3ft": None,
        "fga_pct_3_10ft": None,
        "fga_pct_10_16ft": None,
        "fga_pct_16_3pt": None,
        "fga_pct_3pt": None,
        "pct_2p_assisted": None,
        "pct_3p_assisted": None,
    }

    # The shooting page has a table with id "shooting"
    tables = page.css("table#shooting")
    if not len(tables):
        logger.info("      No shooting table found")
        return stats

    table = tables.first
    
    # Look for the current season row in the footer/totals or the last row in tbody
    # The shooting table has season rows in tbody
    rows = table.css("tbody tr:not(.thead)")
    if not len(rows):
        return stats

    # Get the last (most recent season) row
    target_row = None
    for row in rows:
        # Skip partial/mid-table header rows
        if len(row.css("th[colspan]")) or len(row.css("td[colspan]")):
            continue
        target_row = row

    if not target_row:
        return stats

    def get_pct_stat(stat_name: str) -> float | None:
        cells = target_row.css(f'td[data-stat="{stat_name}"]')
        if not len(cells):
            return None
        text = cells.first.text.strip()
        if not text or text == "-" or text == "":
            return None
        try:
            # Basketball Reference stores these as decimals (e.g., .456)
            # Convert to percentage (0-100)
            val = float(text)
            if val <= 1.0:
                return round(val * 100, 1)
            return round(val, 1)
        except (ValueError, TypeError):
            return None

    # % of FGA by distance
    stats["fga_pct_0_3ft"] = get_pct_stat("pct_fga_00_03")
    stats["fga_pct_3_10ft"] = get_pct_stat("pct_fga_03_10")
    stats["fga_pct_10_16ft"] = get_pct_stat("pct_fga_10_16")
    stats["fga_pct_16_3pt"] = get_pct_stat("pct_fga_16_xx")
    stats["fga_pct_3pt"] = get_pct_stat("pct_fga_3p")

    # % of FG that are assisted
    stats["pct_2p_assisted"] = get_pct_stat("pct_ast_2p")
    stats["pct_3p_assisted"] = get_pct_stat("pct_ast_3p")

    return stats


def parse_advanced_stats(page, logger: logging.Logger) -> dict:
    """
    Parse the Basketball Reference Advanced table from a player's main page.
    Extracts: TRB%, ORB%, DRB%, AST%, and PGA (if available).
    
    Returns dict with keys matching nba_player_advanced_stats columns.
    Missing values are None.
    """
    stats = {
        "trb_pct": None,
        "orb_pct": None,
        "drb_pct": None,
        "ast_pct": None,
        "pga": None,
        "games_played": None,
    }

    # The advanced table has id "advanced"
    tables = page.css("table#advanced")
    if not len(tables):
        logger.info("      No advanced table found")
        return stats

    table = tables.first
    rows = table.css("tbody tr:not(.thead)")
    if not len(rows):
        return stats

    # Get the last (most recent season) row
    target_row = None
    for row in rows:
        if len(row.css("th[colspan]")) or len(row.css("td[colspan]")):
            continue
        target_row = row

    if not target_row:
        return stats

    def get_stat(stat_name: str) -> float | None:
        cells = target_row.css(f'td[data-stat="{stat_name}"]')
        if not len(cells):
            return None
        text = cells.first.text.strip()
        if not text or text == "-" or text == "":
            return None
        try:
            return float(text)
        except (ValueError, TypeError):
            return None

    def get_int_stat(stat_name: str) -> int | None:
        cells = target_row.css(f'td[data-stat="{stat_name}"]')
        if not len(cells):
            return None
        text = cells.first.text.strip()
        if not text or text == "-" or text == "":
            return None
        try:
            return int(text)
        except (ValueError, TypeError):
            return None

    # These are already percentages on Basketball Reference (e.g., 15.2 means 15.2%)
    stats["trb_pct"] = get_stat("trb_pct")
    stats["orb_pct"] = get_stat("orb_pct")
    stats["drb_pct"] = get_stat("drb_pct")
    stats["ast_pct"] = get_stat("ast_pct")
    stats["games_played"] = get_int_stat("g")

    # PGA (Potential Game Assists) - may not be present on all pages
    # It's sometimes in the "play-by-play" or "passing" table instead
    stats["pga"] = get_stat("pga")

    return stats


def scrape_advanced_stats(
    db: NBADatabase, delay: float, season: str, logger: logging.Logger
) -> tuple[int, int]:
    """
    Scrape advanced stats (shooting distribution + advanced metrics) for all players
    in the current season's nba_player_stats table.
    
    Returns (success_count, error_count).
    """
    logger.info("\n--- Advanced Stats Scraping ---")

    # Get distinct player names from the database
    player_names = db.get_distinct_player_names()
    logger.info(f"Found {len(player_names)} distinct players to scrape")

    if not player_names:
        logger.warning("No players found in nba_player_stats")
        return 0, 0

    # Determine the season year for URLs (e.g., "2025-26" -> 2026)
    try:
        season_year = int(season.split("-")[0]) + 1
    except (ValueError, IndexError):
        logger.error(f"Invalid season format: {season}")
        return 0, 0

    success_count = 0
    error_count = 0
    now = datetime.now(timezone.utc).isoformat()

    for i, player_name in enumerate(player_names):
        player_id = name_to_player_id(player_name)
        letter = get_player_letter(player_name)

        if not player_id or not letter:
            logger.warning(f"  [{i+1}/{len(player_names)}] Cannot derive player ID for: {player_name}")
            error_count += 1
            continue

        logger.info(f"  [{i+1}/{len(player_names)}] {player_name} ({player_id})")

        # Initialize combined stats record
        combined_stats = {
            "player_name": player_name,
            "season": season,
            "scraped_at": now,
        }

        # --- Scrape Shooting page ---
        shooting_url = f"{BASE_URL}/players/{letter}/{player_id}/shooting/{season_year}.html"
        logger.info(f"    Fetching shooting stats: {shooting_url}")

        shooting_page = fetch_with_retry(shooting_url, logger, timeout=30)
        if shooting_page:
            shooting_stats = parse_shooting_stats(shooting_page, logger)
            combined_stats.update(shooting_stats)
            logger.info(f"    ✓ Shooting stats parsed")
        else:
            logger.info(f"    ⚠ Shooting page unavailable")
            # Store NULLs for shooting fields
            combined_stats.update({
                "fga_pct_0_3ft": None,
                "fga_pct_3_10ft": None,
                "fga_pct_10_16ft": None,
                "fga_pct_16_3pt": None,
                "fga_pct_3pt": None,
                "pct_2p_assisted": None,
                "pct_3p_assisted": None,
            })

        time.sleep(delay)

        # --- Scrape Advanced table from main player page ---
        advanced_url = f"{BASE_URL}/players/{letter}/{player_id}.html"
        logger.info(f"    Fetching advanced stats: {advanced_url}")

        advanced_page = fetch_with_retry(advanced_url, logger, timeout=30)
        if advanced_page:
            advanced_stats = parse_advanced_stats(advanced_page, logger)
            combined_stats.update(advanced_stats)
            logger.info(f"    ✓ Advanced stats parsed")
        else:
            logger.info(f"    ⚠ Advanced page unavailable")
            # Store NULLs for advanced fields
            combined_stats.update({
                "trb_pct": None,
                "orb_pct": None,
                "drb_pct": None,
                "ast_pct": None,
                "pga": None,
                "games_played": None,
            })

        time.sleep(delay)

        # --- Upsert into nba_player_advanced_stats ---
        if db.upsert_advanced_stats(combined_stats):
            success_count += 1
        else:
            error_count += 1

    logger.info(f"\nAdvanced stats complete: {success_count} success, {error_count} errors")
    return success_count, error_count


# ============================================================
# Season Stats Scraping (League-Wide Totals/Per-Game/Per-36/Per-100/Advanced)
# ============================================================

# Stat type configurations: (url_suffix, table_id_regular, table_id_playoffs)
SEASON_STAT_TYPES = {
    "totals": {
        "url": "totals",
        "table_regular": "totals_stats",
        "table_playoffs": "totals_stats_post",
    },
    "per_game": {
        "url": "per_game",
        "table_regular": "per_game_stats",
        "table_playoffs": "per_game_stats_post",
    },
    "per_36": {
        "url": "per_minute",
        "table_regular": "per_minute_stats",
        "table_playoffs": "per_minute_stats_post",
    },
    "per_poss": {
        "url": "per_poss",
        "table_regular": "per_poss",
        "table_playoffs": "per_poss_post",
    },
    "advanced": {
        "url": "advanced",
        "table_regular": "advanced",
        "table_playoffs": "advanced_post",
    },
}

# Columns to extract per stat type
SEASON_TOTALS_COLUMNS = [
    "name_display", "age", "team_name_abbr", "pos", "games", "games_started",
    "mp", "fg", "fga", "fg_pct", "fg3", "fg3a", "fg3_pct", "fg2", "fg2a",
    "fg2_pct", "efg_pct", "ft", "fta", "ft_pct", "orb", "drb", "trb",
    "ast", "stl", "blk", "tov", "pf", "pts", "tpl_dbl",
]

SEASON_PER_GAME_COLUMNS = [
    "name_display", "age", "team_name_abbr", "pos", "games", "games_started",
    "mp_per_g", "fg_per_g", "fga_per_g", "fg_pct", "fg3_per_g", "fg3a_per_g",
    "fg3_pct", "fg2_per_g", "fg2a_per_g", "fg2_pct", "efg_pct", "ft_per_g",
    "fta_per_g", "ft_pct", "orb_per_g", "drb_per_g", "trb_per_g", "ast_per_g",
    "stl_per_g", "blk_per_g", "tov_per_g", "pf_per_g", "pts_per_g",
]

SEASON_PER_36_COLUMNS = [
    "name_display", "age", "team_name_abbr", "pos", "games", "games_started",
    "mp", "fg_per_mp", "fga_per_mp", "fg_pct", "fg3_per_mp", "fg3a_per_mp",
    "fg3_pct", "fg2_per_mp", "fg2a_per_mp", "fg2_pct", "efg_pct", "ft_per_mp",
    "fta_per_mp", "ft_pct", "orb_per_mp", "drb_per_mp", "trb_per_mp",
    "ast_per_mp", "stl_per_mp", "blk_per_mp", "tov_per_mp", "pf_per_mp",
    "pts_per_mp",
]

SEASON_PER_POSS_COLUMNS = [
    "name_display", "age", "team_name_abbr", "pos", "games", "games_started",
    "mp", "fg_per_poss", "fga_per_poss", "fg_pct", "fg3_per_poss",
    "fg3a_per_poss", "fg3_pct", "fg2_per_poss", "fg2a_per_poss", "fg2_pct",
    "efg_pct", "ft_per_poss", "fta_per_poss", "ft_pct", "orb_per_poss",
    "drb_per_poss", "trb_per_poss", "ast_per_poss", "stl_per_poss",
    "blk_per_poss", "tov_per_poss", "pf_per_poss", "pts_per_poss",
    "off_rtg", "def_rtg",
]

SEASON_ADVANCED_COLUMNS = [
    "name_display", "age", "team_name_abbr", "pos", "games", "games_started",
    "mp", "per", "ts_pct", "fg3a_per_fga_pct", "fta_per_fga_pct",
    "orb_pct", "drb_pct", "trb_pct", "ast_pct", "stl_pct", "blk_pct",
    "tov_pct", "usg_pct", "ows", "dws", "ws", "ws_per_48",
    "obpm", "dbpm", "bpm", "vorp",
]

SEASON_COLUMNS_BY_TYPE = {
    "totals": SEASON_TOTALS_COLUMNS,
    "per_game": SEASON_PER_GAME_COLUMNS,
    "per_36": SEASON_PER_36_COLUMNS,
    "per_poss": SEASON_PER_POSS_COLUMNS,
    "advanced": SEASON_ADVANCED_COLUMNS,
}


def parse_season_stats_table(page, table_id: str, stat_type: str, logger: logging.Logger) -> list[dict]:
    """
    Parse a player stats table from a Basketball Reference league page.
    Returns list of player stat dicts.
    """
    tables = page.css(f"table#{table_id}")
    if not len(tables):
        logger.warning(f"  Table '{table_id}' not found on page")
        return []

    table = tables.first
    rows = table.css("tbody tr:not(.thead)")
    columns = SEASON_COLUMNS_BY_TYPE.get(stat_type, SEASON_TOTALS_COLUMNS)

    players = []
    for row in rows:
        if len(row.css("th[colspan]")):
            continue

        rank_cell = row.css('th[data-stat="ranker"]')
        rank = rank_cell.first.text.strip() if len(rank_cell) else ""

        player_data = {"rank": rank}

        for col in columns:
            cells = row.css(f'td[data-stat="{col}"]')
            if not len(cells):
                player_data[col] = None
                continue

            cell = cells.first
            links = cell.css("a")
            if len(links):
                player_data[col] = links.first.text.strip()
            else:
                text = cell.text.strip() if cell.text else ""
                player_data[col] = text if text else None

        if not player_data.get("name_display"):
            continue

        players.append(player_data)

    return players


def scrape_season_stat_type(
    stat_type: str,
    season_year: int,
    delay: float,
    logger: logging.Logger,
) -> dict:
    """
    Scrape a single stat type (regular season + playoffs from same page).
    Returns dict with 'regular_season' and 'playoffs' keys.
    """
    config = SEASON_STAT_TYPES[stat_type]
    result = {"regular_season": [], "playoffs": []}

    url = f"{BASE_URL}/leagues/NBA_{season_year}_{config['url']}.html"
    logger.info(f"  Fetching {stat_type}: {url}")

    page = fetch_with_retry(url, logger, timeout=30)
    if page:
        players = parse_season_stats_table(page, config["table_regular"], stat_type, logger)
        result["regular_season"] = players
        logger.info(f"    Regular season: {len(players)} players")

        playoff_players = parse_season_stats_table(page, config["table_playoffs"], stat_type, logger)
        result["playoffs"] = playoff_players
        logger.info(f"    Playoffs: {len(playoff_players)} players")

    time.sleep(delay)
    return result


def build_season_stats_db_records(all_data: dict, season: str) -> list[dict]:
    """Build database records from scraped season stats data."""
    records = []
    now = datetime.now(timezone.utc).isoformat()

    for stat_type, data in all_data.items():
        for player in data.get("regular_season", []):
            record = {
                "player_name": player.get("name_display"),
                "team": player.get("team_name_abbr"),
                "position": player.get("pos"),
                "age": player.get("age"),
                "games": player.get("games"),
                "games_started": player.get("games_started"),
                "stat_type": stat_type,
                "is_playoff": False,
                "season": season,
                "scraped_at": now,
                "stats": {k: v for k, v in player.items()
                          if k not in ("name_display", "team_name_abbr", "pos", "age",
                                       "games", "games_started", "rank")},
            }
            records.append(record)

        for player in data.get("playoffs", []):
            record = {
                "player_name": player.get("name_display"),
                "team": player.get("team_name_abbr"),
                "position": player.get("pos"),
                "age": player.get("age"),
                "games": player.get("games"),
                "games_started": player.get("games_started"),
                "stat_type": stat_type,
                "is_playoff": True,
                "season": season,
                "scraped_at": now,
                "stats": {k: v for k, v in player.items()
                          if k not in ("name_display", "team_name_abbr", "pos", "age",
                                       "games", "games_started", "rank")},
            }
            records.append(record)

    return records


def upsert_season_stats(db_client: Client, records: list[dict], logger: logging.Logger) -> int:
    """Upsert player season stats records. Returns count saved."""
    if not records:
        return 0

    count = 0
    batch_size = 50

    for i in range(0, len(records), batch_size):
        batch = records[i:i + batch_size]
        try:
            result = db_client.table("nba_player_season_stats").upsert(
                batch, on_conflict="player_name,team,stat_type,is_playoff,season"
            ).execute()
            count += len(result.data) if result.data else 0
        except Exception as e:
            logger.error(f"  DB upsert failed at batch {i // batch_size + 1}: {e}")
            for record in batch:
                try:
                    result = db_client.table("nba_player_season_stats").upsert(
                        record, on_conflict="player_name,team,stat_type,is_playoff,season"
                    ).execute()
                    if result.data:
                        count += 1
                except Exception as e2:
                    logger.error(f"  Individual upsert failed for {record.get('player_name')}: {e2}")

    return count


def scrape_season_stats(
    db: NBADatabase,
    delay: float,
    season: str,
    logger: logging.Logger,
    stat_types: list[str] | None = None,
    dry_run: bool = False,
) -> tuple[int, int]:
    """
    Scrape league-wide season stats (all stat types, regular + playoffs).
    Returns (success_count, error_count).
    """
    logger.info("\n--- Season Stats Scraping ---")

    try:
        season_year = int(season.split("-")[0]) + 1
    except (ValueError, IndexError):
        logger.error(f"Invalid season format: {season}")
        return 0, 1

    types_to_scrape = stat_types or list(SEASON_STAT_TYPES.keys())
    all_data = {}

    for stat_type in types_to_scrape:
        logger.info(f"\n  --- {stat_type.upper()} ---")
        data = scrape_season_stat_type(stat_type, season_year, delay, logger)
        all_data[stat_type] = data

    total_regular = sum(len(d.get("regular_season", [])) for d in all_data.values())
    total_playoffs = sum(len(d.get("playoffs", [])) for d in all_data.values())

    logger.info(f"\n  Season stats scraped:")
    logger.info(f"    Regular season: {total_regular} player records")
    logger.info(f"    Playoffs: {total_playoffs} player records")
    logger.info(f"    Total: {total_regular + total_playoffs}")

    if dry_run:
        # Save demo data to file
        demo = {
            "scrape_timestamp": datetime.now(timezone.utc).isoformat(),
            "season": season,
            "summary": {
                "stat_types_scraped": types_to_scrape,
                "regular_season_players": total_regular,
                "playoff_players": total_playoffs,
            },
        }
        for stat_type, data in all_data.items():
            demo[f"{stat_type}_regular_season_top10"] = data.get("regular_season", [])[:10]
            demo[f"{stat_type}_playoffs_top10"] = data.get("playoffs", [])[:10]

        output_path = Path(__file__).resolve().parent / "demo_nba_stats.json"
        with open(output_path, "w") as f:
            json.dump(demo, f, indent=2)
        logger.info(f"  Demo data saved to: {output_path}")
        return total_regular + total_playoffs, 0

    # Build and upsert DB records
    records = build_season_stats_db_records(all_data, season)
    logger.info(f"  Built {len(records)} DB records")

    saved = upsert_season_stats(db.client, records, logger)
    logger.info(f"  Saved {saved} records to nba_player_season_stats")

    return saved, 0


# ============================================================
# Main
# ============================================================

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="NBA 2025-26 Scraper")
    parser.add_argument("mode", choices=["full", "schedule-only", "boxscores-only", "daily", "advanced-stats", "season-stats"])
    parser.add_argument("--start-date", type=str, default=None)
    parser.add_argument("--end-date", type=str, default=None)
    parser.add_argument("--delay", type=float, default=3.0)
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--stat-type", type=str, default="all",
                        choices=["all", "totals", "per_game", "per_36", "per_poss", "advanced"],
                        help="For season-stats mode: which stat type to scrape (default: all)")
    parser.add_argument("--dry-run", action="store_true",
                        help="For season-stats mode: print demo data without writing to DB")

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

    return args


def main() -> int:
    args = parse_args()
    logger = setup_logging()

    logger.info("=" * 60)
    logger.info(f"NBA Scraper | Mode: {args.mode} | {datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')}")
    logger.info("=" * 60)

    # Load env
    env_path = Path(__file__).resolve().parent.parent / ".env.local"
    load_dotenv(env_path)

    supabase_url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

    if not supabase_url or not supabase_key:
        logger.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
        return 1

    db = NBADatabase(supabase_url, supabase_key)

    total_games_parsed = 0
    total_games_saved = 0
    total_boxscores = 0
    total_errors = 0

    try:
        # Schedule
        if args.mode in ("full", "schedule-only", "daily"):
            if args.mode == "daily":
                months = [datetime.now(timezone.utc).strftime("%B").lower()]
            else:
                months = SEASON_MONTHS

            logger.info(f"\n--- Schedule: {', '.join(m.capitalize() for m in months)} ---")
            games = scrape_schedule(months, args.delay, logger)
            total_games_parsed = len(games)

            if games:
                saved = db.upsert_games(games)
                total_games_saved = saved
                logger.info(f"Saved {saved} games to DB")

        # Box scores
        if args.mode in ("full", "boxscores-only", "daily"):
            logger.info("\n--- Box Scores ---")

            start_date = args.start_date
            end_date = args.end_date

            if args.mode == "daily":
                today = datetime.now(timezone.utc).date()
                start_date = today - timedelta(days=2)
                end_date = today

            unscraped_only = args.mode in ("boxscores-only", "daily")

            targets = db.get_completed_games(
                start_date=start_date,
                end_date=end_date,
                unscraped_only=unscraped_only,
                limit=args.limit or 500,
            )

            if targets:
                logger.info(f"Found {len(targets)} games to scrape")
                success, errors = scrape_boxscores(targets, args.delay, db, logger)
                total_boxscores = success
                total_errors += errors
            else:
                logger.info("No games to scrape")

        # Advanced stats (legacy - scrapes individual player pages, slow)
        # Only runs if explicitly requested, NOT part of 'full' anymore
        if args.mode == "advanced-stats":
            adv_delay = max(args.delay, 3.0)  # Enforce minimum 3s delay
            adv_success, adv_errors = scrape_advanced_stats(db, adv_delay, SEASON, logger)
            total_errors += adv_errors

        # Season stats (league-wide totals/per-game/per-36/per-100/advanced + playoffs)
        # This replaces advanced-stats for the 'full' run — 5 requests instead of 800+
        if args.mode in ("full", "season-stats"):
            ss_delay = max(args.delay, 3.0)
            stat_types = None if args.stat_type == "all" else [args.stat_type]
            ss_success, ss_errors = scrape_season_stats(
                db, ss_delay, SEASON, logger,
                stat_types=stat_types,
                dry_run=args.dry_run,
            )
            total_errors += ss_errors

    except Exception as e:
        logger.error(f"Fatal: {e}", exc_info=True)
        return 1

    logger.info(f"\n{'=' * 60}")
    logger.info(f"Done | Games: {total_games_parsed} parsed, {total_games_saved} saved | Box scores: {total_boxscores} | Errors: {total_errors}")
    logger.info("=" * 60)
    return 0


if __name__ == "__main__":
    sys.exit(main())
