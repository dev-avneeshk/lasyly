"""
NFL Schedule & Boxscore Scraper (ESPN public API).

Pure HTTP — no headless browser — so it is safe to run in cron / GitHub Actions.
Football Reference is behind a Cloudflare JS challenge and cannot be scraped
without a browser, so ESPN's unofficial public JSON API is used instead.

Populates:
  - nfl_games         (schedule + final scores, one row per game)
  - nfl_player_stats  (one row per player per game, flat numeric columns)
  - prop_line_history (append-only median prop lines, sport='NFL')

Usage:
  python scrape_nfl.py <mode> [options]

Modes:
  full          - Schedule + boxscores for the given season(s)
  schedule      - Schedule + scores only
  boxscores     - Boxscores for completed games missing stats
  daily         - Refresh current + recent weeks (schedule + boxscores)
  backfill      - Full 2024 + 2025 history (regular + postseason)

Options:
  --season YEAR      Season year (default: current). Repeatable via --seasons.
  --seasons LIST     Comma-separated seasons, e.g. "2024,2025"
  --season-type N    1=pre, 2=regular, 3=post (default: both 2 and 3)
  --week N           Limit to a single week
  --delay SECONDS    Delay between requests (default: 1.0, range: 0.3-10)
  --limit N          Max boxscores to fetch
  --dry-run          Parse + print without writing to DB

Environment variables (from ../.env.local):
  NEXT_PUBLIC_SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
  UPSTASH_REDIS_REST_URL      (optional, enables cache-aside)
  UPSTASH_REDIS_REST_TOKEN    (optional)
"""

import os
import sys
import json
import math
import time
import argparse
import logging
from logging.handlers import RotatingFileHandler
from datetime import datetime, date, timezone
from pathlib import Path
from typing import Optional
from urllib.request import urlopen, Request
from urllib.parse import quote
from urllib.error import HTTPError, URLError

from dotenv import load_dotenv
from supabase import create_client, Client


# ============================================================
# Configuration
# ============================================================

ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports/football/nfl"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"

REGULAR_WEEKS = 18
POST_WEEKS = 5  # wild card, divisional, conference, pro bowl slot, super bowl

# Stat categories mapped to prop lines (numeric column on nfl_player_stats)
NFL_STAT_CATEGORIES = [
    "pass_yds", "pass_td", "rush_yds", "rush_td",
    "rec", "rec_yds", "rec_td", "pass_att", "rush_att",
]
MIN_GAMES = 3          # minimum games before a prop line is meaningful
RECENT_GAMES = 10      # window for the median


# ============================================================
# Logging
# ============================================================

def setup_logging() -> logging.Logger:
    logger = logging.getLogger("nfl_scraper")
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
        log_dir / "nfl_scraper.log", maxBytes=10_000_000, backupCount=5
    )
    file_handler.setFormatter(fmt)
    logger.addHandler(file_handler)
    return logger


# ============================================================
# HTTP helper
# ============================================================

def fetch_json(url: str, delay: float, logger: logging.Logger, max_retries: int = 3):
    """Fetch JSON from ESPN with retry/backoff. Returns dict or None."""
    for attempt in range(max_retries):
        try:
            req = Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
            with urlopen(req, timeout=20) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                time.sleep(delay)
                return data
        except HTTPError as e:
            if e.code == 429:
                wait = min(60, 10 * (attempt + 1))
                logger.warning(f"429 rate limited on {url}, waiting {wait}s")
                time.sleep(wait)
            elif e.code >= 500:
                logger.warning(f"Server error {e.code} on {url}, retry {attempt+1}")
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
# Redis cache-aside (Upstash REST)
# ============================================================

