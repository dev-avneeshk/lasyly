"""
ESPN Sports Data Scraper — All sports EXCEPT basketball.
Uses ESPN's free public API to populate teams, rosters, schedules, standings,
and per-game player stats for the current season.

Sports covered:
  - Football (Soccer): Premier League, La Liga, Bundesliga, Serie A, Ligue 1, UCL, MLS
  - American Football (NFL): Full season
  - Hockey (NHL): Full season
  - Tennis: ATP, WTA (rankings + scoreboard)
  - Racing (F1): Season schedule + results
  - Golf (PGA): Tournament schedule
  - MMA (UFC): Event schedule

Usage:
  python scrape_espn.py <mode> [options]

Modes:
  full          - Scrape everything: teams + rosters + schedule + standings + stats
  teams         - Scrape teams only (all leagues)
  rosters       - Scrape player rosters for all teams
  schedule      - Scrape full season schedule for all leagues
  standings     - Scrape current standings for all leagues
  stats         - Scrape box score stats for completed games
  daily         - Quick refresh: today's scores + standings

Options:
  --league LEAGUE    Filter to specific league (e.g. eng.1, nfl, nhl)
  --delay SECONDS    Delay between requests (default: 1.0, range: 0.5-10)
  --limit N          Max items to process per category
  --season YEAR      Season year (default: current)
  --dry-run          Print data without writing to DB

Environment variables (from ../.env.local):
  NEXT_PUBLIC_SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
"""

import os
import sys
import time
import json
import argparse
import logging
from logging.handlers import RotatingFileHandler
from datetime import datetime, date, timedelta, timezone
from pathlib import Path
from typing import Optional
from urllib.request import urlopen, Request
from urllib.error import HTTPError, URLError

from dotenv import load_dotenv
from supabase import create_client, Client


# ============================================================
# Configuration
# ============================================================

ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports"
ESPN_CORE = "https://sports.core.api.espn.com/v2/sports"
ESPN_STANDINGS = "https://site.api.espn.com/apis/v2/sports"

# All leagues to scrape (excluding basketball)
LEAGUES = {
    # Soccer
    "eng.1": {"sport": "soccer", "display": "Premier League", "season": "2025"},
    "esp.1": {"sport": "soccer", "display": "La Liga", "season": "2025"},
    "ger.1": {"sport": "soccer", "display": "Bundesliga", "season": "2025"},
    "ita.1": {"sport": "soccer", "display": "Serie A", "season": "2025"},
    "fra.1": {"sport": "soccer", "display": "Ligue 1", "season": "2025"},
    "uefa.champions": {"sport": "soccer", "display": "Champions League", "season": "2025"},
    "usa.1": {"sport": "soccer", "display": "MLS", "season": "2026"},
    # American Football
    "nfl": {"sport": "football", "display": "NFL", "season": "2025"},
    # Hockey
    "nhl": {"sport": "hockey", "display": "NHL", "season": "2025"},
    # Tennis
    "atp": {"sport": "tennis", "display": "ATP", "season": "2026"},
    "wta": {"sport": "tennis", "display": "WTA", "season": "2026"},
    # Racing
    "f1": {"sport": "racing", "display": "Formula 1", "season": "2026"},
    # Golf
    "pga": {"sport": "golf", "display": "PGA Tour", "season": "2026"},
    # MMA
    "ufc": {"sport": "mma", "display": "UFC", "season": "2026"},
}

# Sports that have traditional team structures (for roster/standings scraping)
TEAM_SPORTS = {"soccer", "football", "hockey"}

# How many days of schedule to fetch for daily mode
DAILY_WINDOW_DAYS = 7


# ============================================================
# Logging
# ============================================================

def setup_logging() -> logging.Logger:
    logger = logging.getLogger("espn_scraper")
    logger.setLevel(logging.INFO)
    fmt = logging.Formatter(
        "%(asctime)s [%(levelname)s] %(message)s", datefmt="%Y-%m-%dT%H:%M:%SZ"
    )

    stdout_handler = logging.StreamHandler(sys.stdout)
    stdout_handler.setFormatter(fmt)
    logger.addHandler(stdout_handler)

    log_dir = Path(__file__).resolve().parent / "logs"
    log_dir.mkdir(exist_ok=True)
    file_handler = RotatingFileHandler(
        log_dir / "espn_scraper.log", maxBytes=10_000_000, backupCount=5
    )
    file_handler.setFormatter(fmt)
    logger.addHandler(file_handler)

    return logger


# ============================================================
# HTTP Helper
# ============================================================

