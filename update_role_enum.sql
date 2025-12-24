-- ============================================
-- 권한 단계 4단계로 확장: part_time 추가
-- ============================================

-- 현재 role 제약조건 확인
SELECT 
  tc.constraint_name,
  cc.check_clause
FROM information_schema.table_constraints tc
JOIN information_schema.check_constraints cc 
  ON tc.constraint_name = cc.constraint_name
WHERE tc.table_name = 'users' 
  AND tc.constraint_type = 'CHECK'
  AND cc.check_clause LIKE '%role%';

-- 기존 role 제약조건 제거
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

-- 새로운 role 제약조건 추가 (part_time 포함)
ALTER TABLE users 
ADD CONSTRAINT users_role_check 
CHECK (role IN ('admin', 'staff', 'viewer', 'part_time'));

-- 확인: 제약조건이 올바르게 설정되었는지 확인
SELECT 
  'New constraint:' as status,
  tc.constraint_name,
  cc.check_clause
FROM information_schema.table_constraints tc
JOIN information_schema.check_constraints cc 
  ON tc.constraint_name = cc.constraint_name
WHERE tc.table_name = 'users' 
  AND tc.constraint_type = 'CHECK'
  AND cc.check_clause LIKE '%role%';