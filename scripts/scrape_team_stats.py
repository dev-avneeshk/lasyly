"""
NBA Team Stats Scraper - Comprehensive
Scrapes ALL team stats tables from basketball-reference.com league page.

This scraper captures BOTH the "Team" and "Opponent" toggles for each table,
giving us what teams score AND what they allow.

Tables scraped from /leagues/NBA_{year}.html:
============================================

TABLE 1: Per Game Stats
  - Toggle: Team    (table#per_game-team)      -> what teams score per game
  - Toggle: Opponent (table#per_game-opponent)  -> what teams allow per game
  Columns: G, MP, FG, FGA, FG%, 3P, 3PA, 3P%, 2P, 2PA, 2P%, FT, FTA, FT%,
           ORB, DRB, TRB, AST, STL, BLK, TOV, PF, PTS

TABLE 2: Totals
  - Toggle: Team    (table#totals-team)         -> team total stats
  - Toggle: Opponent (table#totals-opponent)    -> opponent total stats
  Columns: G, MP, FG, FGA, FG%, 3P, 3PA, 3P%, 2P, 2PA, 2P%, FT, FTA, FT%,
           ORB, DRB, TRB, AST, STL, BLK, TOV, PF, PTS

TABLE 3: Per 100 Possessions
  - Toggle: Team    (table#per_poss-team)       -> team per-100-poss stats
  - Toggle: Opponent (table#per_poss-opponent)  -> opponent per-100-poss stats
  Columns: G, MP, FG, FGA, FG%, 3P, 3PA, 3P%, 2P, 2PA, 2P%, FT, FTA, FT%,
           ORB, DRB, TRB, AST, STL, BLK, TOV, PF, PTS, ORtg, DRtg, NRtg, Pace

TABLE 4: Advanced
  - Toggle: (single table, no toggle) (table#advanced-team)
  Columns: Age, W, L, PW, PL, MOV, SOS, SRS, ORtg, DRtg, NRtg, Pace, FTr,
           3PAr, TS%, eFG%, TOV%, ORB%, FT/FGA, eFG%(opp), TOV%(opp),
           DRB%(opp), FT/FGA(opp), Arena, Attend, Attend/G

TABLE 5: Shooting (Team)
  - Toggle: Team    (table#shooting-team)       -> team shooting splits
  - Toggle: Opponent (table#shooting-opponent)  -> opponent shooting splits
  Columns: G, MP, FG%, Dist., %FGA(2P), %FGA(0-3), %FGA(3-10), %FGA(10-16),
           %FGA(16-3P), %FGA(3P), FG%(2P), FG%(0-3), FG%(3-10), FG%(10-16),
           FG%(16-3P), FG%(3P), %Ast'd(2P), %Ast'd(3P), %FGA(Dunk), Md(Dunk),
           %3PA(Corner), 3P%(Corner), Att(Heave), Md(Heave)

SUMMARY:
=========
- 5 main table groups
- 9 total table views (4 tables x 2 toggles + 1 advanced with no toggle)
- Each table has 30 team rows

Usage:
  python scrape_team_stats.py [options]

Options:
  --delay SECONDS   Delay between requests (default: 3, range: 3-30)
  --season TEXT     Season identifier (default: "2025-26")
  --dry-run         Print stats without writing to DB

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

TEAM_URL_SLUGS = {
    "ATL": "ATL", "BOS": "BOS", "BKN": "BRK", "CHA": "CHO",
    "CHI": "CHI", "CLE": "CLE", "DAL": "DAL", "DEN": "DEN",
    "DET": "DET", "GSW": "GSW", "HOU": "HOU", "IND": "IND",
    "LAC": "LAC", "LAL": "LAL", "MEM": "MEM", "MIA": "MIA",
    "MIL": "MIL", "MIN": "MIN", "NOP": "NOP", "NYK": "NYK",
    "OKC": "OKC", "ORL": "ORL", "PHI": "PHI", "PHX": "PHO",
    "POR": "POR", "SAC": "SAC", "SAS": "SAS", "TOR": "TOR",
    "UTA": "UTA", "WAS": "WAS",
}

# All tables we want to scrape from the league page
# Format: (table_id, stat_type, side)
# side = "team" means what teams do, "opponent" means what teams allow
TABLES_TO_SCRAPE = [
    # Per Game Stats
    ("per_game-team", "per_game", "team"),
    ("per_game-opponent", "per_game", "opponent"),
    # Totals
    ("totals-team", "totals", "team"),
    ("totals-opponent", "totals", "opponent"),
    # Per 100 Possessions
    ("per_poss-team", "per_100_poss", "team"),
    ("per_poss-opponent", "per_100_poss", "opponent"),
    # Advanced (single table, no team/opponent toggle)
    ("advanced-team", "advanced", "team"),
    # Shooting
    ("shooting-team", "shooting", "team"),
    ("shooting-opponent", "shooting", "opponent"),
]

# Column mappings for each stat type
# These are the data-stat attribute values in BBRef HTML
PER_GAME_COLUMNS = [
    "g", "mp", "fg", "fga", "fg_pct", "fg3", "fg3a", "fg3_pct",
    "fg2", "fg2a", "fg2_pct", "ft", "fta", "ft_pct",
    "orb", "drb", "trb", "ast", "stl", "blk", "tov", "pf", "pts",
]

# For opponent tables, BBRef prefixes with "opp_"
OPP_PER_GAME_COLUMNS = [
    "g", "mp", "opp_fg", "opp_fga", "opp_fg_pct", "opp_fg3", "opp_fg3a", "opp_fg3_pct",
    "opp_fg2", "opp_fg2a", "opp_fg2_pct", "opp_ft", "opp_fta", "opp_ft_pct",
    "opp_orb", "opp_drb", "opp_trb", "opp_ast", "opp_stl", "opp_blk", "opp_tov", "opp_pf", "opp_pts",
]

TOTALS_COLUMNS = PER_GAME_COLUMNS  # Same structure
OPP_TOTALS_COLUMNS = OPP_PER_GAME_COLUMNS

# Per 100 Poss has same columns as Per Game (ORtg/DRtg/Pace are in Advanced table only)
PER_POSS_COLUMNS = PER_GAME_COLUMNS
OPP_PER_POSS_COLUMNS = OPP_PER_GAME_COLUMNS

ADVANCED_COLUMNS = [
    "age", "wins", "losses", "wins_pyth", "losses_pyth", "mov", "sos", "srs",
    "off_rtg", "def_rtg", "net_rtg", "pace", "fta_per_fga_pct", "fg3a_per_fga_pct",
    "ts_pct", "efg_pct", "tov_pct", "orb_pct", "ft_rate",
    "opp_efg_pct", "opp_tov_pct", "drb_pct", "opp_ft_rate",
    "arena_name", "attendance", "attendance_per_g",
]

SHOOTING_COLUMNS = [
    "g", "mp", "fg_pct", "avg_dist",
    "pct_fga_fg2a", "pct_fga_00_03", "pct_fga_03_10", "pct_fga_10_16", "pct_fga_16_xx", "pct_fga_fg3a",
    "fg_pct_fg2a", "fg_pct_00_03", "fg_pct_03_10", "fg_pct_10_16", "fg_pct_16_xx", "fg_pct_fg3a",
    "pct_ast_fg2", "pct_ast_fg3",
    "pct_fga_dunk", "fg_dunk", "pct_fg3a_corner", "fg3_pct_corner",
    "fg3a_heave", "fg3_heave",
]

OPP_SHOOTING_COLUMNS = [
    "g", "mp", "opp_fg_pct", "opp_avg_dist",
    "opp_pct_fga_fg2a", "opp_pct_fga_00_03", "opp_pct_fga_03_10", "opp_pct_fga_10_16", "opp_pct_fga_16_xx", "opp_pct_fga_fg3a",
    "opp_fg_pct_fg2a", "opp_fg_pct_00_03", "opp_fg_pct_03_10", "opp_fg_pct_10_16", "opp_fg_pct_16_xx", "opp_fg_pct_fg3a",
    "opp_pct_ast_fg2", "opp_pct_ast_fg3",
    "opp_pct_fga_dunk", "opp_fg_dunk", "opp_pct_fg3a_corner", "opp_fg3_pct_corner",
    "opp_fg3a_heave", "opp_fg3_heave",
]


def get_team_abbr(team_name: str) -> str:
    """Get 3-letter abbreviation for a team name."""
    return TEAM_ABBREVIATIONS.get(team_name, team_name[:3].upper())


# ============================================================
# Logging
# ============================================================

def setup_logging() -> logging.Logger:
    """Configure logging with stdout + rotating file."""
    logger = logging.getLogger("team_stats_scraper")
    logger.setLevel(logging.INFO)

    fmt = logging.Formatter("%(asctime)s [%(levelname)s] %(message)s", datefmt="%Y-%m-%dT%H:%M:%SZ")

    stdout_handler = logging.StreamHandler(sys.stdout)
    stdout_handler.setFormatter(fmt)
    logger.addHandler(stdout_handler)

    log_path = Path(__file__).resolve().parent / "team_stats_scraper.log"
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
# Generic Table Parser
# ============================================================

def get_columns_for_table(table_id: str) -> list[str]:
    """Return the expected column data-stat names for a given table."""
    if "per_game" in table_id:
        if "opponent" in table_id:
            return OPP_PER_GAME_COLUMNS
        return PER_GAME_COLUMNS
    elif "totals" in table_id:
        if "opponent" in table_id:
            return OPP_TOTALS_COLUMNS
        return TOTALS_COLUMNS
    elif "per_poss" in table_id:
        if "opponent" in table_id:
            return OPP_PER_POSS_COLUMNS
        return PER_POSS_COLUMNS
    elif "advanced" in table_id:
        return ADVANCED_COLUMNS
    elif "shooting" in table_id:
        if "opponent" in table_id:
            return OPP_SHOOTING_COLUMNS
        return SHOOTING_COLUMNS
    return []


def normalize_column_name(col: str, table_id: str) -> str:
    """
    Normalize BBRef column names by stripping 'opp_' prefix for opponent tables.
    For the advanced table, keep opp_ prefix since both team and opponent stats
    are in the same row (e.g., efg_pct = team's, opp_efg_pct = opponent's).
    """
    if "advanced" in table_id:
        # Advanced table has both team and opp stats in same row, keep as-is
        return col
    if col.startswith("opp_"):
        return col[4:]  # Remove "opp_" prefix for opponent tables
    return col


def parse_table(page, table_id: str, logger: logging.Logger) -> list[dict]:
    """
    Parse a single table from the page by its HTML id.
    Returns list of dicts: [{ team_abbr, stats: { col: value } }]
    """
    tables = page.css(f"table#{table_id}")
    if not len(tables):
        logger.warning(f"    Table #{table_id} not found on page")
        return []

    table = tables.first
    rows = table.css("tbody tr:not(.thead)")
    columns = get_columns_for_table(table_id)
    results = []

    for row in rows:
        # Skip header rows within tbody
        if len(row.css("th[colspan]")):
            continue

        # Team column
        team_cells = row.css('td[data-stat="team"]')
        if not len(team_cells):
            # Some tables use th for team
            team_cells = row.css('th[data-stat="team"]')
            if not len(team_cells):
                continue

        team_links = team_cells.first.css("a")
        team_name = team_links.first.text.strip() if len(team_links) else team_cells.first.text.strip()
        team_name = team_name.rstrip("*").strip()
        team_abbr = get_team_abbr(team_name)

        if team_abbr not in TEAM_URL_SLUGS:
            continue

        # Extract all stat columns
        stats = {}
        for col in columns:
            cells = row.css(f'td[data-stat="{col}"]')
            if not len(cells):
                stats[normalize_column_name(col, table_id)] = None
                continue

            text = cells.first.text.strip()
            if not text or text == "":
                stats[normalize_column_name(col, table_id)] = None
                continue

            # Try numeric conversion
            try:
                # Handle +/- prefix (e.g., "+11.2" for net_rtg)
                clean_text = text.lstrip("+")
                # Handle comma-separated numbers (e.g., "764,842" for attendance)
                clean_text = clean_text.replace(",", "")
                val = float(clean_text)
                stats[normalize_column_name(col, table_id)] = val
            except (ValueError, TypeError):
                # Keep as string for non-numeric fields (arena name, etc.)
                stats[normalize_column_name(col, table_id)] = text

        results.append({
            "team": team_abbr,
            "stats": stats,
        })

    return results


# ============================================================
# Scrape All Tables from League Page
# ============================================================

def scrape_league_page(season_year: int, delay: float, logger: logging.Logger) -> dict:
    """
    Scrape all team stats tables from the main league page.
    
    Returns: {
        (stat_type, side): [{ team, stats: {...} }, ...]
    }
    """
    url = f"{BASE_URL}/leagues/NBA_{season_year}.html"
    logger.info(f"Fetching league page: {url}")

    page = fetch_page(url, delay, logger)
    if not page:
        logger.error("Failed to fetch league page")
        return {}

    all_data = {}

    for table_id, stat_type, side in TABLES_TO_SCRAPE:
        logger.info(f"  Parsing table: #{table_id} ({stat_type} / {side})")
        rows = parse_table(page, table_id, logger)
        logger.info(f"    -> {len(rows)} teams parsed")
        all_data[(stat_type, side)] = rows

    return all_data


# ============================================================
# Scrape Team Rosters for Positions
# ============================================================

def scrape_team_roster_positions(team_abbr: str, season_year: int, delay: float, logger: logging.Logger) -> list[dict]:
    """Scrape a team's roster page for player positions."""
    slug = TEAM_URL_SLUGS.get(team_abbr, team_abbr)
    url = f"{BASE_URL}/teams/{slug}/{season_year}.html"

    page = fetch_page(url, delay, logger)
    if not page:
        return []

    players = []
    tables = page.css("table#roster")
    if not len(tables):
        return []

    table = tables.first
    rows = table.css("tbody tr")

    for row in rows:
        player_cells = row.css('td[data-stat="player"]')
        if not len(player_cells):
            continue

        player_links = player_cells.first.css("a")
        player_name = player_links.first.text.strip() if len(player_links) else player_cells.first.text.strip()
        if not player_name:
            continue

        pos_cells = row.css('td[data-stat="pos"]')
        position = pos_cells.first.text.strip() if len(pos_cells) else None

        if position:
            players.append({"player_name": player_name, "position": position})

    return players