def fetch_json(url: str, delay: float, logger: logging.Logger, max_retries: int = 3):
    """Fetch JSON from ESPN API with retry logic. Returns parsed dict or None."""
    for attempt in range(max_retries):
        try:
            req = Request(url, headers={
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
                "Accept": "application/json",
            })
            with urlopen(req, timeout=15) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                time.sleep(delay)
                return data
        except HTTPError as e:
            if e.code == 429:
                wait = min(60, 10 * (attempt + 1))
                logger.warning(f"Rate limited (429) on {url}, waiting {wait}s")
                time.sleep(wait)
            elif e.code >= 500:
                logger.warning(f"Server error ({e.code}) on {url}, retry {attempt+1}")
                time.sleep(5 * (attempt + 1))
            elif e.code == 404:
                logger.info(f"404 Not Found: {url}")
                return None
            else:
                logger.error(f"HTTP {e.code} on {url}")
                return None
        except (URLError, OSError) as e:
            logger.warning(f"Network error on {url}: {e}, retry {attempt+1}")
            time.sleep(5 * (attempt + 1))
        except Exception as e:
            logger.error(f"Unexpected error fetching {url}: {e}")
            return None

    logger.error(f"Max retries reached for {url}")
    return None


# ============================================================
# Database
# ============================================================

class ESPNDatabase:
    def __init__(self, url: str, key: str):
        self.client: Client = create_client(url, key)
        self.logger = logging.getLogger("espn_scraper")

    def upsert_teams(self, teams: list[dict]) -> int:
        count = 0
        for i in range(0, len(teams), 50):
            batch = teams[i:i+50]
            try:
                result = self.client.table("espn_teams").upsert(
                    batch, on_conflict="id"
                ).execute()
                count += len(result.data) if result.data else 0
            except Exception as e:
                self.logger.error(f"DB upsert_teams failed: {e}")
                for t in batch:
                    try:
                        self.client.table("espn_teams").upsert(t, on_conflict="id").execute()
                        count += 1
                    except Exception:
                        pass
        return count

    def upsert_players(self, players: list[dict]) -> int:
        count = 0
        for i in range(0, len(players), 50):
            batch = players[i:i+50]
            try:
                result = self.client.table("espn_players").upsert(
                    batch, on_conflict="id"
                ).execute()
                count += len(result.data) if result.data else 0
            except Exception as e:
                self.logger.error(f"DB upsert_players failed: {e}")
                for p in batch:
                    try:
                        self.client.table("espn_players").upsert(p, on_conflict="id").execute()
                        count += 1
                    except Exception:
                        pass
        return count

    def upsert_games(self, games: list[dict]) -> int:
        count = 0
        for i in range(0, len(games), 50):
            batch = games[i:i+50]
            try:
                result = self.client.table("espn_games").upsert(
                    batch, on_conflict="id"
                ).execute()
                count += len(result.data) if result.data else 0
            except Exception as e:
                self.logger.error(f"DB upsert_games batch failed: {e}")
                # Fallback: try individual, nullify team_id FKs on constraint errors
                for g in batch:
                    try:
                        self.client.table("espn_games").upsert(g, on_conflict="id").execute()
                        count += 1
                    except Exception as e2:
                        err_msg = str(e2)
                        if "foreign key constraint" in err_msg:
                            # Nullify the FK references and retry
                            g["home_team_id"] = None
                            g["away_team_id"] = None
                            try:
                                self.client.table("espn_games").upsert(g, on_conflict="id").execute()
                                count += 1
                            except Exception:
                                pass
                        else:
                            self.logger.error(f"DB upsert game {g.get('id')}: {e2}")
        return count

    def upsert_standings(self, standings: list[dict]) -> int:
        count = 0
        for i in range(0, len(standings), 50):
            batch = standings[i:i+50]
            try:
                result = self.client.table("espn_standings").upsert(
                    batch, on_conflict="id"
                ).execute()
                count += len(result.data) if result.data else 0
            except Exception as e:
                self.logger.error(f"DB upsert_standings failed: {e}")
                for s in batch:
                    try:
                        self.client.table("espn_standings").upsert(s, on_conflict="id").execute()
                        count += 1
                    except Exception:
                        pass
        return count

    def upsert_player_stats(self, stats: list[dict]) -> int:
        count = 0
        # Set player_id to None for players not in our espn_players table
        # to avoid FK constraint violations
        for stat in stats:
            stat["player_id"] = None
        for i in range(0, len(stats), 50):
            batch = stats[i:i+50]
            try:
                result = self.client.table("espn_player_stats").upsert(
                    batch, on_conflict="id"
                ).execute()
                count += len(result.data) if result.data else 0
            except Exception as e:
                self.logger.error(f"DB upsert_player_stats failed: {e}")
        return count

    def get_completed_games_without_stats(self, league: str, limit: int = 100) -> list[dict]:
        """Get completed games that don't have player stats yet."""
        try:
            result = (
                self.client.table("espn_games")
                .select("id, event_id, league, sport, match_date, home_team, away_team")
                .eq("league", league)
                .eq("status", "completed")
                .order("match_date", desc=True)
                .limit(limit)
                .execute()
            )
            games = result.data or []
            # Filter out games that already have stats
            games_with_stats = set()
            if games:
                game_ids = [g["id"] for g in games]
                for i in range(0, len(game_ids), 50):
                    batch_ids = game_ids[i:i+50]
                    stats_result = (
                        self.client.table("espn_player_stats")
                        .select("game_id")
                        .in_("game_id", batch_ids)
                        .execute()
                    )
                    for row in (stats_result.data or []):
                        games_with_stats.add(row["game_id"])
            return [g for g in games if g["id"] not in games_with_stats]
        except Exception as e:
            self.logger.error(f"DB get_completed_games failed: {e}")
            return []


