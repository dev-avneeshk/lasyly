-- Migration: Add indexes for player slug lookups and sitemap generation
-- Supports SEO public pages: fast slug resolution and recent player discovery

-- Index for fast player slug lookups on prop_line_history.
-- Uses an expression index that approximates the slug transformation
-- (lowercase, replace spaces/dots with hyphens) for efficient filtering.
CREATE INDEX IF NOT EXISTS idx_prop_lines_player_slug
  ON public.prop_line_history (lower(replace(replace(player_name, ' ', '-'), '.', '')));

-- Index for sitemap generation: quickly find distinct players with recent activity.
-- Covers queries that need player_name ordered by most recent recorded_at,
-- filtered to rows that have a non-null line_value (active prop lines).
CREATE INDEX IF NOT EXISTS idx_prop_lines_recent_players
  ON public.prop_line_history (player_name, recorded_at DESC)
  WHERE line_value IS NOT NULL;
