"""
Tennis Tournament Scraper using Scrapling
Scrapes tennisabstract.com for match data and player statistics.

Usage:
  python scrape_tennis.py <mode> --tournament <url> [options]

Modes:
  daily        - Full workflow: matches + delta detection + player stats
  matches-only - Only scrape tournament page and update matches
  stats-only   - Only scrape player profiles and update stats

Options:
  --tournament URL   Tournament page URL (required)
  --delay SECONDS    Delay between requests (default: 3)
  --limit N          Max players to scrape stats for

Environment variables (from ../.env.local):
  NEXT_PUBLIC_SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
"""

import os
import sys
import time
import argparse
import logging
import json
import re
from logging.handlers import RotatingFileHandler
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from scrapling.fetchers import Fetcher
from supabase import create_client, Client


# ============================================================
# Logging
# ============================================================

def setup_logging() -> logging.Logger:
    logger = logging.getLogger("tennis_scraper")
    logger.setLevel(logging.INFO)
    fmt = logging.Formatter("%(asctime)s [%(levelname)s] %(message)s", datefmt="%Y-%m-%dT%H:%M:%SZ")

    stdout_handler = logging.StreamHandler(sys.stdout)
    stdout_handler.setFormatter(fmt)
    logger.addHandler(stdout_handler)

    log_dir = Path(__file__).resolve().parent / "logs"
    log_dir.mkdir(exist_ok=True)
    file_handler = RotatingFileHandler(log_dir / "tennis_scraper.log", maxBytes=10_000_000, backupCount=5)
    file_handler.setFormatter(fmt)
    logger.addHandler(file_handler)

    return logger


# ============================================================
# Database
# ============================================================

class TennisDatabase:
    def __init__(self, url: str, key: str):
        self.client: Client = create_client(url, key)
        self.logger = logging.getLogger("tennis_scraper")

    # --- Matches ---
    def upsert_match(self, match: dict) -> Optional[dict]:
        """Upsert a match record. Returns the record."""
        try:
            result = self.client.table("tennis_matches").upsert(
                match, on_conflict="tournament,round,player1_name,player2_name"
            ).execute()
            return result.data[0] if result.data else None
        except Exception as e:
            self.logger.error(f"DB match upsert failed: {e}")
            return None

    def upsert_matches_batch(self, matches: list[dict]) -> int:
        """Batch upsert matches. Returns count."""
        count = 0
        batch_size = 50
        for i in range(0, len(matches), batch_size):
            batch = matches[i:i + batch_size]
            try:
                result = self.client.table("tennis_matches").upsert(
                    batch, on_conflict="tournament,round,player1_name,player2_name"
                ).execute()
                count += len(result.data) if result.data else 0
            except Exception as e:
                self.logger.error(f"DB match batch upsert failed: {e}")
                # Fallback to individual
                for m in batch:
                    if self.upsert_match(m):
                        count += 1
        return count

    def get_upcoming_matches(self, tournament: str) -> list[dict]:
        """Get all upcoming matches for a tournament."""
        result = (
            self.client.table("tennis_matches")
            .select("*")
            .eq("tournament", tournament)
            .eq("status", "upcoming")
            .execute()
        )
        return result.data or []

    def mark_match_completed(self, match_id: str, winner: str, score: str) -> bool:
        """Update a match from upcoming to completed."""
        try:
            self.client.table("tennis_matches").update({
                "status": "completed",
                "winner_name": winner,
                "score": score,
                "completed_at": datetime.now(timezone.utc).isoformat(),
            }).eq("id", match_id).execute()
            return True
        except Exception as e:
            self.logger.error(f"DB mark completed failed: {e}")
            return False

    # --- Players ---
    def upsert_player(self, player: dict) -> Optional[dict]:
        """Upsert a player record."""
        try:
            result = self.client.table("tennis_players").upsert(
                player, on_conflict="player_name"
            ).execute()
            return result.data[0] if result.data else None
        except Exception as e:
            self.logger.error(f"DB player upsert failed: {e}")
            return None

    def get_tournament_players(self, tournament: str) -> list[dict]:
        """Get all players involved in a tournament."""
        result = (
            self.client.table("tennis_matches")
            .select("player1_name,player2_name")
            .eq("tournament", tournament)
            .execute()
        )
        players = set()
        for row in (result.data or []):
            if row.get("player1_name"):
                players.add(row["player1_name"])
            if row.get("player2_name"):
                players.add(row["player2_name"])
        return list(players)

    # --- Stats ---
    def upsert_serve_stats(self, stats: dict) -> bool:
        try:
            self.client.table("tennis_serve_stats").upsert(
                stats, on_conflict="player_name,surface,stat_year"
            ).execute()
            return True
        except Exception as e:
            self.logger.error(f"DB serve stats upsert failed: {e}")
            return False

    def upsert_raw_stats(self, stats: dict) -> bool:
        try:
            self.client.table("tennis_raw_stats").upsert(
                stats, on_conflict="player_name,surface,stat_year"
            ).execute()
            return True
        except Exception as e:
            self.logger.error(f"DB raw stats upsert failed: {e}")
            return False

    def upsert_return_stats(self, stats: dict) -> bool:
        try:
            self.client.table("tennis_return_stats").upsert(
                stats, on_conflict="player_name,surface,stat_year"
            ).execute()
            return True
        except Exception as e:
            self.logger.error(f"DB return stats upsert failed: {e}")
            return False

    # --- Line History ---
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


