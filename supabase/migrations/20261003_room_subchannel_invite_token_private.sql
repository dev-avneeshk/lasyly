-- AUTHZ-7: private sub-channel invite tokens were readable through PostgREST.
--
-- `subchannels_select_visible` exposes every column of room_subchannels to
-- anyone who can see the room's sub-channels (anon, for public rooms), so the
-- `invite_token` of a private sub-channel was one SELECT away, although the API
-- hands it to room admins only. The token now has no SELECT grant for API
-- roles: the invite route reads it with the service role after its admin check,
-- and the room RPCs (SECURITY DEFINER) are unaffected.
--
-- Columns added to room_subchannels later need their own `GRANT SELECT (col)`
-- (enforced by __tests__/security/migrations-intact.test.ts).
--
-- Idempotent and non-destructive. Files only; apply through the normal
-- migration process.
DO $$
DECLARE
  v_cols text;
BEGIN
  IF to_regclass('public.room_subchannels') IS NULL THEN
    RETURN;
  END IF;
  REVOKE SELECT ON public.room_subchannels FROM anon, authenticated;
  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
    INTO v_cols
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'room_subchannels'
     AND column_name <> 'invite_token';
  EXECUTE format('GRANT SELECT (%s) ON public.room_subchannels TO anon, authenticated', v_cols);
END $$;
