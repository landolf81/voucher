-- Migration: Enhanced Audit Logging and SMS Notification System
-- Date: 2025-08-25
-- Purpose: Track all voucher activities and send SMS notifications

-- 1. Enhance audit_logs table with more detailed fields
ALTER TABLE audit_logs 
ADD COLUMN IF NOT EXISTS action_type TEXT CHECK (action_type IN ('issue', 'use', 'cancel', 'recall', 'bulk_issue', 'bulk_use', 'delete', 'bulk_delete', 'system')),
ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS total_amount NUMERIC,
ADD COLUMN IF NOT EXISTS voucher_template_id UUID REFERENCES voucher_templates(id),
ADD COLUMN IF NOT EXISTS target_phone TEXT,
ADD COLUMN IF NOT EXISTS target_name TEXT,
ADD COLUMN IF NOT EXISTS ip_address TEXT,
ADD COLUMN IF NOT EXISTS user_agent TEXT;

-- 2. Create notification_logs table for SMS tracking
CREATE TABLE IF NOT EXISTS notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_id UUID REFERENCES vouchers(id),
  audit_log_id UUID REFERENCES audit_logs(id),
  phone TEXT NOT NULL,
  recipient_name TEXT,
  message_type TEXT CHECK (message_type IN ('voucher_used', 'voucher_issued', 'voucher_canceled', 'bulk_notification')),
  message_content TEXT NOT NULL,
  sent_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'queued')),
  error_message TEXT,
  provider TEXT DEFAULT 'twilio',
  provider_message_id TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create notification preferences table
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  phone TEXT,
  receive_usage_notifications BOOLEAN DEFAULT true,
  receive_issue_notifications BOOLEAN DEFAULT false,
  receive_cancel_notifications BOOLEAN DEFAULT false,
  notification_time_start TIME DEFAULT '09:00',
  notification_time_end TIME DEFAULT '21:00',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create activity_summary view for dashboard
CREATE OR REPLACE VIEW activity_summary AS
SELECT 
  al.id,
  al.action,
  al.action_type,
  al.created_at,
  al.quantity,
  al.total_amount,
  al.details,
  -- Voucher info
  v.serial_no,
  v.amount as voucher_amount,
  v.name as voucher_holder,
  v.association,
  -- Template info
  vt.voucher_name as template_name,
  vt.voucher_type as template_type,
  -- Actor info
  up_actor.name as actor_name,
  up_actor.user_id as actor_user_id,
  -- Site info
  s.site_name,
  -- Used by info (for usage actions)
  up_used.name as used_by_name,
  up_used.user_id as used_by_user_id
FROM audit_logs al
LEFT JOIN vouchers v ON al.voucher_id = v.id
LEFT JOIN voucher_templates vt ON al.voucher_template_id = vt.id OR v.template_id = vt.id
LEFT JOIN user_profiles up_actor ON al.actor_user_id = up_actor.id
LEFT JOIN sites s ON al.site_id = s.id
LEFT JOIN user_profiles up_used ON v.used_by_user_id = up_used.id
ORDER BY al.created_at DESC;

-- 5. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_type ON audit_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at_desc ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_logs_status ON notification_logs(status);
CREATE INDEX IF NOT EXISTS idx_notification_logs_phone ON notification_logs(phone);
CREATE INDEX IF NOT EXISTS idx_notification_logs_created_at ON notification_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_preferences_phone ON notification_preferences(phone);

