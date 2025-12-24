-- Migration: 영농회(Associations) 테이블 생성
-- Date: 2025-12-21
-- Purpose: 조합원들이 소속된 영농회 관리

-- ============================================
-- 1. 영농회 테이블 생성
-- ============================================
CREATE TABLE IF NOT EXISTS associations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 기본 정보
  name TEXT NOT NULL,                    -- 영농회명 (예: 성주참외영농조합법인)
  short_code TEXT UNIQUE,                -- 단축 코드 (예: SJCO)

  -- 회장 정보
  chairman_name TEXT,                    -- 영농회장
  women_chairman_name TEXT,              -- 부녀회장

  -- 메타데이터
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 제약조건
  CONSTRAINT unique_association_name UNIQUE(name)
);

-- ============================================
-- 2. 인덱스 생성
-- ============================================
CREATE INDEX IF NOT EXISTS idx_associations_name ON associations(name);
CREATE INDEX IF NOT EXISTS idx_associations_short_code ON associations(short_code);
CREATE INDEX IF NOT EXISTS idx_associations_status ON associations(status);
CREATE INDEX IF NOT EXISTS idx_associations_is_active ON associations(is_active);

-- ============================================
-- 3. updated_at 자동 업데이트 트리거
-- ============================================
CREATE OR REPLACE FUNCTION update_associations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_associations_updated_at ON associations;
CREATE TRIGGER trigger_update_associations_updated_at
  BEFORE UPDATE ON associations
  FOR EACH ROW
  EXECUTE FUNCTION update_associations_updated_at();

-- ============================================
-- 4. members 테이블에 association_id 컬럼 추가
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'members' AND column_name = 'association_id'
  ) THEN
    ALTER TABLE members ADD COLUMN association_id UUID REFERENCES associations(id);
    CREATE INDEX IF NOT EXISTS idx_members_association_id ON members(association_id);
  END IF;
END $$;

-- ============================================
-- 5. RLS 정책
-- ============================================
ALTER TABLE associations ENABLE ROW LEVEL SECURITY;

-- 기존 정책 삭제
DROP POLICY IF EXISTS "Authenticated users can read associations" ON associations;
DROP POLICY IF EXISTS "Admin can manage associations" ON associations;

-- 읽기: 모든 인증된 사용자
CREATE POLICY "Authenticated users can read associations"
  ON associations FOR SELECT
  TO authenticated
  USING (true);

-- 관리: 관리자만
CREATE POLICY "Admin can manage associations"
  ON associations FOR ALL
  TO authenticated
  USING (
    (
      SELECT raw_user_meta_data->>'role'
      FROM auth.users
      WHERE id = auth.uid()
    ) = 'admin'
  );

-- ============================================
-- 6. 코멘트
-- ============================================
COMMENT ON TABLE associations IS '영농회 정보 테이블';
COMMENT ON COLUMN associations.name IS '영농회명';
COMMENT ON COLUMN associations.short_code IS '단축 코드 (CSV 일괄 등록용)';
COMMENT ON COLUMN associations.chairman_name IS '영농회장';
COMMENT ON COLUMN associations.women_chairman_name IS '부녀회장';
