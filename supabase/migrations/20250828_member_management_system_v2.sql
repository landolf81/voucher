-- Migration: Member Management System with Grafting Schedule (v2 - Fixed)
-- Date: 2025-08-28
-- Purpose: Create comprehensive member management system with farming and grafting information

-- ============================================
-- 0. Drop existing objects if they exist (for clean reinstall)
-- ============================================
DROP VIEW IF EXISTS member_overview;
DROP TRIGGER IF EXISTS trigger_log_member_changes ON members;
DROP TRIGGER IF EXISTS trigger_update_member_updated_at ON members;
DROP FUNCTION IF EXISTS log_member_changes();
DROP FUNCTION IF EXISTS update_member_updated_at();
DROP TABLE IF EXISTS member_audit_logs;
DROP TABLE IF EXISTS grafting_schedules;
DROP TABLE IF EXISTS members;
DROP TABLE IF EXISTS crops;

-- Also drop the member_id column from vouchers if it exists
ALTER TABLE vouchers DROP COLUMN IF EXISTS member_id;

-- ============================================
-- 1. Create crops master table
-- ============================================
CREATE TABLE crops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crop_name TEXT UNIQUE NOT NULL,
  requires_grafting BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert initial crop data
INSERT INTO crops (crop_name, requires_grafting, display_order) VALUES
  ('참외', true, 1),
  ('포도', false, 2),
  ('딸기', false, 3),
  ('배', false, 4);

-- ============================================
-- 2. Create members table
-- ============================================
CREATE TABLE members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Basic Information
  site_id UUID REFERENCES sites(id) NOT NULL,
  name TEXT NOT NULL,
  member_id TEXT NOT NULL,
  security_number TEXT,  -- Format: 733054-0-000000
  date_of_birth DATE NOT NULL,
  phone TEXT NOT NULL,
  address TEXT NOT NULL,

  -- Farming Information
  main_crop_id UUID REFERENCES crops(id),
  main_crop_name TEXT,  -- Denormalized for easy access
  sub_crop_id UUID REFERENCES crops(id),
  sub_crop_name TEXT,

  -- Grafting Workplace (for crops that require grafting)
  grafting_workplace_address TEXT,
  grafting_workplace_lat DECIMAL(10, 8),
  grafting_workplace_lng DECIMAL(11, 8),

  -- Membership dates
  join_date DATE,  -- 가입일자
  leave_date DATE,  -- 탈퇴일자

  -- Metadata
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),

  -- Constraints
  CONSTRAINT unique_member_id_per_site UNIQUE(site_id, member_id),
  CONSTRAINT valid_phone CHECK (phone ~ '^010[0-9]{8}$')
);

-- ============================================
-- 3. Create grafting schedules table (yearly)
-- ============================================
CREATE TABLE grafting_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID REFERENCES members(id) ON DELETE CASCADE NOT NULL,

  -- Year and date
  year INTEGER NOT NULL,
  grafting_date DATE NOT NULL,
  time_period TEXT CHECK (time_period IN ('오전', '오후')) NOT NULL,

  -- Optional notes
  notes TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),

  -- One grafting schedule per member per year
  CONSTRAINT unique_grafting_per_member_year UNIQUE(member_id, year)
);

-- ============================================
-- 4. Add member_id to vouchers table
-- ============================================
ALTER TABLE vouchers
ADD COLUMN member_id TEXT;

-- Create index for member_id lookup
CREATE INDEX idx_vouchers_member_id ON vouchers(member_id);

-- ============================================
-- 5. Create member audit logs
-- ============================================
CREATE TABLE member_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID REFERENCES members(id) ON DELETE CASCADE,
  action TEXT CHECK (action IN ('create', 'update', 'delete')) NOT NULL,
  changed_fields JSONB,
  changed_by UUID REFERENCES auth.users(id),
  changed_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address TEXT,
  user_agent TEXT
);

-- ============================================
-- 6. Create indexes for performance
-- ============================================
CREATE INDEX idx_members_site_id ON members(site_id);
CREATE INDEX idx_members_name ON members(name);
CREATE INDEX idx_members_phone ON members(phone);
CREATE INDEX idx_members_member_id ON members(member_id);
CREATE INDEX idx_members_main_crop ON members(main_crop_id);
CREATE INDEX idx_members_is_active ON members(is_active);

CREATE INDEX idx_grafting_schedules_member_id ON grafting_schedules(member_id);
CREATE INDEX idx_grafting_schedules_year ON grafting_schedules(year);
CREATE INDEX idx_grafting_schedules_date ON grafting_schedules(grafting_date);

CREATE INDEX idx_member_audit_logs_member_id ON member_audit_logs(member_id);
CREATE INDEX idx_member_audit_logs_changed_at ON member_audit_logs(changed_at DESC);

-- ============================================
-- 7. Create helper functions
-- ============================================

-- Function to update member updated_at timestamp
CREATE OR REPLACE FUNCTION update_member_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for members table
CREATE TRIGGER trigger_update_member_updated_at
  BEFORE UPDATE ON members
  FOR EACH ROW
  EXECUTE FUNCTION update_member_updated_at();

