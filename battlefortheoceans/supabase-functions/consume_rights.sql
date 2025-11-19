-- Function to consume a single play from a user_rights entry
-- This bypasses RLS policies by running server-side with SECURITY DEFINER
-- Used for consuming voucher plays and pass plays after a game
-- Prevents cheating by ensuring server-side validation

CREATE OR REPLACE FUNCTION consume_rights(
  p_rights_id UUID,
  p_uses_to_consume INTEGER DEFAULT 1
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_uses INTEGER;
  v_new_uses INTEGER;
  v_player_id UUID;
  v_rights_type TEXT;
  v_result JSONB;
BEGIN
  -- Input validation
  IF p_rights_id IS NULL THEN
    RAISE EXCEPTION 'Rights ID is required';
  END IF;
  
  IF p_uses_to_consume IS NULL OR p_uses_to_consume <= 0 THEN
    RAISE EXCEPTION 'Uses to consume must be greater than 0';
  END IF;
  
  -- Get current uses_remaining and validate ownership
  SELECT uses_remaining, player_id, rights_type 
  INTO v_current_uses, v_player_id, v_rights_type
  FROM user_rights
  WHERE id = p_rights_id;
  
  -- Check if entry exists
  IF v_current_uses IS NULL THEN
    RAISE EXCEPTION 'Rights entry not found';
  END IF;
  
  -- Security: Verify the rights belong to the authenticated user
  -- Get the authenticated user ID from JWT
  IF v_player_id::text != current_setting('request.jwt.claims', true)::json->>'sub' THEN
    RAISE EXCEPTION 'You can only consume your own rights';
  END IF;
  
  -- Check if unlimited (-1)
  IF v_current_uses = -1 THEN
    -- Unlimited - return without updating
    SELECT to_jsonb(user_rights.*) INTO v_result
    FROM user_rights
    WHERE id = p_rights_id;
    
    RETURN v_result;
  END IF;
  
  -- Check if already exhausted
  IF v_current_uses <= 0 THEN
    RAISE EXCEPTION 'Rights entry already exhausted';
  END IF;
  
  -- Calculate new uses
  v_new_uses := v_current_uses - p_uses_to_consume;
  
  -- Ensure it doesn't go negative
  IF v_new_uses < 0 THEN
    v_new_uses := 0;
  END IF;
  
  -- Update the entry (bypasses RLS because we're SECURITY DEFINER)
  UPDATE user_rights
  SET 
    uses_remaining = v_new_uses,
    updated_at = NOW()
  WHERE id = p_rights_id;
  
  -- Fetch and return the updated entry
  SELECT to_jsonb(user_rights.*) INTO v_result
  FROM user_rights
  WHERE id = p_rights_id;
  
  -- Log success
  RAISE NOTICE 'Consumed % uses from % rights entry % for player %, new uses_remaining: %', 
    p_uses_to_consume, v_rights_type, p_rights_id, v_player_id, v_new_uses;
  
  RETURN v_result;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Log error and re-raise
    RAISE EXCEPTION 'Failed to consume rights: %', SQLERRM;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION consume_rights(UUID, INTEGER) TO authenticated;

-- Add comment
COMMENT ON FUNCTION consume_rights(UUID, INTEGER) IS 
  'Consumes uses from a user_rights entry. Bypasses RLS for security. Validates ownership server-side.';

