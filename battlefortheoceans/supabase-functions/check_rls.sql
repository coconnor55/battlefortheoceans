-- Check RLS status and policies for all app tables
-- Run in Supabase SQL Editor. Replace placeholder UUIDs when testing.

-- Tables with RLS (see rls_policies.sql): game_results, user_rights, user_profiles,
-- user_achievements, vouchers, achievements, error_logs

-- =============================================================================
-- 1. RLS enabled per table (all public tables)
-- =============================================================================

SELECT
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'game_results',
    'user_rights',
    'user_profiles',
    'user_achievements',
    'vouchers',
    'achievements',
    'error_logs'
  )
ORDER BY tablename;

-- =============================================================================
-- 2. All policies on these tables
-- =============================================================================

SELECT
  tablename,
  policyname,
  cmd AS command,
  permissive,
  roles,
  qual::text AS using_expr,
  with_check::text AS with_check_expr
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'game_results',
    'user_rights',
    'user_profiles',
    'user_achievements',
    'vouchers',
    'achievements',
    'error_logs'
  )
ORDER BY tablename, cmd, policyname;

-- =============================================================================
-- 3. Current auth context (for debugging)
-- In SQL Editor you run as postgres, so auth_uid is null. In the app, JWT sets it.
-- =============================================================================

SELECT
  current_user,
  current_setting('request.jwt.claims', true)::json->>'sub' AS auth_uid;

-- =============================================================================
-- 4. Optional: test INSERT/SELECT for game_results (replace the UUID)
-- =============================================================================

-- INSERT test (uncomment and set v_user_id):
-- DO $$
-- DECLARE v_user_id UUID := '00000000-0000-0000-0000-000000000000'::UUID;
-- BEGIN
--   INSERT INTO game_results (player_id, era_name, opponent_type, opponent_name, won, shots, hits, misses, sunk, hits_damage, score, accuracy, turns, duration_seconds)
--   VALUES (v_user_id, 'Test', 'ai', 'Test', true, 0, 0, 0, 0, 0, 0, 0, 0, 0);
--   RAISE NOTICE 'Insert OK';
-- END $$;

-- SELECT test (uncomment and set UUID):
-- SELECT COUNT(*) FROM game_results WHERE player_id = '00000000-0000-0000-0000-000000000000'::UUID;

-- =============================================================================
-- 5. Optional: test UPDATE on user_rights (replace the UUID)
-- =============================================================================

-- Client UPDATE is blocked by design; consumption uses consume_rights() RPC.
-- To verify RLS blocks direct UPDATE:
-- UPDATE user_rights SET uses_remaining = uses_remaining - 1 WHERE id = '...' AND player_id = auth.uid();
-- (Should fail or affect 0 rows depending on policy; consume_rights bypasses RLS.)

-- =============================================================================
-- 6. Summary: policy count per table
-- Expected after rls_cleanup_legacy + rls_policies: game_results 5, user_rights 3,
-- user_profiles 3, user_achievements 4, vouchers 2, achievements 1, error_logs 2.
-- =============================================================================

SELECT
  tablename,
  COUNT(*) AS policy_count
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'game_results',
    'user_rights',
    'user_profiles',
    'user_achievements',
    'vouchers',
    'achievements',
    'error_logs'
  )
GROUP BY tablename
ORDER BY tablename;