# ============================================================
# Database Operations
# ============================================================

def upsert_team_stats(db_client: Client, records: list[dict], logger: logging.Logger) -> int:
    """Upsert team stats records. Returns count saved."""
    if not records:
        return 0

    count = 0
    batch_size = 50

    for i in range(0, len(records), batch_size):
        batch = records[i:i + batch_size]
        try:
            result = db_client.table("nba_team_stats").upsert(
                batch, on_conflict="team,stat_type,side,season"
            ).execute()
            count += len(result.data) if result.data else 0
        except Exception as e:
            logger.error(f"  DB upsert failed at batch {i // batch_size + 1}: {e}")
            for record in batch:
                try:
                    result = db_client.table("nba_team_stats").upsert(
                        record, on_conflict="team,stat_type,side,season"
                    ).execute()
                    if result.data:
                        count += 1
                except Exception as e2:
                    logger.error(f"  Individual upsert failed: {record.get('team')}/{record.get('stat_type')}/{record.get('side')}: {e2}")

    return count


def upsert_player_positions(db_client: Client, players: list[dict], logger: logging.Logger) -> int:
    """Update player position data in nba_player_stats."""
    if not players:
        return 0

    count = 0
    for player in players:
        player_name = player.get("player_name")
        position = player.get("position")
        if not player_name or not position:
            continue

        try:
            result = (
                db_client.table("nba_player_stats")
                .update({"position": position})
                .eq("player_name", player_name)
                .is_("position", "null")
                .execute()
            )
            if result.data:
                count += 1
        except Exception as e:
            logger.error(f"  Failed to update position for {player_name}: {e}")

    return count


