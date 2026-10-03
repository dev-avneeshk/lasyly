-- L-21: public.level_for_xp stepped one level per loop iteration (O(sqrt(xp)))
-- and is executable by anon, so `rpc('level_for_xp', { p_xp: 1e30 })` burned
-- DB CPU until the statement timeout. Same result in O(1): the largest n with
-- xp_to_reach_level(n) = 50*n*(n-1) <= xp, capped to the integer range.
--
-- Same signature, volatility, search_path and grants as 20260921_arena_economy.sql.
-- Idempotent (CREATE OR REPLACE), non-destructive. Files only.
CREATE OR REPLACE FUNCTION public.level_for_xp(p_xp numeric)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT LEAST(
    2147483647,
    GREATEST(1, floor((1 + sqrt(1 + GREATEST(0, COALESCE(p_xp, 0)) / 12.5)) / 2))
  )::integer
$$;
