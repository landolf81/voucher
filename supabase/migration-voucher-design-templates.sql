-- 교환권 디자인 템플릿 테이블 생성
-- A4용과 모바일용 이미지를 따로 관리하고 필드 배치 정보 저장

-- 1. 교환권 디자인 템플릿 테이블
CREATE TABLE IF NOT EXISTS voucher_design_templates (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  
  -- A4 이미지 (PDF 프린트용)
  a4_image_url text NOT NULL,
  a4_image_width numeric DEFAULT 210, -- A4 width in mm
  a4_image_height numeric DEFAULT 297, -- A4 height in mm
  
  -- 모바일 정사각형 이미지
  mobile_image_url text NOT NULL,
  mobile_image_size numeric DEFAULT 400, -- square size in pixels
  
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
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id)
);

-- 2. 필드 배치 설정 예시 JSON 구조:
-- {
--   "association": { "x": 50, "y": 100, "width": 100, "height": 20, "fontSize": 14, "fontWeight": "bold", "textAlign": "left" },
--   "member_id": { "x": 160, "y": 100, "width": 80, "height": 20, "fontSize": 12, "textAlign": "center" },
--   "name": { "x": 50, "y": 130, "width": 120, "height": 20, "fontSize": 16, "fontWeight": "bold" },
--   "dob": { "x": 50, "y": 160, "width": 80, "height": 20, "fontSize": 12 },
--   "amount": { "x": 140, "y": 160, "width": 100, "height": 20, "fontSize": 18, "fontWeight": "bold", "textAlign": "right" },
--   "serial_no": { "x": 50, "y": 190, "width": 120, "height": 20, "fontSize": 10, "fontFamily": "monospace" },
--   "qr_code": { "x": 160, "y": 180, "width": 40, "height": 40 },
--   "barcode": { "x": 50, "y": 220, "width": 120, "height": 30 }
-- }

-- 3. 교환권 템플릿에 디자인 연결
ALTER TABLE voucher_templates 
ADD COLUMN IF NOT EXISTS design_template_id uuid REFERENCES voucher_design_templates(id);

-- 4. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_voucher_design_templates_active ON voucher_design_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_voucher_design_templates_created_at ON voucher_design_templates(created_at);
CREATE INDEX IF NOT EXISTS idx_voucher_templates_design ON voucher_templates(design_template_id);

-- 5. RLS 정책 설정
ALTER TABLE voucher_design_templates ENABLE ROW LEVEL SECURITY;

-- 모든 인증된 사용자가 읽을 수 있음
CREATE POLICY "voucher_design_templates_read_policy" ON voucher_design_templates
  FOR SELECT USING (auth.role() = 'authenticated');

-- 관리자만 생성/수정/삭제 가능
CREATE POLICY "voucher_design_templates_write_policy" ON voucher_design_templates
  FOR ALL USING (
    auth.role() = 'authenticated' AND 
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'staff')
    )
  );

-- 6. 업데이트 트리거 함수
CREATE OR REPLACE FUNCTION update_voucher_design_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  NEW.updated_by = auth.uid();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_voucher_design_templates_updated_at
  BEFORE UPDATE ON voucher_design_templates
  FOR EACH ROW EXECUTE PROCEDURE update_voucher_design_templates_updated_at();