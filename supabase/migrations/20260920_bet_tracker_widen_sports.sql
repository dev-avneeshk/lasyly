--
-- Widen bet_tracker.sport to every sport the props page serves.
--
-- The column was created with CHECK (sport IN ('NBA', 'Tennis')) back when those
-- were the only two sports in the app. Props now cover NFL, NHL and Soccer as
-- well, so the "Log" button on those cards had no chance of working: the client
-- refused to call the API, and had it called, the insert would have been
-- rejected by this constraint.
--
-- bet_tracker is a manual tracker — picks are resolved by the user through
-- PATCH /api/bets/[betId], not by a settlement cron — so there is no
-- sport-specific resolution logic that needs to exist before a sport can be
-- logged.
--
-- The allowlist is kept in sync with lib/props/statCatalog.ts (LOGGABLE_SPORTS).
--
-- This is additive: it only widens what is accepted, so every existing row
-- remains valid and no data is rewritten.

BEGIN;

ALTER TABLE public.bet_tracker
  DROP CONSTRAINT IF EXISTS bet_tracker_sport_check;

ALTER TABLE public.bet_tracker
  ADD CONSTRAINT bet_tracker_sport_check
  CHECK (sport IN ('NBA', 'Tennis', 'NFL', 'NHL', 'Soccer'));

COMMIT;
