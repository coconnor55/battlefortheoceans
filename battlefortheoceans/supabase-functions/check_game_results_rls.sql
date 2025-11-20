-- Check RLS policies on game_results table
-- Run these commands in Supabase SQL Editor to verify RLS configuration

-- 1. Check if RLS is enabled on game_results table
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'game_results';

-- 2. List all RLS policies on game_results table
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd as command,  -- SELECT, INSERT, UPDATE, DELETE, or ALL
  qual as using_expression,
  with_check as with_check_expression
FROM pg_policies 
WHERE tablename = 'game_results'
ORDER BY policyname;

-- 3. Check current user context (to see what user the policies evaluate as)
SELECT 
  current_user,
  session_user,
  current_setting('request.jwt.claims', true)::json->>'sub' as auth_user_id;

-- 4. Test INSERT policy (should allow users to insert their own records)
-- Replace the UUID with an actual user ID
EXPLAIN (ANALYZE, BUFFERS) 
INSERT INTO game_results (
  player_id,
  era_name,
  opponent_type,
  opponent_name,
  won,
  shots,
  hits,
  misses,
  sunk,
  hits_damage,
  score,
  accuracy,
  turns,
  duration_seconds
) VALUES (
  '180e5efa-2c5f-4a19-b969-d67283def379'::uuid,
  'Test Era',
  'ai',
  'Test Opponent',
  true,
  10,
  5,
  5,
  1,
  10.0,
  50,
  50.0,
  10,
  60
);

-- 5. Test SELECT policy (should allow users to read their own records)
-- Replace the UUID with an actual user ID
EXPLAIN (ANALYZE, BUFFERS) 
SELECT * FROM game_results 
WHERE player_id = '180e5efa-2c5f-4a19-b969-d67283def379'::uuid
ORDER BY created_at DESC
LIMIT 10;

-- 6. Check if policies exist and what they allow
SELECT 
  policyname,
  cmd as command,
  qual as using_expression,
  with_check as with_check_expression,
  CASE 
    WHEN cmd = 'SELECT' THEN 'READ'
    WHEN cmd = 'INSERT' THEN 'WRITE'
    WHEN cmd = 'UPDATE' THEN 'UPDATE'
    WHEN cmd = 'DELETE' THEN 'DELETE'
    WHEN cmd = 'ALL' THEN 'ALL OPERATIONS'
  END as operation_type
FROM pg_policies 
WHERE tablename = 'game_results'
ORDER BY cmd, policyname;

-- 7. Test as authenticated user (simulate client-side query)
-- This will show if RLS is blocking the query
SET LOCAL role TO 'authenticated';
SET LOCAL request.jwt.claims TO '{"sub": "180e5efa-2c5f-4a19-b969-d67283def379"}';

SELECT COUNT(*) as readable_records
FROM game_results 
WHERE player_id = '180e5efa-2c5f-4a19-b969-d67283def379'::uuid;

RESET role;
RESET request.jwt.claims;

-- 8. Recommended RLS policies for game_results table:
-- 
-- First, ensure RLS is enabled:
-- ALTER TABLE game_results ENABLE ROW LEVEL SECURITY;
--
-- Policy 1: Allow users to INSERT their own game results
-- DROP POLICY IF EXISTS "Users can insert their own game results" ON game_results;
-- CREATE POLICY "Users can insert their own game results"
-- ON game_results
-- FOR INSERT
-- TO authenticated
-- WITH CHECK (auth.uid() = player_id);
--
-- Policy 2: Allow users to SELECT their own game results
-- DROP POLICY IF EXISTS "Users can read their own game results" ON game_results;
-- CREATE POLICY "Users can read their own game results"
-- ON game_results
-- FOR SELECT
-- TO authenticated
-- USING (auth.uid() = player_id);
--
-- Policy 3: Allow users to UPDATE their own game results (if needed)
-- DROP POLICY IF EXISTS "Users can update their own game results" ON game_results;
-- CREATE POLICY "Users can update their own game results"
-- ON game_results
-- FOR UPDATE
-- TO authenticated
-- USING (auth.uid() = player_id)
-- WITH CHECK (auth.uid() = player_id);
--
-- Policy 4: Allow users to DELETE their own game results (if needed)
-- DROP POLICY IF EXISTS "Users can delete their own game results" ON game_results;
-- CREATE POLICY "Users can delete their own game results"
-- ON game_results
-- FOR DELETE
-- TO authenticated
-- USING (auth.uid() = player_id);

