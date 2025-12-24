-- ============================================
-- 간단한 사용자 확인 쿼리
-- ============================================

-- 1. 모든 사용자 조회
SELECT 
  user_id,
  phone,
  name,
  role
FROM users
ORDER BY role, user_id;

-- 2. admin 사용자 구체적 확인
SELECT 
  'admin 사용자 정보' as title,
  user_id,
  phone,
  name,
  role,
  id
FROM users 
WHERE user_id = 'admin';

-- 3. 사용자 수 통계
SELECT 
  role,
  COUNT(*) as count
FROM users
GROUP BY role
ORDER BY role;