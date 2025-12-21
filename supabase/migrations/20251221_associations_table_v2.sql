-- Migration: 영농회 테이블 컬럼 변경
-- Date: 2025-12-21
-- Purpose: 불필요한 컬럼 제거, 영농회장/부녀회장 컬럼 추가

-- ============================================
-- 1. 불필요한 컬럼 삭제
-- ============================================
ALTER TABLE associations
  DROP COLUMN IF EXISTS representative_name,
  DROP COLUMN IF EXISTS phone,
  DROP COLUMN IF EXISTS fax,
  DROP COLUMN IF EXISTS email,
  DROP COLUMN IF EXISTS address,
  DROP COLUMN IF EXISTS postal_code,
  DROP COLUMN IF EXISTS business_number,
  DROP COLUMN IF EXISTS establishment_date,
  DROP COLUMN IF EXISTS site_id,
  DROP COLUMN IF EXISTS association_type,
  DROP COLUMN IF EXISTS notes;

-- ============================================
-- 2. 새 컬럼 추가 (영농회장, 부녀회장)
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'associations' AND column_name = 'chairman_name'
  ) THEN
    ALTER TABLE associations ADD COLUMN chairman_name TEXT;
    COMMENT ON COLUMN associations.chairman_name IS '영농회장';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'associations' AND column_name = 'women_chairman_name'
  ) THEN
    ALTER TABLE associations ADD COLUMN women_chairman_name TEXT;
    COMMENT ON COLUMN associations.women_chairman_name IS '부녀회장';
  END IF;
END $$;
