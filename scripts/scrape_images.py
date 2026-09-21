"""
Player headshot + team logo image mirror (NBA & NFL).

Downloads current-season NBA and NFL player headshots and team logos from
ESPN's public CDN, uploads them to Supabase Storage, and writes the resulting
public Storage URLs back into the DB so the app serves self-hosted images
instead of depending on ESPN's CDN at render time.

WHY: headshots/logos were rendering as initials/abbreviations because the app
relied on ESPN CDN URLs that were either missing (no stored URL) or occasionally
unreachable. Mirroring into Storage makes them stable and ours.

What it does
------------
Teams  (30 NBA + 32 NFL):
  - Fetch the ESPN team list, download each 500px logo.
  - Upload to bucket `team-logos` at `{sport}/{espn_id}.png`.
  - Upsert into `espn_teams` with logo_url = <storage public URL>.

Players (current-season rosters):
  - Fetch each team's roster from ESPN (athlete id + name + headshot href).
  - Download each headshot at w=350 (crisp for the 36-72px UI, ~1/3 the size
    of the full 1040px asset — see the storage estimate in the PR notes).
  - Upload to bucket `player-headshots` at `{sport}/{espn_id}.png`.
  - NFL: upsert into `espn_players` (sport=football) with headshot_url.
  - NBA: upsert into `espn_players` (sport=basketball) AND, when the name
    matches an existing `nba_players` row, set nba_players.headshot_url — that
    is the table the rankings headshot resolver reads first.

Idempotent: re-running overwrites the same Storage paths (upsert) and re-upserts
the same rows, so it is safe to run repeatedly (e.g. weekly to pick up roster
changes and new players).

Usage
-----
  python scrape_images.py all                # teams + players, NBA + NFL
  python scrape_images.py teams              # logos only
  python scrape_images.py players            # headshots only
  python scrape_images.py all --sport nba    # limit to one league
  python scrape_images.py players --limit 5  # first 5 teams (smoke test)
  python scrape_images.py all --dry-run      # fetch + measure, write nothing

Options
  --sport {nba,nfl}   Limit to one league (default: both)
  --width N           Headshot resize width (default: 350)
  --delay SECONDS     Delay between ESPN requests (default: 1.0)
  --limit N           Max teams to process (per league) — for testing
  --dry-run           Do everything except upload/DB writes

Environment (from ../.env.local)
  NEXT_PUBLIC_SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
"""

import os
import sys
import time
import argparse
import logging
import unicodedata
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

# league_key -> ESPN sport slug + our stored sport value (matches espn_players.sport)
LEAGUES = {
    "nba": {"espn_sport": "basketball", "stored_sport": "basketball"},
    "nfl": {"espn_sport": "football", "stored_sport": "football"},
}

PLAYER_BUCKET = "player-headshots"
TEAM_BUCKET = "team-logos"

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"

# Full-size headshot template. We pull it through ESPN's combiner resizer so we
# store a right-sized asset rather than the ~265 KB 1040px original.
HEADSHOT_FULL = "https://a.espncdn.com/i/headshots/{sport}/players/full/{id}.png"


# ============================================================
# Logging
# ============================================================

def setup_logging() -> logging.Logger:
    logger = logging.getLogger("image_scraper")
    logger.setLevel(logging.INFO)
    if not logger.handlers:
        h = logging.StreamHandler()
        h.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(message)s", "%H:%M:%S"))
        logger.addHandler(h)
    return logger


# ============================================================
# HTTP helpers
# ============================================================

def fetch_json(url: str, delay: float, logger: logging.Logger, max_retries: int = 4):
    """GET JSON from ESPN with retry/backoff. Returns dict or None."""
    import json
    for attempt in range(max_retries):
        try:
            req = Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
            with urlopen(req, timeout=30) as resp:
                data = json.loads(resp.read().decode("utf-8"))
            time.sleep(delay)
            return data
        except (HTTPError, URLError) as e:
            wait = delay * (attempt + 1) * 2
            logger.warning(f"  fetch retry {attempt + 1}/{max_retries} ({e}) — sleeping {wait:.1f}s")
            time.sleep(wait)
        except Exception as e:  # noqa: BLE001
            logger.warning(f"  fetch error ({e})")
            time.sleep(delay)
    logger.error(f"  giving up on {url}")
    return None


def fetch_bytes(url: str, logger: logging.Logger, max_retries: int = 3) -> Optional[bytes]:
    """Download raw image bytes. Returns None on failure (missing headshot, etc.)."""
    for attempt in range(max_retries):
        try:
            req = Request(url, headers={"User-Agent": UA})
            with urlopen(req, timeout=30) as resp:
                return resp.read()
        except HTTPError as e:
            if e.code in (403, 404):
                return None  # no image for this player; caller falls back to initials
            time.sleep(0.8 * (attempt + 1))
        except Exception:  # noqa: BLE001
            time.sleep(0.8 * (attempt + 1))
    return None


