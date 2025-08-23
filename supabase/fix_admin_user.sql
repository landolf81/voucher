-- ============================================
-- admin 사용자 강제 생성/수정 스크립트
-- ============================================

-- 1. 사업장 먼저 생성 (참조 무결성)
INSERT INTO sites (id, site_name) VALUES
  ('11111111-1111-1111-1111-111111111111', '농협하나로마트 강남점')
ON CONFLICT (id) DO UPDATE SET
  site_name = EXCLUDED.site_name;

-- 2. 기존 admin 사용자 삭제 (있다면)
DELETE FROM users WHERE user_id = 'admin';

-- 3. admin 사용자 새로 생성
INSERT INTO users (
  id,
  user_id, 
  email,
  phone,
  name,
  role,
  site_id
) VALUES (
  '33333333-3333-3333-3333-333333333333',
  'admin',
  'admin@example.com',
  '01087654321',
  '관리자',
  'admin',
  '11111111-1111-1111-1111-111111111111'
);

-- 4. 생성 확인
SELECT 
  'admin 사용자 생성 완료' as message,
  user_id,
  phone,
  name,
  role
FROM users 
WHERE user_id = 'admin';

-- 5. 모든 사용자 목록
SELECT 
  user_id,
  phone, 
  name,
  role,
  created_at
FROM users
ORDER BY role, user_id;