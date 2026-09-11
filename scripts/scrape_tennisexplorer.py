"""
TennisExplorer Scraper

Scrapes tennisexplorer.com for current tennis match data and player statistics,
then stores everything in Supabase. This replaces the stale tennisabstract flow
for *match* and *W/L* data (tennisabstract remains the source for granular
serve/return stats via scrape_tennis.py).

Data captured per match-detail page (one fetch yields all of this):
  - Match:        players, tournament, round, surface, time, score, winner, status
  - Players:      bio (birthdate, height, weight, handedness), singles/doubles rank
  - Stats:        full year-by-year W/L by surface for BOTH players
  - Odds:         match-winner average decimal odds

Storage targets:
  - tennis_matches       (existing) — match rows
  - tennis_players       (existing + enrichment columns) — player bio/rank
  - tennis_raw_stats     (existing) — year/surface W/L (matches_played/won/lost, win_pct)
  - tennis_match_odds    (new)      — match-winner odds

Enrichment columns/tables are written only if present; the scraper degrades
gracefully when migration 20260602_tennisexplorer_enrichment.sql has not yet
been applied (writes core columns, skips the rest with a one-time warning).

Usage:
  python scrape_tennisexplorer.py daily        [--limit N] [--delay S]
  python scrape_tennisexplorer.py matches-only  --match <url-or-id> [...]
  python scrape_tennisexplorer.py discover      # print today's match-detail URLs

Environment (../.env.local):
  NEXT_PUBLIC_SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
"""
from __future__ import annotations

import os
import re
import sys
import time
import argparse
import logging
from logging.handlers import RotatingFileHandler
from datetime import datetime, timezone, date
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from scrapling.fetchers import Fetcher
from supabase import create_client, Client

from tennisexplorer_extract import extract_match, parse_match_id

BASE = "https://www.tennisexplorer.com"
MATCHES_PAGE = f"{BASE}/matches/"
MATCH_DETAIL = f"{BASE}/match-detail/?id="
USER_AGENT = "betroom-tennis-scraper/1.0 (+https://betroom)"


# ============================================================
# Logging
# ============================================================

def setup_logging() -> logging.Logger:
    logger = logging.getLogger("te_scraper")
    if logger.handlers:
        return logger
    logger.setLevel(logging.INFO)
    fmt = logging.Formatter("%(asctime)s [%(levelname)s] %(message)s",
                            datefmt="%Y-%m-%dT%H:%M:%SZ")
    sh = logging.StreamHandler(sys.stdout)
    sh.setFormatter(fmt)
    logger.addHandler(sh)
    log_dir = Path(__file__).resolve().parent / "logs"
    log_dir.mkdir(exist_ok=True)
    fh = RotatingFileHandler(log_dir / "tennisexplorer_scraper.log",
                             maxBytes=10_000_000, backupCount=5)
    fh.setFormatter(fmt)
    logger.addHandler(fh)
    return logger


# ============================================================
# Value coercion helpers
# ============================================================

def _to_int(text: Optional[str]) -> Optional[int]:
    """'29.' -> 29, '198 cm' -> 198, '-' -> None."""
    if not text:
        return None
    m = re.search(r"\d+", text)
    return int(m.group(0)) if m else None


def _parse_birthdate(text: Optional[str]) -> Optional[str]:
    """'20. 4. 1997' -> '1997-04-20' (ISO). Returns None if unparseable."""
    if not text:
        return None
    m = re.match(r"\s*(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})", text)
    if not m:
        return None
    d, mo, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
    try:
        return date(y, mo, d).isoformat()
    except ValueError:
        return None


def _parse_te_date(label: Optional[str]) -> Optional[str]:
    """Convert a match date label to ISO. 'Today'/'Tomorrow' -> today/tomorrow;
    '31.05.2026' -> '2026-05-31'. Returns None otherwise."""
    if not label:
        return None
    today = datetime.now(timezone.utc).date()
    low = label.strip().lower()
    if low == "today":
        return today.isoformat()
    if low == "tomorrow":
        from datetime import timedelta
        return (today + timedelta(days=1)).isoformat()
    m = re.match(r"(\d{2})\.(\d{2})\.(\d{4})", label.strip())
    if m:
        return f"{m.group(3)}-{m.group(2)}-{m.group(1)}"
    return None


