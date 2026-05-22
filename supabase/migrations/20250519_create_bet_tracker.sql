-- Migration: Create bet_tracker table
-- User bet/pick records with RLS for user-scoped access

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

CREATE INDEX idx_bets_user ON public.bet_tracker (user_id, created_at DESC);
CREATE INDEX idx_bets_status ON public.bet_tracker (user_id, status);

ALTER TABLE public.bet_tracker ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own bets."
  ON public.bet_tracker FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own bets."
  ON public.bet_tracker FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own bets."
  ON public.bet_tracker FOR UPDATE USING (auth.uid() = user_id);
