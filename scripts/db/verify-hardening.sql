-- =====================================================================
-- Post-migration verification for the concurrency/security hardening
-- =====================================================================
-- Read-only. Safe to run anywhere, any number of times.
--
-- Paste the whole file into the Supabase SQL Editor (or `psql -f`). It returns
-- one row per invariant with a PASS / FAIL / WARN verdict, ordered so failures
-- surface first.
--
-- Covers:
--   20260914_lock_down_money_rpcs.sql
--   20260914_idempotency_constraints.sql
--   20260914_cheapen_hot_rls.sql
--   20260915_retention.sql
--   20260916_indexes_no_concurrent.sql  (or the two CONCURRENTLY equivalents)
--
-- A FAIL on check 1 is the one that matters most: it means any logged-in user can
-- still mint wallet balance by calling the RPC directly from a browser.
-- =====================================================================

WITH
-- ── 1. The money printers must be unreachable from a browser ────────────────
wallet_rpc_grants AS (
  SELECT
    p.proname,
    bool_or(has_function_privilege('authenticated', p.oid, 'EXECUTE')) AS authed_can_exec,
    bool_or(has_function_privilege('anon', p.oid, 'EXECUTE'))          AS anon_can_exec
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname IN ('credit_wallet', 'debit_wallet')
  GROUP BY p.proname
),
check_wallet AS (
  SELECT
    'money RPCs not browser-callable' AS check_name,
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM wallet_rpc_grants) THEN 'WARN'
      WHEN bool_or(authed_can_exec OR anon_can_exec) THEN 'FAIL'
      ELSE 'PASS'
    END AS status,
    COALESCE(
      string_agg(
        proname || ': authenticated=' || authed_can_exec || ' anon=' || anon_can_exec,
        ', ' ORDER BY proname
      ),
      'credit_wallet/debit_wallet not found (never created?)'
    ) AS detail
  FROM wallet_rpc_grants
),

-- ── 2. Actor-verifying RPCs ─────────────────────────────────────────────────
check_actor_guard AS (
  SELECT
    'purchase_pick + grant_signup_bonus verify auth.uid()' AS check_name,
    CASE WHEN count(*) FILTER (WHERE prosrc LIKE '%is_service_caller%') = 2
         THEN 'PASS' ELSE 'FAIL' END AS status,
    string_agg(
      proname || ': ' ||
      CASE WHEN prosrc LIKE '%is_service_caller%' THEN 'guarded' ELSE 'NOT GUARDED' END,
      ', ' ORDER BY proname
    ) AS detail
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname IN ('purchase_pick', 'grant_signup_bonus')
),
check_advisory_locks AS (
  SELECT
    'idempotency reads sit behind an advisory lock' AS check_name,
    CASE WHEN count(*) FILTER (WHERE prosrc LIKE '%pg_advisory_xact_lock%') >= 3
         THEN 'PASS' ELSE 'FAIL' END AS status,
    string_agg(
      proname || ': ' ||
      CASE WHEN prosrc LIKE '%pg_advisory_xact_lock%' THEN 'locked' ELSE 'NO LOCK' END,
      ', ' ORDER BY proname
    ) AS detail
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname IN ('purchase_pick', 'grant_signup_bonus', 'process_stripe_topup')
),

-- ── 3. Structural idempotency ───────────────────────────────────────────────
check_unique_indexes AS (
  SELECT
    'idempotency unique indexes present' AS check_name,
    CASE WHEN count(*) = 3 THEN 'PASS' ELSE 'FAIL' END AS status,
    'found ' || count(*) || ' of 3: ' ||
      COALESCE(string_agg(indexname, ', ' ORDER BY indexname), '(none)') AS detail
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND indexname IN ('uq_transactions_signup_bonus',
                      'uq_transactions_stripe_session',
                      'uq_unlocked_picks_user_betslip')
),

