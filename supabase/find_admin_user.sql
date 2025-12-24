-- ============================================
-- admin 사용자 찾기 및 수정
-- ============================================

-- 1. 모든 사용자의 user_id 확인
SELECT 
  id,
  user_id,
  phone,
  name,
  role
FROM users
ORDER BY role, user_id;

-- 2. role이 admin인 사용자 찾기
SELECT 
  'role=admin인 사용자' as description,
  id,
  user_id,
  phone,
  name,
  role
FROM users 
WHERE role = 'admin';

-- 3. admin 역할 사용자의 user_id를 'admin'으로 수정
UPDATE users 
SET user_id = 'admin'
WHERE role = 'admin' 
  AND (user_id IS NULL OR user_id != 'admin');

-- 4. 수정 후 확인
SELECT 
  'UPDATE 후 admin 사용자' as description,
  id,
  user_id,
  phone,
  name,
  role
FROM users 
WHERE user_id = 'admin' OR role = 'admin';

-- 5. 최종 모든 사용자 목록
SELECT 
  '최종 사용자 목록' as description,
  user_id,
  phone,
  name,
  role
FROM users
ORDER BY 
  CASE role 
    WHEN 'admin' THEN 1
    WHEN 'staff' THEN 2
    ELSE 3
  END,
  user_id;