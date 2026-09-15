-- Quiz attempts (NBA + NFL trivia)
--
-- One row per completed quiz attempt. Stores the score so we can show a user
-- their history and build a public leaderboard. The question bank itself lives
-- in code (lib/quiz/data.ts); this table only records outcomes.
--
-- Grading is server-authoritative: the API computes score/total against the
-- code bank and inserts the row via the service role. `correct_question_ids`
-- is kept for future per-question analytics.
--
-- RLS:
--   - A user may read their OWN attempts.
--   - Attempts are also publicly readable so the leaderboard can aggregate
--     across users (mirrors user_achievements). No PII is stored here.
--   - Writes go through the service role only (RLS denies client inserts),
--     so a client can never fabricate a score.

BEGIN;

CREATE TABLE IF NOT EXISTS public.quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  quiz_id TEXT NOT NULL CHECK (char_length(quiz_id) <= 100),
  sport   TEXT NOT NULL CHECK (sport IN ('nba', 'nfl')),

  score INTEGER NOT NULL CHECK (score >= 0),
  total INTEGER NOT NULL CHECK (total > 0),
  -- Accuracy is derivable but stored for cheap leaderboard sorting.
  accuracy NUMERIC(4,1) NOT NULL CHECK (accuracy >= 0 AND accuracy <= 100),

  correct_question_ids JSONB NOT NULL DEFAULT '[]'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CHECK (score <= total)
);

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user ON public.quiz_attempts (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_quiz ON public.quiz_attempts (quiz_id, accuracy DESC);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_sport ON public.quiz_attempts (sport, accuracy DESC);

ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "quiz_attempts select own" ON public.quiz_attempts;
CREATE POLICY "quiz_attempts select own"
  ON public.quiz_attempts FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "quiz_attempts select public" ON public.quiz_attempts;
CREATE POLICY "quiz_attempts select public"
  ON public.quiz_attempts FOR SELECT
  USING (true);

-- No INSERT/UPDATE/DELETE policies: only the service role (which bypasses RLS)
-- may write, keeping scores server-authoritative.

COMMIT;
