-- Migration: Create parlays and parlay_legs tables
-- Supports the Parlay Builder & Tracker feature for saving, tracking, and sharing multi-leg parlays.

-- 1. parlays table
CREATE TABLE IF NOT EXISTS public.parlays (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'won', 'lost')),
  visibility      TEXT NOT NULL
                    CHECK (visibility IN ('public', 'private')),
  odds            NUMERIC(10,2),
  stake           NUMERIC(10,2),
  custom_note     TEXT CHECK (char_length(custom_note) <= 280),
  combined_hit_rate NUMERIC(4,1) CHECK (combined_hit_rate >= 0.0 AND combined_hit_rate <= 100.0),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at     TIMESTAMPTZ
);

-- 2. parlay_legs table
CREATE TABLE IF NOT EXISTS public.parlay_legs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parlay_id       UUID NOT NULL REFERENCES public.parlays(id) ON DELETE CASCADE,
  player_name     TEXT NOT NULL CHECK (char_length(player_name) <= 200),
  stat_category   TEXT NOT NULL CHECK (char_length(stat_category) <= 100),
  prop_line       NUMERIC(10,2) NOT NULL,
  direction       TEXT NOT NULL CHECK (direction IN ('over', 'under')),
  l10_hit_rate    NUMERIC(4,1) CHECK (l10_hit_rate >= 0.0 AND l10_hit_rate <= 100.0),
  leg_order       INTEGER NOT NULL CHECK (leg_order >= 1 AND leg_order <= 20),
  sport           TEXT NOT NULL
);

-- 3. Enable Row Level Security
ALTER TABLE public.parlays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parlay_legs ENABLE ROW LEVEL SECURITY;

-- 4. RLS policies for parlays

-- Users can select their own parlays
CREATE POLICY "select_own"
  ON public.parlays FOR SELECT
  USING (user_id = auth.uid());

-- All authenticated users can select public parlays
CREATE POLICY "select_public"
  ON public.parlays FOR SELECT
  USING (visibility = 'public');

-- Users can insert parlays where user_id matches their auth.uid()
CREATE POLICY "insert_own"
  ON public.parlays FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can update their own parlays (status, resolved_at, visibility)
CREATE POLICY "update_own"
  ON public.parlays FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Users can delete their own pending parlays only
CREATE POLICY "delete_own_pending"
  ON public.parlays FOR DELETE
  USING (user_id = auth.uid() AND status = 'pending');

-- 5. RLS policies for parlay_legs

-- Users can select legs where the parent parlay is accessible (own or public)
CREATE POLICY "select_via_parlay"
  ON public.parlay_legs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.parlays p
      WHERE p.id = parlay_id
        AND (p.user_id = auth.uid() OR p.visibility = 'public')
    )
  );

-- Users can insert legs for their own parlays
CREATE POLICY "insert_via_parlay"
  ON public.parlay_legs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.parlays p
      WHERE p.id = parlay_id
        AND p.user_id = auth.uid()
    )
  );

-- 6. Indexes for efficient queries

-- Dashboard queries: filter by user and status
CREATE INDEX IF NOT EXISTS idx_parlays_user_status
  ON public.parlays (user_id, status);

-- Feed queries: public parlays sorted by newest first
CREATE INDEX IF NOT EXISTS idx_parlays_feed
  ON public.parlays (visibility, created_at DESC);

-- Leg lookups by parlay
CREATE INDEX IF NOT EXISTS idx_parlay_legs_parlay
  ON public.parlay_legs (parlay_id);
