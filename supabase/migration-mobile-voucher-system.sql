-- Mobile Voucher System Migration
-- Adds support for mobile voucher issuance, link-based access, and issuance type tracking

-- 1. Add issuance type and mobile fields to vouchers table
ALTER TABLE vouchers 
ADD COLUMN IF NOT EXISTS issuance_type TEXT DEFAULT 'pdf' CHECK (issuance_type IN ('pdf', 'mobile', 'both')),
ADD COLUMN IF NOT EXISTS mobile_link_token TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS mobile_image_url TEXT,
ADD COLUMN IF NOT EXISTS link_expires_at TIMESTAMPTZ;

-- 2. Create mobile voucher batches table for user-specific bulk issuance
CREATE TABLE IF NOT EXISTS mobile_voucher_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  template_id UUID REFERENCES voucher_templates(id) ON DELETE CASCADE,
  batch_name TEXT NOT NULL,
  total_count INTEGER NOT NULL DEFAULT 0,
  generated_count INTEGER DEFAULT 0,
  link_token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'generating', 'completed', 'failed', 'expired')),
  error_message TEXT,
  download_count INTEGER DEFAULT 0,
  last_accessed_at TIMESTAMPTZ
);

-- 3. Create index for performance
CREATE INDEX IF NOT EXISTS idx_vouchers_mobile_link_token ON vouchers(mobile_link_token);
CREATE INDEX IF NOT EXISTS idx_vouchers_issuance_type ON vouchers(issuance_type);
CREATE INDEX IF NOT EXISTS idx_mobile_voucher_batches_link_token ON mobile_voucher_batches(link_token);
CREATE INDEX IF NOT EXISTS idx_mobile_voucher_batches_user_id ON mobile_voucher_batches(user_id);
CREATE INDEX IF NOT EXISTS idx_mobile_voucher_batches_status ON mobile_voucher_batches(status);

-- 4. Create junction table for batch-voucher relationships
CREATE TABLE IF NOT EXISTS mobile_batch_vouchers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID REFERENCES mobile_voucher_batches(id) ON DELETE CASCADE,
  voucher_id UUID REFERENCES vouchers(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(batch_id, voucher_id)
);

CREATE INDEX IF NOT EXISTS idx_mobile_batch_vouchers_batch_id ON mobile_batch_vouchers(batch_id);
CREATE INDEX IF NOT EXISTS idx_mobile_batch_vouchers_voucher_id ON mobile_batch_vouchers(voucher_id);

-- 5. Add trigger to update mobile_voucher_batches updated_at
CREATE OR REPLACE FUNCTION update_mobile_batch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_mobile_batch_updated_at
  BEFORE UPDATE ON mobile_voucher_batches
  FOR EACH ROW
  EXECUTE FUNCTION update_mobile_batch_updated_at();

-- 6. Function to generate secure tokens
CREATE OR REPLACE FUNCTION generate_secure_token(length INTEGER DEFAULT 32)
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..length LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 7. Function to cleanup expired batches
CREATE OR REPLACE FUNCTION cleanup_expired_mobile_batches()
RETURNS INTEGER AS $$
DECLARE
  expired_count INTEGER;
BEGIN
  UPDATE mobile_voucher_batches 
  SET status = 'expired'
  WHERE expires_at < NOW() 
    AND status NOT IN ('expired', 'failed');
  
  GET DIAGNOSTICS expired_count = ROW_COUNT;
  RETURN expired_count;
END;
$$ LANGUAGE plpgsql;

-- 8. Add audit log support for mobile issuance
INSERT INTO audit_logs (action, details, created_at)
VALUES ('mobile_voucher_system_migration', 
        json_build_object(
          'migration_version', '1.0.0',
          'tables_created', ARRAY['mobile_voucher_batches', 'mobile_batch_vouchers'],
          'fields_added', ARRAY['issuance_type', 'mobile_link_token', 'mobile_image_url', 'link_expires_at']
        ), 
        NOW());

-- 9. Update existing vouchers to have default issuance_type
UPDATE vouchers 
SET issuance_type = 'pdf' 
WHERE issuance_type IS NULL;