class RedisCache:
    """
    Minimal Upstash Redis REST client for cache-aside.
    Used to avoid re-fetching expensive completed-game summaries during backfill
    (completed games never change). No-ops gracefully if Upstash isn't configured.
    """
    def __init__(self, url: Optional[str], token: Optional[str], logger: logging.Logger):
        self.url = (url or "").rstrip("/")
        self.token = token or ""
        self.logger = logger
        self.enabled = bool(self.url and self.token)
        if self.enabled:
            logger.info("Redis cache-aside enabled (Upstash REST)")
        else:
            logger.info("Redis not configured — cache-aside disabled")

    def _cmd(self, *parts) -> Optional[dict]:
        if not self.enabled:
            return None
        path = "/".join(quote(str(p), safe="") for p in parts)
        req = Request(
            f"{self.url}/{path}",
            headers={"Authorization": f"Bearer {self.token}"},
        )
        try:
            with urlopen(req, timeout=10) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except Exception as e:
            self.logger.warning(f"Redis command failed ({parts[0]}): {e}")
            return None

    def get_json(self, key: str):
        res = self._cmd("get", key)
        if res and res.get("result"):
            try:
                return json.loads(res["result"])
            except (ValueError, TypeError):
                return None
        return None

    def set_json(self, key: str, value, ttl_seconds: int = 30 * 24 * 3600) -> None:
        if not self.enabled:
            return
        # Send the (potentially large) value in the POST body — putting it in the
        # URL path overflows header/URL limits for big game summaries (HTTP 431/400).
        # Upstash REST: POST /set/{key}?EX={ttl} with the raw value as the body.
        body = json.dumps(value).encode("utf-8")
        req = Request(
            f"{self.url}/set/{quote(key, safe='')}?EX={ttl_seconds}",
            data=body,
            method="POST",
            headers={
                "Authorization": f"Bearer {self.token}",
                "Content-Type": "application/octet-stream",
            },
        )
        try:
            urlopen(req, timeout=10).read()
        except Exception as e:
            self.logger.warning(f"Redis set failed for {key}: {e}")


# ============================================================
# Numeric parsing helpers
# ============================================================

def _to_int(v) -> int:
    try:
        return int(float(v))
    except (ValueError, TypeError):
        return 0


def _to_float(v):
    try:
        return round(float(v), 2)
    except (ValueError, TypeError):
        return None


def _split_pair(v, sep):
    """Parse 'a/b' or 'a-b' -> (int a, int b). Missing -> (0, 0)."""
    if not v or not isinstance(v, str) or sep not in v:
        return (_to_int(v), 0)
    a, _, b = v.partition(sep)
    return (_to_int(a), _to_int(b))


def _labeled(labels: list, stats: list) -> dict:
    """Zip ESPN labels + a player's stat values into a dict."""
    out = {}
    for i, label in enumerate(labels):
        out[label] = stats[i] if i < len(stats) else None
    return out


# ============================================================
# Player positions (from team rosters)
# ============================================================

def build_position_map(delay: float, logger: logging.Logger) -> dict[str, str]:
    """
    Build an {athlete_id: position_abbr} map from all 32 NFL team rosters.

    ESPN's boxscore summary omits player positions, so we source them from the
    roster endpoint once per run and use them to fill the `position` column.
    Returns an empty dict on failure (positions are best-effort, not required).
    """
    positions: dict[str, str] = {}
    teams_data = fetch_json(f"{ESPN_BASE}/teams", delay, logger)
    if not teams_data:
        logger.warning("Could not fetch team list for positions")
        return positions

    try:
        teams = teams_data["sports"][0]["leagues"][0]["teams"]
    except (KeyError, IndexError):
        logger.warning("Unexpected teams payload shape")
        return positions

    for entry in teams:
        team = entry.get("team", entry)
        tid = team.get("id")
        if not tid:
            continue
        roster = fetch_json(f"{ESPN_BASE}/teams/{tid}/roster", delay, logger)
        if not roster:
            continue
        for group in roster.get("athletes", []):
            for ath in group.get("items", []):
                aid = str(ath.get("id", ""))
                pos = ath.get("position", {})
                pos_abbr = pos.get("abbreviation") if isinstance(pos, dict) else None
                if aid and pos_abbr:
                    positions[aid] = pos_abbr

    logger.info(f"  Built position map for {len(positions)} players")
    return positions


# ============================================================
# Database
# ============================================================