# ============================================================
# Tournament Page Scraping
# ============================================================

def fetch_tournament_page(url: str, logger: logging.Logger) -> Optional[dict]:
    """Fetch tournament page and extract JS variables. Returns dict of variable values."""
    try:
        page = Fetcher.get(url, stealthy_headers=True, timeout=30)
        if page.status != 200:
            logger.error(f"Tournament page HTTP {page.status}: {url}")
            return None
    except Exception as e:
        logger.error(f"Tournament page fetch failed: {e}")
        return None

    # Get head HTML and extract the big inline script
    head = page.css('head').first
    head_html = head.html_content

    scripts = re.findall(r'<script[^>]*>(.*?)</script>', head_html, re.DOTALL)
    big_scripts = [s for s in scripts if len(s) > 10000]

    if not big_scripts:
        logger.warning("No large script block found on tournament page")
        return None

    big_script = big_scripts[0]

    # Extract JS variables
    variables = {}
    for var_name in ['upcomingSingles', 'completedSingles', 'upcomingDoubles', 'completedDoubles']:
        match = re.search(rf"var\s+{var_name}\s*=\s*'(.*?)';", big_script, re.DOTALL)
        if match:
            variables[var_name] = match.group(1)
        else:
            variables[var_name] = ''

    return variables


def parse_completed_matches(html_str: str, tournament: str) -> list[dict]:
    """Parse completed matches from HTML string."""
    matches = []
    if not html_str.strip():
        return matches

    lines = re.split(r'<br\s*/?>', html_str)
    for line in lines:
        line = line.strip()
        if not line or line == '&nbsp;':
            continue

        # Strip HTML tags to get plain text
        clean = re.sub(r'<[^>]+>', '', line).strip()
        # Remove &nbsp;
        clean = clean.replace('&nbsp;', '').strip()
        if not clean:
            continue

        # Pattern: "R128: Player Name (CTY) d. Player Name (CTY) 6-3 7-5"
        match = re.match(
            r'^(R\d+|R128|QF|SF|F|Q\d*|RR):\s*(.+?)\s+d\.\s+(.+?)\s+([\d][\d\-\(\) WO]+.*)$',
            clean
        )

        if match:
            round_code = match.group(1)
            winner_raw = match.group(2).strip()
            loser_raw = match.group(3).strip()
            score = match.group(4).strip()

            # Extract player name (remove seed/qualifier prefix and country suffix)
            winner_name = extract_player_name(winner_raw)
            loser_name = extract_player_name(loser_raw)

            if winner_name and loser_name:
                # Sort player names for consistent dedup key
                p1, p2 = sorted([winner_name, loser_name])
                matches.append({
                    "tournament": tournament,
                    "round": round_code,
                    "player1_name": p1,
                    "player2_name": p2,
                    "status": "completed",
                    "winner_name": winner_name,
                    "score": score,
                    "scraped_at": datetime.now(timezone.utc).isoformat(),
                    "completed_at": datetime.now(timezone.utc).isoformat(),
                })

    return matches


