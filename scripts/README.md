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