class NFLDatabase:
    def __init__(self, url: str, key: str):
        self.client: Client = create_client(url, key)
        self.logger = logging.getLogger("nfl_scraper")

    def upsert_games(self, games: list[dict]) -> int:
        count = 0
        for i in range(0, len(games), 100):
            batch = games[i:i + 100]
            try:
                res = self.client.table("nfl_games").upsert(batch, on_conflict="id").execute()
                count += len(res.data) if res.data else 0
            except Exception as e:
                self.logger.error(f"upsert_games batch failed at {i}: {e}")
                for g in batch:
                    try:
                        r = self.client.table("nfl_games").upsert(g, on_conflict="id").execute()
                        count += 1 if r.data else 0
                    except Exception as e2:
                        self.logger.error(f"upsert game {g.get('id')}: {e2}")
        return count

    def get_completed_games_without_stats(
        self, seasons: list[int], limit: int = 1000
    ) -> list[dict]:
        """Completed games with no rows in nfl_player_stats yet."""
        scraped = self._scraped_game_ids()
        out = []
        offset = 0
        batch = 1000
        while True:
            q = (
                self.client.table("nfl_games")
                .select("id, game_date, home_team, away_team, home_abbr, away_abbr")
                .eq("status", "completed")
                .in_("season", seasons)
                .order("game_date", desc=False)
                .range(offset, offset + batch - 1)
            )
            rows = q.execute().data or []
            for g in rows:
                if g["id"] in scraped:
                    continue
                out.append(g)
                if len(out) >= limit:
                    return out
            if len(rows) < batch:
                break
            offset += batch
        return out

    def _scraped_game_ids(self) -> set:
        ids = set()
        offset = 0
        batch = 1000
        while True:
            rows = (
                self.client.table("nfl_player_stats")
                .select("game_id")
                .range(offset, offset + batch - 1)
                .execute()
                .data
                or []
            )
            for r in rows:
                ids.add(r["game_id"])
            if len(rows) < batch:
                break
            offset += batch
        return ids

    def insert_player_stats(self, game_id: str, stats: list[dict]) -> int:
        """Idempotent: delete existing rows for the game, then insert."""
        self.client.table("nfl_player_stats").delete().eq("game_id", game_id).execute()
        count = 0
        for i in range(0, len(stats), 100):
            batch = stats[i:i + 100]
            try:
                r = self.client.table("nfl_player_stats").insert(batch).execute()
                count += len(r.data) if r.data else 0
            except Exception as e:
                self.logger.error(f"insert_player_stats failed for {game_id}: {e}")
        return count

    def get_player_recent_stats(self, player_name: str, limit: int = RECENT_GAMES) -> list[dict]:
        try:
            return (
                self.client.table("nfl_player_stats")
                .select("pass_yds, pass_td, rush_yds, rush_td, rec, rec_yds, rec_td, pass_att, rush_att, game_date")
                .eq("player_name", player_name)
                .order("game_date", desc=True)
                .limit(limit)
                .execute()
                .data
                or []
            )
        except Exception as e:
            self.logger.error(f"recent stats for {player_name}: {e}")
            return []

    def record_line_history(self, player_name: str, stat_category: str, line_value: float) -> bool:
        try:
            self.client.table("prop_line_history").insert({
                "player_name": player_name,
                "sport": "NFL",
                "stat_category": stat_category,
                "line_value": line_value,
            }).execute()
            return True
        except Exception as e:
            self.logger.error(f"line history {player_name}/{stat_category}: {e}")
            return False

    def get_stats_missing_position(self) -> list[dict]:
        """Fetch (id, athlete_id) for player-stat rows with no position set."""
        out = []
        offset = 0
        batch = 1000
        while True:
            rows = (
                self.client.table("nfl_player_stats")
                .select("id, athlete_id")
                .is_("position", "null")
                .range(offset, offset + batch - 1)
                .execute()
                .data
                or []
            )
            out.extend(rows)
            if len(rows) < batch:
                break
            offset += batch
        return out

    def update_positions(self, updates: list[tuple[str, str]]) -> int:
        """Set position on rows. `updates` is a list of (row_id, position).

        Batched by position: group row ids by their target position and issue one
        UPDATE ... WHERE id IN (chunk) per group, instead of one call per row.
        This turns tens of thousands of round-trips into a few hundred.
        """
        by_pos: dict[str, list[str]] = {}
        for row_id, pos in updates:
            by_pos.setdefault(pos, []).append(row_id)

        count = 0
        chunk_size = 200
        for pos, ids in by_pos.items():
            for i in range(0, len(ids), chunk_size):
                chunk = ids[i:i + chunk_size]
                try:
                    r = (
                        self.client.table("nfl_player_stats")
                        .update({"position": pos})
                        .in_("id", chunk)
                        .execute()
                    )
                    count += len(r.data) if r.data else 0
                except Exception as e:
                    self.logger.error(f"batch update position={pos} at {i}: {e}")
            self.logger.info(f"    position {pos}: {len(ids)} rows")
        return count


