-- Add purpose column to vouchers table
-- This tracks the purpose/reason for creating the voucher (e.g., 'achievement', 'admin_invite', 'referral_reward')

-- Add the column
ALTER TABLE vouchers
ADD COLUMN IF NOT EXISTS purpose TEXT;

-- Add comment
COMMENT ON COLUMN vouchers.purpose IS 'Purpose/reason for creating the voucher (e.g., achievement, admin_invite, referral_reward, email_immediate_reward)';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_vouchers_purpose ON vouchers(purpose) WHERE purpose IS NOT NULL;


