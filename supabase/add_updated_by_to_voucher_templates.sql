-- voucher_templates 테이블에 updated_by와 created_by 컬럼 추가
-- 누가 언제 템플릿을 생성/수정했는지 추적하기 위한 감사 목적

-- created_by 컬럼 추가 (nullable)
ALTER TABLE voucher_templates 
ADD COLUMN IF NOT EXISTS created_by uuid;

-- updated_by 컬럼 추가 (nullable)
ALTER TABLE voucher_templates 
ADD COLUMN IF NOT EXISTS updated_by uuid;

-- 외래키 제약조건 추가 (auth.users 테이블 참조)
ALTER TABLE voucher_templates 
ADD CONSTRAINT fk_voucher_templates_created_by 
FOREIGN KEY (created_by) REFERENCES auth.users(id);

ALTER TABLE voucher_templates 
ADD CONSTRAINT fk_voucher_templates_updated_by 
FOREIGN KEY (updated_by) REFERENCES auth.users(id);

-- 인덱스 추가 (성능 향상)
CREATE INDEX IF NOT EXISTS idx_voucher_templates_created_by ON voucher_templates(created_by);
CREATE INDEX IF NOT EXISTS idx_voucher_templates_updated_by ON voucher_templates(updated_by);

-- 트리거 함수 수정 (updated_by도 처리하도록)
CREATE OR REPLACE FUNCTION update_voucher_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  -- updated_by는 애플리케이션에서 설정하므로 트리거에서는 건드리지 않음
  RETURN NEW;
END;
$$ language 'plpgsql';