# ============================================================
# Prop line history
# ============================================================

def compute_median(values: list[float]) -> float:
    if not values:
        return 0.0
    s = sorted(values)
    n = len(s)
    if n % 2 == 0:
        return (s[n // 2 - 1] + s[n // 2]) / 2
    return s[n // 2]


def round_to_half(value: float) -> float:
    return math.floor(value * 2 + 0.5) / 2


def record_prop_lines(players: set[str], db: NFLDatabase, logger: logging.Logger) -> int:
    recorded = 0
    for name in players:
        recent = db.get_player_recent_stats(name)
        if len(recent) < MIN_GAMES:
            continue
        for stat in NFL_STAT_CATEGORIES:
            values = [float(r.get(stat) or 0) for r in recent]
            line = round_to_half(compute_median(values))
            if line <= 0:
                continue
            if db.record_line_history(name, stat, line):
                recorded += 1
    return recorded


# ============================================================
# Parsing: schedule
# ============================================================

def _status_from_event(event: dict) -> str:
    info = event.get("status", {}).get("type", {})
    state = info.get("state", "")
    completed = info.get("completed", False)
    name = info.get("name", "")
    if completed is True or state == "post" or name == "STATUS_FINAL":
        return "completed"
    if name in ("STATUS_POSTPONED", "STATUS_CANCELED", "STATUS_SUSPENDED"):
        return "postponed"
    if state == "in" or name == "STATUS_IN_PROGRESS":
        return "in_progress"
    return "scheduled"


def parse_event(event: dict, season: int, season_type: int, week: Optional[int]) -> Optional[dict]:
    event_id = event.get("id")
    if not event_id:
        return None
    comps = event.get("competitions", [])
    if not comps:
        return None
    comp = comps[0]
    competitors = comp.get("competitors", [])
    home = next((c for c in competitors if c.get("homeAway") == "home"), None)
    away = next((c for c in competitors if c.get("homeAway") == "away"), None)
    if not home or not away:
        return None

    home_team = home.get("team", {})
    away_team = away.get("team", {})
    status = _status_from_event(event)

    date_str = event.get("date", "")
    try:
        dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
        game_date = dt.date().isoformat()
        start_time = dt.isoformat()
    except (ValueError, AttributeError):
        game_date = date.today().isoformat()
        start_time = None

    home_score = away_score = None
    if status in ("completed", "in_progress"):
        home_score = _to_int(home.get("score")) if home.get("score") not in (None, "") else None
        away_score = _to_int(away.get("score")) if away.get("score") not in (None, "") else None

    return {
        "id": str(event_id),
        "event_id": str(event_id),
        "season": season,
        "season_type": season_type,
        "week": week,
        "game_date": game_date,
        "start_time": start_time,
        "home_team": home_team.get("displayName", "TBD"),
        "away_team": away_team.get("displayName", "TBD"),
        "home_abbr": home_team.get("abbreviation"),
        "away_abbr": away_team.get("abbreviation"),
        "home_score": home_score,
        "away_score": away_score,
        "status": status,
        "venue": comp.get("venue", {}).get("fullName") if comp.get("venue") else None,
    }


def scrape_schedule(
    seasons: list[int], season_types: list[int], only_week: Optional[int],
    delay: float, db: NFLDatabase, logger: logging.Logger, dry_run: bool
) -> int:
    total = 0
    for season in seasons:
        for st in season_types:
            weeks = REGULAR_WEEKS if st == 2 else POST_WEEKS
            week_range = [only_week] if only_week else range(1, weeks + 1)
            for wk in week_range:
                url = f"{ESPN_BASE}/scoreboard?dates={season}&seasontype={st}&week={wk}"
                data = fetch_json(url, delay, logger)
                if not data:
                    continue
                events = data.get("events", [])
                games = [g for e in events if (g := parse_event(e, season, st, wk))]
                if not games:
                    continue
                label = "reg" if st == 2 else "post"
                logger.info(f"  {season} {label} wk{wk}: {len(games)} games")
                if dry_run:
                    for g in games[:3]:
                        logger.info(f"    {g['game_date']} {g['away_team']} @ {g['home_team']} [{g['status']}] {g['away_score']}-{g['home_score']}")
                else:
                    total += db.upsert_games(games)
    return total


# ============================================================
# Parsing: boxscore player stats
# ============================================================

def parse_boxscore(data: dict, game_id: str, game_date: str,
                   positions: Optional[dict[str, str]] = None) -> list[dict]:
    """Flatten ESPN summary boxscore into one numeric row per player.

    `positions` is an optional {athlete_id: position_abbr} map used to fill the
    position column, since ESPN's boxscore feed omits it.
    """
    positions = positions or {}
    box = data.get("boxscore", {})
    team_players = box.get("players", [])
    if not team_players:
        return []

    # team display names for opponent assignment
    team_names = [tp.get("team", {}).get("abbreviation") or tp.get("team", {}).get("displayName", "")
                  for tp in team_players]

    # accumulate per (team, athlete_id) so multiple categories merge into one row
    rows: dict[str, dict] = {}

    for idx, tp in enumerate(team_players):
        team = team_names[idx]
        opponent = team_names[1 - idx] if len(team_names) == 2 else None
        for cat in tp.get("statistics", []):
            name = cat.get("name", "")
            labels = cat.get("labels", [])
            for ath in cat.get("athletes", []):
                info = ath.get("athlete", {})
                aid = str(info.get("id", ""))
                if not aid:
                    continue
                key = f"{game_id}-{aid}"
                row = rows.get(key)
                if row is None:
                    row = {
                        "id": key,
                        "game_id": game_id,
                        "player_name": info.get("displayName", ""),
                        "athlete_id": aid,
                        "team": team,
                        "opponent": opponent,
                        "position": (
                            (info.get("position", {}).get("abbreviation") if isinstance(info.get("position"), dict) else None)
                            or positions.get(aid)
                        ),
                        "game_date": game_date,
                        "raw_stats": {},
                    }
                    rows[key] = row

                vals = _labeled(labels, ath.get("stats", []))
                row["raw_stats"][name] = vals
                _apply_category(row, name, vals)

    return list(rows.values())


def _apply_category(row: dict, name: str, v: dict) -> None:
    """Map one ESPN stat category's labeled values onto numeric columns."""
    if name == "passing":
        c, att = _split_pair(v.get("C/ATT"), "/")
        sacks, _sack_yds = _split_pair(v.get("SACKS"), "-")
        row.update({
            "pass_c": c, "pass_att": att,
            "pass_yds": _to_int(v.get("YDS")),
            "pass_td": _to_int(v.get("TD")),
            "pass_int": _to_int(v.get("INT")),
            "pass_sacks": sacks,
            "qbr": _to_float(v.get("QBR")),
            "pass_rtg": _to_float(v.get("RTG")),
        })
    elif name == "rushing":
        row.update({
            "rush_att": _to_int(v.get("CAR")),
            "rush_yds": _to_int(v.get("YDS")),
            "rush_avg": _to_float(v.get("AVG")),
            "rush_td": _to_int(v.get("TD")),
            "rush_long": _to_int(v.get("LONG")),
        })
    elif name == "receiving":
        row.update({
            "rec": _to_int(v.get("REC")),
            "rec_yds": _to_int(v.get("YDS")),
            "rec_avg": _to_float(v.get("AVG")),
            "rec_td": _to_int(v.get("TD")),
            "rec_long": _to_int(v.get("LONG")),
            "targets": _to_int(v.get("TGTS")),
        })
    elif name == "fumbles":
        row.update({
            "fumbles": _to_int(v.get("FUM")),
            "fumbles_lost": _to_int(v.get("LOST")),
        })
    elif name == "defensive":
        row.update({
            "tackles_total": _to_int(v.get("TOT")),
            "sacks": _to_float(v.get("SACKS")) or 0,
            "tackles_tfl": _to_int(v.get("TFL")),
            "passes_def": _to_int(v.get("PD")),
        })
        row["def_td"] = _to_int(v.get("TD"))
    elif name == "interceptions":
        row["def_int"] = _to_int(v.get("INT"))
        # a pick-six shows up here too
        if _to_int(v.get("TD")):
            row["def_td"] = row.get("def_td", 0) + _to_int(v.get("TD"))
    elif name == "kicking":
        fg_m, fg_a = _split_pair(v.get("FG"), "/")
        xp_m, xp_a = _split_pair(v.get("XP"), "/")
        row.update({
            "fg_made": fg_m, "fg_att": fg_a,
            "xp_made": xp_m, "xp_att": xp_a,
            "kick_pts": _to_int(v.get("PTS")),
        })


def scrape_boxscores(
    seasons: list[int], delay: float, limit: int, cache: RedisCache,
    db: NFLDatabase, logger: logging.Logger, dry_run: bool,
    positions: Optional[dict[str, str]] = None
) -> tuple[int, int]:
    games = db.get_completed_games_without_stats(seasons, limit=limit)
    logger.info(f"  {len(games)} completed games need boxscores")
    ok = err = 0
    players_touched: set[str] = set()

    for i, g in enumerate(games):
        gid = g["id"]
        # No Redis cache: get_completed_games_without_stats() already skips any game
        # that has rows in nfl_player_stats, so a completed game is fetched from ESPN
        # exactly once and never re-scraped across runs (same strategy as the NBA
        # scraper). A caller-provided `cache` is honored if present, for a small
        # within-run resume optimization, but is optional.
        cache_key = f"nfl:summary:v2:{gid}"
        data = cache.get_json(cache_key) if cache and cache.enabled else None
        source = "cache"
        if data is None:
            source = "espn"
            url = f"{ESPN_BASE}/summary?event={gid}"
            raw = fetch_json(url, delay, logger)
            if raw:
                # parse_boxscore only reads data["boxscore"]["players"]; the rest of
                # the ESPN summary (drives, play-by-play, odds, news, videos, …) is
                # huge and unused. Keep only the slice we actually parse.
                players = (raw.get("boxscore") or {}).get("players") or []
                data = {"boxscore": {"players": players}}
                if cache and cache.enabled:
                    cache.set_json(cache_key, data)
        if not data:
            err += 1
            continue

        stats = parse_boxscore(data, gid, g["game_date"], positions)
        logger.info(f"  [{i+1}/{len(games)}] {g['away_team']} @ {g['home_team']} ({g['game_date']}) -> {len(stats)} players [{source}]")
        if not stats:
            continue
        if dry_run:
            for s in stats[:3]:
                logger.info(f"      {s['player_name']} ({s['team']}) pass_yds={s.get('pass_yds',0)} rush_yds={s.get('rush_yds',0)} rec_yds={s.get('rec_yds',0)}")
            ok += 1
            continue
        saved = db.insert_player_stats(gid, stats)
        ok += 1 if saved else 0
        for s in stats:
            if s.get("player_name"):
                players_touched.add(s["player_name"])

    if players_touched and not dry_run:
        logger.info(f"--- Recording prop lines for {len(players_touched)} players ---")
        rec = record_prop_lines(players_touched, db, logger)
        logger.info(f"  Recorded {rec} prop line history entries")

    return ok, err


# ============================================================
# Positions backfill (existing rows)
# ============================================================

def backfill_positions(delay: float, db: NFLDatabase, logger: logging.Logger, dry_run: bool) -> int:
    """Fill the position column on existing nfl_player_stats rows that lack it."""
    positions = build_position_map(delay, logger)
    if not positions:
        logger.warning("Empty position map — nothing to backfill")
        return 0

    rows = db.get_stats_missing_position()
    logger.info(f"  {len(rows)} rows missing position")
    updates = []
    for r in rows:
        pos = positions.get(str(r.get("athlete_id")))
        if pos:
            updates.append((r["id"], pos))
    logger.info(f"  {len(updates)} rows can be resolved from the roster map")

    if dry_run:
        for row_id, pos in updates[:10]:
            logger.info(f"    would set {row_id} -> {pos}")
        return 0

    updated = db.update_positions(updates)
    logger.info(f"  Updated {updated} rows with positions")
    return updated


# ============================================================
# CLI
# ============================================================

def parse_args():
    p = argparse.ArgumentParser(description="NFL scraper (ESPN public API)")
    p.add_argument("mode", choices=["full", "schedule", "boxscores", "daily", "backfill", "positions"])
    p.add_argument("--season", type=int, default=None)
    p.add_argument("--seasons", type=str, default=None, help="comma-separated, e.g. 2024,2025")
    p.add_argument("--season-type", type=int, choices=[1, 2, 3], default=None)
    p.add_argument("--week", type=int, default=None)
    p.add_argument("--delay", type=float, default=1.0)
    p.add_argument("--limit", type=int, default=10000)
    p.add_argument("--dry-run", action="store_true")
    p.add_argument(
        "--cache",
        action="store_true",
        help="Opt-in Redis (Upstash) within-run resume cache. Off by default; "
             "cross-run dedup is handled by the DB (games with stats are skipped).",
    )
    return p.parse_args()


def resolve_seasons(args) -> list[int]:
    if args.seasons:
        return [int(s.strip()) for s in args.seasons.split(",") if s.strip()]
    if args.season:
        return [args.season]
    if args.mode == "backfill":
        return [2024, 2025]
    # default: current NFL season year (season spans into next calendar year)
    today = date.today()
    return [today.year if today.month >= 8 else today.year - 1]


def main() -> int:
    args = parse_args()
    logger = setup_logging()

    if not (0.3 <= args.delay <= 10):
        logger.error("Delay must be between 0.3 and 10 seconds")
        return 1

    env_path = Path(__file__).resolve().parent.parent / ".env.local"
    load_dotenv(env_path)

    supabase_url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not supabase_url or not supabase_key:
        logger.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
        return 1

    seasons = resolve_seasons(args)
    season_types = [args.season_type] if args.season_type else [2, 3]

    logger.info(f"=== NFL Scraper: mode={args.mode} seasons={seasons} types={season_types} dry_run={args.dry_run} ===")
    start = time.time()

    db = NFLDatabase(supabase_url, supabase_key)
    # Redis is OFF by default. Cross-run dedup is handled entirely by the DB:
    # get_completed_games_without_stats() skips any game already in nfl_player_stats,
    # so completed games are fetched from ESPN at most once (same as the NBA scraper).
    # Pass --cache to enable the optional within-run resume cache.
    if args.cache:
        cache = RedisCache(
            os.getenv("UPSTASH_REDIS_REST_URL"),
            os.getenv("UPSTASH_REDIS_REST_TOKEN"),
            logger,
        )
    else:
        cache = RedisCache(None, None, logger)  # disabled no-op

    results = {}

    if args.mode == "positions":
        logger.info("--- Backfill positions on existing rows ---")
        results["positions_updated"] = backfill_positions(args.delay, db, logger, args.dry_run)
        elapsed = time.time() - start
        logger.info(f"=== Finished in {elapsed:.1f}s ===")
        logger.info(f"Results: {json.dumps(results, indent=2)}")
        return 0

    if args.mode in ("full", "schedule", "backfill", "daily"):
        logger.info("--- Schedule ---")
        results["games"] = scrape_schedule(
            seasons, season_types, args.week, args.delay, db, logger, args.dry_run
        )

    if args.mode in ("full", "boxscores", "backfill", "daily"):
        # Positions aren't in the boxscore feed — source them from rosters once
        # per run and fill them in as we write player stats.
        logger.info("--- Building position map ---")
        positions = build_position_map(args.delay, logger)

        logger.info("--- Boxscores ---")
        ok, err = scrape_boxscores(
            seasons, args.delay, args.limit, cache, db, logger, args.dry_run, positions
        )
        results["boxscores_ok"] = ok
        results["boxscores_err"] = err

    elapsed = time.time() - start
    logger.info(f"=== Finished in {elapsed:.1f}s ===")
    logger.info(f"Results: {json.dumps(results, indent=2)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
