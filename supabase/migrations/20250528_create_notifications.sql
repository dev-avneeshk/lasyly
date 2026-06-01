-- Notifications table for in-app notification system
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('follow', 'parlay_won', 'parlay_lost', 'room_invite', 'achievement')),
  title TEXT NOT NULL CHECK (char_length(title) <= 200),
  body TEXT CHECK (char_length(body) <= 500),
  link TEXT CHECK (char_length(link) <= 500),
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own" ON public.notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "update_own" ON public.notifications FOR UPDATE USING (user_id = auth.uid());

CREATE INDEX idx_notifications_user_unread ON public.notifications (user_id, is_read, created_at DESC);