def parse_upcoming_matches(html_str: str, tournament: str) -> list[dict]:
    """Parse upcoming matches from HTML string."""
    matches = []
    if not html_str.strip():
        return matches

    lines = re.split(r'<br\s*/?>', html_str)
    for line in lines:
        line = line.strip()
        if not line or line == '&nbsp;':
            continue

        clean = re.sub(r'<[^>]+>', '', line).strip()
        clean = clean.replace('&nbsp;', '').strip()
        if not clean:
            continue

        # Pattern: "R1: Player Name (CTY) vs Player Name (CTY) [1-2]"
        # The H2H in brackets is optional
        match = re.match(
            r'^(R\d+|R128|QF|SF|F|Q\d*|RR):\s*(.+?)\s+vs\s+(.+?)(?:\s+\[.*?\])?\s*$',
            clean
        )

        if match:
            round_code = match.group(1)
            player1_raw = match.group(2).strip()
            player2_raw = match.group(3).strip()

            player1_name = extract_player_name(player1_raw)
            player2_name = extract_player_name(player2_raw)

            if player1_name and player2_name:
                p1, p2 = sorted([player1_name, player2_name])
                matches.append({
                    "tournament": tournament,
                    "round": round_code,
                    "player1_name": p1,
                    "player2_name": p2,
                    "status": "upcoming",
                    "winner_name": None,
                    "score": None,
                    "scraped_at": datetime.now(timezone.utc).isoformat(),
                    "completed_at": None,
                })

    return matches


def extract_player_name(raw: str) -> str:
    """Extract clean player name from raw string like '(Q)Player Name (CTY)' or '(1)Player Name (CTY)'."""
    # Remove leading seed/qualifier: (1), (Q), (WC), (LL), (PR), (Alt)
    cleaned = re.sub(r'^\(\w+\)', '', raw).strip()
    # Remove trailing country: (USA), (ESP), etc.
    cleaned = re.sub(r'\s*\([A-Z]{2,3}\)\s*$', '', cleaned).strip()
    return cleaned


def get_tournament_id(url: str) -> str:
    """Extract tournament identifier from URL."""
    # https://www.tennisabstract.com/current/2026ATPRome.html -> 2026ATPRome
    filename = url.rstrip('/').split('/')[-1]
    return filename.replace('.html', '')


def _parse_sets_from_score(score: str, player_won: bool) -> tuple[int, int]:
    """
    Parse sets won/lost from a score string like '6-4 7-5' or '6-4 3-6 6-3'.
    Returns (sets_won, sets_lost) for the player.
    Handles walkovers (W/O), retirements (ret.), and tiebreaks.
    """
    if not score or score in ('W/O', 'w/o', 'Walkover'):
        return (0, 0)

    # Strip retirement suffix
    score = re.sub(r'\s*(ret\.?|RET\.?|retired).*$', '', score, flags=re.IGNORECASE).strip()

    # Match set scores: digits-digits optionally followed by tiebreak (7)
    set_pattern = re.findall(r'(\d+)-(\d+)(?:\(\d+\))?', score)
    if not set_pattern:
        return (0, 0)

    sets_won = 0
    sets_lost = 0
    for p_games, o_games in set_pattern:
        p, o = int(p_games), int(o_games)
        if p > o:
            sets_won += 1
        elif o > p:
            sets_lost += 1
        # tied sets (rare, e.g. incomplete) ignored

    return (sets_won, sets_lost)