def resized_headshot_url(espn_sport: str, espn_id: str, width: int) -> str:
    """ESPN combiner URL that resizes the full headshot to `width` (4:3-ish)."""
    height = round(width * 254 / 350)
    inner = HEADSHOT_FULL.format(sport=espn_sport, id=espn_id)
    # `/i/` prefix is stripped by the combiner; it wants the path after the host.
    path = inner.split("a.espncdn.com")[1]
    return f"https://a.espncdn.com/combiner/i?img={path}&w={width}&h={height}"


# ============================================================
# Name normalization (mirror lib/players/headshotResolver.ts)
# ============================================================

def normalize_name(name: str) -> str:
    n = unicodedata.normalize("NFD", name)
    n = "".join(c for c in n if unicodedata.category(c) != "Mn")
    n = n.lower()
    out = []
    for ch in n:
        out.append(ch if ch.isalnum() else " ")
    return " ".join("".join(out).split())


# ============================================================
# Storage
# ============================================================

class Store:
    def __init__(self, client: Client, logger: logging.Logger, dry_run: bool):
        self.client = client
        self.logger = logger
        self.dry_run = dry_run

    def ensure_bucket(self, name: str):
        if self.dry_run:
            return
        try:
            self.client.storage.get_bucket(name)
            return
        except Exception:  # noqa: BLE001
            pass
        try:
            # Public bucket: images are non-sensitive and served directly.
            self.client.storage.create_bucket(
                name, options={"public": True, "file_size_limit": 5_000_000}
            )
            self.logger.info(f"  created bucket '{name}'")
        except Exception as e:  # noqa: BLE001
            # Race or already-exists — treat as fine.
            self.logger.info(f"  bucket '{name}' ready ({e})")

    def upload(self, bucket: str, path: str, data: bytes) -> Optional[str]:
        """Upload (upsert) bytes and return the public URL."""
        if self.dry_run:
            return f"[dry-run]/{bucket}/{path}"
        try:
            self.client.storage.from_(bucket).upload(
                path, data,
                {"content-type": "image/png", "upsert": "true", "cache-control": "public, max-age=31536000"},
            )
        except Exception as e:  # noqa: BLE001
            self.logger.warning(f"  upload failed {bucket}/{path}: {e}")
            return None
        return self.client.storage.from_(bucket).get_public_url(path)


# ============================================================
# Teams
# ============================================================

def scrape_team_logos(client, store, delay, logger, only_sport, limit, dry_run) -> int:
    total = 0
    for league, cfg in LEAGUES.items():
        if only_sport and league != only_sport:
            continue
        espn_sport = cfg["espn_sport"]
        stored_sport = cfg["stored_sport"]
        data = fetch_json(f"{ESPN_BASE}/{espn_sport}/{league}/teams", delay, logger)
        if not data:
            continue
        teams = data.get("sports", [{}])[0].get("leagues", [{}])[0].get("teams", [])
        logger.info(f"[{league}] {len(teams)} teams")
        rows = []
        for i, entry in enumerate(teams):
            if limit and i >= limit:
                break
            team = entry.get("team", entry)
            espn_id = str(team.get("id", ""))
            logos = team.get("logos") or []
            src = logos[0].get("href") if logos else None
            if not src:
                src = f"https://a.espncdn.com/i/teamlogos/{league}/500/{team.get('abbreviation','').lower()}.png"
            img = fetch_bytes(src, logger)
            if not img:
                logger.warning(f"  no logo for {team.get('displayName')}")
                continue
            url = store.upload(TEAM_BUCKET, f"{league}/{espn_id}.png", img)
            if not url:
                continue
            rows.append({
                "id": f"{league}-{espn_id}",
                "espn_id": espn_id,
                "name": team.get("displayName", team.get("name", "")),
                "abbreviation": team.get("abbreviation", ""),
                "short_name": team.get("shortDisplayName", ""),
                "logo_url": url,
                "color": team.get("color"),
                "alternate_color": team.get("alternateColor"),
                "sport": stored_sport,
                "league": league,
            })
            total += 1
        if rows and not dry_run:
            client.table("espn_teams").upsert(rows, on_conflict="id").execute()
        logger.info(f"[{league}] {len(rows)} logos mirrored")
    return total


# ============================================================
# Players
# ============================================================

def iter_roster_athletes(roster_data):
    """Yield athlete dicts from an ESPN roster response (grouped or flat)."""
    for group in roster_data.get("athletes", []):
        items = group.get("items", []) if isinstance(group, dict) else []
        if not items and isinstance(group, dict) and group.get("id"):
            items = [group]
        for a in items:
            yield a


