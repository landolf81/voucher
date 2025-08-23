# Design Templates Setup

교환권 디자인 템플릿 시스템을 설정하려면 Supabase 대시보드에서 테이블을 수동으로 생성해야 합니다.

## 설정 단계:

1. Supabase 프로젝트 대시보드로 이동
2. SQL Editor 메뉴로 이동
3. 다음 SQL을 실행:

```sql
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

-- 모든 사용자가 읽을 수 있음 (개발용 - 운영시 수정 필요)
DROP POLICY IF EXISTS "voucher_design_templates_read_policy" ON voucher_design_templates;
CREATE POLICY "voucher_design_templates_read_policy" ON voucher_design_templates
  FOR SELECT USING (true);

-- 모든 사용자가 수정할 수 있음 (개발용 - 운영시 수정 필요)
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

-- 업데이트 트리거
DROP TRIGGER IF EXISTS update_voucher_design_templates_updated_at ON voucher_design_templates;
CREATE TRIGGER update_voucher_design_templates_updated_at
  BEFORE UPDATE ON voucher_design_templates
  FOR EACH ROW EXECUTE PROCEDURE update_voucher_design_templates_updated_at();

-- 테스트 데이터 삽입 (선택사항) - 플레이스홀더 이미지 사용
INSERT INTO voucher_design_templates (
  name, 
  description, 
  a4_image_url, 
  mobile_image_url,
  a4_field_positions,
  mobile_field_positions
) VALUES (
  '기본 템플릿',
  '기본 교환권 디자인 템플릿',
  '/uploads/voucher-templates/default-a4.svg',
  '/uploads/voucher-templates/default-mobile.svg',
  '{
    "association": {"x": 50, "y": 50, "width": 200, "height": 20, "fontSize": 16, "fontWeight": "bold"},
    "member_id": {"x": 300, "y": 50, "width": 100, "height": 20, "fontSize": 14},
    "name": {"x": 50, "y": 80, "width": 150, "height": 20, "fontSize": 18, "fontWeight": "bold"},
    "dob": {"x": 50, "y": 110, "width": 100, "height": 20, "fontSize": 12},
    "amount": {"x": 300, "y": 110, "width": 100, "height": 20, "fontSize": 20, "fontWeight": "bold", "textAlign": "right"},
    "serial_no": {"x": 50, "y": 140, "width": 200, "height": 20, "fontSize": 10, "fontFamily": "monospace"},
    "qr_code": {"x": 400, "y": 50, "width": 60, "height": 60},
    "barcode": {"x": 50, "y": 180, "width": 200, "height": 40}
  }',
  '{
    "association": {"x": 20, "y": 20, "width": 160, "height": 16, "fontSize": 14, "fontWeight": "bold"},
    "member_id": {"x": 200, "y": 20, "width": 80, "height": 16, "fontSize": 12},
    "name": {"x": 20, "y": 50, "width": 120, "height": 16, "fontSize": 16, "fontWeight": "bold"},
    "dob": {"x": 20, "y": 80, "width": 80, "height": 16, "fontSize": 10},
    "amount": {"x": 200, "y": 80, "width": 80, "height": 16, "fontSize": 18, "fontWeight": "bold", "textAlign": "right"},
    "serial_no": {"x": 20, "y": 110, "width": 160, "height": 16, "fontSize": 8, "fontFamily": "monospace"},
    "qr_code": {"x": 300, "y": 20, "width": 50, "height": 50},
    "barcode": {"x": 20, "y": 140, "width": 160, "height": 30}
  }'
) ON CONFLICT DO NOTHING;
```

## SQL 실행 후:

1. 브라우저 새로고침
2. 교환권 관리 → "디자인 관리" 탭으로 이동
3. 디자인 템플릿 생성 및 관리 가능
4. 교환권 관리 → "교환권 정보" 탭에서 템플릿별 디자인 설정
5. "발행(인쇄)" 탭에서 자동 디자인 추천 및 PDF 생성 테스트

## 기능 설명:

### 1. 디자인 템플릿 관리
- A4와 모바일용 이미지 업로드
- 필드 위치 설정 (캔버스 기반)
- 템플릿 활성화/비활성화

### 2. 교환권 템플릿과 디자인 연결
- 교환권 정보 등록 시 디자인 템플릿 선택
- 템플릿별 기본 디자인 설정

### 3. 자동 디자인 추천
- 발행 시 교환권 선택하면 연결된 디자인 자동 적용
- 수동으로 다른 디자인 선택 가능

### 4. PDF 생성
- 선택된 디자인으로 교환권 PDF 생성
- A4 (프린터용) 및 모바일 (정사각형) 형식 지원

## 주의사항:

위의 RLS 정책은 개발용으로 설정되어 있습니다. 운영 환경에서는 사용자 역할과 인증 상태에 따라 접근을 제한해야 합니다.