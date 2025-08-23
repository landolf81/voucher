-- 교환권 템플릿 테이블 생성
CREATE TABLE IF NOT EXISTS voucher_templates (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  voucher_name text NOT NULL,
  voucher_type text NOT NULL,
  expires_at timestamptz NOT NULL,
  selected_sites jsonb DEFAULT '[]',
  notes text,
  status text DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid,
  updated_by uuid
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_voucher_templates_status ON voucher_templates(status);
CREATE INDEX IF NOT EXISTS idx_voucher_templates_created_at ON voucher_templates(created_at);
CREATE INDEX IF NOT EXISTS idx_voucher_templates_type ON voucher_templates(voucher_type);

-- RLS 정책 설정
ALTER TABLE voucher_templates ENABLE ROW LEVEL SECURITY;

-- 모든 인증된 사용자가 읽을 수 있음
CREATE POLICY "voucher_templates_read_policy" ON voucher_templates
  FOR SELECT USING (auth.role() = 'authenticated');

-- 인증된 사용자가 생성/수정/삭제 가능 (일단 단순하게)
CREATE POLICY "voucher_templates_write_policy" ON voucher_templates
  FOR ALL USING (auth.role() = 'authenticated');

-- 업데이트 트리거 함수
CREATE OR REPLACE FUNCTION update_voucher_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_voucher_templates_updated_at
  BEFORE UPDATE ON voucher_templates
  FOR EACH ROW EXECUTE PROCEDURE update_voucher_templates_updated_at();