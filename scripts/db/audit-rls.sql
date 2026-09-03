-- =====================================================================
-- RLS audit: run this in the Supabase SQL Editor
-- =====================================================================
-- PostgREST cannot reach pg_catalog, so the automated checks in
-- scripts/db/check-schema.mjs can only observe RLS *behaviour*, not the
-- policies themselves. Run this when you need the actual policy list, e.g.
-- after check-rls.mjs reports a leak.
-- =====================================================================

-- 1. Tables with RLS disabled entirely. Anything here in `public` with real
--    data is fully readable and writable with the public anon key.
SELECT
  c.relname               AS table_name,
  c.relrowsecurity        AS rls_enabled,
  c.relforcerowsecurity   AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND NOT c.relrowsecurity
ORDER BY c.relname;

-- 2. Unconditionally permissive policies. `qual IS NULL` means USING (true),
--    which ORs with every other policy on the table and defeats all of them.
--    This is what leaked private rooms, messages and memberships.
SELECT
  tablename,
  policyname,
  cmd,
  roles,
  qual        AS using_expression,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND cmd <> 'INSERT'
  AND (qual IS NULL OR btrim(lower(qual)) = 'true')
ORDER BY tablename, policyname;

-- 3. Tables that have RLS on but NO policies. These deny all access to
--    non-owner roles, which usually shows up as mysteriously empty results.
SELECT c.relname AS table_name
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relrowsecurity
  AND NOT EXISTS (
    SELECT 1 FROM pg_policies p
    WHERE p.schemaname = 'public' AND p.tablename = c.relname
  )
ORDER BY c.relname;

-- 4. Full policy dump for the room tables, to eyeball against
--    supabase/migrations/20260905_fix_permissive_rls_policies.sql
SELECT tablename, policyname, cmd, qual AS using_expression, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('rooms', 'messages', 'room_members', 'room_subchannels')
ORDER BY tablename, cmd, policyname;

-- 5. Anon/authenticated grants that bypass RLS considerations at the
--    privilege level (RLS only applies if the role can reach the table).
SELECT table_name, privilege_type, grantee
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND grantee IN ('anon', 'authenticated')
  AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')
ORDER BY table_name, grantee, privilege_type;
