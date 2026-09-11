"""
NBA Player Bio Scraper — Height & Weight

Populates public.nba_players.height and .weight for every distinct player found
in nba_player_season_stats, by fetching each player's Basketball Reference
profile page and parsing the meta (bio) block.

Only height and weight are written. player_name and basketball_reference_id are
set so rows can be identified and re-run cheaply. The run is idempotent and
resumable: players that already have a non-null height are skipped unless
--force is passed.

Usage:
  python scrape_player_bio.py [options]

Options:
  --delay SECONDS   Delay between profile requests (default: 3, range: 1-30)
  --limit N         Only process the first N players (for verification runs)
  --force           Re-scrape players that already have height populated
  --dry-run         Parse and print, but do not write to the database

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
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from scrapling.fetchers import Fetcher
from supabase import create_client, Client

BASE_URL = "https://www.basketball-reference.com"

# Regex over the collapsed meta text: e.g. "6-6 , 195lb (198cm, 88kg)"
HEIGHT_WEIGHT_RE = re.compile(r"(\d-\d{1,2})\s*,?\s*(\d{2,3})\s*lb")


# ============================================================
# Logging
# ============================================================

def setup_logging() -> logging.Logger:
    logger = logging.getLogger("player_bio_scraper")
    logger.setLevel(logging.INFO)
    fmt = logging.Formatter("%(asctime)s [%(levelname)s] %(message)s", datefmt="%Y-%m-%dT%H:%M:%SZ")

    stdout_handler = logging.StreamHandler(sys.stdout)
    stdout_handler.setFormatter(fmt)
    logger.addHandler(stdout_handler)

    log_path = Path(__file__).resolve().parent / "player_bio_scraper.log"
    file_handler = RotatingFileHandler(log_path, maxBytes=10_000_000, backupCount=5)
    file_handler.setFormatter(fmt)
    logger.addHandler(file_handler)
    return logger


# ============================================================
# Basketball Reference ID derivation
# ============================================================

def normalize_name(player_name: str) -> str:
    """Lowercase, strip punctuation/accents-ish, collapse whitespace."""
    n = player_name.strip().lower()
    n = re.sub(r"[^a-z0-9 ]", "", n)
    n = re.sub(r"\s+", " ", n)
    return n.strip()


def candidate_player_ids(player_name: str) -> list[str]:
    """
    Build candidate Basketball Reference player IDs.

    BR format: first 5 letters of last name + first 2 of first name + NN suffix.
    Example: "Shai Gilgeous-Alexander" -> last="gilgeousalexander" -> "gilge" + "sh" + "01".

    We try suffixes 01..05 because the "01" default is frequently wrong for
    players who share a name stem. Returns [] if a name can't be parsed.
    """
    parts = player_name.strip().split()
    if len(parts) < 2:
        return []

    first = re.sub(r"[^a-zA-Z]", "", parts[0]).lower()
    last = re.sub(r"[^a-zA-Z]", "", parts[-1]).lower()
    if not first or not last:
        return []

    stem = last[:5] + first[:2]
    return [f"{stem}{i:02d}" for i in range(1, 6)]


def player_letter(player_name: str) -> str:
    parts = player_name.strip().split()
    if len(parts) < 2:
        return ""
    last = re.sub(r"[^a-zA-Z]", "", parts[-1]).lower()
    return last[0] if last else ""


# ============================================================
# Fetch + parse
# ============================================================

def fetch_with_retry(url: str, logger: logging.Logger, timeout: int = 30):
    """Fetch a URL. Returns page on 200, None on 404, retries 429/5xx up to 3x."""
    retries = 0
    while retries < 3:
        try:
            page = Fetcher.get(url, stealthy_headers=True, timeout=timeout)
            if page.status == 200:
                return page
            if page.status == 404:
                return None
            if page.status == 429:
                retries += 1
                logger.warning(f"    429 rate limited. Waiting 60s (retry {retries}/3)")
                time.sleep(60)
            elif page.status >= 500:
                retries += 1
                logger.warning(f"    {page.status} server error. Waiting 60s (retry {retries}/3)")
                time.sleep(60)
            elif page.status == 403:
                retries += 1
                logger.warning(f"    403 forbidden (rate limit?). Waiting 60s (retry {retries}/3)")
                time.sleep(60)
            else:
                logger.error(f"    HTTP {page.status} for {url} - skipping")
                return None
        except Exception as e:
            retries += 1
            logger.warning(f"    Request error: {e}. Waiting 60s (retry {retries}/3)")
            time.sleep(60)
    logger.error(f"    Max retries reached for {url}")
    return None


def parse_height_weight(page) -> tuple[Optional[str], Optional[str]]:
    """Extract (height, weight) from the meta bio block. Returns (None, None) if absent."""
    meta = page.css("div#meta")
    if not len(meta):
        return None, None
    txt = re.sub(r"\s+", " ", meta.first.get_all_text() or "").strip()
    m = HEIGHT_WEIGHT_RE.search(txt)
    if not m:
        return None, None
    return m.group(1), m.group(2)


def page_matches_player(page, player_name: str) -> bool:
    """Sanity check: the <h1> on the page should match the player's name."""
    h1 = page.css("h1")
    if not len(h1):
        return False
    got = normalize_name(h1.first.get_all_text() or "")
    want = normalize_name(player_name)
    return want in got or got in want


