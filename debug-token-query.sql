-- 토큰 검색 쿼리
-- Supabase Dashboard > SQL Editor에서 실행하세요

-- 1. 부분 토큰으로 검색
SELECT
  id,
  serial_no,
  name,
  mobile_link_token,
  LENGTH(mobile_link_token) as token_length,
  link_expires_at,
  status,
  issuance_type,
  created_at,
  issued_at
FROM vouchers
WHERE mobile_link_token LIKE 'G93TsXgAJHBHjPZuuJV6ETDoAOpFk_mh02tg63%'
ORDER BY created_at DESC
LIMIT 10;

-- 2. 최근 모바일 발행 교환권 확인 (토큰이 있는 것들)
SELECT
  id,
  serial_no,
  name,
  mobile_link_token,
  LENGTH(mobile_link_token) as token_length,
  link_expires_at,
  status,
  issuance_type,
  created_at
FROM vouchers
WHERE mobile_link_token IS NOT NULL
  AND issuance_type = 'mobile'
ORDER BY created_at DESC
LIMIT 20;

-- 3. 특정 시리얼 번호로 검색 (사용자에게 시리얼 번호를 물어보세요)
-- SELECT
--   id,
--   serial_no,
--   name,
--   mobile_link_token,
--   LENGTH(mobile_link_token) as token_length,
--   link_expires_at,
--   status
-- FROM vouchers
-- WHERE serial_no = 'YOUR_SERIAL_NUMBER_HERE';

-- 4. 최근 생성된 모바일 배치 확인
SELECT
  id,
  batch_name,
  link_token,
  LENGTH(link_token) as token_length,
  total_count,
  generated_count,
  status,
  expires_at,
  created_at
FROM mobile_voucher_batches
ORDER BY created_at DESC
LIMIT 10;