# ============================================================
# Teams Scraping
# ============================================================

def scrape_teams(db: ESPNDatabase, delay: float, logger: logging.Logger,
                 league_filter: Optional[str] = None, dry_run: bool = False) -> int:
    """Scrape all teams for configured leagues."""
    total = 0
    leagues_to_scrape = {league_filter: LEAGUES[league_filter]} if league_filter else LEAGUES

    for league_key, config in leagues_to_scrape.items():
        sport = config["sport"]
        if sport not in TEAM_SPORTS:
            continue

        url = f"{ESPN_BASE}/{sport}/{league_key}/teams"
        logger.info(f"Fetching teams: {config['display']} ({url})")

        data = fetch_json(url, delay, logger)
        if not data:
            continue

        teams = []
        sport_teams = data.get("sports", [{}])[0].get("leagues", [{}])[0].get("teams", [])

        for entry in sport_teams:
            team = entry.get("team", entry)
            team_id = f"{league_key}-{team.get('id', '')}"
            venue = team.get("venue", {})

            record = {
                "id": team_id,
                "espn_id": str(team.get("id", "")),
                "name": team.get("displayName", team.get("name", "")),
                "abbreviation": team.get("abbreviation", ""),
                "short_name": team.get("shortDisplayName", ""),
                "logo_url": team.get("logos", [{}])[0].get("href", "") if team.get("logos") else None,
                "color": team.get("color", None),
                "alternate_color": team.get("alternateColor", None),
                "sport": sport,
                "league": league_key,
                "venue_name": venue.get("fullName", None) if venue else None,
                "venue_city": venue.get("address", {}).get("city", None) if venue else None,
                "conference": team.get("groups", {}).get("parent", {}).get("name", None) if isinstance(team.get("groups"), dict) else None,
                "division": team.get("groups", {}).get("name", None) if isinstance(team.get("groups"), dict) else None,
                "raw_data": json.dumps(team) if not dry_run else None,
            }
            teams.append(record)

        if dry_run:
            logger.info(f"  [DRY RUN] Would save {len(teams)} teams for {config['display']}")
            for t in teams[:3]:
                logger.info(f"    {t['abbreviation']} - {t['name']}")
        else:
            saved = db.upsert_teams(teams)
            logger.info(f"  Saved {saved} teams for {config['display']}")
            total += saved

    return total


# ============================================================
# Rosters Scraping
# ============================================================

def scrape_rosters(db: ESPNDatabase, delay: float, logger: logging.Logger,
                   league_filter: Optional[str] = None, limit: Optional[int] = None,
                   dry_run: bool = False) -> int:
    """Scrape player rosters for all teams."""
    total = 0
    leagues_to_scrape = {league_filter: LEAGUES[league_filter]} if league_filter else LEAGUES
    team_count = 0

    for league_key, config in leagues_to_scrape.items():
        sport = config["sport"]
        if sport not in TEAM_SPORTS:
            continue

        # First get team list
        url = f"{ESPN_BASE}/{sport}/{league_key}/teams"
        data = fetch_json(url, delay, logger)
        if not data:
            continue

        sport_teams = data.get("sports", [{}])[0].get("leagues", [{}])[0].get("teams", [])

        for entry in sport_teams:
            if limit and team_count >= limit:
                return total

            team = entry.get("team", entry)
            team_espn_id = team.get("id", "")
            team_id = f"{league_key}-{team_espn_id}"
            team_name = team.get("displayName", "")

            roster_url = f"{ESPN_BASE}/{sport}/{league_key}/teams/{team_espn_id}/roster"
            logger.info(f"  Fetching roster: {team_name} ({league_key})")

            roster_data = fetch_json(roster_url, delay, logger)
            if not roster_data:
                continue

            players = []
            # ESPN roster response has athletes grouped by position or flat
            athlete_groups = roster_data.get("athletes", [])

            for group in athlete_groups:
                # Could be a position group or flat list
                athlete_list = group.get("items", []) if isinstance(group, dict) else []
                if not athlete_list and isinstance(group, dict):
                    # Some sports have athletes directly
                    athlete_list = [group]

                for athlete in athlete_list:
                    athlete_id = str(athlete.get("id", ""))
                    if not athlete_id:
                        continue

                    player_record = {
                        "id": f"{league_key}-{athlete_id}",
                        "espn_id": athlete_id,
                        "name": athlete.get("displayName", athlete.get("fullName", "")),
                        "team_id": team_id,
                        "team_name": team_name,
                        "jersey_number": athlete.get("jersey", None),
                        "position": athlete.get("position", {}).get("abbreviation", None) if isinstance(athlete.get("position"), dict) else athlete.get("position", None),
                        "height": athlete.get("displayHeight", None),
                        "weight": athlete.get("displayWeight", None),
                        "age": athlete.get("age", None),
                        "headshot_url": athlete.get("headshot", {}).get("href", None) if isinstance(athlete.get("headshot"), dict) else None,
                        "sport": sport,
                        "league": league_key,
                        "status": "active",
                        "nationality": athlete.get("citizenship", None) or athlete.get("flag", {}).get("alt", None) if isinstance(athlete.get("flag"), dict) else None,
                        "raw_data": None,  # Skip raw to save space
                    }
                    players.append(player_record)

            if dry_run:
                logger.info(f"    [DRY RUN] {len(players)} players for {team_name}")
            else:
                saved = db.upsert_players(players)
                logger.info(f"    Saved {saved} players for {team_name}")
                total += saved

            team_count += 1

    return total


