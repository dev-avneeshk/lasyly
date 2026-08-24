-- =====================================================================
-- COMBINED MIGRATION: All missing tables/changes
-- Run this in your Supabase SQL Editor in order.
-- =====================================================================
-- Tables to create:
--   1. team_logos, matches (live scores)
--   2. bet_tracker
--   3. ai_writeup_cache
--   4. prop_votes
--   5. football_matches, football_player_stats, football_standings, football_players
-- Alterations:
--   6. wallet double-spend protection (idempotency_key + RPC functions)
--   7. bet_tracker: add is_monitored column + indexes
--   8. tennis_raw_stats: fix column types
--   9. Security RLS baseline
-- =====================================================================


-- ═══════════════════════════════════════════════════════════════════════
-- 1. LIVE SCORES TABLES (team_logos + matches)
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.team_logos (
  id TEXT PRIMARY KEY,
  team_name TEXT NOT NULL,
  abbreviation TEXT,
  logo_url TEXT NOT NULL,
  stored_logo_url TEXT,
  color TEXT,
  sport TEXT NOT NULL,
  league TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.matches (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  home_score INTEGER DEFAULT 0,
  away_score INTEGER DEFAULT 0,
  home_logo TEXT,
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
  source TEXT NOT NULL DEFAULT 'espn',
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_matches_date ON public.matches (match_date);
CREATE INDEX IF NOT EXISTS idx_matches_league_date ON public.matches (league, match_date);
CREATE INDEX IF NOT EXISTS idx_matches_sport_date ON public.matches (sport, match_date);
CREATE INDEX IF NOT EXISTS idx_matches_status ON public.matches (status);
CREATE INDEX IF NOT EXISTS idx_matches_source ON public.matches (source);


-- ═══════════════════════════════════════════════════════════════════════
-- 2. BET TRACKER
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.bet_tracker (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  player_name TEXT NOT NULL,
  sport TEXT NOT NULL CHECK (sport IN ('NBA', 'Tennis')),
  stat_category TEXT NOT NULL,
  prop_line NUMERIC NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('over', 'under')),
  confidence_score INTEGER CHECK (confidence_score BETWEEN 1 AND 5),
  matchup_grade TEXT CHECK (matchup_grade IN ('A', 'B', 'C', 'D', 'F')),
  odds INTEGER NOT NULL CHECK (odds BETWEEN -10000 AND 10000),
  stake NUMERIC(8,2) NOT NULL CHECK (stake BETWEEN 0.01 AND 99999.99),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'won', 'lost', 'push')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  resolved_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_bets_user ON public.bet_tracker (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bets_status ON public.bet_tracker (user_id, status);

ALTER TABLE public.bet_tracker ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own bets."
  ON public.bet_tracker FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own bets."
  ON public.bet_tracker FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own bets."
  ON public.bet_tracker FOR UPDATE USING (auth.uid() = user_id);


-- ═══════════════════════════════════════════════════════════════════════
-- 3. AI WRITEUP CACHE
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.ai_writeup_cache (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  prop_identifier TEXT NOT NULL,
  sport TEXT NOT NULL CHECK (sport IN ('NBA', 'Tennis')),
  writeup TEXT NOT NULL,
  prop_line_at_generation NUMERIC NOT NULL,
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  UNIQUE(prop_identifier, sport)
);

CREATE INDEX IF NOT EXISTS idx_writeup_cache_prop ON public.ai_writeup_cache (prop_identifier, sport);
CREATE INDEX IF NOT EXISTS idx_writeup_cache_expires ON public.ai_writeup_cache (expires_at);

ALTER TABLE public.ai_writeup_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Writeups are viewable by everyone."
  ON public.ai_writeup_cache FOR SELECT USING (true);


-- ═══════════════════════════════════════════════════════════════════════
-- 4. PROP VOTES
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.prop_votes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prop_identifier TEXT NOT NULL,
  sport TEXT NOT NULL CHECK (sport IN ('NBA', 'Tennis')),
  direction TEXT NOT NULL CHECK (direction IN ('over', 'under')),
  vote_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, prop_identifier, vote_date)
);

