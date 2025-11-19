-- Check RLS policies on user_rights table
-- Run these commands in Supabase SQL Editor to verify RLS configuration

-- 1. Check if RLS is enabled on user_rights table
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'user_rights';

-- 2. List all RLS policies on user_rights table
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
WHERE tablename = 'user_rights'
ORDER BY policyname;

-- 3. Check if there are different policies for different rights_type values
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'user_rights'
  AND (qual::text LIKE '%rights_type%' OR with_check::text LIKE '%rights_type%');

-- 4. Check current user context (to see what user the policies evaluate as)
SELECT 
  current_user,
  session_user,
  current_setting('request.jwt.claims', true)::json->>'sub' as auth_user_id;

-- 5. Test if UPDATE is allowed (this will show what policies apply)
-- Replace the UUID with an actual user_rights.id from your database
EXPLAIN (ANALYZE, BUFFERS) 
UPDATE user_rights 
SET uses_remaining = uses_remaining - 1 
WHERE id = 'cbd9d4a3-9d79-4907-906c-48ed850d12bb'::uuid;

