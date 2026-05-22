-- Migration: Create football scraper tables
-- Stores match schedules, player stats, standings, and player records from FBRef
-- Covers top 5 European leagues: Premier League, La Liga, Bundesliga, Serie A, Ligue 1

-- ============================================================
-- 1. football_matches
-- ============================================================
CREATE TABLE IF NOT EXISTS public.football_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_date DATE NOT NULL,
  match_url TEXT UNIQUE NOT NULL,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  home_score INTEGER,
  away_score INTEGER,
  status TEXT NOT NULL CHECK (status IN ('completed', 'scheduled')),
  league TEXT NOT NULL,
  comp_id INTEGER NOT NULL,
  season TEXT NOT NULL DEFAULT '2024-25',
  round TEXT,
  venue TEXT,
  kickoff_time TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_football_matches_status ON public.football_matches (status);
CREATE INDEX IF NOT EXISTS idx_football_matches_league ON public.football_matches (league);
CREATE INDEX IF NOT EXISTS idx_football_matches_date ON public.football_matches (match_date);

ALTER TABLE public.football_matches ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'football_matches'
      AND policyname = 'Football matches are viewable by everyone.'
  ) THEN
    CREATE POLICY "Football matches are viewable by everyone."
      ON public.football_matches FOR SELECT USING (true);
  END IF;
END $$;

-- ============================================================
-- 2. football_player_stats
-- ============================================================
CREATE TABLE IF NOT EXISTS public.football_player_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.football_matches(id) ON DELETE CASCADE,
  player_name TEXT NOT NULL,
  player_fbref_id TEXT NOT NULL,
  team TEXT NOT NULL,
  opponent TEXT NOT NULL,
  match_date DATE NOT NULL,
  position TEXT,
  is_starter BOOLEAN NOT NULL DEFAULT false,
  minutes INTEGER,
  goals INTEGER,
  assists INTEGER,
  shots INTEGER,
  shots_on_target INTEGER,
  passes_completed INTEGER,
  passes_attempted INTEGER,
  pass_completion_pct NUMERIC(5,2),
  key_passes INTEGER,
  through_balls INTEGER,
  tackles INTEGER,
  interceptions INTEGER,
  blocks INTEGER,
  clearances INTEGER,
  aerials_won INTEGER,
  fouls_committed INTEGER,
  fouls_drawn INTEGER,
  yellow_cards INTEGER,
  red_cards INTEGER,
  xg NUMERIC(5,2),
  xag NUMERIC(5,2),
  progressive_carries INTEGER,
  progressive_passes INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_football_player_stats_match_id ON public.football_player_stats (match_id);
CREATE INDEX IF NOT EXISTS idx_football_player_stats_player ON public.football_player_stats (player_fbref_id);
CREATE INDEX IF NOT EXISTS idx_football_player_stats_date ON public.football_player_stats (match_date);

ALTER TABLE public.football_player_stats ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'football_player_stats'
      AND policyname = 'Football player stats are viewable by everyone.'
  ) THEN
    CREATE POLICY "Football player stats are viewable by everyone."
      ON public.football_player_stats FOR SELECT USING (true);
  END IF;
END $$;

-- ============================================================
-- 3. football_standings
-- ============================================================
CREATE TABLE IF NOT EXISTS public.football_standings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team TEXT NOT NULL,
  league TEXT NOT NULL,
  comp_id INTEGER NOT NULL,
  season TEXT NOT NULL DEFAULT '2024-25',
  position INTEGER NOT NULL,
  matches_played INTEGER NOT NULL,
  wins INTEGER NOT NULL,
  draws INTEGER NOT NULL,
  losses INTEGER NOT NULL,
  goals_for INTEGER NOT NULL,
  goals_against INTEGER NOT NULL,
  goal_difference INTEGER NOT NULL,
  points INTEGER NOT NULL,
  xg NUMERIC(5,2),
  xga NUMERIC(5,2),
  last_5 TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(team, league, season)
);

ALTER TABLE public.football_standings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'football_standings'
      AND policyname = 'Football standings are viewable by everyone.'
  ) THEN
    CREATE POLICY "Football standings are viewable by everyone."
      ON public.football_standings FOR SELECT USING (true);
  END IF;
END $$;

-- ============================================================
-- 4. football_players
-- ============================================================
CREATE TABLE IF NOT EXISTS public.football_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_fbref_id TEXT UNIQUE NOT NULL,
  player_name TEXT NOT NULL,
  current_team TEXT NOT NULL,
  position TEXT,
  nationality TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_football_players_fbref_id ON public.football_players (player_fbref_id);
CREATE INDEX IF NOT EXISTS idx_football_players_team ON public.football_players (current_team);

ALTER TABLE public.football_players ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'football_players'
      AND policyname = 'Football players are viewable by everyone.'
  ) THEN
    CREATE POLICY "Football players are viewable by everyone."
      ON public.football_players FOR SELECT USING (true);
  END IF;
END $$;

-- ============================================================
-- 5. Auto-update updated_at trigger
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_football_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for football_matches
DROP TRIGGER IF EXISTS trg_football_matches_updated_at ON public.football_matches;
CREATE TRIGGER trg_football_matches_updated_at
  BEFORE UPDATE ON public.football_matches
  FOR EACH ROW EXECUTE FUNCTION public.update_football_updated_at();

-- Trigger for football_standings
DROP TRIGGER IF EXISTS trg_football_standings_updated_at ON public.football_standings;
CREATE TRIGGER trg_football_standings_updated_at
  BEFORE UPDATE ON public.football_standings
  FOR EACH ROW EXECUTE FUNCTION public.update_football_updated_at();

-- Trigger for football_players
DROP TRIGGER IF EXISTS trg_football_players_updated_at ON public.football_players;
CREATE TRIGGER trg_football_players_updated_at
  BEFORE UPDATE ON public.football_players
  FOR EACH ROW EXECUTE FUNCTION public.update_football_updated_at();