# ============================================================
# Delta Detection
# ============================================================

def detect_deltas(
    completed_matches: list[dict],
    db_upcoming: list[dict],
    logger: logging.Logger
) -> list[dict]:
    """Find matches that transitioned from upcoming to completed. Returns list of updates."""
    deltas = []

    # Build lookup from completed matches
    completed_lookup = {}
    for m in completed_matches:
        key = (m["tournament"], m["round"], m["player1_name"], m["player2_name"])
        completed_lookup[key] = m

    # Check each DB upcoming match
    for db_match in db_upcoming:
        key = (db_match["tournament"], db_match["round"], db_match["player1_name"], db_match["player2_name"])
        if key in completed_lookup:
            completed = completed_lookup[key]
            deltas.append({
                "id": db_match["id"],
                "winner_name": completed["winner_name"],
                "score": completed["score"],
            })

    return deltas


# ============================================================
# Player Profile Scraping
# ============================================================

def build_profile_url(player_name: str) -> str:
    """Build tennisabstract profile URL from player name."""
    # Remove special chars, make CamelCase
    # "Alex Michelsen" -> "AlexMichelsen"
    # "Carlos Alcaraz" -> "CarlosAlcaraz"
    clean = re.sub(r'[^a-zA-Z\s]', '', player_name)
    camel = clean.replace(' ', '')
    return f"https://www.tennisabstract.com/cgi-bin/player-classic.cgi?p={camel}"


def scrape_player_stats(player_name: str, delay: float, logger: logging.Logger) -> Optional[dict]:
    """Scrape a player's profile page and extract match-level stats for aggregation."""
    url = build_profile_url(player_name)
    logger.info(f"    Fetching: {player_name}")

    try:
        page = Fetcher.get(url, stealthy_headers=True, timeout=30)
        if page.status != 200:
            # Try WTA URL
            camel = re.sub(r'[^a-zA-Z\s]', '', player_name).replace(' ', '')
            url2 = f"https://www.tennisabstract.com/cgi-bin/wplayer-classic.cgi?p={camel}"
            page = Fetcher.get(url2, stealthy_headers=True, timeout=30)
            if page.status != 200:
                logger.warning(f"    HTTP {page.status} for {player_name}")
                return None
    except Exception as e:
        logger.error(f"    Fetch error for {player_name}: {e}")
        return None

    # Extract the big script
    head = page.css('head').first
    head_html = head.html_content
    scripts = re.findall(r'<script[^>]*>(.*?)</script>', head_html, re.DOTALL)
    big_scripts = [s for s in scripts if len(s) > 5000]

    if not big_scripts:
        logger.warning(f"    No data script found for {player_name}")
        return None

    big_script = big_scripts[0]

    # Extract matchhead and matchmx
    head_match = re.search(r'var matchhead\s*=\s*\[(.*?)\]', big_script, re.DOTALL)
    data_match = re.search(r'var matchmx\s*=\s*\[(.*?)\];\s*\n', big_script, re.DOTALL)

    if not head_match or not data_match:
        logger.warning(f"    Could not find matchmx for {player_name}")
        return None

    # Parse headers
    headers_raw = head_match.group(1)
    headers = [h.strip().strip('"').strip("'") for h in headers_raw.split(',')]

    # Parse match data - it's a 2D array
    # Each row is like ["20260506", "ATP Rome", "Clay", ...]
    data_raw = data_match.group(1)

    try:
        # The data is JS array syntax - parse rows
        rows = re.findall(r'\[([^\]]+)\]', data_raw)
        matches = []
        for row_str in rows:
            # Parse values: "string", number, or ""
            values = []
            for token in re.split(r',\s*', row_str):
                token = token.strip()
                if token.startswith('"') and token.endswith('"'):
                    values.append(token[1:-1])
                elif token.isdigit():
                    values.append(token)
                else:
                    values.append(token.strip('"'))
            
            if len(values) >= len(headers):
                match_dict = dict(zip(headers, values))
                matches.append(match_dict)
            elif len(values) >= 20:
                # Partial row, still usable
                match_dict = dict(zip(headers[:len(values)], values))
                matches.append(match_dict)
    except Exception as e:
        logger.warning(f"    Parse error for {player_name}: {e}")
        return None

    # Aggregate stats by surface and year
    return aggregate_player_stats(player_name, matches, headers)


