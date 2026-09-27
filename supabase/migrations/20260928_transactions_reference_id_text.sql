-- =====================================================================
-- Migration: transactions.reference_id uuid → text
-- =====================================================================
-- The arena economy (20260921_arena_economy.sql) stores its idempotency key in
-- transactions.reference_id and was written for a TEXT column ("reference_id
-- (text) holds the arena game id or the ISO week key"). On the live database
-- the column is UUID, so every one of those functions fails the first time it
-- touches it:
--
--     ERROR: operator does not exist: uuid = text      (WHERE reference_id = p_game_id)
--
-- Confirmed live against start_arena_stake and refund_arena_stake. The effect:
--   - every 1v1 create / matchmake / join returned 500 ("Couldn't process the
--     stake") — start_arena_stake runs before the game exists;
--   - CPU rewards, 1v1 payouts, refunds and the weekly level bonus would all
--     fail the same way.
--
-- Casting inside the functions instead (p_game_id::uuid) isn't an option: the
-- weekly bonus key is an ISO week like '2026-W38', which is not a UUID.
--
-- Existing writers are unaffected. purchase_pick and credit/debit_wallet pass
-- UUIDs, and a uuid value assigns to a text column implicitly.
--
-- The ledger was empty when this was written, so the rewrite is instant. It is
-- guarded so re-running it is a no-op.
-- =====================================================================

BEGIN;

DO $$
DECLARE
  v_type text;
  v_fk   record;
BEGIN
  SELECT data_type INTO v_type
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'transactions' AND column_name = 'reference_id';

  IF v_type IS NULL THEN
    RAISE EXCEPTION 'public.transactions.reference_id not found';
  END IF;

  IF v_type = 'text' THEN
    RAISE NOTICE 'reference_id is already text; nothing to do';
    RETURN;
  END IF;

  -- A foreign key from reference_id (e.g. to betslips.id) would block the type
  -- change, and would reject every arena row anyway: a game id or week key is
  -- not a betslip. Drop any, and say so.
  FOR v_fk IN
    SELECT c.conname
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
     WHERE c.conrelid = 'public.transactions'::regclass
       AND c.contype = 'f'
       AND a.attname = 'reference_id'
  LOOP
    EXECUTE format('ALTER TABLE public.transactions DROP CONSTRAINT %I', v_fk.conname);
    RAISE NOTICE 'dropped foreign key % on transactions.reference_id', v_fk.conname;
  END LOOP;

  ALTER TABLE public.transactions
    ALTER COLUMN reference_id TYPE text USING reference_id::text;

  RAISE NOTICE 'transactions.reference_id: % → text', v_type;
END
$$;

COMMIT;

-- =====================================================================
-- Verify afterwards (read-only):
--   SELECT data_type FROM information_schema.columns
--    WHERE table_schema = 'public' AND table_name = 'transactions'
--      AND column_name = 'reference_id';                           -- text
-- =====================================================================