-- Function to log member changes
CREATE OR REPLACE FUNCTION log_member_changes()
RETURNS TRIGGER AS $$
DECLARE
  changed_data JSONB;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO member_audit_logs (member_id, action, changed_fields, changed_by)
    VALUES (NEW.id, 'create', to_jsonb(NEW), NEW.created_by);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Only log if there are actual changes
    IF OLD IS DISTINCT FROM NEW THEN
      changed_data = jsonb_build_object(
        'before', to_jsonb(OLD),
        'after', to_jsonb(NEW)
      );
      INSERT INTO member_audit_logs (member_id, action, changed_fields, changed_by)
      VALUES (NEW.id, 'update', changed_data, NEW.updated_by);
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO member_audit_logs (member_id, action, changed_fields, changed_by)
    VALUES (OLD.id, 'delete', to_jsonb(OLD), auth.uid());
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Trigger for member audit logging
CREATE TRIGGER trigger_log_member_changes
  AFTER INSERT OR UPDATE OR DELETE ON members
  FOR EACH ROW
  EXECUTE FUNCTION log_member_changes();

-- ============================================
-- 8. Create views for easy querying
-- ============================================

-- Member overview with voucher statistics
-- Fixed: Properly cast and join on TEXT member_id field
CREATE OR REPLACE VIEW member_overview AS
SELECT
  m.id,
  m.site_id,
  m.name,
  m.member_id,
  m.security_number,
  m.date_of_birth,
  m.phone,
  m.address,
  m.main_crop_id,
  m.main_crop_name,
  m.sub_crop_id,
  m.sub_crop_name,
  m.grafting_workplace_address,
  m.grafting_workplace_lat,
  m.grafting_workplace_lng,
  m.join_date,
  m.leave_date,
  m.is_active,
  m.created_at,
  m.updated_at,
  m.created_by,
  m.updated_by,
  -- Site info
  s.site_name,
  -- Grafting schedule info
  gs.id as current_year_grafting_id,
  gs.grafting_date as current_year_grafting_date,
  gs.time_period as current_year_grafting_time,
  -- Voucher statistics (using TEXT member_id comparison)
  COUNT(DISTINCT v.id) FILTER (WHERE v.status = 'issued') as issued_voucher_count,
  COUNT(DISTINCT v.id) FILTER (WHERE v.status = 'used') as used_voucher_count,
  COALESCE(SUM(v.amount) FILTER (WHERE v.status = 'issued'), 0) as total_issued_amount,
  COALESCE(SUM(v.amount) FILTER (WHERE v.status = 'used'), 0) as total_used_amount,
  COALESCE(SUM(v.amount) FILTER (WHERE v.status = 'issued'), 0) as remaining_amount
FROM members m
LEFT JOIN sites s ON m.site_id = s.id
LEFT JOIN grafting_schedules gs ON m.id = gs.member_id AND gs.year = EXTRACT(YEAR FROM NOW())::INTEGER
LEFT JOIN vouchers v ON m.member_id = v.member_id  -- Both are TEXT type
WHERE m.is_active = true
GROUP BY m.id, m.site_id, m.name, m.member_id, m.security_number, m.date_of_birth, m.phone, m.address,
         m.main_crop_id, m.main_crop_name, m.sub_crop_id, m.sub_crop_name,
         m.grafting_workplace_address, m.grafting_workplace_lat, m.grafting_workplace_lng,
         m.join_date, m.leave_date, m.is_active, m.created_at, m.updated_at, m.created_by, m.updated_by,
         s.site_name, gs.id, gs.grafting_date, gs.time_period;

-- ============================================
-- 9. Row Level Security (RLS) Policies
-- ============================================

-- Enable RLS
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE grafting_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE crops ENABLE ROW LEVEL SECURITY;

-- Crops: Public read for authenticated users
CREATE POLICY "Authenticated users can read crops"
  ON crops FOR SELECT
  TO authenticated
  USING (true);

-- Members: Admin only for now
CREATE POLICY "Admin can do everything with members"
  ON members FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  );

-- Grafting schedules: Admin only
CREATE POLICY "Admin can do everything with grafting schedules"
  ON grafting_schedules FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  );

-- Member audit logs: Admin read only
CREATE POLICY "Admin can read member audit logs"
  ON member_audit_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  );

-- ============================================
-- 10. Comments for documentation
-- ============================================

COMMENT ON TABLE members IS '조합원 기본 정보 및 영농 정보';
COMMENT ON TABLE grafting_schedules IS '년도별 접목 일정 정보';
COMMENT ON TABLE crops IS '작물 마스터 데이터';
COMMENT ON TABLE member_audit_logs IS '조합원 정보 변경 이력';

COMMENT ON COLUMN members.member_id IS '조합원 ID (영농회 내 고유)';
COMMENT ON COLUMN members.security_number IS '증권번호 (형식: 733054-0-000000)';
COMMENT ON COLUMN members.grafting_workplace_address IS '접목 작업장 주소';
COMMENT ON COLUMN members.join_date IS '가입일자';
COMMENT ON COLUMN members.leave_date IS '탈퇴일자';
COMMENT ON COLUMN grafting_schedules.time_period IS '접목 시간대 (오전/오후)';
COMMENT ON COLUMN vouchers.member_id IS '조합원 ID (members.member_id와 매칭)';