# ============================================================
# Database layer
# ============================================================

class TennisExplorerDB:
    def __init__(self, url: str, key: str, logger: logging.Logger):
        self.client: Client = create_client(url, key)
        self.logger = logger
        # Detected once on first use; controls graceful degradation.
        self._enrichment_ok: Optional[bool] = None
        self._odds_ok: Optional[bool] = None

    # --- capability detection ---
    def _check_enrichment(self) -> bool:
        if self._enrichment_ok is None:
            try:
                self.client.table("tennis_matches").select("match_id").limit(1).execute()
                self._enrichment_ok = True
            except Exception:
                self._enrichment_ok = False
                self.logger.warning(
                    "Enrichment columns missing — apply migration "
                    "20260602_tennisexplorer_enrichment.sql to store match_id/surface/"
                    "bio/rank. Falling back to core columns only."
                )
        return self._enrichment_ok

    def _check_odds(self) -> bool:
        if self._odds_ok is None:
            try:
                self.client.table("tennis_match_odds").select("match_id").limit(1).execute()
                self._odds_ok = True
            except Exception:
                self._odds_ok = False
                self.logger.warning("tennis_match_odds table missing — skipping odds storage.")
        return self._odds_ok

    # --- matches ---
    def upsert_match(self, match: dict) -> bool:
        """Upsert a match row, using enrichment columns when available."""
        core = {
            "tournament": match["tournament"],
            "round": match["round"],
            "player1_name": match["player1_name"],
            "player2_name": match["player2_name"],
            "status": match["status"],
            "winner_name": match.get("winner_name"),
            "score": match.get("score"),
            "scraped_at": datetime.now(timezone.utc).isoformat(),
        }
        if match["status"] == "completed":
            core["completed_at"] = datetime.now(timezone.utc).isoformat()

        if self._check_enrichment():
            core.update({
                "match_id": match.get("match_id"),
                "surface": match.get("surface"),
                "scheduled_time": match.get("scheduled_time"),
                "match_date": match.get("match_date"),
                "source": "tennisexplorer",
                "source_url": match.get("source_url"),
            })

        try:
            self.client.table("tennis_matches").upsert(
                core, on_conflict="tournament,round,player1_name,player2_name"
            ).execute()
            return True
        except Exception as e:
            self.logger.error(
                f"match upsert failed [{match.get('tournament')} {match.get('round')} "
                f"{match.get('player1_name')} v {match.get('player2_name')}]: {e}"
            )
            return False

    # --- players ---
    def upsert_player(self, name: str, profile_url: Optional[str], slug: Optional[str],
                      bio: dict) -> bool:
        """Upsert a player row with bio/ranking enrichment when available."""
        row = {"player_name": name}
        if profile_url:
            row["profile_url"] = (BASE + profile_url) if profile_url.startswith("/") else profile_url

        if self._check_enrichment():
            row.update({
                "te_slug": slug,
                "te_profile_url": (BASE + profile_url) if profile_url and profile_url.startswith("/") else profile_url,
                "rank_singles": _to_int(bio.get("rank_singles")),
                "rank_doubles": _to_int(bio.get("rank_doubles")),
                "birthdate": _parse_birthdate(bio.get("birthdate")),
                "height_cm": _to_int(bio.get("height")),
                "weight_kg": _to_int(bio.get("weight")),
                "plays": (bio.get("plays") or None) if bio.get("plays") not in ("-", "") else None,
                "turned_pro": _to_int(bio.get("turned_pro")),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            })

        try:
            self.client.table("tennis_players").upsert(
                row, on_conflict="player_name"
            ).execute()
            return True
        except Exception as e:
            self.logger.error(f"player upsert failed [{name}]: {e}")
            return False

    # --- raw stats (year/surface W/L) ---
    def upsert_raw_stats_batch(self, rows: list[dict]) -> int:
        """Upsert tennis_raw_stats rows keyed by (player_name, surface, stat_year)."""
        if not rows:
            return 0
        count = 0
        for i in range(0, len(rows), 100):
            batch = rows[i:i + 100]
            try:
                self.client.table("tennis_raw_stats").upsert(
                    batch, on_conflict="player_name,surface,stat_year"
                ).execute()
                count += len(batch)
            except Exception as e:
                self.logger.error(f"raw_stats batch upsert failed: {e}")
        return count

    # --- odds ---
    def upsert_odds(self, odds_row: dict) -> bool:
        if not self._check_odds():
            return False
        try:
            self.client.table("tennis_match_odds").upsert(
                odds_row, on_conflict="match_id,bookmaker"
            ).execute()
            return True
        except Exception as e:
            self.logger.error(f"odds upsert failed [{odds_row.get('match_id')}]: {e}")
            return False