def aggregate_player_stats(player_name: str, matches: list[dict], headers: list[str]) -> dict:
    """Aggregate match-level data into surface/year stats."""
    stats = {
        "player_name": player_name,
        "serve_stats": [],
        "raw_stats": [],
        "return_stats": [],
    }

    # Group by surface and year
    groups = {}
    for m in matches:
        surface = m.get("surf", "Unknown")
        date_str = m.get("date", "")
        year = date_str[:4] if len(date_str) >= 4 else "Unknown"

        if surface not in ("Hard", "Clay", "Grass"):
            continue

        key = (surface, year)
        if key not in groups:
            groups[key] = []
        groups[key].append(m)

    now = datetime.now(timezone.utc).isoformat()

    for (surface, year), group_matches in groups.items():
        # Compute serve stats
        total_aces = 0
        total_dfs = 0
        total_pts = 0
        total_firsts = 0
        total_fwon = 0
        total_swon = 0
        wins = 0
        losses = 0
        total_sets_won = 0
        total_sets_lost = 0
        total_games_won = 0
        total_games_lost = 0
        matches_count = len(group_matches)

        for m in group_matches:
            try:
                total_aces += int(m.get("aces", 0) or 0)
                total_dfs += int(m.get("dfs", 0) or 0)
                total_pts += int(m.get("pts", 0) or 0)
                total_firsts += int(m.get("firsts", 0) or 0)
                total_fwon += int(m.get("fwon", 0) or 0)
                total_swon += int(m.get("swon", 0) or 0)
                # Games won/lost from raw columns
                total_games_won += int(m.get("games", 0) or 0)
                total_games_lost += int(m.get("ogames", 0) or 0)
                if m.get("wl") == "W":
                    wins += 1
                elif m.get("wl") == "L":
                    losses += 1
                # Parse sets from score string e.g. "6-4 7-5" or "6-4 3-6 6-3"
                score = m.get("score", "") or ""
                sw, sl = _parse_sets_from_score(score, m.get("wl", "") == "W")
                total_sets_won += sw
                total_sets_lost += sl
            except (ValueError, TypeError):
                continue

        # Compute percentages
        first_in_pct = round(total_firsts / total_pts * 100, 1) if total_pts > 0 else None
        first_won_pct = round(total_fwon / total_firsts * 100, 1) if total_firsts > 0 else None
        second_pts = total_pts - total_firsts
        second_won_pct = round(total_swon / second_pts * 100, 1) if second_pts > 0 else None

        stats["serve_stats"].append({
            "player_name": player_name,
            "surface": surface,
            "stat_year": year,
            "matches_played": matches_count,
            "first_serve_pct": first_in_pct,
            "first_serve_win_pct": first_won_pct,
            "second_serve_win_pct": second_won_pct,
            "aces_per_match": round(total_aces / matches_count, 1) if matches_count > 0 else None,
            "dfs_per_match": round(total_dfs / matches_count, 1) if matches_count > 0 else None,
            "updated_at": now,
        })

        stats["raw_stats"].append({
            "player_name": player_name,
            "surface": surface,
            "stat_year": year,
            "matches_played": matches_count,
            "matches_won": wins,
            "matches_lost": losses,
            "win_pct": round(wins / matches_count * 100, 1) if matches_count > 0 else None,
            "sets_won": round(total_sets_won / matches_count, 2) if matches_count > 0 else None,
            "sets_lost": round(total_sets_lost / matches_count, 2) if matches_count > 0 else None,
            "games_won": round(total_games_won / matches_count, 1) if matches_count > 0 else None,
            "games_lost": round(total_games_lost / matches_count, 1) if matches_count > 0 else None,
            "updated_at": now,
        })

        # Return stats
        total_oaces = 0
        total_opts = 0
        total_ofirsts = 0
        total_ofwon = 0
        total_oswon = 0

        for m in group_matches:
            try:
                total_oaces += int(m.get("oaces", 0) or 0)
                total_opts += int(m.get("opts", 0) or 0)
                total_ofirsts += int(m.get("ofirsts", 0) or 0)
                total_ofwon += int(m.get("ofwon", 0) or 0)
                total_oswon += int(m.get("oswon", 0) or 0)
            except (ValueError, TypeError):
                continue

        ret_vs_first_pct = round((total_ofirsts - total_ofwon) / total_ofirsts * 100, 1) if total_ofirsts > 0 else None
        opp_second_pts = total_opts - total_ofirsts
        ret_vs_second_pct = round((opp_second_pts - total_oswon) / opp_second_pts * 100, 1) if opp_second_pts > 0 else None

        stats["return_stats"].append({
            "player_name": player_name,
            "surface": surface,
            "stat_year": year,
            "return_vs_first_pct": ret_vs_first_pct,
            "return_vs_second_pct": ret_vs_second_pct,
            "updated_at": now,
        })

    return stats


