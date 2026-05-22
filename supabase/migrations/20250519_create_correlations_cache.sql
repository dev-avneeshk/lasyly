-- Migration: Create correlations_cache table
-- Pre-computed pairwise correlations (refreshed daily)

CREATE TABLE IF NOT EXISTS public.correlations_cache (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  sport TEXT NOT NULL CHECK (sport IN ('NBA', 'Tennis')),
  prop_a TEXT NOT NULL,
  prop_b TEXT NOT NULL,
  coefficient NUMERIC(5,4) NOT NULL,
  overlapping_games INTEGER NOT NULL,
  computed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(sport, prop_a, prop_b)
);

CREATE INDEX idx_correlations_prop_a ON public.correlations_cache (prop_a, coefficient DESC);
CREATE INDEX idx_correlations_prop_b ON public.correlations_cache (prop_b, coefficient DESC);
CREATE INDEX idx_correlations_sport ON public.correlations_cache (sport);

ALTER TABLE public.correlations_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Correlations are viewable by everyone."
  ON public.correlations_cache FOR SELECT USING (true);
