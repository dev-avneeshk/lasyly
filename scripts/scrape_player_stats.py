"""
NBA Player Season Stats Scraper - Comprehensive
Scrapes ALL player stats pages from basketball-reference.com league pages.

Each page has 2 tables: Regular Season + Playoffs toggle.

Pages scraped:
==============

PAGE 1: Per Game (/leagues/NBA_2026_per_game.html)
  - Table: #per_game_stats       (Regular Season) - 734 players, 31 cols
  - Table: #per_game_stats_post  (Playoffs)       - 231 players, 31 cols

PAGE 2: Totals (/leagues/NBA_2026_totals.html)
  - Table: #totals_stats         (Regular Season) - 734 players, 32 cols
  - Table: #totals_stats_post    (Playoffs)       - 231 players, 32 cols

PAGE 3: Per 36 Minutes (/leagues/NBA_2026_per_minute.html)
  - Table: #per_minute_stats      (Regular Season) - 734 players, 31 cols
  - Table: #per_minute_stats_post (Playoffs)       - 231 players, 31 cols

PAGE 4: Per 100 Possessions (/leagues/NBA_2026_per_poss.html)
  - Table: #per_poss              (Regular Season) - 734 players, 33 cols
  - Table: #per_poss_post         (Playoffs)       - 231 players, 33 cols

PAGE 5: Advanced (/leagues/NBA_2026_advanced.html)
  - Table: #advanced              (Regular Season) - 734 players, 29 cols
  - Table: #advanced_post         (Playoffs)       - 231 players, 29 cols

PAGE 6: Shooting (/leagues/NBA_2026_shooting.html)
  - Table: #shooting              (Regular Season) - 734 players, 31 cols
  - Table: #shooting_post         (Playoffs)       - 231 players, 31 cols

SUMMARY:
=========
- 6 pages to fetch
- 12 tables total (6 regular season + 6 playoffs)
- ~734 players regular season + ~231 playoffs per table
- All stats stored as JSONB in nba_player_season_stats table

Usage:
  python scrape_player_stats.py [options]

Options:
  --delay SECONDS   Delay between page requests (default: 3, range: 3-30)
  --season TEXT     Season identifier (default: "2025-26")
  --dry-run         Print stats without writing to DB
  --pages LIST      Comma-separated list of pages to scrape (default: all)
                    Options: per_game, totals, per_minute, per_poss, advanced, shooting

Environment variables (from ../.env.local):
  NEXT_PUBLIC_SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
"""

import os
import sys
import time
import argparse
import logging
from logging.handlers import RotatingFileHandler
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from scrapling.fetchers import Fetcher
from supabase import create_client, Client

# ============================================================
# Configuration
# ============================================================

BASE_URL = "https://www.basketball-reference.com"

# Pages to scrape: (stat_type, url_suffix, regular_table_id, playoff_table_id)
PAGES_TO_SCRAPE = [
    ("per_game", "per_game", "per_game_stats", "per_game_stats_post"),
    ("totals", "totals", "totals_stats", "totals_stats_post"),
    ("per_36", "per_minute", "per_minute_stats", "per_minute_stats_post"),
    ("per_poss", "per_poss", "per_poss", "per_poss_post"),
    ("advanced", "advanced", "advanced", "advanced_post"),
    ("shooting", "shooting", "shooting", "shooting_post"),
]


# ============================================================
# Logging
# ============================================================

def setup_logging() -> logging.Logger:
    """Configure logging with stdout + rotating file."""
    logger = logging.getLogger("player_stats_scraper")
    logger.setLevel(logging.INFO)

    fmt = logging.Formatter("%(asctime)s [%(levelname)s] %(message)s", datefmt="%Y-%m-%dT%H:%M:%SZ")

    stdout_handler = logging.StreamHandler(sys.stdout)
    stdout_handler.setFormatter(fmt)
    logger.addHandler(stdout_handler)

    log_path = Path(__file__).resolve().parent / "player_stats_scraper.log"
    file_handler = RotatingFileHandler(log_path, maxBytes=10_000_000, backupCount=5)
    file_handler.setFormatter(fmt)
    logger.addHandler(file_handler)

    return logger


# ============================================================
# HTTP Fetching with Retry
# ============================================================

def fetch_page(url: str, delay: float, logger: logging.Logger):
    """Fetch a page with rate limiting and retry logic."""
    retries = 0
    while retries < 3:
        try:
            page = Fetcher.get(url, stealthy_headers=True, timeout=30)

            if page.status == 200:
                return page
            elif page.status == 429:
                retries += 1
                logger.warning(f"  Rate limited (429). Waiting 60s (retry {retries}/3)")
                time.sleep(60)
            elif page.status >= 500:
                retries += 1
                logger.warning(f"  Server error ({page.status}). Waiting 60s (retry {retries}/3)")
                time.sleep(60)
            else:
                logger.error(f"  HTTP {page.status} for {url} - skipping")
                return None
        except Exception as e:
            logger.error(f"  Error fetching {url}: {e}")
            return None

    logger.error(f"  Max retries (3) reached for {url}")
    return None