# ============================================================
# Fetch with retry + rate limit
# ============================================================

def fetch(url: str, logger: logging.Logger, retries: int = 3) -> Optional[object]:
    for attempt in range(1, retries + 1):
        try:
            page = Fetcher.get(
                url, stealthy_headers=True, timeout=30,
                headers={"User-Agent": USER_AGENT},
            )
            if page.status == 200:
                return page
            if page.status == 429:
                logger.warning(f"HTTP 429 for {url} — backoff 60s (attempt {attempt})")
                time.sleep(60)
                continue
            if 500 <= page.status < 600:
                logger.warning(f"HTTP {page.status} for {url} — backoff (attempt {attempt})")
                time.sleep(min(60, 10 * attempt))
                continue
            logger.error(f"HTTP {page.status} for {url}")
            return None
        except Exception as e:
            logger.warning(f"fetch error {url}: {e} (attempt {attempt})")
            time.sleep(min(30, 5 * attempt))
    logger.error(f"giving up on {url} after {retries} attempts")
    return None


# ============================================================
# Discovery
# ============================================================

def discover_match_ids(logger: logging.Logger) -> list[str]:
    """Fetch today's matches page and return unique match-detail ids."""
    page = fetch(MATCHES_PAGE, logger)
    if not page:
        return []
    ids = []
    for a in page.css("a"):
        href = a.attrib.get("href", "")
        m = re.search(r"match-detail/\?id=(\d+)", href)
        if m:
            ids.append(m.group(1))
    uniq = list(dict.fromkeys(ids))
    logger.info(f"Discovered {len(uniq)} match-detail ids")
    return uniq


# ============================================================
# Transform: year_by_year -> tennis_raw_stats rows
# ============================================================

def build_raw_stats_rows(player_name: str, year_by_year: dict) -> list[dict]:
    """
    Flatten one player's {year: {surface: record}} into tennis_raw_stats rows.
    The 'all' year is stored as stat_year='Career'; the per-surface 'Total'
    column is stored as surface='All'.
    """
    rows = []
    now = datetime.now(timezone.utc).isoformat()
    for year_key, surfaces in (year_by_year or {}).items():
        stat_year = "Career" if year_key == "all" else year_key
        for surface, rec in surfaces.items():
            if not rec:
                continue
            surface_label = "All" if surface == "Total" else surface
            rows.append({
                "player_name": player_name,
                "surface": surface_label,
                "stat_year": stat_year,
                "matches_played": rec["played"],
                "matches_won": rec["won"],
                "matches_lost": rec["lost"],
                "win_pct": rec["win_pct"],
                "updated_at": now,
            })
    return rows


# ============================================================
# Process a single match-detail page
# ============================================================

