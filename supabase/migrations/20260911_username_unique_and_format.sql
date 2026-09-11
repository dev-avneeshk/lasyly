-- =====================================================================
-- Enforce unique + well-formed usernames (prereq for public /l/<username> pages)
-- =====================================================================
-- WHY
--
-- Public profile URLs (lasyly.me/l/<username>) resolve a profile by its
-- username. That only works if usernames are UNIQUE. Until now nothing in the
-- schema guaranteed it — the /api/profiles/[identifier] endpoint does
-- `.eq("username", ...).maybeSingle()`, which THROWS if two rows match. So a
-- duplicate username silently breaks profile lookups for both users.
--
-- Usernames must also be case-insensitively unique: "Xyz" and "xyz" are the
-- same handle from a user's perspective and would produce two URLs pointing at
-- different people.
--
-- WHAT THIS DOES
--
--   1. Guards against existing duplicates. If any case-insensitive duplicate
--      usernames already exist, this migration RAISES and aborts rather than
--      silently failing to build the unique index. Resolve the duplicates
--      (rename the newer accounts) and re-run.
--   2. Adds a CHECK constraint on the username format: 3-30 chars, letters /
--      digits / underscore / dot, must start with a letter or digit. NULLs are
--      allowed (some accounts may not have set a username yet).
--   3. Adds a case-insensitive UNIQUE index on lower(username), excluding NULLs
--      so multiple username-less rows remain legal.
--
-- SAFETY
--
--   * Read/lookup only changes; no data is mutated.
--   * The CHECK is added NOT VALID first, then VALIDATed, so it does not take a
--     long ACCESS EXCLUSIVE lock while scanning existing rows.
-- =====================================================================

-- 0. Abort early if case-insensitive duplicates exist. -----------------
DO $$
DECLARE
  v_dupes text;
BEGIN
  SELECT string_agg(u, ', ')
    INTO v_dupes
  FROM (
    SELECT lower(username) AS u
    FROM public.profiles
    WHERE username IS NOT NULL
    GROUP BY lower(username)
    HAVING count(*) > 1
  ) d;

  IF v_dupes IS NOT NULL THEN
    RAISE EXCEPTION
      'Cannot enforce unique usernames: duplicate handle(s) exist -> %. Rename the affected accounts and re-run this migration.',
      v_dupes;
  END IF;
END $$;

-- 1. Format constraint. ------------------------------------------------
-- Allowed: 3-30 chars, [A-Za-z0-9._], first char alphanumeric.
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_username_format_chk;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_username_format_chk
  CHECK (
    username IS NULL
    OR username ~ '^[A-Za-z0-9][A-Za-z0-9._]{2,29}$'
  )
  NOT VALID;

ALTER TABLE public.profiles
  VALIDATE CONSTRAINT profiles_username_format_chk;

-- 2. Case-insensitive unique index (excludes NULL usernames). ----------
DROP INDEX IF EXISTS public.profiles_username_lower_key;

CREATE UNIQUE INDEX profiles_username_lower_key
  ON public.profiles (lower(username))
  WHERE username IS NOT NULL;
