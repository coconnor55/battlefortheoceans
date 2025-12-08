-- supabase-functions/update_achievements_reward_system.sql
-- Copyright(c) 2025, Clint H. O'Connor
-- Migration to refactor achievement rewards from reward_passes to reward_type + reward_count
-- 
-- Changes:
-- 1. Add reward_type column (TEXT) - can be 'passes' or era name (e.g., 'pirates')
-- 2. Add reward_count column (INTEGER) - number of rewards
-- 3. Update pirate achievements to reward_type='pirates' with appropriate reward_count
-- 4. Update all other achievements to reward_type='passes' with reward_count from reward_passes
-- 5. Drop reward_passes column after migration

BEGIN;

-- Step 1: Add new columns
ALTER TABLE achievements
  ADD COLUMN IF NOT EXISTS reward_type TEXT,
  ADD COLUMN IF NOT EXISTS reward_count INTEGER;

-- Step 2: Update pirate achievements to use 'pirates' as reward_type
-- These achievements should reward Pirates era vouchers instead of generic passes
UPDATE achievements
SET 
  reward_type = 'pirates',
  reward_count = reward_passes
WHERE id IN (
  'pirate-hunter',    -- If exists (1 fleet)
  'pirate-scourge',   -- 2 fleets
  'pirate-terror',    -- 3 fleets
  'pirate-nemesis'    -- 4 fleets
)
AND reward_passes > 0;

-- Step 3: Update all other achievements to use 'passes' as reward_type
UPDATE achievements
SET 
  reward_type = 'passes',
  reward_count = reward_passes
WHERE reward_type IS NULL
  AND reward_passes > 0;

-- Step 4: Set reward_count to 0 for achievements with no reward
UPDATE achievements
SET 
  reward_type = NULL,
  reward_count = 0
WHERE reward_passes IS NULL OR reward_passes = 0;

-- Step 5: Add check constraint to ensure reward_type is valid when reward_count > 0
ALTER TABLE achievements
  ADD CONSTRAINT achievements_reward_check 
  CHECK (
    (reward_count IS NULL OR reward_count = 0) OR 
    (reward_type IS NOT NULL AND reward_count > 0)
  );

-- Step 6: Add comment to document the new system
COMMENT ON COLUMN achievements.reward_type IS 'Type of reward: ''passes'' for generic passes, or era name (e.g., ''pirates'') for era-specific vouchers';
COMMENT ON COLUMN achievements.reward_count IS 'Number of rewards (passes or vouchers) granted when achievement is unlocked';

-- Step 7: Drop the old reward_passes column
ALTER TABLE achievements
  DROP COLUMN IF EXISTS reward_passes;

COMMIT;

-- Verification query (run separately to check results):
-- SELECT id, name, reward_type, reward_count, reward_passes 
-- FROM achievements 
-- WHERE reward_count > 0 
-- ORDER BY reward_type, reward_count;