CREATE INDEX IF NOT EXISTS idx_votes_prop ON public.prop_votes (prop_identifier, vote_date);
CREATE INDEX IF NOT EXISTS idx_votes_user ON public.prop_votes (user_id);

ALTER TABLE public.prop_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view all votes."
  ON public.prop_votes FOR SELECT USING (true);
CREATE POLICY "Users can insert their own votes."
  ON public.prop_votes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own votes."
  ON public.prop_votes FOR UPDATE USING (auth.uid() = user_id);


-- ═══════════════════════════════════════════════════════════════════════
-- 5. FOOTBALL TABLES
-- ═══════════════════════════════════════════════════════════════════════

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

-- Football updated_at triggers
CREATE OR REPLACE FUNCTION public.update_football_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_football_matches_updated_at ON public.football_matches;
CREATE TRIGGER trg_football_matches_updated_at
  BEFORE UPDATE ON public.football_matches
  FOR EACH ROW EXECUTE FUNCTION public.update_football_updated_at();

DROP TRIGGER IF EXISTS trg_football_standings_updated_at ON public.football_standings;
CREATE TRIGGER trg_football_standings_updated_at
  BEFORE UPDATE ON public.football_standings
  FOR EACH ROW EXECUTE FUNCTION public.update_football_updated_at();

DROP TRIGGER IF EXISTS trg_football_players_updated_at ON public.football_players;
CREATE TRIGGER trg_football_players_updated_at
  BEFORE UPDATE ON public.football_players
  FOR EACH ROW EXECUTE FUNCTION public.update_football_updated_at();


