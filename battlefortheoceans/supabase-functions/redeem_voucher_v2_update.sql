-- Update to redeem_voucher_v2 function
-- - Adds check to prevent voucher creator from redeeming their own vouchers
-- - Checks redeemed_at on vouchers table to prevent double redemption
-- - Sets redeemed_at and redeemed_by when voucher is redeemed

CREATE OR REPLACE FUNCTION redeem_voucher_v2(
  p_user_id UUID,
  p_voucher_code TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_parsed JSONB;
  v_rights_type TEXT;
  v_rights_value TEXT;
  v_uses_remaining INTEGER;
  v_expires_at TIMESTAMP WITH TIME ZONE;
  v_duration_ms BIGINT;
  v_result JSONB;
  v_new_right_id UUID;
BEGIN
  -- Input validation
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'User ID is required';
  END IF;
  
  IF p_voucher_code IS NULL OR trim(p_voucher_code) = '' THEN
    RAISE EXCEPTION 'Voucher code is required';
  END IF;
  
  -- Normalize voucher code
  p_voucher_code := trim(p_voucher_code);
  
  -- 1. Check voucher exists in vouchers table
  IF NOT EXISTS (
    SELECT 1 FROM vouchers WHERE voucher_code = p_voucher_code
  ) THEN
    RAISE EXCEPTION 'Invalid voucher code';
  END IF;
  
  -- 1.5. Check voucher creator is not redeeming their own voucher
  IF EXISTS (
    SELECT 1 FROM vouchers 
    WHERE voucher_code = p_voucher_code 
    AND created_by = p_user_id
  ) THEN
    RAISE EXCEPTION 'You cannot redeem a voucher that you created';
  END IF;
  
  -- 2. Check voucher not already redeemed - check redeemed_at FIRST (most reliable)
  IF EXISTS (
    SELECT 1 FROM vouchers 
    WHERE voucher_code = p_voucher_code 
    AND redeemed_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Voucher already redeemed';
  END IF;
  
  -- 2.5. Also check user_rights table as backup (shouldn't happen if redeemed_at is set, but double-check)
  IF EXISTS (
    SELECT 1 FROM user_rights WHERE voucher_used = p_voucher_code
  ) THEN
    RAISE EXCEPTION 'Voucher already redeemed';
  END IF;
  
  -- 3. Parse voucher code
  BEGIN
    v_parsed := parse_voucher_code(p_voucher_code);
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to parse voucher code: %', SQLERRM;
  END;
  
  -- 4. Extract parsed values
  v_rights_type := v_parsed->>'rights_type';
  v_rights_value := v_parsed->>'rights_value';
  v_uses_remaining := (v_parsed->>'uses_remaining')::INTEGER;
  
  -- 5. Calculate expiration
  IF v_parsed->>'value_type' = 'time' THEN
    -- Time-based: expires after duration
    v_duration_ms := (v_parsed->>'duration_ms')::BIGINT;
    v_expires_at := NOW() + (v_duration_ms || ' milliseconds')::INTERVAL;
  ELSE
    -- Count-based: expires after 2 years
    v_expires_at := NOW() + INTERVAL '2 years';
  END IF;
  
  -- 6. Create user_rights entry (atomic)
  INSERT INTO user_rights (
    player_id,
    rights_type,
    rights_value,
    uses_remaining,
    expires_at,
    voucher_used,
    created_at,
    updated_at
  ) VALUES (
    p_user_id,
    v_rights_type,
    v_rights_value,
    v_uses_remaining,
    v_expires_at,
    p_voucher_code,
    NOW(),
    NOW()
  )
  RETURNING id INTO v_new_right_id;
  
  -- 7. Mark voucher as redeemed in vouchers table
  UPDATE vouchers
  SET redeemed_at = NOW(),
      redeemed_by = p_user_id
  WHERE voucher_code = p_voucher_code
  AND redeemed_at IS NULL;
  
  -- 8. Fetch and return the created entry
  SELECT to_jsonb(user_rights.*) INTO v_result
  FROM user_rights
  WHERE id = v_new_right_id;
  
  -- Log success
  RAISE NOTICE 'Voucher % redeemed successfully for user %', p_voucher_code, p_user_id;
  
  RETURN v_result;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Log error and re-raise
    RAISE EXCEPTION 'Voucher redemption failed: %', SQLERRM;
END;
$$;