def process_match(match_id: str, db: TennisExplorerDB, logger: logging.Logger) -> dict:
    """Fetch, extract and store one match. Returns a per-match summary counter."""
    summary = {"matches": 0, "players": 0, "stat_rows": 0, "odds": 0, "errors": 0}
    url = f"{MATCH_DETAIL}{match_id}"
    page = fetch(url, logger)
    if not page:
        summary["errors"] += 1
        return summary

    data = extract_match(page, url)
    m = data["match"]
    if not m.get("player1_name") or not m.get("player2_name"):
        logger.warning(f"[{match_id}] no players parsed — skipping")
        summary["errors"] += 1
        return summary

    # Resolve match_date from the date label.
    m["match_date"] = _parse_te_date(m.get("date_label"))

    # 1. Match row
    if db.upsert_match(m):
        summary["matches"] += 1
    else:
        summary["errors"] += 1

    # 2. Players (bio + rank) — map header p1/p2 to ordered names is not needed;
    #    store under the *display* names from the header.
    bios = data["bios"]
    players = data["players"]
    for slot in ("player1", "player2"):
        p = players[slot]
        if p.get("name"):
            if db.upsert_player(p["name"], p.get("profile_url"), p.get("slug"), bios.get(slot, {})):
                summary["players"] += 1

    # 3. Year/surface W/L -> tennis_raw_stats
    raw_rows = []
    yby = data["year_by_year"]
    for slot in ("player1", "player2"):
        name = players[slot].get("name")
        if name:
            raw_rows.extend(build_raw_stats_rows(name, yby.get(slot, {})))
    summary["stat_rows"] += db.upsert_raw_stats_batch(raw_rows)

    # 4. Odds (match-winner)
    odds = data.get("odds")
    if odds and m.get("match_id"):
        odds_row = {
            "match_id": m["match_id"],
            "player1_name": players["player1"].get("name"),
            "player2_name": players["player2"].get("name"),
            "player1_odds": odds.get("player1_odds"),
            "player2_odds": odds.get("player2_odds"),
            "bookmaker": "average",
            "scraped_at": datetime.now(timezone.utc).isoformat(),
        }
        if db.upsert_odds(odds_row):
            summary["odds"] += 1

    logger.info(
        f"[{match_id}] {m['status']:<9} {m.get('tournament')} {m.get('round')} | "
        f"{players['player1'].get('name')} vs {players['player2'].get('name')}"
        + (f" | {m.get('winner_name')} {m.get('score')}" if m["status"] == "completed" else "")
    )
    return summary


# ============================================================
# CLI
# ============================================================

def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="TennisExplorer Scraper")
    p.add_argument("mode", choices=["daily", "matches-only", "discover"])
    p.add_argument("--match", action="append", default=[],
                   help="Specific match-detail URL or id (repeatable). Used by matches-only.")
    p.add_argument("--limit", type=int, default=None, help="Max matches to process in daily mode")
    p.add_argument("--delay", type=float, default=3.0, help="Delay between requests (1-30s)")
    args = p.parse_args()
    if args.delay < 1 or args.delay > 30:
        p.error("--delay must be between 1 and 30")
    return args


def resolve_match_id(token: str) -> Optional[str]:
    """Accept either a full match-detail URL or a bare numeric id."""
    if token.isdigit():
        return token
    return parse_match_id(token)


def main() -> int:
    args = parse_args()
    logger = setup_logging()

    logger.info("=" * 60)
    logger.info(f"TennisExplorer Scraper | mode={args.mode} | "
                f"{datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')}")

    # Discover mode doesn't need DB.
    if args.mode == "discover":
        for mid in discover_match_ids(logger):
            print(f"{MATCH_DETAIL}{mid}")
        return 0

    load_dotenv(Path(__file__).resolve().parent.parent / ".env.local")
    url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        logger.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
        return 1
    db = TennisExplorerDB(url, key, logger)

    # Build the work list.
    if args.mode == "matches-only":
        if not args.match:
            logger.error("matches-only requires at least one --match <url-or-id>")
            return 1
        match_ids = [resolve_match_id(t) for t in args.match]
        match_ids = [m for m in match_ids if m]
    else:  # daily
        match_ids = discover_match_ids(logger)
        if args.limit:
            match_ids = match_ids[: args.limit]

    totals = {"matches": 0, "players": 0, "stat_rows": 0, "odds": 0, "errors": 0}
    for i, mid in enumerate(match_ids, 1):
        logger.info(f"--- [{i}/{len(match_ids)}] match {mid} ---")
        s = process_match(mid, db, logger)
        for k in totals:
            totals[k] += s[k]
        time.sleep(args.delay)

    logger.info("=" * 60)
    logger.info(
        f"Done | matches={totals['matches']} players={totals['players']} "
        f"stat_rows={totals['stat_rows']} odds={totals['odds']} errors={totals['errors']}"
    )
    logger.info("=" * 60)
    return 0


if __name__ == "__main__":
    sys.exit(main())
