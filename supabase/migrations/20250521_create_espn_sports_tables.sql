-- Migration: Create ESPN sports data tables
-- Populates all sports EXCEPT basketball (handled by basketball-reference scrapers)
-- Covers: Football (Soccer), NFL, NHL, Tennis (ATP/WTA), F1, Golf, MMA
-- Data source: ESPN unofficial public API (no auth required)

-- ============================================================
-- 1. espn_teams — All teams across all ESPN-sourced sports
-- ============================================================
CREATE TABLE IF NOT EXISTS public.espn_teams (
  id TEXT PRIMARY KEY,                -- "{league}-{espnTeamId}" e.g. "eng.1-359"
  espn_id TEXT NOT NULL,
  name TEXT NOT NULL,
  abbreviation TEXT,
  short_name TEXT,
  logo_url TEXT,
  color TEXT,
  alternate_color TEXT,
  sport TEXT NOT NULL,                -- football, soccer, hockey, tennis, racing
  league TEXT NOT NULL,               -- eng.1, nfl, nhl, atp, wta, f1
  venue_name TEXT,
  venue_city TEXT,
  conference TEXT,
  division TEXT,
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_espn_teams_league ON public.espn_teams (league);
CREATE INDEX IF NOT EXISTS idx_espn_teams_sport ON public.espn_teams (sport);

ALTER TABLE public.espn_teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ESPN teams viewable by everyone."
  ON public.espn_teams FOR SELECT USING (true);

-- ============================================================
-- 2. espn_players — Rosters for all ESPN-sourced sports
-- ============================================================
CREATE TABLE IF NOT EXISTS public.espn_players (
  id TEXT PRIMARY KEY,                -- "{league}-{espnAthleteId}"
  espn_id TEXT NOT NULL,
  name TEXT NOT NULL,
  team_id TEXT REFERENCES public.espn_teams(id) ON DELETE SET NULL,
  team_name TEXT,
  jersey_number TEXT,
  position TEXT,
  height TEXT,
  weight TEXT,
  age INTEGER,
  headshot_url TEXT,
  sport TEXT NOT NULL,
  league TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  nationality TEXT,
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_espn_players_league ON public.espn_players (league);
CREATE INDEX IF NOT EXISTS idx_espn_players_team ON public.espn_players (team_id);
CREATE INDEX IF NOT EXISTS idx_espn_players_name ON public.espn_players (name);

ALTER TABLE public.espn_players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ESPN players viewable by everyone."
  ON public.espn_players FOR SELECT USING (true);

-- ============================================================
-- 3. espn_games — All games/events for current season
-- ============================================================
CREATE TABLE IF NOT EXISTS public.espn_games (
  id TEXT PRIMARY KEY,                -- "{league}-{eventId}"
  event_id TEXT NOT NULL,
  home_team_id TEXT REFERENCES public.espn_teams(id) ON DELETE SET NULL,
  away_team_id TEXT REFERENCES public.espn_teams(id) ON DELETE SET NULL,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  home_score INTEGER,
  away_score INTEGER,
  sport TEXT NOT NULL,
  league TEXT NOT NULL,
  season TEXT NOT NULL,               -- "2024-25" or "2025"
  season_type INTEGER DEFAULT 2,      -- 1=pre, 2=regular, 3=post
  week INTEGER,                       -- NFL week
  match_date DATE NOT NULL,
  start_time TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'scheduled',
  venue TEXT,
  home_logo TEXT,
  away_logo TEXT,
  odds_spread TEXT,
  odds_over_under TEXT,
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_espn_games_league_date ON public.espn_games (league, match_date);
CREATE INDEX IF NOT EXISTS idx_espn_games_status ON public.espn_games (status);
CREATE INDEX IF NOT EXISTS idx_espn_games_season ON public.espn_games (league, season);

ALTER TABLE public.espn_games ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ESPN games viewable by everyone."
  ON public.espn_games FOR SELECT USING (true);

-- ============================================================
-- 4. espn_standings — Current season standings
-- ============================================================
CREATE TABLE IF NOT EXISTS public.espn_standings (
  id TEXT PRIMARY KEY,                -- "{league}-{season}-{espnTeamId}"
  team_id TEXT REFERENCES public.espn_teams(id) ON DELETE CASCADE,
  team_name TEXT NOT NULL,
  league TEXT NOT NULL,
  sport TEXT NOT NULL,
  season TEXT NOT NULL,
  group_name TEXT,                    -- conference/division/group name
  position INTEGER,
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  draws INTEGER DEFAULT 0,
  overtime_losses INTEGER DEFAULT 0,  -- NHL OTL
  points INTEGER,                     -- soccer/NHL points
  win_pct NUMERIC(5,3),
  games_played INTEGER DEFAULT 0,
  goals_for INTEGER,
  goals_against INTEGER,
  goal_difference INTEGER,
  points_for INTEGER,                 -- NFL
  points_against INTEGER,             -- NFL
  streak TEXT,
  home_record TEXT,
  away_record TEXT,
  last_10 TEXT,                       -- NHL
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_espn_standings_league ON public.espn_standings (league, season);

ALTER TABLE public.espn_standings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ESPN standings viewable by everyone."
  ON public.espn_standings FOR SELECT USING (true);

-- ============================================================
-- 5. espn_player_stats — Per-game player stats from ESPN summaries
-- ============================================================
CREATE TABLE IF NOT EXISTS public.espn_player_stats (
  id TEXT PRIMARY KEY,                -- "{league}-{eventId}-{athleteId}"
  game_id TEXT REFERENCES public.espn_games(id) ON DELETE CASCADE,
  player_id TEXT REFERENCES public.espn_players(id) ON DELETE SET NULL,
  player_name TEXT NOT NULL,
  team TEXT NOT NULL,
  sport TEXT NOT NULL,
  league TEXT NOT NULL,
  match_date DATE NOT NULL,
  stats JSONB NOT NULL DEFAULT '{}',  -- flexible stat storage
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_espn_player_stats_game ON public.espn_player_stats (game_id);
CREATE INDEX IF NOT EXISTS idx_espn_player_stats_player ON public.espn_player_stats (player_id);
CREATE INDEX IF NOT EXISTS idx_espn_player_stats_league_date ON public.espn_player_stats (league, match_date);

ALTER TABLE public.espn_player_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ESPN player stats viewable by everyone."
  ON public.espn_player_stats FOR SELECT USING (true);

-- ============================================================
-- 6. Auto-update triggers
-- ============================================================
CREATE OR REPLACE FUNCTION public.espn_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_espn_teams_ts BEFORE UPDATE ON public.espn_teams
  FOR EACH ROW EXECUTE FUNCTION public.espn_update_timestamp();
CREATE TRIGGER trg_espn_players_ts BEFORE UPDATE ON public.espn_players
  FOR EACH ROW EXECUTE FUNCTION public.espn_update_timestamp();
CREATE TRIGGER trg_espn_games_ts BEFORE UPDATE ON public.espn_games
  FOR EACH ROW EXECUTE FUNCTION public.espn_update_timestamp();
CREATE TRIGGER trg_espn_standings_ts BEFORE UPDATE ON public.espn_standings
  FOR EACH ROW EXECUTE FUNCTION public.espn_update_timestamp();
