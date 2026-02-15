-- RLS policies for Battle for the Oceans
-- Run in Supabase SQL Editor to enable Row Level Security and create policies.
-- Safe to re-run: uses DROP POLICY IF EXISTS before CREATE POLICY.

-- =============================================================================
-- game_results
-- Client: GameStatsService inserts and reads; StatsPage reads. No client UPDATE/DELETE.
-- =============================================================================

ALTER TABLE game_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert their own game results" ON game_results;
CREATE POLICY "Users can insert their own game results"
  ON game_results
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = player_id);

DROP POLICY IF EXISTS "Users can read their own game results" ON game_results;
CREATE POLICY "Users can read their own game results"
  ON game_results
  FOR SELECT
  TO authenticated
  USING (auth.uid() = player_id);

-- Leaderboard / recent champions need to read other users' game_results (join with user_profiles)
DROP POLICY IF EXISTS "Authenticated can read game results for leaderboard" ON game_results;
CREATE POLICY "Authenticated can read game results for leaderboard"
  ON game_results
  FOR SELECT
  TO authenticated
  USING (true);

-- Optional: allow update/delete for own rows (e.g. stats correction or account cleanup)
DROP POLICY IF EXISTS "Users can update their own game results" ON game_results;
CREATE POLICY "Users can update their own game results"
  ON game_results
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = player_id)
  WITH CHECK (auth.uid() = player_id);

DROP POLICY IF EXISTS "Users can delete their own game results" ON game_results;
CREATE POLICY "Users can delete their own game results"
  ON game_results
  FOR DELETE
  TO authenticated
  USING (auth.uid() = player_id);

-- =============================================================================
-- user_rights
-- Client: SELECT (balance, checkRights, badges); INSERT (creditPasses, grantEraAccess);
--        DELETE (profile reset). Updates only via consume_rights() RPC (SECURITY DEFINER).
-- =============================================================================

ALTER TABLE user_rights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their own rights" ON user_rights;
CREATE POLICY "Users can read their own rights"
  ON user_rights
  FOR SELECT
  TO authenticated
  USING (auth.uid() = player_id);

DROP POLICY IF EXISTS "Users can insert their own rights" ON user_rights;
CREATE POLICY "Users can insert their own rights"
  ON user_rights
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = player_id);

DROP POLICY IF EXISTS "Users can delete their own rights" ON user_rights;
CREATE POLICY "Users can delete their own rights"
  ON user_rights
  FOR DELETE
  TO authenticated
  USING (auth.uid() = player_id);

-- No UPDATE policy: decrements are done server-side via consume_rights() only.

-- =============================================================================
-- user_profiles
-- Client: SELECT (own + leaderboard), INSERT (create profile), UPDATE (own only).
-- Leaderboard needs SELECT on other users' public stats.
-- =============================================================================

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read all profiles" ON user_profiles;
CREATE POLICY "Users can read all profiles"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
CREATE POLICY "Users can insert own profile"
  ON user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
CREATE POLICY "Users can update own profile"
  ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- No DELETE from client (account deletion is via delete_user_cascade or dashboard).

-- =============================================================================
-- user_achievements
-- Client: SELECT, UPSERT, DELETE (profile reset). Row key: player_id.
-- =============================================================================

ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own achievements" ON user_achievements;
CREATE POLICY "Users can read own achievements"
  ON user_achievements
  FOR SELECT
  TO authenticated
  USING (auth.uid() = player_id);

DROP POLICY IF EXISTS "Users can insert own achievements" ON user_achievements;
CREATE POLICY "Users can insert own achievements"
  ON user_achievements
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = player_id);

DROP POLICY IF EXISTS "Users can update own achievements" ON user_achievements;
CREATE POLICY "Users can update own achievements"
  ON user_achievements
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = player_id)
  WITH CHECK (auth.uid() = player_id);

DROP POLICY IF EXISTS "Users can delete own achievements" ON user_achievements;
CREATE POLICY "Users can delete own achievements"
  ON user_achievements
  FOR DELETE
  TO authenticated
  USING (auth.uid() = player_id);

-- =============================================================================
-- vouchers
-- Client: SELECT (created by me, redeemed by me, or sent to my email); UPDATE (set redeemed_at/redeemed_by).
-- Voucher creation is via generate_voucher RPC. Redemption is via redeem_voucher_v2 RPC; client may pre-check or fallback-update.
-- JWT must include 'email' for "sent to me" SELECT (Supabase Auth includes it by default).
-- =============================================================================

ALTER TABLE vouchers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own and sent-to-me vouchers" ON vouchers;
CREATE POLICY "Users can read own and sent-to-me vouchers"
  ON vouchers
  FOR SELECT
  TO authenticated
  USING (
    created_by = auth.uid()
    OR redeemed_by = auth.uid()
    OR (email_sent_to IS NOT NULL AND email_sent_to = current_setting('request.jwt.claims', true)::json->>'email')
  );

DROP POLICY IF EXISTS "Users can update unredeemed voucher to mark redeemed" ON vouchers;
CREATE POLICY "Users can update unredeemed voucher to mark redeemed"
  ON vouchers
  FOR UPDATE
  TO authenticated
  USING (redeemed_at IS NULL)
  WITH CHECK (redeemed_by = auth.uid());

-- No INSERT from client (generate_voucher RPC). No DELETE from client.

-- =============================================================================
-- achievements
-- Reference table: client only SELECT. No per-user data.
-- =============================================================================

ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read achievements" ON achievements;
CREATE POLICY "Authenticated can read achievements"
  ON achievements
  FOR SELECT
  TO authenticated
  USING (true);

-- No INSERT/UPDATE/DELETE from client.

-- =============================================================================
-- error_logs
-- Client: INSERT (log errors), SELECT (read own by player_id). Used by ErrorLogService.
-- =============================================================================

ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert error logs" ON error_logs;
CREATE POLICY "Users can insert error logs"
  ON error_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (player_id IS NULL OR player_id = auth.uid());

DROP POLICY IF EXISTS "Users can read own error logs" ON error_logs;
CREATE POLICY "Users can read own error logs"
  ON error_logs
  FOR SELECT
  TO authenticated
  USING (player_id = auth.uid());

-- No UPDATE/DELETE from client.