def scrape_player_headshots(client, store, delay, logger, only_sport, width, limit, dry_run) -> int:
    total = 0
    for league, cfg in LEAGUES.items():
        if only_sport and league != only_sport:
            continue
        espn_sport = cfg["espn_sport"]
        stored_sport = cfg["stored_sport"]

        teams_data = fetch_json(f"{ESPN_BASE}/{espn_sport}/{league}/teams", delay, logger)
        if not teams_data:
            continue
        teams = teams_data.get("sports", [{}])[0].get("leagues", [{}])[0].get("teams", [])

        # Preload nba_players for name-matched headshot_url updates (NBA only).
        nba_by_norm = {}
        if league == "nba" and not dry_run:
            res = client.table("nba_players").select("id, player_name").limit(5000).execute()
            for row in (res.data or []):
                nba_by_norm.setdefault(normalize_name(row["player_name"]), row["id"])

        league_players = 0
        for ti, entry in enumerate(teams):
            if limit and ti >= limit:
                break
            team = entry.get("team", entry)
            team_espn_id = str(team.get("id", ""))
            team_name = team.get("displayName", "")
            roster = fetch_json(
                f"{ESPN_BASE}/{espn_sport}/{league}/teams/{team_espn_id}/roster", delay, logger
            )
            if not roster:
                logger.warning(f"  [{league}] roster fetch failed for {team_name}")
                continue

            player_rows = []
            nba_updates = []
            for a in iter_roster_athletes(roster):
                espn_id = str(a.get("id", ""))
                name = a.get("displayName") or a.get("fullName") or ""
                if not espn_id or not name:
                    continue
                # Prefer the athlete's own headshot href, resized; else build one.
                href = None
                hs = a.get("headshot")
                if isinstance(hs, dict) and hs.get("href"):
                    href = f"{hs['href']}&w={width}&h={round(width * 254 / 350)}" if "?" in hs["href"] else resized_headshot_url(espn_sport, espn_id, width)
                else:
                    href = resized_headshot_url(espn_sport, espn_id, width)

                img = fetch_bytes(href, logger)
                if not img:
                    continue
                url = store.upload(PLAYER_BUCKET, f"{league}/{espn_id}.png", img)
                if not url:
                    continue

                pos = a.get("position")
                pos = pos.get("abbreviation") if isinstance(pos, dict) else pos
                player_rows.append({
                    "id": f"{league}-{espn_id}",
                    "espn_id": espn_id,
                    "name": name,
                    "team_id": f"{league}-{team_espn_id}",
                    "team_name": team_name,
                    "jersey_number": a.get("jersey"),
                    "position": pos,
                    "headshot_url": url,
                    "sport": stored_sport,
                    "league": league,
                    "status": "active",
                })

                if league == "nba":
                    nba_id = nba_by_norm.get(normalize_name(name))
                    if nba_id:
                        nba_updates.append((nba_id, url))

                total += 1
                league_players += 1

            if player_rows and not dry_run:
                client.table("espn_players").upsert(player_rows, on_conflict="id").execute()
                for nba_id, url in nba_updates:
                    client.table("nba_players").update({"headshot_url": url}).eq("id", nba_id).execute()
            logger.info(f"  [{league}] {team_name}: {len(player_rows)} headshots")

        logger.info(f"[{league}] {league_players} player headshots mirrored")
    return total


# ============================================================
# Main
# ============================================================

def main():
    p = argparse.ArgumentParser(description="Mirror NBA/NFL images to Supabase Storage")
    p.add_argument("mode", choices=["all", "teams", "players"])
    p.add_argument("--sport", choices=["nba", "nfl"], default=None)
    p.add_argument("--width", type=int, default=350)
    p.add_argument("--delay", type=float, default=1.0)
    p.add_argument("--limit", type=int, default=None)
    p.add_argument("--dry-run", action="store_true")
    args = p.parse_args()

    logger = setup_logging()
    load_dotenv(Path(__file__).resolve().parent.parent / ".env.local")
    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        logger.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local")
        sys.exit(1)

    client = create_client(url, key)
    store = Store(client, logger, args.dry_run)

    if args.dry_run:
        logger.info("DRY RUN — no uploads or DB writes")

    if args.mode in ("all", "teams"):
        store.ensure_bucket(TEAM_BUCKET)
        n = scrape_team_logos(client, store, args.delay, logger, args.sport, args.limit, args.dry_run)
        logger.info(f"TOTAL team logos: {n}")

    if args.mode in ("all", "players"):
        store.ensure_bucket(PLAYER_BUCKET)
        n = scrape_player_headshots(client, store, args.delay, logger, args.sport, args.width, args.limit, args.dry_run)
        logger.info(f"TOTAL player headshots: {n}")

    logger.info("Done.")


if __name__ == "__main__":
    main()