# ============================================================
# Schedule Scraping
# ============================================================

def scrape_schedule(db: ESPNDatabase, delay: float, logger: logging.Logger,
                    league_filter: Optional[str] = None, season: Optional[str] = None,
                    limit: Optional[int] = None, dry_run: bool = False) -> int:
    """Scrape full season schedule for all leagues using scoreboard endpoint with date ranges."""
    total = 0
    leagues_to_scrape = {league_filter: LEAGUES[league_filter]} if league_filter else LEAGUES

    for league_key, config in leagues_to_scrape.items():
        sport = config["sport"]
        league_season = season or config["season"]
        display = config["display"]

        logger.info(f"Fetching schedule: {display} (season {league_season})")

        all_games = []

        if sport == "soccer":
            # Soccer: fetch by date range (Aug to May for European, Mar to Nov for MLS)
            if league_key == "usa.1":
                start = date(int(league_season), 2, 1)
                end = date(int(league_season), 12, 15)
            else:
                start = date(int(league_season), 8, 1)
                end = date(int(league_season) + 1, 6, 30)
            all_games = _fetch_schedule_by_dates(sport, league_key, start, end, delay, logger, limit)

        elif sport == "football":
            # NFL: fetch by season type and week
            for season_type in [2, 3]:  # regular + postseason
                weeks = 18 if season_type == 2 else 4
                for week in range(1, weeks + 1):
                    url = f"{ESPN_BASE}/{sport}/{league_key}/scoreboard?dates={league_season}&seasontype={season_type}&week={week}"
                    data = fetch_json(url, delay, logger)
                    if not data:
                        continue
                    events = data.get("events", [])
                    for event in events:
                        game = _parse_event(event, league_key, sport, league_season, season_type, week)
                        if game:
                            all_games.append(game)
                    if limit and len(all_games) >= limit:
                        break
                if limit and len(all_games) >= limit:
                    break

        elif sport == "hockey":
            # NHL: fetch by date range (Oct to June)
            start = date(int(league_season), 10, 1)
            end = date(int(league_season) + 1, 6, 30)
            all_games = _fetch_schedule_by_dates(sport, league_key, start, end, delay, logger, limit)

        elif sport in ("tennis", "racing", "golf", "mma"):
            # These use scoreboard for current/recent events
            url = f"{ESPN_BASE}/{sport}/{league_key}/scoreboard"
            data = fetch_json(url, delay, logger)
            if data:
                events = data.get("events", [])
                for event in events:
                    game = _parse_event(event, league_key, sport, league_season)
                    if game:
                        all_games.append(game)

        if limit:
            all_games = all_games[:limit]

        logger.info(f"  Found {len(all_games)} games for {display}")

        if dry_run:
            for g in all_games[:5]:
                logger.info(f"    {g['match_date']} | {g['home_team']} vs {g['away_team']} [{g['status']}]")
        else:
            saved = db.upsert_games(all_games)
            logger.info(f"  Saved {saved} games for {display}")
            total += saved

    return total


def _fetch_schedule_by_dates(sport: str, league_key: str, start: date, end: date,
                              delay: float, logger: logging.Logger,
                              limit: Optional[int] = None) -> list[dict]:
    """Fetch schedule by iterating over date ranges (weekly chunks)."""
    games = []
    current = start
    season = LEAGUES[league_key]["season"]

    while current <= end:
        chunk_end = min(current + timedelta(days=6), end)
        date_range = f"{current.strftime('%Y%m%d')}-{chunk_end.strftime('%Y%m%d')}"
        url = f"{ESPN_BASE}/{sport}/{league_key}/scoreboard?dates={date_range}"

        data = fetch_json(url, delay, logger)
        if data:
            events = data.get("events", [])
            for event in events:
                game = _parse_event(event, league_key, sport, season)
                if game:
                    games.append(game)

        if limit and len(games) >= limit:
            break

        current = chunk_end + timedelta(days=1)

    return games


