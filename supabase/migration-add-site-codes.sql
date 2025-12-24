-- 사업장 간략 코드 시스템을 위한 스키마 확장
-- sites 테이블에 short_code 컬럼 추가

-- 1. sites 테이블에 간략 코드 컬럼 추가
ALTER TABLE sites 
ADD COLUMN IF NOT EXISTS short_code text UNIQUE;

-- 2. 간략 코드 컬럼에 인덱스 추가 (빠른 조회를 위해)
CREATE INDEX IF NOT EXISTS idx_sites_short_code ON sites(short_code);

-- 3. 기존 사업장들에 기본 간략 코드 생성 (중복 방지)
-- 먼저 임시로 고유한 값을 생성한 후 중복 해결
UPDATE sites 
SET short_code = CASE 
  WHEN site_name LIKE '%총구%' THEN 'TG'
  WHEN site_name LIKE '%도흥%' THEN 'DH'
  WHEN site_name LIKE '%자재백화점%' THEN 'JB'
  WHEN site_name LIKE '%본점%' THEN 'BJ'
  WHEN site_name LIKE '%지점%' THEN UPPER(SUBSTRING(site_name, 1, 2))
  ELSE UPPER(SUBSTRING(site_name, 1, 2))
END || '_' || id::text -- 임시로 ID를 추가해서 고유성 보장
WHERE short_code IS NULL;

-- 4. 중복된 코드가 있는 경우 순번 추가
-- 임시 ID 접미사를 제거하고 깔끔한 코드 생성
CREATE OR REPLACE FUNCTION resolve_duplicate_site_codes()
RETURNS void AS $$
DECLARE
  site_record RECORD;
  base_code text;
  final_code text;
  counter integer;
BEGIN
  -- 모든 사이트에 대해 깔끔한 코드 생성
  FOR site_record IN 
    SELECT id, site_name, short_code
    FROM sites 
    WHERE short_code IS NOT NULL 
    ORDER BY site_name
  LOOP
    -- 임시 ID 접미사 제거하여 기본 코드 추출
    base_code := REGEXP_REPLACE(site_record.short_code, '_[0-9a-f-]+$', '');
    final_code := base_code;
    counter := 1;
    
    -- 중복 체크 및 순번 추가
    WHILE EXISTS (
      SELECT 1 FROM sites 
      WHERE short_code = final_code 
      AND id != site_record.id
    ) LOOP
      counter := counter + 1;
      final_code := base_code || counter::text;
    END LOOP;
    
    -- 최종 코드 업데이트
    UPDATE sites 
    SET short_code = final_code 
    WHERE id = site_record.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 5. 중복 해결 함수 실행
SELECT resolve_duplicate_site_codes();

-- 6. 임시 함수 제거
DROP FUNCTION resolve_duplicate_site_codes();

-- 7. 향후 사업장 추가 시 자동으로 코드 생성하는 트리거 함수
CREATE OR REPLACE FUNCTION generate_site_short_code()
RETURNS TRIGGER AS $$
DECLARE
  base_code text;
  final_code text;
  counter integer := 1;
BEGIN
  -- short_code가 비어있는 경우에만 자동 생성
  IF NEW.short_code IS NULL OR NEW.short_code = '' THEN
    -- 기본 코드 생성 (사업장명 첫 2글자)
    base_code := UPPER(SUBSTRING(NEW.site_name, 1, 2));
    final_code := base_code;
    
    -- 중복 체크 및 순번 추가
    WHILE EXISTS (SELECT 1 FROM sites WHERE short_code = final_code AND id != NEW.id) LOOP
      counter := counter + 1;
      final_code := base_code || counter::text;
    END LOOP;
    
    NEW.short_code := final_code;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 8. 트리거 생성
DROP TRIGGER IF EXISTS trigger_generate_site_short_code ON sites;
CREATE TRIGGER trigger_generate_site_short_code
  BEFORE INSERT OR UPDATE ON sites
  FOR EACH ROW
  EXECUTE FUNCTION generate_site_short_code();

-- 9. 코멘트 추가
COMMENT ON COLUMN sites.short_code IS '사업장 간략 코드 (CSV 업로드 시 사용)';

-- 10. 확인 쿼리 (실행 후 결과 확인용)
-- SELECT site_name, short_code FROM sites ORDER BY site_name;