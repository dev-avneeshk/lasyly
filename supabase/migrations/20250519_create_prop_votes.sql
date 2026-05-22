-- Create prop_votes table for community sentiment voting on props.
-- Users can vote over/under on any prop once per day.

CREATE TABLE IF NOT EXISTS public.prop_votes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prop_identifier TEXT NOT NULL,
  sport TEXT NOT NULL CHECK (sport IN ('NBA', 'Tennis')),
  direction TEXT NOT NULL CHECK (direction IN ('over', 'under')),
  vote_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, prop_identifier, vote_date)
);

CREATE INDEX idx_votes_prop ON public.prop_votes (prop_identifier, vote_date);
CREATE INDEX idx_votes_user ON public.prop_votes (user_id);

ALTER TABLE public.prop_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all votes."
  ON public.prop_votes FOR SELECT USING (true);

CREATE POLICY "Users can insert their own votes."
  ON public.prop_votes FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own votes."
  ON public.prop_votes FOR UPDATE USING (auth.uid() = user_id);