def _parse_event(event: dict, league_key: str, sport: str,
                 season: str, season_type: int = 2, week: Optional[int] = None) -> Optional[dict]:
    """Parse an ESPN event into a game record."""
    event_id = event.get("id", "")
    if not event_id:
        return None

    competitions = event.get("competitions", [])
    if not competitions:
        return None

    comp = competitions[0]
    competitors = comp.get("competitors", [])

    home = next((c for c in competitors if c.get("homeAway") == "home"), None)
    away = next((c for c in competitors if c.get("homeAway") == "away"), None)

    # For non-team sports (tennis, golf, etc.), handle differently
    if not home and not away and competitors:
        # Use first two competitors
        home = competitors[0] if len(competitors) > 0 else None
        away = competitors[1] if len(competitors) > 1 else None

    home_team_data = home.get("team", {}) if home else {}
    away_team_data = away.get("team", {}) if away else {}

    # Determine status
    status_info = event.get("status", {}).get("type", {})
    status_name = status_info.get("name", "")
    if status_name in ("STATUS_FINAL", "STATUS_FULL_TIME"):
        status = "completed"
    elif status_name == "STATUS_SCHEDULED":
        status = "scheduled"
    elif status_name in ("STATUS_POSTPONED", "STATUS_CANCELED"):
        status = "postponed"
    else:
        status = "in_progress"

    # Parse date
    event_date_str = event.get("date", "")
    try:
        event_dt = datetime.fromisoformat(event_date_str.replace("Z", "+00:00"))
        match_date = event_dt.date().isoformat()
        start_time = event_dt.isoformat()
    except (ValueError, AttributeError):
        match_date = date.today().isoformat()
        start_time = None

    # Parse scores
    home_score = None
    away_score = None
    if status == "completed" or status == "in_progress":
        try:
            home_score = int(home.get("score", 0)) if home else None
            away_score = int(away.get("score", 0)) if away else None
        except (ValueError, TypeError):
            pass

    # Odds
    odds_spread = None
    odds_ou = None
    odds_list = comp.get("odds", [])
    if odds_list and odds_list[0] and isinstance(odds_list[0], dict):
        odds_spread = odds_list[0].get("details", None)
        odds_ou = str(odds_list[0].get("overUnder", "")) if odds_list[0].get("overUnder") else None

    home_team_name = home_team_data.get("displayName", "") or home_team_data.get("name", "") or event.get("name", "").split(" at ")[1] if " at " in event.get("name", "") else "TBD"
    away_team_name = away_team_data.get("displayName", "") or away_team_data.get("name", "") or event.get("name", "").split(" at ")[0] if " at " in event.get("name", "") else "TBD"

    # Fix: if home/away names are still empty, parse from event name
    if home_team_name == "TBD" or away_team_name == "TBD":
        name_parts = event.get("name", "").split(" at ")
        if len(name_parts) == 2:
            away_team_name = name_parts[0].strip()
            home_team_name = name_parts[1].strip()
        else:
            name_parts = event.get("name", "").split(" vs ")
            if len(name_parts) == 2:
                home_team_name = name_parts[0].strip()
                away_team_name = name_parts[1].strip()

    return {
        "id": f"{league_key}-{event_id}",
        "event_id": event_id,
        "home_team_id": None,  # Skip FK to avoid constraint issues with relegated/missing teams
        "away_team_id": None,
        "home_team": home_team_name,
        "away_team": away_team_name,
        "home_score": home_score,
        "away_score": away_score,
        "sport": sport,
        "league": league_key,
        "season": season,
        "season_type": season_type,
        "week": week,
        "match_date": match_date,
        "start_time": start_time,
        "status": status,
        "venue": comp.get("venue", {}).get("fullName", None) if comp.get("venue") else None,
        "home_logo": home_team_data.get("logo", None),
        "away_logo": away_team_data.get("logo", None),
        "odds_spread": odds_spread,
        "odds_over_under": odds_ou,
        "raw_data": None,  # Skip to save space, can enable if needed
    }


# ============================================================
# Standings Scraping
# ============================================================

