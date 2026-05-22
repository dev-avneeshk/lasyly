-- Team logos storage (permanent, avoids re-fetching from ESPN CDN)
CREATE TABLE IF NOT EXISTS team_logos (
  id TEXT PRIMARY KEY,              -- e.g. "espn-nba-13" (sport-league-teamId)
  team_name TEXT NOT NULL,
  abbreviation TEXT,
  logo_url TEXT NOT NULL,           -- original ESPN CDN URL
  stored_logo_url TEXT,             -- Supabase storage URL (after download)
  color TEXT,                       -- hex without #
  sport TEXT NOT NULL,
  league TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- All matches (permanent storage - ESPN + scraper data)
CREATE TABLE IF NOT EXISTS matches (
  id TEXT PRIMARY KEY,              -- e.g. "espn-nba-401584721"
  event_id TEXT NOT NULL,           -- ESPN event ID
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  home_score INTEGER DEFAULT 0,
  away_score INTEGER DEFAULT 0,
  home_logo TEXT,                   -- logo URL (ESPN CDN or stored)
  away_logo TEXT,
  home_color TEXT,
  away_color TEXT,
  venue TEXT,
  league TEXT NOT NULL,
  sport TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Not Started',
  clock TEXT,
  match_date DATE NOT NULL,
  start_time TIMESTAMPTZ,
  source TEXT NOT NULL DEFAULT 'espn',  -- 'espn', 'scraper_nba', 'scraper_fb', etc.
  raw_data JSONB,                   -- store full ESPN/scraper response for future use
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_matches_date ON matches (match_date);
CREATE INDEX IF NOT EXISTS idx_matches_league_date ON matches (league, match_date);
CREATE INDEX IF NOT EXISTS idx_matches_sport_date ON matches (sport, match_date);
CREATE INDEX IF NOT EXISTS idx_matches_status ON matches (status);
CREATE INDEX IF NOT EXISTS idx_matches_source ON matches (source);
