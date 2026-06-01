CREATE TABLE IF NOT EXISTS public.message_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL CHECK (char_length(emoji) <= 10),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(message_id, user_id, emoji)
);

ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_all" ON public.message_reactions FOR SELECT USING (true);
CREATE POLICY "insert_own" ON public.message_reactions FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "delete_own" ON public.message_reactions FOR DELETE USING (user_id = auth.uid());

CREATE INDEX idx_reactions_message ON public.message_reactions (message_id);