-- ── 4. Permissive-policy shadowing (the betslips/reactions bug) ─────────────
check_permissive AS (
  SELECT
    'no permissive policy on user-scoped tables' AS check_name,
    CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS status,
    CASE WHEN count(*) = 0 THEN 'none'
         ELSE string_agg(format('%s.%s (%s)', tablename, policyname, cmd), ', ')
    END AS detail
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('rooms','messages','room_members','betslips',
                      'reactions','transactions','unlocked_picks')
    AND (
      (cmd <> 'INSERT' AND (qual IS NULL OR btrim(lower(qual)) = 'true'))
      OR (cmd IN ('INSERT','UPDATE','ALL')
          AND with_check IS NOT NULL AND btrim(lower(with_check)) = 'true')
    )
),
check_rls_enabled AS (
  SELECT
    'RLS enabled on user-scoped tables' AS check_name,
    CASE WHEN count(*) FILTER (WHERE NOT c.relrowsecurity) = 0 THEN 'PASS' ELSE 'FAIL' END AS status,
    COALESCE(
      NULLIF(string_agg(c.relname || '=' || c.relrowsecurity, ', '
                        ORDER BY c.relname) FILTER (WHERE NOT c.relrowsecurity), ''),
      'all enabled'
    ) AS detail
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname IN ('rooms','messages','room_members','betslips',
                      'reactions','transactions','unlocked_picks','profiles')
),

-- ── 5. Cheaper RLS helpers ──────────────────────────────────────────────────
check_helper_lang AS (
  SELECT
    'RLS helpers are LANGUAGE sql (not plpgsql)' AS check_name,
    CASE WHEN count(*) FILTER (WHERE l.lanname <> 'sql') = 0 THEN 'PASS' ELSE 'FAIL' END AS status,
    string_agg(p.proname || '=' || l.lanname, ', ' ORDER BY p.proname) AS detail
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  JOIN pg_language l ON l.oid = p.prolang
  WHERE n.nspname = 'public'
    AND p.proname IN ('can_view_subchannel','can_post_subchannel','is_room_member',
                      'is_room_admin','room_is_public','is_room_muted')
),
check_replica_identity AS (
  SELECT
    'messages REPLICA IDENTITY is DEFAULT (not FULL)' AS check_name,
    CASE WHEN c.relreplident = 'd' THEN 'PASS' ELSE 'FAIL' END AS status,
    'relreplident=' || c.relreplident::text || ' (d=default, f=full)' AS detail
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'messages'
),

-- ── 6. Retention ────────────────────────────────────────────────────────────
check_retention_fn AS (
  SELECT
    'cleanup_expired_data() exists' AS check_name,
    CASE WHEN count(*) = 1 THEN 'PASS' ELSE 'FAIL' END AS status,
    'found ' || count(*) AS detail
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'cleanup_expired_data'
),
check_chat_cleanup_overload AS (
  SELECT
    'cleanup_old_chat_data: unbatched 0-arg version dropped' AS check_name,
    CASE
      WHEN count(*) FILTER (WHERE p.pronargs = 0) > 0 THEN 'FAIL'
      WHEN count(*) FILTER (WHERE p.pronargs = 1) = 1 THEN 'PASS'
      ELSE 'WARN'
    END AS status,
    'overloads: ' || COALESCE(string_agg(p.pronargs::text, ', ' ORDER BY p.pronargs), '(none)') AS detail
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'cleanup_old_chat_data'
),

-- ── 7. Indexes ──────────────────────────────────────────────────────────────
expected_indexes(name) AS (
  VALUES
    ('idx_transactions_user_created'), ('uq_follows_follower_following'),
    ('idx_follows_following'), ('idx_room_members_user'),
    ('idx_room_members_room_role'), ('idx_rooms_creator'),
    ('idx_rooms_public_members'), ('idx_messages_created_at'),
    ('idx_messages_user'), ('idx_message_reactions_user'),
    ('idx_betslips_user'), ('idx_betslips_room'), ('idx_betslips_for_sale'),
    ('idx_unlocked_picks_betslip'), ('idx_notifications_unread'),
    ('idx_notifications_read_created'), ('idx_notifications_created'),
    ('idx_post_comments_user'), ('idx_espn_games_match_date'),
    ('idx_espn_player_stats_match_date'), ('idx_prop_votes_vote_date'),
    ('idx_correlations_computed_at'), ('idx_subchannel_requests_decided'),
    ('idx_room_audit_log_created'), ('idx_room_mutes_expiry')
),
check_indexes AS (
  SELECT
    'hot-path + retention indexes present' AS check_name,
    CASE WHEN count(*) FILTER (WHERE i.indexname IS NULL) = 0 THEN 'PASS' ELSE 'WARN' END AS status,
    (count(*) FILTER (WHERE i.indexname IS NOT NULL))::text || ' of 25 present' ||
    CASE WHEN count(*) FILTER (WHERE i.indexname IS NULL) > 0
         THEN '; MISSING: ' || string_agg(e.name, ', ') FILTER (WHERE i.indexname IS NULL)
         ELSE '' END AS detail
  FROM expected_indexes e
  LEFT JOIN pg_indexes i
    ON i.schemaname = 'public' AND i.indexname = e.name
),
check_invalid_indexes AS (
  SELECT
    'no invalid/half-built indexes' AS check_name,
    CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS status,
    CASE WHEN count(*) = 0 THEN 'none'
         ELSE string_agg(indexrelid::regclass::text, ', ') END AS detail
  FROM pg_index WHERE NOT indisvalid
),