# ============================================================
# Table Parser
# ============================================================

def parse_player_table(page, table_id: str, logger: logging.Logger) -> list[dict]:
    """
    Parse a player stats table. Dynamically reads all columns from the header.
    Returns list of dicts with player_name, team, position, age, games, games_started,
    and a stats dict containing all other columns.
    """
    tables = page.css(f"table#{table_id}")
    if not len(tables):
        logger.warning(f"    Table #{table_id} not found")
        return []

    table = tables.first

    # Get column names from header
    headers = table.css("thead tr")
    if not len(headers):
        logger.warning(f"    No header rows in #{table_id}")
        return []

    last_header = headers[-1]
    header_ths = last_header.css("th")
    column_names = [th.attrib.get("data-stat", "") for th in header_ths]

    # Parse rows
    rows = table.css("tbody tr:not(.thead)")
    results = []

    for row in rows:
        # Skip mid-table header rows
        if len(row.css("th[colspan]")):
            continue
        if len(row.css("td[colspan]")):
            continue

        # Player name (in th or td with data-stat="name_display" or "player")
        player_name = ""
        name_cell = row.css('td[data-stat="name_display"]')
        if not len(name_cell):
            name_cell = row.css('td[data-stat="player"]')
        if len(name_cell):
            links = name_cell.first.css("a")
            player_name = links.first.text.strip() if len(links) else name_cell.first.text.strip()

        if not player_name:
            continue

        # Team
        team = ""
        team_cell = row.css('td[data-stat="team_name_abbr"]')
        if not len(team_cell):
            team_cell = row.css('td[data-stat="team_id"]')
        if len(team_cell):
            team_links = team_cell.first.css("a")
            team = team_links.first.text.strip() if len(team_links) else team_cell.first.text.strip()

        # Position
        pos_cell = row.css('td[data-stat="pos"]')
        position = pos_cell.first.text.strip() if len(pos_cell) else None

        # Age
        age_cell = row.css('td[data-stat="age"]')
        age = age_cell.first.text.strip() if len(age_cell) else None

        # Games
        games_cell = row.css('td[data-stat="games"]')
        if not len(games_cell):
            games_cell = row.css('td[data-stat="g"]')
        games = games_cell.first.text.strip() if len(games_cell) else None

        # Games started
        gs_cell = row.css('td[data-stat="games_started"]')
        if not len(gs_cell):
            gs_cell = row.css('td[data-stat="gs"]')
        games_started = gs_cell.first.text.strip() if len(gs_cell) else None

        # All other stats as JSONB
        stats = {}
        skip_cols = {"ranker", "name_display", "player", "team_name_abbr", "team_id",
                     "pos", "age", "games", "g", "games_started", "gs", "awards", "DUMMY"}

        all_tds = row.css("td")
        for td in all_tds:
            col_name = td.attrib.get("data-stat", "")
            if not col_name or col_name in skip_cols:
                continue

            text = td.text.strip()
            if not text:
                stats[col_name] = None
                continue

            # Try numeric conversion
            try:
                clean = text.lstrip("+").replace(",", "")
                stats[col_name] = float(clean)
            except (ValueError, TypeError):
                stats[col_name] = text

        results.append({
            "player_name": player_name,
            "team": team,
            "position": position,
            "age": age,
            "games": games,
            "games_started": games_started,
            "stats": stats,
        })

    return results


# ============================================================
# Database Operations
# ============================================================

def upsert_player_season_stats(db_client: Client, records: list[dict], logger: logging.Logger) -> int:
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
            # Fallback to individual inserts
            for record in batch:
                try:
                    result = db_client.table("nba_player_season_stats").upsert(
                        record, on_conflict="player_name,team,stat_type,is_playoff,season"
                    ).execute()
                    if result.data:
                        count += 1
                except Exception as e2:
                    logger.error(f"  Individual upsert failed: {record.get('player_name')}: {e2}")

    return count


# ============================================================
# Build Records
# ============================================================

