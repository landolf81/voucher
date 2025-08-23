-- ============================================
-- 사용자 데이터 디버깅 쿼리
-- ============================================

-- 1. users 테이블 존재 확인
SELECT table_name, table_schema
FROM information_schema.tables 
WHERE table_name = 'users' AND table_schema = 'public';

-- 2. users 테이블 구조 확인  
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'users' AND table_schema = 'public'
ORDER BY ordinal_position;

-- 3. 모든 사용자 조회 (created_at 제외)
SELECT 
  id,
  user_id,
  email, 
  phone,
  name,
  role,
  site_id
FROM users
ORDER BY user_id;

-- 4. admin 사용자 구체적 검색
SELECT *
FROM users 
WHERE user_id = 'admin';

-- 5. 사용자 수 확인
SELECT 
  'Total users' as description,
  COUNT(*) as count
FROM users
UNION ALL
SELECT 
  'Admin users' as description,
  COUNT(*) as count
FROM users 
WHERE role = 'admin'
UNION ALL
SELECT 
  'Users with user_id=admin' as description,
  COUNT(*) as count
FROM users 
WHERE user_id = 'admin';

-- 6. user_id 컬럼의 모든 값 확인
SELECT DISTINCT user_id, COUNT(*)
FROM users
GROUP BY user_id
ORDER BY user_id;

-- 7. 전화번호 형식 확인
SELECT 
  user_id,
  phone,
  LENGTH(phone) as phone_length,
  phone ~ '^010[0-9]{8}$' as is_valid_format
FROM users
WHERE user_id = 'admin';

-- 8. 사이트 연결 확인
SELECT 
  u.user_id,
  u.name,
  u.role,
  s.site_name
FROM users u
LEFT JOIN sites s ON u.site_id = s.id
WHERE u.user_id = 'admin';

-- 9. 현재 연결 정보 확인
SELECT 
  current_database() as database_name,
  current_user as current_user,
  current_schema() as current_schema;