def scrape_standings(db: ESPNDatabase, delay: float, logger: logging.Logger,
                     league_filter: Optional[str] = None, season: Optional[str] = None,
                     dry_run: bool = False) -> int:
    """Scrape current standings for all team-sport leagues."""
    total = 0
    leagues_to_scrape = {league_filter: LEAGUES[league_filter]} if league_filter else LEAGUES

    for league_key, config in leagues_to_scrape.items():
        sport = config["sport"]
        if sport not in TEAM_SPORTS:
            continue

        league_season = season or config["season"]
        display = config["display"]

        # Standings endpoint uses /apis/v2/ (not /apis/site/v2/)
        url = f"{ESPN_STANDINGS}/{sport}/{league_key}/standings"
        logger.info(f"Fetching standings: {display}")

        data = fetch_json(url, delay, logger)
        if not data:
            # Fallback: try site API
            url = f"{ESPN_BASE}/{sport}/{league_key}/standings"
            data = fetch_json(url, delay, logger)
            if not data:
                continue

        standings = []
        # ESPN standings structure varies by sport
        children = data.get("children", [])
        if not children:
            # Some sports have standings directly
            children = [data]

        for group in children:
            group_name = group.get("name", "") or group.get("abbreviation", "")
            group_standings = group.get("standings", {}).get("entries", [])

            if not group_standings:
                # Try nested children (divisions within conferences)
                for subgroup in group.get("children", []):
                    sub_name = f"{group_name} - {subgroup.get('name', '')}"
                    sub_entries = subgroup.get("standings", {}).get("entries", [])
                    for idx, entry in enumerate(sub_entries):
                        record = _parse_standing_entry(entry, league_key, sport, league_season, sub_name, idx + 1)
                        if record:
                            standings.append(record)
                continue

            for idx, entry in enumerate(group_standings):
                record = _parse_standing_entry(entry, league_key, sport, league_season, group_name, idx + 1)
                if record:
                    standings.append(record)

        logger.info(f"  Found {len(standings)} standing entries for {display}")

        if dry_run:
            for s in standings[:5]:
                logger.info(f"    #{s['position']} {s['team_name']} ({s['group_name'] or 'Overall'})")
        else:
            saved = db.upsert_standings(standings)
            logger.info(f"  Saved {saved} standings for {display}")
            total += saved

    return total


def _parse_standing_entry(entry: dict, league_key: str, sport: str,
                           season: str, group_name: str, position: int) -> Optional[dict]:
    """Parse a single standings entry from ESPN."""
    team_info = entry.get("team", {})
    team_espn_id = str(team_info.get("id", ""))
    if not team_espn_id:
        return None

    team_name = team_info.get("displayName", team_info.get("name", ""))

    # Parse stats from the entry
    stats = {}
    for stat in entry.get("stats", []):
        stat_name = stat.get("name", "") or stat.get("abbreviation", "")
        stat_value = stat.get("value", stat.get("displayValue", ""))
        if stat_name:
            stats[stat_name.lower()] = stat_value

    # Extract common fields
    wins = _safe_int(stats.get("wins", stats.get("w", 0)))
    losses = _safe_int(stats.get("losses", stats.get("l", 0)))
    draws = _safe_int(stats.get("draws", stats.get("d", stats.get("ties", 0))))
    games_played = _safe_int(stats.get("gamesplayed", stats.get("gp", 0)))
    points = _safe_int(stats.get("points", stats.get("pts", None)))

    # Sport-specific fields
    goals_for = _safe_int(stats.get("pointsfor", stats.get("goalsfor", None)))
    goals_against = _safe_int(stats.get("pointsagainst", stats.get("goalsagainst", None)))
    goal_diff = _safe_int(stats.get("pointdifferential", stats.get("goaldifference", None)))
    win_pct = _safe_float(stats.get("winpercent", stats.get("winpct", None)))
    streak = stats.get("streak", None)
    if isinstance(streak, (int, float)):
        streak = str(streak)

    # NFL specific
    points_for = _safe_int(stats.get("pointsfor", None)) if sport == "football" else None
    points_against = _safe_int(stats.get("pointsagainst", None)) if sport == "football" else None

    # NHL specific
    ot_losses = _safe_int(stats.get("otlosses", stats.get("overtimelosses", 0)))

    return {
        "id": f"{league_key}-{season}-{team_espn_id}",
        "team_id": f"{league_key}-{team_espn_id}",
        "team_name": team_name,
        "league": league_key,
        "sport": sport,
        "season": season,
        "group_name": group_name,
        "position": position,
        "wins": wins,
        "losses": losses,
        "draws": draws,
        "overtime_losses": ot_losses,
        "points": points,
        "win_pct": win_pct,
        "games_played": games_played or (wins + losses + draws),
        "goals_for": goals_for if sport == "soccer" else None,
        "goals_against": goals_against if sport == "soccer" else None,
        "goal_difference": goal_diff if sport == "soccer" else None,
        "points_for": points_for,
        "points_against": points_against,
        "streak": str(streak) if streak else None,
        "home_record": stats.get("home", stats.get("homerecord", None)),
        "away_record": stats.get("away", stats.get("awayrecord", None)),
        "last_10": stats.get("last10record", None),
        "raw_data": None,
    }


# ============================================================
# Player Stats Scraping (from game summaries)
# ============================================================

