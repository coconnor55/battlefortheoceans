-- Drop legacy/duplicate RLS policies so only the canonical set from rls_policies.sql remains.
-- Run this in Supabase SQL Editor, then re-run rls_policies.sql to ensure policies exist.
--
-- Canonical policy names (these are KEPT; all others on these tables are dropped):

-- game_results (5): Users can insert their own game results, Users can read their own game results,
--   Authenticated can read game results for leaderboard, Users can update their own game results,
--   Users can delete their own game results
-- user_rights (3): Users can read their own rights, Users can insert their own rights, Users can delete their own rights
-- user_profiles (3): Users can read all profiles, Users can insert own profile, Users can update own profile
-- user_achievements (4): Users can read own achievements, Users can insert own achievements,
--   Users can update own achievements, Users can delete own achievements
-- vouchers (2): Users can read own and sent-to-me vouchers, Users can update unredeemed voucher to mark redeemed
-- achievements (1): Authenticated can read achievements
-- error_logs (2): Users can insert error logs, Users can read own error logs

DO $$
DECLARE
  r RECORD;
  keep_policies TEXT[] := ARRAY[
    'Users can insert their own game results',
    'Users can read their own game results',
    'Authenticated can read game results for leaderboard',
    'Users can update their own game results',
    'Users can delete their own game results',
    'Users can read their own rights',
    'Users can insert their own rights',
    'Users can delete their own rights',
    'Users can read all profiles',
    'Users can insert own profile',
    'Users can update own profile',
    'Users can read own achievements',
    'Users can insert own achievements',
    'Users can update own achievements',
    'Users can delete own achievements',
    'Users can read own and sent-to-me vouchers',
    'Users can update unredeemed voucher to mark redeemed',
    'Authenticated can read achievements',
    'Users can insert error logs',
    'Users can read own error logs'
  ];
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'game_results', 'user_rights', 'user_profiles', 'user_achievements',
        'vouchers', 'achievements', 'error_logs'
      )
      AND policyname != ALL(keep_policies)
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
    RAISE NOTICE 'Dropped policy % on %.%', r.policyname, r.schemaname, r.tablename;
  END LOOP;
END $$;