# ============================================================
# Main Workflow
# ============================================================

def run_matches(tournament_url: str, db: TennisDatabase, logger: logging.Logger) -> tuple[int, int, int]:
    """Scrape tournament page and update matches. Returns (upcoming, completed, deltas)."""
    tournament_id = get_tournament_id(tournament_url)
    logger.info(f"Scraping tournament: {tournament_id}")

    # Fetch and parse
    variables = fetch_tournament_page(tournament_url, logger)
    if not variables:
        return 0, 0, 0

    upcoming = parse_upcoming_matches(variables.get('upcomingSingles', ''), tournament_id)
    completed = parse_completed_matches(variables.get('completedSingles', ''), tournament_id)

    logger.info(f"  Parsed: {len(upcoming)} upcoming, {len(completed)} completed")

    # Delta detection
    db_upcoming = db.get_upcoming_matches(tournament_id)
    deltas = detect_deltas(completed, db_upcoming, logger)

    if deltas:
        logger.info(f"  Delta: {len(deltas)} matches newly completed")
        for d in deltas:
            db.mark_match_completed(d["id"], d["winner_name"], d["score"])

    # Upsert all matches
    all_matches = upcoming + completed
    if all_matches:
        count = db.upsert_matches_batch(all_matches)
        logger.info(f"  Saved {count} match records to DB")

    # Ensure all players exist
    all_players = set()
    for m in all_matches:
        all_players.add(m["player1_name"])
        all_players.add(m["player2_name"])

    for player in all_players:
        if player:
            db.upsert_player({
                "player_name": player,
                "profile_url": build_profile_url(player),
            })

    return len(upcoming), len(completed), len(deltas)