# ============================================================
# Database
# ============================================================

def get_distinct_player_names(db: Client) -> list[str]:
    names = set()
    offset = 0
    batch = 1000
    while True:
        r = db.table("nba_player_season_stats").select("player_name").range(offset, offset + batch - 1).execute()
        rows = r.data or []
        for row in rows:
            if row.get("player_name"):
                names.add(row["player_name"])
        if len(rows) < batch:
            break
        offset += batch
    return sorted(names)


def get_existing_heights(db: Client) -> dict[str, Optional[str]]:
    """Map player_name -> height for rows already in nba_players."""
    result = {}
    offset = 0
    batch = 1000
    while True:
        r = db.table("nba_players").select("player_name,height").range(offset, offset + batch - 1).execute()
        rows = r.data or []
        for row in rows:
            result[row["player_name"]] = row.get("height")
        if len(rows) < batch:
            break
        offset += batch
    return result


def upsert_player_bio(db: Client, record: dict, logger: logging.Logger) -> bool:
    try:
        db.table("nba_players").upsert(record, on_conflict="player_name").execute()
        return True
    except Exception as e:
        logger.error(f"    DB upsert failed for {record.get('player_name')}: {e}")
        return False


# ============================================================
# Main
# ============================================================

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="NBA Player Bio (Height/Weight) Scraper")
    parser.add_argument("--delay", type=float, default=3.0)
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    if args.delay < 1 or args.delay > 30:
        parser.error("--delay must be between 1 and 30")
    return args


def main() -> int:
    args = parse_args()
    logger = setup_logging()

    logger.info("=" * 60)
    logger.info(f"NBA Player Bio Scraper | {datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')}")
    logger.info(f"  delay={args.delay}s limit={args.limit} force={args.force} dry_run={args.dry_run}")
    logger.info("=" * 60)

    env_path = Path(__file__).resolve().parent.parent / ".env.local"
    load_dotenv(env_path)
    supabase_url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not supabase_url or not supabase_key:
        logger.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
        return 1
    db: Client = create_client(supabase_url, supabase_key)

    names = get_distinct_player_names(db)
    logger.info(f"Found {len(names)} distinct players in nba_player_season_stats")

    existing = get_existing_heights(db) if not args.force else {}

    # Skip players that already have height unless --force
    todo = [n for n in names if args.force or not existing.get(n)]
    if args.limit:
        todo = todo[:args.limit]
    logger.info(f"Processing {len(todo)} players (skipping {len(names) - len(todo)} already populated)")

    now = datetime.now(timezone.utc).isoformat()
    success = 0
    not_found = 0
    no_data = 0

    for i, name in enumerate(todo):
        letter = player_letter(name)
        candidates = candidate_player_ids(name)
        if not letter or not candidates:
            logger.warning(f"  [{i+1}/{len(todo)}] Cannot derive ID for: {name}")
            not_found += 1
            continue

        logger.info(f"  [{i+1}/{len(todo)}] {name}")

        height = weight = None
        matched_id = None

        for pid in candidates:
            url = f"{BASE_URL}/players/{letter}/{pid}.html"
            page = fetch_with_retry(url, logger)
            time.sleep(args.delay)  # polite delay after every request

            if page is None:
                continue  # 404 -> try next suffix
            if not page_matches_player(page, name):
                # Wrong player with same stem; keep trying suffixes
                continue
            h, w = parse_height_weight(page)
            matched_id = pid
            height, weight = h, w
            break

        if matched_id is None:
            logger.warning(f"    ⚠ No matching profile page found for {name}")
            not_found += 1
            continue

        if not height and not weight:
            logger.warning(f"    ⚠ Profile found ({matched_id}) but no height/weight parsed")
            no_data += 1
            # still record identity so we don't refetch endlessly on --force
        else:
            logger.info(f"    ✓ {matched_id}: height={height} weight={weight}")

        record = {
            "player_name": name,
            "normalized_name": normalize_name(name),
            "basketball_reference_id": matched_id,
            "height": height,
            "weight": weight,
            "updated_at": now,
        }

        if args.dry_run:
            logger.info(f"    [dry-run] would upsert: {record}")
            success += 1
        else:
            if upsert_player_bio(db, record, logger):
                success += 1

    logger.info("=" * 60)
    logger.info(f"Done | processed={len(todo)} | written={success} | not_found={not_found} | no_data={no_data}")
    logger.info("=" * 60)
    return 0


if __name__ == "__main__":
    sys.exit(main())