-- ═══════════════════════════════════════════════════════════════════════
-- 6. WALLET DOUBLE-SPEND PROTECTION
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_transactions_idempotency
  ON public.transactions (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE OR REPLACE FUNCTION public.debit_wallet(
  p_user_id UUID,
  p_amount NUMERIC,
  p_type TEXT,
  p_reference_id UUID DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS TABLE(success BOOLEAN, new_balance NUMERIC, error_message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_balance NUMERIC;
  v_new_balance NUMERIC;
  v_lock_key BIGINT;
BEGIN
  v_lock_key := ('x' || left(replace(p_user_id::text, '-', ''), 16))::bit(64)::bigint;
  PERFORM pg_advisory_xact_lock(v_lock_key);

  IF p_idempotency_key IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM transactions WHERE idempotency_key = p_idempotency_key) THEN
      SELECT wallet_balance INTO v_current_balance FROM profiles WHERE id = p_user_id;
      RETURN QUERY SELECT true, v_current_balance, NULL::TEXT;
      RETURN;
    END IF;
  END IF;

  SELECT wallet_balance INTO v_current_balance
    FROM profiles
    WHERE id = p_user_id
    FOR UPDATE;

  IF v_current_balance IS NULL THEN
    RETURN QUERY SELECT false, 0::NUMERIC, 'User not found'::TEXT;
    RETURN;
  END IF;

  IF v_current_balance < p_amount THEN
    RETURN QUERY SELECT false, v_current_balance, 'Insufficient funds'::TEXT;
    RETURN;
  END IF;

  v_new_balance := v_current_balance - p_amount;
  UPDATE profiles SET wallet_balance = v_new_balance WHERE id = p_user_id;

  INSERT INTO transactions (user_id, type, amount, status, reference_id, idempotency_key)
  VALUES (p_user_id, p_type, -p_amount, 'completed', p_reference_id, p_idempotency_key);

  RETURN QUERY SELECT true, v_new_balance, NULL::TEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.credit_wallet(
  p_user_id UUID,
  p_amount NUMERIC,
  p_type TEXT,
  p_reference_id UUID DEFAULT NULL,
  p_stripe_session_id TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS TABLE(success BOOLEAN, new_balance NUMERIC, error_message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_balance NUMERIC;
  v_new_balance NUMERIC;
  v_lock_key BIGINT;
BEGIN
  v_lock_key := ('x' || left(replace(p_user_id::text, '-', ''), 16))::bit(64)::bigint;
  PERFORM pg_advisory_xact_lock(v_lock_key);

  IF p_idempotency_key IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM transactions WHERE idempotency_key = p_idempotency_key) THEN
      SELECT wallet_balance INTO v_current_balance FROM profiles WHERE id = p_user_id;
      RETURN QUERY SELECT true, v_current_balance, NULL::TEXT;
      RETURN;
    END IF;
  END IF;

  SELECT wallet_balance INTO v_current_balance
    FROM profiles
    WHERE id = p_user_id
    FOR UPDATE;

  IF v_current_balance IS NULL THEN
    RETURN QUERY SELECT false, 0::NUMERIC, 'User not found'::TEXT;
    RETURN;
  END IF;

  v_new_balance := v_current_balance + p_amount;
  UPDATE profiles SET wallet_balance = v_new_balance WHERE id = p_user_id;

  INSERT INTO transactions (user_id, type, amount, status, reference_id, stripe_session_id, idempotency_key)
  VALUES (p_user_id, p_type, p_amount, 'completed', p_reference_id, p_stripe_session_id, p_idempotency_key);

  RETURN QUERY SELECT true, v_new_balance, NULL::TEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.debit_wallet TO authenticated;
GRANT EXECUTE ON FUNCTION public.credit_wallet TO authenticated, service_role;


-- ═══════════════════════════════════════════════════════════════════════
-- 7. BET TRACKER: ADD is_monitored + INDEXES
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE public.bet_tracker
  ADD COLUMN IF NOT EXISTS is_monitored BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_bets_monitored ON public.bet_tracker (user_id, is_monitored, status);
CREATE INDEX IF NOT EXISTS idx_bets_sport_stat ON public.bet_tracker (user_id, sport, stat_category, created_at DESC);

ALTER TABLE public.bet_tracker
  ALTER COLUMN odds DROP NOT NULL,
  ALTER COLUMN stake DROP NOT NULL;

ALTER TABLE public.bet_tracker DROP CONSTRAINT IF EXISTS bet_tracker_odds_check;
ALTER TABLE public.bet_tracker ADD CONSTRAINT bet_tracker_odds_check
  CHECK (is_monitored = true OR (odds IS NOT NULL AND odds BETWEEN -10000 AND 10000));

ALTER TABLE public.bet_tracker DROP CONSTRAINT IF EXISTS bet_tracker_stake_check;
ALTER TABLE public.bet_tracker ADD CONSTRAINT bet_tracker_stake_check
  CHECK (is_monitored = true OR (stake IS NOT NULL AND stake BETWEEN 0.01 AND 99999.99));


-- ═══════════════════════════════════════════════════════════════════════
-- 8. TENNIS RAW STATS: FIX COLUMN TYPES
-- ═══════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tennis_raw_stats'
      AND column_name = 'win_pct' AND data_type IN ('integer', 'bigint', 'smallint')
  ) THEN
    ALTER TABLE public.tennis_raw_stats ALTER COLUMN win_pct TYPE NUMERIC(5,1);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tennis_raw_stats'
      AND column_name = 'sets_won' AND data_type IN ('integer', 'bigint', 'smallint')
  ) THEN
    ALTER TABLE public.tennis_raw_stats ALTER COLUMN sets_won TYPE NUMERIC(6,2);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tennis_raw_stats'
      AND column_name = 'sets_lost' AND data_type IN ('integer', 'bigint', 'smallint')
  ) THEN
    ALTER TABLE public.tennis_raw_stats ALTER COLUMN sets_lost TYPE NUMERIC(6,2);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tennis_raw_stats'
      AND column_name = 'games_won' AND data_type IN ('integer', 'bigint', 'smallint')
  ) THEN
    ALTER TABLE public.tennis_raw_stats ALTER COLUMN games_won TYPE NUMERIC(6,1);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tennis_raw_stats'
      AND column_name = 'games_lost' AND data_type IN ('integer', 'bigint', 'smallint')
  ) THEN
    ALTER TABLE public.tennis_raw_stats ALTER COLUMN games_lost TYPE NUMERIC(6,1);
  END IF;
END $$;
