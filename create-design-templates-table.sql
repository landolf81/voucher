-- 교환권 디자인 템플릿 테이블 생성
CREATE TABLE IF NOT EXISTS voucher_design_templates (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  
  -- A4 이미지 (PDF 프린트용)
  a4_image_url text NOT NULL,
  a4_image_width numeric DEFAULT 210,
  a4_image_height numeric DEFAULT 297,
  
  -- 모바일 정사각형 이미지
  mobile_image_url text NOT NULL,
  mobile_image_size numeric DEFAULT 400,
  
  -- 필드 배치 설정 (JSON)
  a4_field_positions jsonb NOT NULL DEFAULT '{}',
  mobile_field_positions jsonb NOT NULL DEFAULT '{}',
  
  -- 기본 스타일 설정
  default_font_family text DEFAULT 'Pretendard',
  default_font_size numeric DEFAULT 12,
  default_text_color text DEFAULT '#000000',
  
  -- 메타데이터
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid,
  updated_by uuid
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_voucher_design_templates_active ON voucher_design_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_voucher_design_templates_created_at ON voucher_design_templates(created_at);

-- RLS 정책 설정
ALTER TABLE voucher_design_templates ENABLE ROW LEVEL SECURITY;

-- 모든 인증된 사용자가 읽을 수 있음
DROP POLICY IF EXISTS "voucher_design_templates_read_policy" ON voucher_design_templates;
CREATE POLICY "voucher_design_templates_read_policy" ON voucher_design_templates
  FOR SELECT USING (true);

-- 관리자만 생성/수정/삭제 가능
DROP POLICY IF EXISTS "voucher_design_templates_write_policy" ON voucher_design_templates;
CREATE POLICY "voucher_design_templates_write_policy" ON voucher_design_templates
  FOR ALL USING (true);

-- 업데이트 트리거 함수
CREATE OR REPLACE FUNCTION update_voucher_design_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_voucher_design_templates_updated_at ON voucher_design_templates;
CREATE TRIGGER update_voucher_design_templates_updated_at
  BEFORE UPDATE ON voucher_design_templates
  FOR EACH ROW EXECUTE PROCEDURE update_voucher_design_templates_updated_at();