-- 6. Function to log activity with details
CREATE OR REPLACE FUNCTION log_activity(
  p_action TEXT,
  p_action_type TEXT,
  p_actor_user_id UUID,
  p_site_id UUID,
  p_voucher_id UUID DEFAULT NULL,
  p_quantity INTEGER DEFAULT 1,
  p_total_amount NUMERIC DEFAULT NULL,
  p_details JSONB DEFAULT '{}'::jsonb,
  p_target_phone TEXT DEFAULT NULL,
  p_target_name TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO audit_logs (
    action,
    action_type,
    actor_user_id,
    site_id,
    voucher_id,
    quantity,
    total_amount,
    details,
    target_phone,
    target_name,
    created_at
  ) VALUES (
    p_action,
    p_action_type,
    p_actor_user_id,
    p_site_id,
    p_voucher_id,
    p_quantity,
    p_total_amount,
    p_details,
    p_target_phone,
    p_target_name,
    NOW()
  ) RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;

-- 7. Function to queue SMS notification
CREATE OR REPLACE FUNCTION queue_sms_notification(
  p_phone TEXT,
  p_message TEXT,
  p_message_type TEXT,
  p_voucher_id UUID DEFAULT NULL,
  p_audit_log_id UUID DEFAULT NULL,
  p_recipient_name TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_notification_id UUID;
  v_prefs notification_preferences;
BEGIN
  -- Check if notifications are enabled for this phone
  SELECT * INTO v_prefs 
  FROM notification_preferences 
  WHERE phone = p_phone AND is_active = true
  LIMIT 1;
  
  -- If no preferences found or notifications disabled, skip
  IF NOT FOUND THEN
    -- Create default preferences if not exist
    INSERT INTO notification_preferences (phone, is_active)
    VALUES (p_phone, true)
    ON CONFLICT DO NOTHING;
  END IF;
  
  -- Check notification type preferences
  IF v_prefs IS NOT NULL THEN
    IF p_message_type = 'voucher_used' AND NOT v_prefs.receive_usage_notifications THEN
      RETURN NULL;
    END IF;
    IF p_message_type = 'voucher_issued' AND NOT v_prefs.receive_issue_notifications THEN
      RETURN NULL;
    END IF;
    IF p_message_type = 'voucher_canceled' AND NOT v_prefs.receive_cancel_notifications THEN
      RETURN NULL;
    END IF;
  END IF;
  
  -- Queue the notification
  INSERT INTO notification_logs (
    phone,
    recipient_name,
    message_type,
    message_content,
    voucher_id,
    audit_log_id,
    status
  ) VALUES (
    p_phone,
    p_recipient_name,
    p_message_type,
    p_message,
    p_voucher_id,
    p_audit_log_id,
    'queued'
  ) RETURNING id INTO v_notification_id;
  
  RETURN v_notification_id;
END;
$$;

-- 8. Enhanced voucher usage function with SMS notification
CREATE OR REPLACE FUNCTION use_voucher_with_notification(
  p_serial TEXT,
  p_user_id UUID,
  p_site_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE 
  v_voucher vouchers;
  v_log_id UUID;
  v_notification_id UUID;
  v_message TEXT;
  v_site_name TEXT;
  v_user_name TEXT;
BEGIN
  -- Lock and get voucher
  SELECT * INTO v_voucher FROM vouchers WHERE serial_no = p_serial FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'VOUCHER_NOT_FOUND');
  END IF;
  
  IF v_voucher.status <> 'issued' THEN
    RETURN json_build_object('success', false, 'error', 'VOUCHER_ALREADY_USED');
  END IF;
  
  -- Get site name
  SELECT site_name INTO v_site_name FROM sites WHERE id = p_site_id;
  
  -- Get user name
  SELECT name INTO v_user_name FROM user_profiles WHERE id = p_user_id;
  
  -- Update voucher status
  UPDATE vouchers
  SET 
    status = 'used',
    used_at = NOW(),
    used_by_user_id = p_user_id,
    used_at_site_id = p_site_id
  WHERE id = v_voucher.id;
  
  -- Log activity
  v_log_id := log_activity(
    'voucher_used',
    'use',
    p_user_id,
    p_site_id,
    v_voucher.id,
    1,
    v_voucher.amount,
    json_build_object(
      'serial_no', v_voucher.serial_no,
      'holder_name', v_voucher.name,
      'association', v_voucher.association,
      'site_name', v_site_name,
      'user_name', v_user_name
    )::jsonb,
    v_voucher.phone,
    v_voucher.name
  );
  
  -- Queue SMS notification if phone exists
  IF v_voucher.phone IS NOT NULL THEN
    v_message := format(
      '[교환권 사용] %s님의 교환권이 %s %s에서 사용되었습니다. 금액: %s원',
      v_voucher.name,
      to_char(NOW(), 'MM/DD HH24:MI'),
      v_site_name,
      to_char(v_voucher.amount, 'FM999,999,999')
    );
    
    v_notification_id := queue_sms_notification(
      v_voucher.phone,
      v_message,
      'voucher_used',
      v_voucher.id,
      v_log_id,
      v_voucher.name
    );
  END IF;
  
  RETURN json_build_object(
    'success', true,
    'voucher_id', v_voucher.id,
    'serial_no', v_voucher.serial_no,
    'amount', v_voucher.amount,
    'used_at', NOW(),
    'notification_queued', v_notification_id IS NOT NULL
  );
END;
$$;

-- 9. Function for bulk voucher issuance logging
CREATE OR REPLACE FUNCTION log_bulk_issue(
  p_template_id UUID,
  p_quantity INTEGER,
  p_total_amount NUMERIC,
  p_actor_user_id UUID,
  p_site_id UUID,
  p_association TEXT
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_log_id UUID;
  v_template_name TEXT;
BEGIN
  -- Get template name
  SELECT voucher_name INTO v_template_name 
  FROM voucher_templates 
  WHERE id = p_template_id;
  
  -- Log activity
  v_log_id := log_activity(
    format('bulk_issue_%s_vouchers', p_quantity),
    'bulk_issue',
    p_actor_user_id,
    p_site_id,
    NULL,
    p_quantity,
    p_total_amount,
    json_build_object(
      'template_id', p_template_id,
      'template_name', v_template_name,
      'association', p_association,
      'issued_at', NOW()
    )::jsonb
  );
  
  RETURN v_log_id;
END;
$$;

-- 10. Create trigger to update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_notification_logs_updated_at
  BEFORE UPDATE ON notification_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_preferences_updated_at
  BEFORE UPDATE ON notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 11. Grant appropriate permissions
GRANT SELECT ON activity_summary TO authenticated;
GRANT SELECT, INSERT ON audit_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE ON notification_logs TO authenticated;
GRANT ALL ON notification_preferences TO authenticated;

-- 12. Add RLS policies
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

-- Allow users to see their own notification preferences
CREATE POLICY "Users can view own notification preferences" ON notification_preferences
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notification preferences" ON notification_preferences
  FOR UPDATE USING (auth.uid() = user_id);

-- Allow authenticated users to view notification logs
CREATE POLICY "Authenticated users can view notification logs" ON notification_logs
  FOR SELECT TO authenticated USING (true);

-- Admin can manage all notifications
CREATE POLICY "Admin can manage notifications" ON notification_logs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.user_id = auth.uid()::text 
      AND user_profiles.role = 'admin'
    )
  );

-- Add audit log entry for migration
INSERT INTO audit_logs (action, action_type, details, created_at)
VALUES (
  'migration_audit_notification_system', 
  'system',
  json_build_object(
    'version', '1.0.0',
    'description', 'Enhanced audit logging and SMS notification system',
    'migrated_at', NOW()
  ),
  NOW()
);