-- Auth Users Display Name Migration
-- user_profiles의 user_id를 auth.users의 user_metadata.display_name으로 마이그레이션

-- 1. 먼저 현재 데이터 상태 확인
DO $$
DECLARE
    v_count INTEGER;
BEGIN
    -- user_profiles 테이블의 레코드 수 확인
    SELECT COUNT(*) INTO v_count FROM user_profiles;
    RAISE NOTICE 'Total user_profiles records: %', v_count;
    
    -- auth.users에서 display_name이 이미 설정된 사용자 수 확인
    SELECT COUNT(*) INTO v_count 
    FROM auth.users 
    WHERE raw_user_meta_data->>'display_name' IS NOT NULL;
    RAISE NOTICE 'Users with existing display_name: %', v_count;
END $$;

-- 2. user_profiles의 user_id를 auth.users의 display_name으로 업데이트
-- 이미 display_name이 있는 경우는 건너뜀
UPDATE auth.users au
SET 
    raw_user_meta_data = COALESCE(au.raw_user_meta_data, '{}'::jsonb) || 
    jsonb_build_object(
        'display_name', up.user_id,
        'name', up.name,
        'role', up.role,
        'site_id', up.site_id
    ),
    updated_at = NOW()
FROM user_profiles up
WHERE 
    au.id = up.id
    AND (au.raw_user_meta_data->>'display_name' IS NULL OR au.raw_user_meta_data->>'display_name' = '');

-- 3. 업데이트 결과 확인
DO $$
DECLARE
    v_count INTEGER;
    v_updated INTEGER;
BEGIN
    -- 업데이트된 레코드 수 확인
    GET DIAGNOSTICS v_updated = ROW_COUNT;
    RAISE NOTICE 'Updated % auth.users records', v_updated;
    
    -- display_name이 설정된 총 사용자 수 확인
    SELECT COUNT(*) INTO v_count 
    FROM auth.users 
    WHERE raw_user_meta_data->>'display_name' IS NOT NULL;
    RAISE NOTICE 'Total users with display_name after migration: %', v_count;
END $$;

-- 4. 마이그레이션 로그 추가
INSERT INTO audit_logs (action, details, created_at)
VALUES (
    'auth_users_display_name_migration',
    json_build_object(
        'migration_version', '1.0.0',
        'description', 'Migrated user_profiles.user_id to auth.users.raw_user_meta_data.display_name',
        'migrated_at', NOW()
    ),
    NOW()
);

-- 5. 데이터 검증 - user_id와 display_name 매핑 확인
SELECT 
    up.user_id as "user_profiles_user_id",
    up.name as "user_name",
    au.email as "auth_email",
    au.phone as "auth_phone",
    au.raw_user_meta_data->>'display_name' as "auth_display_name",
    CASE 
        WHEN au.raw_user_meta_data->>'display_name' = up.user_id THEN '✅ Matched'
        WHEN au.raw_user_meta_data->>'display_name' IS NULL THEN '❌ Missing'
        ELSE '⚠️ Mismatch'
    END as "status"
FROM user_profiles up
LEFT JOIN auth.users au ON au.id = up.id
ORDER BY up.created_at DESC
LIMIT 20;