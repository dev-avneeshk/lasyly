# NBA Scraper

Scrapes basketball-reference.com for the 2025-26 NBA season schedule and player box score stats, storing data in Supabase.

## Setup

```bash
pip install -r requirements.txt
```

## Environment

Requires in `../.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## Usage

```bash
# Full season scrape (schedule + all box scores)
python scrape_nba.py full

# Only scrape schedule pages (Oct-May)
python scrape_nba.py schedule-only

# Only scrape box scores for games missing stats
python scrape_nba.py boxscores-only

# Daily update (current month schedule + last 2 days box scores)
python scrape_nba.py daily

# Limit box scores scraped
python scrape_nba.py boxscores-only --limit 10

# Filter by date range
python scrape_nba.py boxscores-only --start-date 2025-10-21 --end-date 2025-10-31

# Custom delay between requests (default: 3s)
python scrape_nba.py full --delay 5
```

## Database Tables

- `nba_games` — Game schedule with scores and status
- `nba_player_stats` — Player box score stats per game

## Rate Limiting

- 3 second default delay between requests
- Auto-retry on 429/5xx with 60s backoff (max 3 retries)
- Respectful User-Agent header

---

# NFL Scraper (`scrape_nfl.py`)

Scrapes NFL schedule, final scores, and per-player boxscore stats from ESPN's
public JSON API and stores them in Supabase (`nfl_games`, `nfl_player_stats`),
plus append-only prop lines in `prop_line_history` (sport `NFL`).

Football Reference is **not** used: it sits behind a Cloudflare JavaScript
challenge that blocks all pure-HTTP clients, so it can't be scraped in cron
without a headless browser. ESPN is pure HTTP and cron-safe.

## Environment

Same Supabase vars as above. Optionally, for cache-aside on completed-game
summaries (avoids re-fetching during large backfills):
```
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
```

## Usage

```bash
# Full backfill of 2024 + 2025 (regular + postseason): schedule + boxscores + prop lines
python scrape_nfl.py backfill --delay 1

# Just one season
python scrape_nfl.py full --season 2025 --delay 1

# Schedule/scores only
python scrape_nfl.py schedule --season 2025

# Boxscores for completed games missing stats
python scrape_nfl.py boxscores --seasons 2024,2025 --limit 50

# Daily refresh (current season, schedule + new boxscores)
python scrape_nfl.py daily

# Parse-only, no DB writes (safe before the migration is applied)
python scrape_nfl.py schedule --season 2025 --dry-run

# Backfill player positions on existing rows (from current team rosters)
python scrape_nfl.py positions
```

Requires migration `supabase/migrations/20260911_create_nfl_tables.sql` applied first.

### Player positions

ESPN's boxscore feed does not include player positions, so the scraper sources
them from the team roster endpoint once per run and fills the `position` column
as it writes player stats (`full`/`boxscores`/`daily`/`backfill` modes).

The `positions` mode backfills positions onto rows that are missing them. Note:
positions come from *current* rosters, so players no longer on any roster
(retired/cut in older seasons) can't be resolved and stay null. Current and
recent players are covered, and new data is always written with positions.
