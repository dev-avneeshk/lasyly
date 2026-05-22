-- Migration: Create prop_line_history table
-- Append-only log of prop line values recorded each scraper run

CREATE TABLE IF NOT EXISTS public.prop_line_history (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  player_name TEXT NOT NULL,
  sport TEXT NOT NULL CHECK (sport IN ('NBA', 'Tennis')),
  stat_category TEXT NOT NULL,
  line_value NUMERIC NOT NULL,
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX idx_line_history_player_stat 
  ON public.prop_line_history (player_name, stat_category, recorded_at DESC);
CREATE INDEX idx_line_history_recorded 
  ON public.prop_line_history (recorded_at DESC);

ALTER TABLE public.prop_line_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Line history is viewable by everyone."
  ON public.prop_line_history FOR SELECT USING (true);