def run_stats(tournament_url: str, db: TennisDatabase, delay: float, limit: Optional[int], logger: logging.Logger) -> tuple[int, int]:
    """Scrape player profiles and update stats. Returns (players_scraped, stats_upserted)."""
    tournament_id = get_tournament_id(tournament_url)
    players = db.get_tournament_players(tournament_id)

    if limit:
        players = players[:limit]

    logger.info(f"  Scraping stats for {len(players)} players")

    players_scraped = 0
    stats_upserted = 0
    line_history_recorded = 0

    for i, player_name in enumerate(players):
        if not player_name:
            continue

        logger.info(f"  [{i+1}/{len(players)}] {player_name}")
        stats = scrape_player_stats(player_name, delay, logger)

        if stats:
            players_scraped += 1
            for s in stats.get("serve_stats", []):
                if db.upsert_serve_stats(s):
                    stats_upserted += 1
                    # Record line history for tennis serve stats (aces)
                    aces_per_match = s.get("aces_per_match")
                    if aces_per_match and aces_per_match > 0:
                        prop_line = round(aces_per_match * 2) / 2  # round to nearest 0.5
                        if prop_line > 0 and db.record_line_history(player_name, "Tennis", "aces", prop_line):
                            line_history_recorded += 1
                    # Record first serve % as a prop line
                    first_serve_pct = s.get("first_serve_pct")
                    if first_serve_pct and first_serve_pct > 0:
                        prop_line = round(first_serve_pct * 2) / 2
                        if prop_line > 0 and db.record_line_history(player_name, "Tennis", "first_serve", prop_line):
                            line_history_recorded += 1
            for s in stats.get("raw_stats", []):
                if db.upsert_raw_stats(s):
                    stats_upserted += 1
                    # Record win % as a prop line
                    win_pct = s.get("win_pct")
                    if win_pct and win_pct > 0:
                        prop_line = round(win_pct * 2) / 2
                        if prop_line > 0 and db.record_line_history(player_name, "Tennis", "win_pct", prop_line):
                            line_history_recorded += 1
            for s in stats.get("return_stats", []):
                if db.upsert_return_stats(s):
                    stats_upserted += 1

        time.sleep(delay)

    if line_history_recorded > 0:
        logger.info(f"  Recorded {line_history_recorded} tennis prop line history entries")

    return players_scraped, stats_upserted


# ============================================================
# CLI
# ============================================================

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Tennis Tournament Scraper")
    parser.add_argument("mode", choices=["daily", "matches-only", "stats-only"])
    parser.add_argument("--tournament", required=True, help="Tournament page URL")
    parser.add_argument("--delay", type=float, default=3.0)
    parser.add_argument("--limit", type=int, default=None)

    args = parser.parse_args()

    if args.delay < 1 or args.delay > 30:
        parser.error("--delay must be between 1 and 30")

    return args


def main() -> int:
    args = parse_args()
    logger = setup_logging()

    logger.info("=" * 60)
    logger.info(f"Tennis Scraper | Mode: {args.mode} | {datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')}")
    logger.info(f"Tournament: {args.tournament}")
    logger.info("=" * 60)

    # Load env
    env_path = Path(__file__).resolve().parent.parent / ".env.local"
    load_dotenv(env_path)

    supabase_url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

    if not supabase_url or not supabase_key:
        logger.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
        return 1

    db = TennisDatabase(supabase_url, supabase_key)

    upcoming_count = 0
    completed_count = 0
    delta_count = 0
    players_scraped = 0
    stats_upserted = 0
    errors = 0

    try:
        # Matches
        if args.mode in ("daily", "matches-only"):
            upcoming_count, completed_count, delta_count = run_matches(
                args.tournament, db, logger
            )

        # Stats
        if args.mode in ("daily", "stats-only"):
            logger.info("\n--- Player Stats ---")
            players_scraped, stats_upserted = run_stats(
                args.tournament, db, args.delay, args.limit, logger
            )

    except Exception as e:
        logger.error(f"Fatal: {e}", exc_info=True)
        errors += 1
        return 1

    # Summary
    logger.info(f"\n{'=' * 60}")
    logger.info(f"Done | Upcoming: {upcoming_count} | Completed: {completed_count} | Deltas: {delta_count}")
    logger.info(f"     | Players: {players_scraped} | Stats upserted: {stats_upserted} | Errors: {errors}")
    logger.info("=" * 60)
    return 0


if __name__ == "__main__":
    sys.exit(main())
