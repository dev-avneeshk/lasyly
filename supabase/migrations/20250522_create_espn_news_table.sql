-- Migration: Create ESPN news articles table
-- Stores news fetched hourly from ESPN's public API
-- Used by the explore page news feed

CREATE TABLE IF NOT EXISTS public.espn_news (
  id TEXT PRIMARY KEY,                    -- ESPN article ID
  headline TEXT NOT NULL,
  description TEXT,
  story TEXT,                             -- Full article HTML body
  published_at TIMESTAMPTZ NOT NULL,
  source TEXT NOT NULL,                   -- "Premier League", "NBA", etc.
  category TEXT NOT NULL,                 -- "Football", "NBA", "NFL", etc.
  image_url TEXT,
  link TEXT,
  byline TEXT,
  article_type TEXT DEFAULT 'HeadlineNews', -- HeadlineNews, Media, etc.
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_espn_news_category ON public.espn_news (category);
CREATE INDEX IF NOT EXISTS idx_espn_news_published ON public.espn_news (published_at DESC);
CREATE INDEX IF NOT EXISTS idx_espn_news_category_published ON public.espn_news (category, published_at DESC);

ALTER TABLE public.espn_news ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ESPN news viewable by everyone."
  ON public.espn_news FOR SELECT USING (true);

-- Auto-update timestamp trigger
CREATE TRIGGER trg_espn_news_ts BEFORE UPDATE ON public.espn_news
  FOR EACH ROW EXECUTE FUNCTION public.espn_update_timestamp();