# ============================================================
# Build Records for DB
# ============================================================

def build_records(all_data: dict, season: str) -> list[dict]:
    """
    Convert scraped data into DB records.
    Each record stores the full stats as JSONB.
    """
    records = []
    now = datetime.now(timezone.utc).isoformat()

    for (stat_type, side), team_rows in all_data.items():
        for row in team_rows:
            records.append({
                "team": row["team"],
                "stat_type": stat_type,
                "side": side,
                "season": season,
                "stats": row["stats"],
                "scraped_at": now,
            })

    return records


# ============================================================
# Main
# ============================================================

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="NBA Team Stats Scraper (All Tables)")
    parser.add_argument("--delay", type=float, default=3.0,
                        help="Delay between requests in seconds (default: 3, min: 3)")
    parser.add_argument("--season", type=str, default="2025-26",
                        help="Season identifier (default: 2025-26)")
    parser.add_argument("--dry-run", action="store_true",
                        help="Print stats without writing to DB")
    parser.add_argument("--skip-rosters", action="store_true",
                        help="Skip roster scraping (saves 30 requests)")

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
    logger.info(f"NBA Team Stats Scraper | Season: {args.season}")
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

    # ---- Step 1: Scrape all tables from league page ----
    logger.info("\n--- Step 1: Scraping league page tables ---")
    all_data = scrape_league_page(season_year, args.delay, logger)

    if not all_data:
        logger.error("No data scraped from league page")
        return 1

    # Print summary
    total_tables = len(all_data)
    total_team_rows = sum(len(rows) for rows in all_data.values())
    logger.info(f"\n  SUMMARY: {total_tables} tables scraped, {total_team_rows} total team rows")

    for (stat_type, side), rows in all_data.items():
        logger.info(f"    {stat_type:15s} | {side:10s} | {len(rows)} teams")

    # ---- Step 2: Build DB records ----
    records = build_records(all_data, args.season)
    logger.info(f"\n  Built {len(records)} records for DB")

    if args.dry_run:
        logger.info("\n  [DRY RUN] Skipping DB write. Sample data:")
        for rec in records[:5]:
            logger.info(f"    {rec['team']} | {rec['stat_type']} | {rec['side']} | keys: {list(rec['stats'].keys())[:8]}...")
        return 0

    # ---- Step 3: Upsert to DB ----
    logger.info("\n--- Step 3: Upserting to nba_team_stats ---")
    saved = upsert_team_stats(db_client, records, logger)
    logger.info(f"  Saved {saved} records")

    # ---- Step 4: Scrape rosters for player positions ----
    positions_updated = 0
    if not args.skip_rosters:
        logger.info("\n--- Step 4: Scraping team rosters for positions ---")
        all_players = []

        for team_abbr in sorted(TEAM_URL_SLUGS.keys()):
            logger.info(f"  Fetching roster: {team_abbr}")
            players = scrape_team_roster_positions(team_abbr, season_year, args.delay, logger)
            if players:
                all_players.extend(players)
                logger.info(f"    Found {len(players)} players")
            time.sleep(args.delay)

        positions_updated = upsert_player_positions(db_client, all_players, logger)
        logger.info(f"  Updated positions for {positions_updated} players")

    # ---- Final Summary ----
    logger.info(f"\n{'=' * 60}")
    logger.info(f"DONE | Tables: {total_tables} | Records: {saved} | Positions: {positions_updated}")
    logger.info("=" * 60)
    return 0


if __name__ == "__main__":
    sys.exit(main())
