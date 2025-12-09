-- Fix generate_voucher function - remove updated_at column (doesn't exist in vouchers table)
-- The function already has p_created_for parameter, just need to remove updated_at from INSERT

CREATE OR REPLACE FUNCTION public.generate_voucher(
  p_type text, 
  p_value text, 
  p_purpose text DEFAULT 'manual'::text, 
  p_created_by uuid DEFAULT NULL::uuid, 
  p_email_sent_to text DEFAULT NULL::text, 
  p_reward_passes integer DEFAULT 1, 
  p_signup_bonus_passes integer DEFAULT 10, 
  p_created_for uuid DEFAULT NULL::uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  -- Removed updated_at - column doesn't exist in vouchers table
  INSERT INTO vouchers (
    voucher_code,
    purpose,
    created_by,
    email_sent_to,
    reward_passes,
    signup_bonus_passes,
    created_for,
    created_at
  ) VALUES (
    v_voucher_code,
    p_purpose,
    p_created_by,
    p_email_sent_to,
    p_reward_passes,
    p_signup_bonus_passes,
    p_created_for,
    NOW()
  );
  
  RETURN v_voucher_code;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to generate voucher: %', SQLERRM;
END;
$function$;

