-- Delete user and all related records (cascade delete)
-- Run this in Supabase SQL Editor
-- Replace '180e5efa-2c5f-4a19-b969-d67283def379' with the user ID you want to delete

-- Set the user ID
DO $$
DECLARE
  v_user_id UUID := '180e5efa-2c5f-4a19-b969-d67283def379'::UUID;
BEGIN
  RAISE NOTICE 'Starting cascade delete for user: %', v_user_id;
  
  -- 1. Delete user_achievements
  DELETE FROM user_achievements WHERE player_id = v_user_id;
  RAISE NOTICE 'Deleted user_achievements';
  
  -- 2. Delete game_results
  DELETE FROM game_results WHERE player_id = v_user_id;
  RAISE NOTICE 'Deleted game_results';
  
  -- 3. Delete user_rights (uses player_id, not user_id)
  DELETE FROM user_rights WHERE player_id = v_user_id;
  RAISE NOTICE 'Deleted user_rights';
  
  -- 4. Delete vouchers created by this user (required - foreign key constraint)
  DELETE FROM vouchers WHERE created_by = v_user_id;
  RAISE NOTICE 'Deleted vouchers created by user';
  
  -- 5. Delete vouchers redeemed by this user (if redeemed_by column exists)
  -- Note: Check if your vouchers table has a redeemed_by column
  -- DELETE FROM vouchers WHERE redeemed_by = v_user_id;
  -- RAISE NOTICE 'Deleted vouchers redeemed by user';
  
  -- 6. Delete user_profiles (must be after vouchers due to foreign key constraint)
  DELETE FROM user_profiles WHERE id = v_user_id;
  RAISE NOTICE 'Deleted user_profiles';
  
  -- 7. Delete from auth.users (this is the actual user account)
  -- Note: You may need to do this from the Supabase Dashboard or use admin API
  -- DELETE FROM auth.users WHERE id = v_user_id;
  -- RAISE NOTICE 'Deleted auth.users record';
  
  RAISE NOTICE 'Cascade delete completed for user: %', v_user_id;
END $$;

-- After running the above, delete the user from Supabase Dashboard:
-- Authentication → Users → Find user → Delete

-- OR use this to check what records exist before deleting:
-- SELECT 'user_profiles' as table_name, COUNT(*) as count FROM user_profiles WHERE id = '180e5efa-2c5f-4a19-b969-d67283def379'::UUID
-- UNION ALL
-- SELECT 'game_results', COUNT(*) FROM game_results WHERE player_id = '180e5efa-2c5f-4a19-b969-d67283def379'::UUID
-- UNION ALL
-- SELECT 'user_achievements', COUNT(*) FROM user_achievements WHERE player_id = '180e5efa-2c5f-4a19-b969-d67283def379'::UUID
-- UNION ALL
-- SELECT 'user_rights', COUNT(*) FROM user_rights WHERE player_id = '180e5efa-2c5f-4a19-b969-d67283def379'::UUID
-- UNION ALL
-- SELECT 'vouchers (created_by)', COUNT(*) FROM vouchers WHERE created_by = '180e5efa-2c5f-4a19-b969-d67283def379'::UUID
-- UNION ALL
-- SELECT 'vouchers (redeemed_by)', COUNT(*) FROM vouchers WHERE redeemed_by = '180e5efa-2c5f-4a19-b969-d67283def379'::UUID;