def build_records(parsed_rows: list[dict], stat_type: str, is_playoff: bool, season: str) -> list[dict]:
    """Convert parsed player rows into DB records."""
    records = []
    now = datetime.now(timezone.utc).isoformat()

    for row in parsed_rows:
        records.append({
            "player_name": row["player_name"],
            "team": row["team"],
            "position": row["position"],
            "age": row["age"],
            "games": row["games"],
            "games_started": row["games_started"],
            "stat_type": stat_type,
            "is_playoff": is_playoff,
            "season": season,
            "stats": row["stats"],
            "scraped_at": now,
        })

    return records


# ============================================================
# Main
# ============================================================

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="NBA Player Season Stats Scraper (All Pages)")
    parser.add_argument("--delay", type=float, default=3.0,
                        help="Delay between page requests (default: 3, min: 3)")
    parser.add_argument("--season", type=str, default="2025-26",
                        help="Season identifier (default: 2025-26)")
    parser.add_argument("--dry-run", action="store_true",
                        help="Print stats without writing to DB")
    parser.add_argument("--pages", type=str, default="all",
                        help="Comma-separated pages to scrape (default: all)")

    args = parser.parse_args()
    if args.delay < 3:
        args.delay = 3.0
    if args.delay > 30:
        parser.error("--delay must be at most 30")
    return args


def main() -> int:
    args = parse_args()
    logger = setup_logging()

    logger.info("=" * 60)
    logger.info(f"NBA Player Season Stats Scraper | Season: {args.season}")
    logger.info(f"  {datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')}")
    logger.info("=" * 60)

    # Load env
    env_path = Path(__file__).resolve().parent.parent / ".env.local"
    load_dotenv(env_path)

    supabase_url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

    if not supabase_url or not supabase_key:
        logger.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
        return 1

    db_client: Client = create_client(supabase_url, supabase_key)

    # Parse season year (e.g., "2025-26" -> 2026)
    try:
        season_year = int(args.season.split("-")[0]) + 1
    except (ValueError, IndexError):
        logger.error(f"Invalid season format: {args.season}. Expected YYYY-YY")
        return 1

    # Filter pages if specified
    if args.pages == "all":
        pages = PAGES_TO_SCRAPE
    else:
        requested = [p.strip() for p in args.pages.split(",")]
        pages = [p for p in PAGES_TO_SCRAPE if p[0] in requested]
        if not pages:
            logger.error(f"No valid pages in: {args.pages}")
            logger.error(f"Valid options: per_game, totals, per_36, per_poss, advanced, shooting")
            return 1

    total_records = 0
    total_saved = 0
    all_records = []

    for stat_type, url_suffix, reg_table_id, playoff_table_id in pages:
        url = f"{BASE_URL}/leagues/NBA_{season_year}_{url_suffix}.html"
        logger.info(f"\n--- Fetching: {stat_type} ({url}) ---")

        page = fetch_page(url, args.delay, logger)
        if not page:
            logger.error(f"  Failed to fetch {stat_type} page")
            continue

        # Regular season table
        logger.info(f"  Parsing #{reg_table_id} (Regular Season)...")
        reg_rows = parse_player_table(page, reg_table_id, logger)
        logger.info(f"    -> {len(reg_rows)} players")
        reg_records = build_records(reg_rows, stat_type, False, args.season)
        all_records.extend(reg_records)
        total_records += len(reg_records)

        # Playoffs table
        logger.info(f"  Parsing #{playoff_table_id} (Playoffs)...")
        playoff_rows = parse_player_table(page, playoff_table_id, logger)
        logger.info(f"    -> {len(playoff_rows)} players")
        playoff_records = build_records(playoff_rows, stat_type, True, args.season)
        all_records.extend(playoff_records)
        total_records += len(playoff_records)

        time.sleep(args.delay)

    # Summary
    logger.info(f"\n{'=' * 60}")
    logger.info(f"SCRAPE COMPLETE | {len(pages)} pages | {total_records} total records")
    logger.info(f"{'=' * 60}")

    if args.dry_run:
        logger.info("\n[DRY RUN] Sample records:")
        for rec in all_records[:5]:
            stat_keys = list(rec["stats"].keys())[:6]
            logger.info(f"  {rec['player_name']:25s} | {rec['team']:4s} | {rec['stat_type']:10s} | playoff={rec['is_playoff']} | keys: {stat_keys}...")
        logger.info(f"\n  Total would write: {total_records} records")
        return 0

    # Write to DB
    logger.info(f"\n--- Upserting {total_records} records to nba_player_season_stats ---")
    total_saved = upsert_player_season_stats(db_client, all_records, logger)
    logger.info(f"  Saved {total_saved} records")

    logger.info(f"\n{'=' * 60}")
    logger.info(f"DONE | Pages: {len(pages)} | Records: {total_saved}/{total_records}")
    logger.info("=" * 60)
    return 0


if __name__ == "__main__":
    sys.exit(main())
