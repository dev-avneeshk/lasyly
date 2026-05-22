-- Migration: Create ai_writeup_cache table
-- Cached AI-generated writeups with 6h expiry and line-change invalidation

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

CREATE INDEX idx_writeup_cache_prop ON public.ai_writeup_cache (prop_identifier, sport);
CREATE INDEX idx_writeup_cache_expires ON public.ai_writeup_cache (expires_at);

ALTER TABLE public.ai_writeup_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Writeups are viewable by everyone."
  ON public.ai_writeup_cache FOR SELECT USING (true);
