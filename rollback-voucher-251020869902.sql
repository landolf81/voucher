-- 교환권 251020869902 상태를 'issued'로 롤백
-- 실행 전 현재 상태 확인
SELECT
  serial_no,
  status,
  issued_at,
  used_at,
  used_at_site_id,
  used_by_user_id
FROM vouchers
WHERE serial_no = '251020869902';

-- 상태를 'issued'로 롤백하고 사용 관련 정보 제거
UPDATE vouchers
SET
  status = 'issued',
  used_at = NULL,
  used_at_site_id = NULL,
  used_by_user_id = NULL
WHERE serial_no = '251020869902';

-- 롤백 후 상태 확인
SELECT
  serial_no,
  status,
  issued_at,
  used_at,
  used_at_site_id,
  used_by_user_id
FROM vouchers
WHERE serial_no = '251020869902';
