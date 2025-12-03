-- Create error_logs table for error tracking
-- This table stores critical errors and error summaries from game sessions

CREATE TABLE IF NOT EXISTS error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Game context
  game_id TEXT,
  player_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  era_id TEXT,
  opponent_name TEXT,
  
  -- Error details
  error_name TEXT NOT NULL,
  error_message TEXT,
  error_stack TEXT,
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'summary')),
  
  -- Summary details (for summary severity)
  total_errors INTEGER,
  error_types JSONB, -- Array of { error: string, count: number }
  errors JSONB, -- Array of full error objects with context
  
  -- Game context (for summaries)
  game_duration INTEGER, -- milliseconds
  game_turns INTEGER,
  winner TEXT,
  human_won BOOLEAN,
  
  -- Additional context
  error_context JSONB, -- Additional context data
  
  -- Metadata
  environment TEXT DEFAULT 'development',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_error_logs_severity ON error_logs(severity);
CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON error_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_game_id ON error_logs(game_id);
CREATE INDEX IF NOT EXISTS idx_error_logs_player_id ON error_logs(player_id);
CREATE INDEX IF NOT EXISTS idx_error_logs_era_id ON error_logs(era_id);

-- Row Level Security (RLS) - Only admins and developers can read
ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Only admins and developers can read error logs
CREATE POLICY "Only admins and developers can read error logs"
  ON error_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('admin', 'developer')
    )
  );

-- Policy: Service role can insert (for error logging)
-- Note: This allows the application to insert errors using service role
-- In production, you may want to use a service account or API key
CREATE POLICY "Service role can insert error logs"
  ON error_logs
  FOR INSERT
  WITH CHECK (true); -- Service role bypasses RLS, but this is explicit

-- Grant permissions
GRANT SELECT ON error_logs TO authenticated;
GRANT INSERT ON error_logs TO authenticated;
GRANT SELECT ON error_logs TO service_role;
GRANT INSERT ON error_logs TO service_role;

-- Comments
COMMENT ON TABLE error_logs IS 'Stores critical errors and error summaries from game sessions';
COMMENT ON COLUMN error_logs.severity IS 'critical: immediate error, summary: aggregated errors from a game';
COMMENT ON COLUMN error_logs.error_types IS 'JSONB array of error type counts for summaries';
COMMENT ON COLUMN error_logs.errors IS 'JSONB array of full error objects with context';
COMMENT ON COLUMN error_logs.error_context IS 'Additional context data (component stack, etc.)';