-- ── 8. Data-level invariants ────────────────────────────────────────────────
check_dupe_bonuses AS (
  SELECT
    'no duplicate signup bonuses' AS check_name,
    CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS status,
    count(*) || ' user(s) with more than one SIGNUP_BONUS row' AS detail
  FROM (
    SELECT user_id FROM public.transactions
    WHERE type = 'SIGNUP_BONUS' GROUP BY user_id HAVING count(*) > 1
  ) d
),
check_dupe_sessions AS (
  SELECT
    'no double-credited Stripe sessions' AS check_name,
    CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS status,
    count(*) || ' session(s) credited more than once' AS detail
  FROM (
    SELECT stripe_session_id FROM public.transactions
    WHERE stripe_session_id IS NOT NULL
    GROUP BY stripe_session_id HAVING count(*) > 1
  ) d
),
check_negative_balances AS (
  SELECT
    'no negative wallet balances' AS check_name,
    CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS status,
    count(*) || ' profile(s) below zero' AS detail
  FROM public.profiles WHERE wallet_balance < 0
)

SELECT * FROM (
  SELECT * FROM check_wallet
  UNION ALL SELECT * FROM check_actor_guard
  UNION ALL SELECT * FROM check_advisory_locks
  UNION ALL SELECT * FROM check_unique_indexes
  UNION ALL SELECT * FROM check_permissive
  UNION ALL SELECT * FROM check_rls_enabled
  UNION ALL SELECT * FROM check_helper_lang
  UNION ALL SELECT * FROM check_replica_identity
  UNION ALL SELECT * FROM check_retention_fn
  UNION ALL SELECT * FROM check_chat_cleanup_overload
  UNION ALL SELECT * FROM check_indexes
  UNION ALL SELECT * FROM check_invalid_indexes
  UNION ALL SELECT * FROM check_dupe_bonuses
  UNION ALL SELECT * FROM check_dupe_sessions
  UNION ALL SELECT * FROM check_negative_balances
) r
ORDER BY CASE status WHEN 'FAIL' THEN 0 WHEN 'WARN' THEN 1 ELSE 2 END, check_name;

-- =====================================================================
-- FOLLOW-UP (run separately): permissive policies on every OTHER table.
--
-- The check above only covers seven tables. The betslips/reactions bug came from
-- dashboard-created tables, so review anything with BOTH a permissive and a
-- scoped SELECT policy — that shape means a restrictive rule is being cancelled
-- out. `USING (true)` alone is correct for public scraper data (espn_*, nba_*,
-- matches, blog_posts) and wrong for anything user-scoped.
--
--   SELECT p.tablename,
--          count(*) FILTER (WHERE p.qual IS NULL OR btrim(lower(p.qual)) = 'true')
--            AS permissive_select,
--          count(*) FILTER (WHERE p.qual IS NOT NULL AND btrim(lower(p.qual)) <> 'true')
--            AS scoped_select,
--          string_agg(p.policyname, ' | ') AS policies
--   FROM pg_policies p
--   WHERE p.schemaname = 'public' AND p.cmd = 'SELECT'
--   GROUP BY p.tablename
--   HAVING count(*) FILTER (WHERE p.qual IS NULL OR btrim(lower(p.qual)) = 'true') > 0
--   ORDER BY scoped_select DESC, p.tablename;
-- =====================================================================