def scrape_stats(db: ESPNDatabase, delay: float, logger: logging.Logger,
                 league_filter: Optional[str] = None, limit: int = 50,
                 dry_run: bool = False) -> int:
    """Scrape player stats from completed game summaries."""
    total = 0
    leagues_to_scrape = {league_filter: LEAGUES[league_filter]} if league_filter else LEAGUES

    for league_key, config in leagues_to_scrape.items():
        sport = config["sport"]
        if sport not in TEAM_SPORTS:
            continue

        display = config["display"]
        logger.info(f"Fetching player stats for completed games: {display}")

        games = db.get_completed_games_without_stats(league_key, limit)
        if not games:
            logger.info(f"  No games needing stats for {display}")
            continue

        logger.info(f"  Found {len(games)} games needing stats")

        for game in games:
            event_id = game["event_id"]
            game_id = game["id"]
            sport_path = f"{sport}/{league_key}"

            summary_url = f"{ESPN_BASE}/{sport_path}/summary?event={event_id}"
            data = fetch_json(summary_url, delay, logger)
            if not data:
                continue

            stats = _parse_boxscore(data, game_id, league_key, sport, game.get("match_date", ""))
            if stats:
                if dry_run:
                    logger.info(f"    [DRY RUN] {len(stats)} player stats for {game.get('home_team')} vs {game.get('away_team')}")
                else:
                    saved = db.upsert_player_stats(stats)
                    total += saved
                    logger.info(f"    Saved {saved} player stats for event {event_id}")
            else:
                logger.info(f"    No boxscore data for event {event_id}")

    return total


def _parse_boxscore(data: dict, game_id: str, league_key: str,
                     sport: str, match_date: str) -> list[dict]:
    """Parse player stats from ESPN summary. Handles both formats:
    - NFL/NHL: boxscore.players[].statistics[].athletes[]
    - Soccer: rosters[].roster[].stats[]
    """
    stats = []
    event_id = game_id.split("-")[-1]

    # ─── Format 1: boxscore.players (NFL, NHL) ───────────────────────────
    boxscore = data.get("boxscore", {})
    players_data = boxscore.get("players", [])

    if players_data:
        for team_group in players_data:
            team_name = team_group.get("team", {}).get("displayName", "Unknown")
            statistics = team_group.get("statistics", [])

            for stat_block in statistics:
                labels = stat_block.get("labels", [])
                athletes = stat_block.get("athletes", [])
                stat_type = stat_block.get("name", "general")

                for athlete in athletes:
                    athlete_info = athlete.get("athlete", {})
                    athlete_id = str(athlete_info.get("id", ""))
                    if not athlete_id:
                        continue

                    athlete_name = athlete_info.get("displayName", "")
                    athlete_stats = athlete.get("stats", [])

                    # Build stats dict from labels + values
                    stat_dict = {"stat_type": stat_type}
                    for i, label in enumerate(labels):
                        if i < len(athlete_stats):
                            stat_dict[label] = athlete_stats[i]

                    # Use composite key: league-eventId-athleteId-statType
                    record = {
                        "id": f"{league_key}-{event_id}-{athlete_id}-{stat_type}",
                        "game_id": game_id,
                        "player_id": f"{league_key}-{athlete_id}",
                        "player_name": athlete_name,
                        "team": team_name,
                        "sport": sport,
                        "league": league_key,
                        "match_date": match_date,
                        "stats": json.dumps(stat_dict),
                    }
                    stats.append(record)
        return stats

    # ─── Format 2: rosters (Soccer) ──────────────────────────────────────
    rosters = data.get("rosters", [])
    if rosters:
        for team_group in rosters:
            team_info = team_group.get("team", {})
            team_name = team_info.get("displayName", team_info.get("name", "Unknown"))
            roster = team_group.get("roster", [])

            for player in roster:
                athlete_info = player.get("athlete", {})
                athlete_id = str(athlete_info.get("id", ""))
                if not athlete_id:
                    continue

                athlete_name = athlete_info.get("displayName", "")
                player_stats = player.get("stats", [])

                if not player_stats:
                    continue

                # Build stats dict from the stats array
                stat_dict = {
                    "starter": player.get("starter", False),
                    "position": player.get("position", {}).get("abbreviation", "") if isinstance(player.get("position"), dict) else "",
                }
                for stat_entry in player_stats:
                    name = stat_entry.get("name", stat_entry.get("abbreviation", ""))
                    value = stat_entry.get("displayValue", stat_entry.get("value", ""))
                    if name:
                        stat_dict[name] = value

                record = {
                    "id": f"{league_key}-{event_id}-{athlete_id}",
                    "game_id": game_id,
                    "player_id": f"{league_key}-{athlete_id}",
                    "player_name": athlete_name,
                    "team": team_name,
                    "sport": sport,
                    "league": league_key,
                    "match_date": match_date,
                    "stats": json.dumps(stat_dict),
                }
                stats.append(record)

    return stats


# ============================================================
# Daily Mode
# ============================================================

