-- Mobile voucher status tracking tables

-- Add version column to vouchers table for optimistic locking
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 0;

-- Create mobile voucher access logs table
CREATE TABLE IF NOT EXISTS mobile_voucher_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token VARCHAR(255) NOT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  session_id UUID,
  status_checked VARCHAR(50),
  accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for monitoring and analysis
CREATE INDEX IF NOT EXISTS idx_access_logs_token ON mobile_voucher_access_logs (token);
CREATE INDEX IF NOT EXISTS idx_access_logs_session ON mobile_voucher_access_logs (session_id);
CREATE INDEX IF NOT EXISTS idx_access_logs_ip ON mobile_voucher_access_logs (ip_address);
CREATE INDEX IF NOT EXISTS idx_access_logs_accessed_at ON mobile_voucher_access_logs (accessed_at);

-- Create suspicious activity monitoring view
CREATE OR REPLACE VIEW suspicious_voucher_access AS
SELECT 
  token,
  ip_address,
  COUNT(*) as access_count,
  COUNT(DISTINCT user_agent) as unique_user_agents,
  MAX(accessed_at) as last_access,
  MIN(accessed_at) as first_access
FROM mobile_voucher_access_logs
WHERE accessed_at > NOW() - INTERVAL '1 hour'
GROUP BY token, ip_address
HAVING 
  COUNT(*) > 100 OR -- Too many requests
  COUNT(DISTINCT user_agent) > 3; -- Multiple user agents

-- Create function for atomic voucher status update
CREATE OR REPLACE FUNCTION update_voucher_status_atomic(
  p_token VARCHAR,
  p_new_status VARCHAR,
  p_expected_version INTEGER
) RETURNS TABLE(
  success BOOLEAN,
  new_version INTEGER,
  status VARCHAR
) AS $$
DECLARE
  v_updated_count INTEGER;
  v_new_version INTEGER;
  v_status VARCHAR;
BEGIN
  -- Atomic update with version check
  UPDATE vouchers
  SET 
    status = p_new_status,
    version = version + 1,
    used_at = CASE 
      WHEN p_new_status = 'used' THEN NOW() 
      ELSE used_at 
    END
  WHERE 
    mobile_link_token = p_token 
    AND version = p_expected_version
    AND status != p_new_status
  RETURNING version, status INTO v_new_version, v_status;
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  
  RETURN QUERY SELECT 
    v_updated_count > 0 as success,
    v_new_version,
    v_status;
END;
$$ LANGUAGE plpgsql;

-- Create alert function for suspicious activity
CREATE OR REPLACE FUNCTION alert_suspicious_activity() RETURNS TRIGGER AS $$
BEGIN
  -- Check if this is suspicious activity
  IF (
    SELECT COUNT(*) 
    FROM mobile_voucher_access_logs 
    WHERE token = NEW.token 
      AND accessed_at > NOW() - INTERVAL '1 minute'
  ) > 30 THEN
    -- Log to audit table
    INSERT INTO audit_logs (
      action,
      table_name,
      record_id,
      details,
      created_at
    ) VALUES (
      'SUSPICIOUS_ACCESS',
      'mobile_voucher_access_logs',
      NEW.id::text,
      jsonb_build_object(
        'token', NEW.token,
        'ip', NEW.ip_address,
        'user_agent', NEW.user_agent,
        'message', 'High frequency access detected'
      ),
      NOW()
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for suspicious activity monitoring
DROP TRIGGER IF EXISTS monitor_suspicious_access ON mobile_voucher_access_logs;
CREATE TRIGGER monitor_suspicious_access
  AFTER INSERT ON mobile_voucher_access_logs
  FOR EACH ROW
  EXECUTE FUNCTION alert_suspicious_activity();

-- Add RLS policies
ALTER TABLE mobile_voucher_access_logs ENABLE ROW LEVEL SECURITY;

-- Policy for service role only
CREATE POLICY "Service role can manage access logs" ON mobile_voucher_access_logs
  FOR ALL USING (true);

-- Grant permissions
GRANT SELECT, INSERT ON mobile_voucher_access_logs TO service_role;
GRANT SELECT ON suspicious_voucher_access TO service_role;