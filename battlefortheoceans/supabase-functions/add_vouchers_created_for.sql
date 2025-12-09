-- Add created_for column to vouchers table
-- This tracks which user a voucher was created for (e.g., achievement rewards)
-- NULL means anyone can use it, created_for means it's for that specific player only

-- Add the column
ALTER TABLE vouchers
ADD COLUMN IF NOT EXISTS created_for UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add comment
COMMENT ON COLUMN vouchers.created_for IS 'User ID this voucher was created for. NULL = anyone can use, UUID = specific player only';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_vouchers_created_for ON vouchers(created_for) WHERE created_for IS NOT NULL;

