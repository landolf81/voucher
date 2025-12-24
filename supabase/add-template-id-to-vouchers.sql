-- vouchers 테이블에 template_id 컬럼 추가
ALTER TABLE vouchers 
ADD COLUMN IF NOT EXISTS template_id uuid;

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_vouchers_template_id ON vouchers(template_id);

-- 기존 데이터에 대한 처리 (선택사항)
-- 기존 교환권들은 template_id가 null이 될 것입니다
-- 필요하다면 기본 템플릿 ID를 설정할 수 있습니다

-- 예: 첫 번째 템플릿을 기본값으로 설정하고 싶다면
-- UPDATE vouchers 
-- SET template_id = (SELECT id FROM voucher_templates ORDER BY created_at LIMIT 1)
-- WHERE template_id IS NULL;