-- Update generate_voucher RPC function to accept created_for parameter
-- This allows tracking which user a voucher was created for (e.g., achievement rewards)
-- NULL means anyone can use it, created_for means it's for that specific player only

-- First, drop the existing function(s) - there may be multiple overloaded versions
DROP FUNCTION IF EXISTS generate_voucher(TEXT, TEXT, TEXT, UUID, TEXT, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS generate_voucher(TEXT, TEXT);
DROP FUNCTION IF EXISTS generate_voucher(TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS generate_voucher(TEXT, TEXT, TEXT, UUID);
DROP FUNCTION IF EXISTS generate_voucher(TEXT, TEXT, TEXT, UUID, TEXT);
DROP FUNCTION IF EXISTS generate_voucher(TEXT, TEXT, TEXT, UUID, TEXT, INTEGER);
DROP FUNCTION IF EXISTS generate_voucher(TEXT, TEXT, TEXT, UUID, TEXT, INTEGER, INTEGER, UUID);

-- Now create the new function with the created_for parameter
CREATE OR REPLACE FUNCTION generate_voucher(
  p_type TEXT,
  p_value TEXT,
  p_purpose TEXT DEFAULT 'manual',
  p_created_by UUID DEFAULT NULL,
  p_email_sent_to TEXT DEFAULT NULL,
  p_reward_passes INTEGER DEFAULT 1,
  p_signup_bonus_passes INTEGER DEFAULT 10,
  p_created_for UUID DEFAULT NULL  -- NEW PARAMETER
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_voucher_code TEXT;
  v_uuid UUID;
BEGIN
  -- Validate inputs
  IF p_type IS NULL OR p_type = '' THEN
    RAISE EXCEPTION 'Voucher type is required';
  END IF;
  
  IF p_value IS NULL OR p_value = '' THEN
    RAISE EXCEPTION 'Voucher value is required';
  END IF;
  
  -- Generate UUID for voucher code
  v_uuid := gen_random_uuid();
  
  -- Create voucher code: {type}-{value}-{uuid}
  v_voucher_code := p_type || '-' || p_value || '-' || v_uuid::TEXT;
  
  -- Insert into vouchers table
  -- Only including columns that actually exist in the vouchers table
  -- Note: created_at is likely auto-generated, but including it to be safe
  INSERT INTO vouchers (
    voucher_code,
    purpose,
    created_by,
    email_sent_to,
    reward_passes,
    signup_bonus_passes,
    created_for,  -- NEW COLUMN
    created_at
  ) VALUES (
    v_voucher_code,
    p_purpose,
    p_created_by,
    p_email_sent_to,
    p_reward_passes,
    p_signup_bonus_passes,
    p_created_for,  -- NEW COLUMN
    NOW()
  );
  
  RETURN v_voucher_code;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to generate voucher: %', SQLERRM;
END;
$$;

COMMENT ON FUNCTION generate_voucher IS 'Generates a voucher code and stores it in the vouchers table. Supports created_for parameter for tracking achievement rewards.';
