-- LPI v2: add the two new overall-score components.
--
-- Context: LPI v1 combined only rate/percentage percentiles (BPM, TS%, USG%,
-- per-100, stl%, blk%, drb%, ast%) with no volume term, which let low-minute
-- reserves outrank full-workload stars. LPI v2 adds:
--
--   impact_score       — VORP/BPM/WS48 blend; VORP is minutes-scaled so it
--                        cannot be inflated by a small efficient sample.
--   role_volume_score  — total minutes + minutes per game; makes workload an
--                        explicit ranked axis.
--
-- Both are 0-100 like every other component score. Additive and backward
-- compatible: existing rows keep NULL for these columns until regenerated.

-- Wrapped in an explicit transaction: scripts/db/apply-migration.sh relies on
-- each file's own BEGIN/COMMIT for atomicity (it intentionally does NOT pass
-- --single-transaction), so on failure the whole file rolls back.
BEGIN;

ALTER TABLE nba_player_rankings
  ADD COLUMN IF NOT EXISTS impact_score NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS role_volume_score NUMERIC(5,2);

-- Widen `confidence` from NUMERIC(4,3) to NUMERIC(5,2).
--
-- The column was created for a 0-1 confidence scale (max 9.999), but the
-- engine emits confidence on a 0-100 public metadata scale
-- (lib/rankings/scores/availability.ts: sqrt(games_pct) * 100). Every player
-- above ~10% games-played therefore triggered "numeric field overflow" and the
-- entire ranking write failed. NUMERIC(5,2) holds 0.00-100.00.
ALTER TABLE nba_player_rankings
  ALTER COLUMN confidence TYPE NUMERIC(5,2);

COMMENT ON COLUMN nba_player_rankings.impact_score IS
  'LPI v2 Impact component (0-100): BPM 45% + VORP 35% + WS/48 20%. Volume-inclusive via VORP.';

COMMENT ON COLUMN nba_player_rankings.role_volume_score IS
  'LPI v2 Role & Volume component (0-100): total minutes 60% + minutes per game 40%. Not evidence-shrunk.';

COMMIT;
