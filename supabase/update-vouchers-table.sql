-- vouchers 테이블 업데이트: 필요한 컬럼들 추가

-- member_id 컬럼 추가
ALTER TABLE vouchers 
ADD COLUMN IF NOT EXISTS member_id text;

-- template_id 컬럼 추가 
ALTER TABLE vouchers 
ADD COLUMN IF NOT EXISTS template_id uuid;

-- phone 컬럼 추가
ALTER TABLE vouchers 
ADD COLUMN IF NOT EXISTS phone text;

-- status 컬럼 값 업데이트 (기존 'issued' 상태를 새로운 상태 체계에 맞게)
ALTER TABLE vouchers 
DROP CONSTRAINT IF EXISTS vouchers_status_check;

-- 새로운 상태 체계로 check constraint 추가
ALTER TABLE vouchers
ADD CONSTRAINT vouchers_status_check 
CHECK (status IN ('registered', 'issued', 'used', 'recalled', 'disposed'));

-- 기존 데이터 상태 업데이트
UPDATE vouchers 
SET status = 'issued' 
WHERE status = 'canceled';

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_vouchers_member_id ON vouchers(member_id);
CREATE INDEX IF NOT EXISTS idx_vouchers_template_id ON vouchers(template_id);

-- 업데이트된 테이블 구조 확인
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'vouchers' 
ORDER BY ordinal_position;