-- 안전한 사업장 간략 코드 시스템 마이그레이션
-- 기존 데이터와 컬럼이 있을 수 있음을 고려한 버전

-- 1. sites 테이블에 간략 코드 컬럼 추가 (이미 존재할 수 있음)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'sites' AND column_name = 'short_code'
  ) THEN
    ALTER TABLE sites ADD COLUMN short_code text UNIQUE;
  END IF;
END $$;

-- 2. 간략 코드 컬럼에 인덱스 추가 (이미 존재할 수 있음)
CREATE INDEX IF NOT EXISTS idx_sites_short_code ON sites(short_code);

-- 3. 기존 NULL 코드들을 임시 고유 값으로 설정
UPDATE sites 
SET short_code = CASE 
  WHEN site_name LIKE '%총구%' THEN 'TG'
  WHEN site_name LIKE '%도흥%' THEN 'DH'
  WHEN site_name LIKE '%자재백화점%' THEN 'JB'
  WHEN site_name LIKE '%본점%' THEN 'BJ'
  WHEN site_name LIKE '%지점%' THEN UPPER(SUBSTRING(site_name, 1, 2))
  ELSE UPPER(SUBSTRING(site_name, 1, 2))
END || '_TEMP_' || EXTRACT(EPOCH FROM NOW())::bigint || '_' || id::text
WHERE short_code IS NULL;

-- 4. 중복 해결 및 깔끔한 코드 생성 함수
CREATE OR REPLACE FUNCTION setup_clean_site_codes()
RETURNS void AS $$
DECLARE
  site_record RECORD;
  base_code text;
  final_code text;
  counter integer;
  temp_suffix text;
BEGIN
  -- 모든 임시 코드들을 깔끔한 코드로 변환
  FOR site_record IN 
    SELECT id, site_name, short_code
    FROM sites 
    WHERE short_code LIKE '%_TEMP_%'
    ORDER BY site_name
  LOOP
    -- 임시 접미사 제거하여 기본 코드 추출
    base_code := SPLIT_PART(site_record.short_code, '_TEMP_', 1);
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
  
  -- 여전히 NULL인 코드들 처리 (혹시 누락된 경우)
  FOR site_record IN 
    SELECT id, site_name
    FROM sites 
    WHERE short_code IS NULL OR short_code = ''
    ORDER BY site_name
  LOOP
    base_code := UPPER(SUBSTRING(site_record.site_name, 1, 2));
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
    
    UPDATE sites 
    SET short_code = final_code 
    WHERE id = site_record.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 5. 깔끔한 코드 설정 함수 실행
SELECT setup_clean_site_codes();

-- 6. 임시 함수 제거
DROP FUNCTION setup_clean_site_codes();

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

-- 8. 트리거 생성 (이미 존재할 수 있으므로 DROP 후 생성)
DROP TRIGGER IF EXISTS trigger_generate_site_short_code ON sites;
CREATE TRIGGER trigger_generate_site_short_code
  BEFORE INSERT OR UPDATE ON sites
  FOR EACH ROW
  EXECUTE FUNCTION generate_site_short_code();

-- 9. 코멘트 추가
COMMENT ON COLUMN sites.short_code IS '사업장 간략 코드 (CSV 업로드 시 사용)';

-- 10. 확인 쿼리 (결과 확인용)
SELECT 
  site_name, 
  short_code,
  CASE 
    WHEN short_code IS NOT NULL THEN '✓ 설정됨'
    ELSE '✗ 미설정'
  END as status
FROM sites 
ORDER BY site_name;