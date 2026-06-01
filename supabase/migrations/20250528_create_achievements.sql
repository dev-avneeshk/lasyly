-- User achievements table for streak badges & achievements system
CREATE TABLE IF NOT EXISTS public.user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_key TEXT NOT NULL CHECK (char_length(achievement_key) <= 100),
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, achievement_key)
);

ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own" ON public.user_achievements FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "select_public" ON public.user_achievements FOR SELECT USING (true);

CREATE INDEX idx_achievements_user ON public.user_achievements (user_id);