def scrape_daily(db: ESPNDatabase, delay: float, logger: logging.Logger,
                 league_filter: Optional[str] = None, dry_run: bool = False) -> dict:
    """Quick daily refresh: fetch recent scores (today + past DAILY_WINDOW_DAYS) and update standings."""
    results = {"games": 0, "standings": 0}
    leagues_to_scrape = {league_filter: LEAGUES[league_filter]} if league_filter else LEAGUES

    today = date.today()

    for league_key, config in leagues_to_scrape.items():
        sport = config["sport"]
        display = config["display"]
        season = config["season"]

        # Fetch scoreboard for today + recent days to catch completed games
        for day_offset in range(DAILY_WINDOW_DAYS + 1):
            target_date = today - timedelta(days=day_offset)
            date_str = target_date.strftime("%Y%m%d")
            url = f"{ESPN_BASE}/{sport}/{league_key}/scoreboard?dates={date_str}"
            if day_offset == 0:
                logger.info(f"Daily: {display} (today + {DAILY_WINDOW_DAYS} days back)")

            data = fetch_json(url, delay, logger)
            if data:
                events = data.get("events", [])
                games = []
                for event in events:
                    game = _parse_event(event, league_key, sport, season)
                    if game:
                        games.append(game)

                if games:
                    if dry_run:
                        logger.info(f"  [DRY RUN] {len(games)} games on {target_date.isoformat()} for {display}")
                    else:
                        saved = db.upsert_games(games)
                        results["games"] += saved
                        if saved > 0:
                            logger.info(f"  Saved {saved} games on {target_date.isoformat()} for {display}")

    # Also refresh standings
    standings_count = scrape_standings(db, delay, logger, league_filter, dry_run=dry_run)
    results["standings"] = standings_count

    return results


# ============================================================
# Helpers
# ============================================================

def _safe_int(val) -> Optional[int]:
    if val is None:
        return None
    try:
        return int(float(val))
    except (ValueError, TypeError):
        return None


def _safe_float(val) -> Optional[float]:
    if val is None:
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None


# ============================================================
# CLI
# ============================================================

def parse_args():
    parser = argparse.ArgumentParser(
        description="ESPN Sports Data Scraper (all sports except basketball)"
    )
    parser.add_argument(
        "mode",
        choices=["full", "teams", "rosters", "schedule", "standings", "stats", "daily"],
        help="Scraping mode"
    )
    parser.add_argument("--league", type=str, default=None, help="Filter to specific league key (e.g. eng.1, nfl)")
    parser.add_argument("--delay", type=float, default=1.0, help="Delay between requests in seconds (default: 1.0)")
    parser.add_argument("--limit", type=int, default=None, help="Max items to process per category")
    parser.add_argument("--season", type=str, default=None, help="Season year override")
    parser.add_argument("--dry-run", action="store_true", help="Print data without writing to DB")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    logger = setup_logging()

    # Validate league filter
    if args.league and args.league not in LEAGUES:
        logger.error(f"Invalid league: {args.league}. Valid: {list(LEAGUES.keys())}")
        return 1

    # Validate delay
    if not (0.5 <= args.delay <= 10):
        logger.error("Delay must be between 0.5 and 10 seconds")
        return 1

    logger.info(f"=== ESPN Scraper starting: mode={args.mode}, league={args.league or 'all'} ===")
    start_time = time.time()

    # Load env
    env_path = Path(__file__).resolve().parent.parent / ".env.local"
    load_dotenv(env_path)

    supabase_url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

    if not supabase_url or not supabase_key:
        logger.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local")
        return 1

    db = ESPNDatabase(supabase_url, supabase_key)

    # Execute mode
    results = {}

    if args.mode == "full":
        logger.info("--- Phase 1: Teams ---")
        results["teams"] = scrape_teams(db, args.delay, logger, args.league, args.dry_run)

        logger.info("--- Phase 2: Rosters ---")
        results["players"] = scrape_rosters(db, args.delay, logger, args.league, args.limit, args.dry_run)

        logger.info("--- Phase 3: Schedule ---")
        results["games"] = scrape_schedule(db, args.delay, logger, args.league, args.season, args.limit, args.dry_run)

        logger.info("--- Phase 4: Standings ---")
        results["standings"] = scrape_standings(db, args.delay, logger, args.league, args.season, args.dry_run)

        logger.info("--- Phase 5: Player Stats ---")
        results["stats"] = scrape_stats(db, args.delay, logger, args.league, args.limit or 50, args.dry_run)

    elif args.mode == "teams":
        results["teams"] = scrape_teams(db, args.delay, logger, args.league, args.dry_run)

    elif args.mode == "rosters":
        results["players"] = scrape_rosters(db, args.delay, logger, args.league, args.limit, args.dry_run)

    elif args.mode == "schedule":
        results["games"] = scrape_schedule(db, args.delay, logger, args.league, args.season, args.limit, args.dry_run)

    elif args.mode == "standings":
        results["standings"] = scrape_standings(db, args.delay, logger, args.league, args.season, args.dry_run)

    elif args.mode == "stats":
        results["stats"] = scrape_stats(db, args.delay, logger, args.league, args.limit or 50, args.dry_run)

    elif args.mode == "daily":
        results = scrape_daily(db, args.delay, logger, args.league, args.dry_run)

    elapsed = time.time() - start_time
    logger.info(f"=== ESPN Scraper finished in {elapsed:.1f}s ===")
    logger.info(f"Results: {json.dumps(results, indent=2)}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
