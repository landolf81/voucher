-- ============================================
-- users 테이블 안전하게 삭제하기
-- 의존성 제거 후 테이블 삭제
-- ============================================

-- 1. 현재 users 테이블 의존성 확인
SELECT 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND ccu.table_name = 'users';

-- 2. vouchers 테이블의 used_by_user_id 외래키 제거
ALTER TABLE vouchers 
DROP CONSTRAINT IF EXISTS vouchers_used_by_user_id_fkey;

-- 3. audit_logs 테이블의 actor_user_id 외래키 제거  
ALTER TABLE audit_logs 
DROP CONSTRAINT IF EXISTS audit_logs_actor_user_id_fkey;

-- 4. vouchers 테이블의 recalled_by_user_id 외래키 제거 (있다면)
ALTER TABLE vouchers 
DROP CONSTRAINT IF EXISTS vouchers_recalled_by_user_id_fkey;

-- 5. 다른 가능한 외래키들 제거
-- (migration 파일에서 생성된 것들)
DO $$ 
DECLARE
    rec RECORD;
BEGIN
    -- users 테이블을 참조하는 모든 외래키 찾아서 삭제
    FOR rec IN 
        SELECT tc.constraint_name, tc.table_name
        FROM information_schema.table_constraints AS tc 
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY' 
          AND ccu.table_name = 'users'
    LOOP
        EXECUTE format('ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I', 
                      rec.table_name, rec.constraint_name);
        RAISE NOTICE 'Dropped constraint % from table %', rec.constraint_name, rec.table_name;
    END LOOP;
END $$;

-- 6. used_by_user_id 컬럼을 user_profiles 참조로 변경
ALTER TABLE vouchers 
ADD CONSTRAINT vouchers_used_by_user_id_fkey 
FOREIGN KEY (used_by_user_id) REFERENCES user_profiles(id);

-- 7. audit_logs의 actor_user_id 컬럼을 user_profiles 참조로 변경
ALTER TABLE audit_logs 
ADD CONSTRAINT audit_logs_actor_user_id_fkey 
FOREIGN KEY (actor_user_id) REFERENCES user_profiles(id);

-- 8. recalled_by_user_id 컬럼을 user_profiles 참조로 변경 (있다면)
DO $$ 
BEGIN
    -- recalled_by_user_id 컬럼이 존재하는지 확인
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'vouchers' 
        AND column_name = 'recalled_by_user_id'
    ) THEN
        ALTER TABLE vouchers 
        ADD CONSTRAINT vouchers_recalled_by_user_id_fkey 
        FOREIGN KEY (recalled_by_user_id) REFERENCES user_profiles(id);
        RAISE NOTICE 'Added recalled_by_user_id foreign key constraint';
    END IF;
END $$;

-- 9. 의존성 제거 확인
SELECT 
    'Remaining dependencies on users table:' as status,
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND ccu.table_name = 'users';

-- 10. users 테이블 데이터 백업 (삭제 전)
SELECT 
    'Users table backup before deletion:' as status,
    id, email, phone, name, role, site_id, user_id, is_active, created_at
FROM users
ORDER BY created_at;

-- 11. users 테이블 삭제
DROP TABLE IF EXISTS users CASCADE;

-- 12. 삭제 확인
SELECT 
    'Table deletion completed' as status,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_name = 'users' AND table_schema = 'public'
        ) 
        THEN 'users table still exists'
        ELSE 'users table successfully deleted'
    END as result;

-- 13. 새로운 외래키 제약조건 확인
SELECT 
    'New foreign key constraints:' as status,
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND ccu.table_name = 'user_profiles';

-- 14. 최종 테이블 목록 확인
SELECT 
    'Final table list:' as status,
    table_name
FROM information_schema.tables 
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;