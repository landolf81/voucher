-- Safe Auth Users Display Name Migration with Backup and Rollback
-- user_profiles의 user_id를 auth.users의 user_metadata.display_name으로 안전하게 마이그레이션

-- ====================================
-- STEP 1: 백업 테이블 생성
-- ====================================
CREATE TABLE IF NOT EXISTS auth_users_backup_before_display_name (
    id UUID PRIMARY KEY,
    raw_user_meta_data JSONB,
    updated_at TIMESTAMPTZ,
    backed_up_at TIMESTAMPTZ DEFAULT NOW()
);

-- 기존 auth.users 데이터 백업
INSERT INTO auth_users_backup_before_display_name (id, raw_user_meta_data, updated_at)
SELECT id, raw_user_meta_data, updated_at
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- ====================================
-- STEP 2: 현재 상태 분석
-- ====================================
DO $$
DECLARE
    v_total_profiles INTEGER;
    v_total_auth_users INTEGER;
    v_matched_users INTEGER;
    v_missing_display_name INTEGER;
BEGIN
    -- user_profiles 총 개수
    SELECT COUNT(*) INTO v_total_profiles FROM user_profiles;
    RAISE NOTICE '📊 Total user_profiles: %', v_total_profiles;
    
    -- auth.users 총 개수
    SELECT COUNT(*) INTO v_total_auth_users FROM auth.users;
    RAISE NOTICE '📊 Total auth.users: %', v_total_auth_users;
    
    -- 매칭되는 사용자 수 (user_profiles.id = auth.users.id)
    SELECT COUNT(*) INTO v_matched_users 
    FROM user_profiles up
    INNER JOIN auth.users au ON au.id = up.id;
    RAISE NOTICE '✅ Matched users (by ID): %', v_matched_users;
    
    -- display_name이 없는 auth.users 수
    SELECT COUNT(*) INTO v_missing_display_name
    FROM auth.users au
    INNER JOIN user_profiles up ON au.id = up.id
    WHERE au.raw_user_meta_data->>'display_name' IS NULL 
       OR au.raw_user_meta_data->>'display_name' = '';
    RAISE NOTICE '⚠️  Users needing display_name update: %', v_missing_display_name;
END $$;-- ====================================
-- STEP 3: 마이그레이션 실행
-- ====================================
BEGIN;  -- 트랜잭션 시작

-- user_profiles.user_id를 auth.users.display_name으로 업데이트
UPDATE auth.users au
SET 
    raw_user_meta_data = COALESCE(au.raw_user_meta_data, '{}'::jsonb) || 
    jsonb_build_object(
        'display_name', up.user_id,
        'user_id', up.user_id,  -- 호환성을 위해 user_id도 유지
        'name', up.name,
        'role', up.role,
        'site_id', up.site_id,
        'profile_id', up.id
    ),
    updated_at = NOW()
FROM user_profiles up
WHERE 
    au.id = up.id
    AND (
        au.raw_user_meta_data->>'display_name' IS NULL 
        OR au.raw_user_meta_data->>'display_name' = ''
    );

-- 업데이트 결과 확인
DO $$
DECLARE
    v_updated_count INTEGER;
BEGIN
    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    RAISE NOTICE '✅ Updated % auth.users records with display_name', v_updated_count;
    
    -- 0개 업데이트된 경우 경고
    IF v_updated_count = 0 THEN
        RAISE WARNING '⚠️  No records were updated. This might mean display_names are already set.';
    END IF;
END $$;

COMMIT;  -- 트랜잭션 커밋-- ====================================
-- STEP 4: 마이그레이션 검증
-- ====================================
-- 마이그레이션 후 데이터 검증
WITH migration_check AS (
    SELECT 
        up.id,
        up.user_id as profile_user_id,
        up.name,
        au.email as auth_email,
        au.phone as auth_phone,
        au.raw_user_meta_data->>'display_name' as auth_display_name,
        au.raw_user_meta_data->>'user_id' as auth_user_id,
        CASE 
            WHEN au.raw_user_meta_data->>'display_name' = up.user_id THEN 'SUCCESS'
            WHEN au.raw_user_meta_data->>'display_name' IS NULL THEN 'MISSING'
            ELSE 'MISMATCH'
        END as migration_status
    FROM user_profiles up
    LEFT JOIN auth.users au ON au.id = up.id
)
SELECT 
    migration_status,
    COUNT(*) as count,
    STRING_AGG(profile_user_id::TEXT, ', ' ORDER BY profile_user_id) as user_ids
FROM migration_check
GROUP BY migration_status
ORDER BY migration_status;-- ====================================
-- STEP 5: 마이그레이션 로그
-- ====================================
INSERT INTO audit_logs (action, details, created_at)
VALUES (
    'auth_users_display_name_migration_safe',
    json_build_object(
        'migration_version', '2.0.0',
        'description', 'Safe migration of user_profiles.user_id to auth.users.display_name with backup',
        'backup_table', 'auth_users_backup_before_display_name',
        'migrated_at', NOW()
    ),
    NOW()
);

-- ====================================
-- ROLLBACK SCRIPT (필요시 사용)
-- ====================================
-- 롤백이 필요한 경우 아래 스크립트를 실행하세요:
/*
BEGIN;

-- 백업에서 원래 데이터 복원
UPDATE auth.users au
SET 
    raw_user_meta_data = backup.raw_user_meta_data,
    updated_at = backup.updated_at
FROM auth_users_backup_before_display_name backup
WHERE au.id = backup.id;

-- 롤백 로그
INSERT INTO audit_logs (action, details, created_at)
VALUES (
    'auth_users_display_name_migration_rollback',
    json_build_object(
        'rollback_reason', 'Manual rollback',
        'rolled_back_at', NOW()
    ),
    NOW()
);

COMMIT;
*/-- ====================================
-- VERIFICATION QUERIES (실행 후 확인용)
-- ====================================

-- 1. 특정 사용자 확인 (예: 131027631)
SELECT 
    up.user_id,
    up.name,
    au.email,
    au.phone,
    au.raw_user_meta_data->>'display_name' as display_name,
    au.raw_user_meta_data->>'user_id' as meta_user_id
FROM user_profiles up
LEFT JOIN auth.users au ON au.id = up.id
WHERE up.user_id = '131027631';

-- 2. display_name이 제대로 설정된 사용자 목록 (상위 10개)
SELECT 
    au.raw_user_meta_data->>'display_name' as display_name,
    au.email,
    au.phone,
    au.created_at
FROM auth.users au
WHERE au.raw_user_meta_data->>'display_name' IS NOT NULL
ORDER BY au.created_at DESC
LIMIT 10;

-- 3. 전체 마이그레이션 통계
SELECT 
    COUNT(*) FILTER (WHERE au.raw_user_meta_data->>'display_name' IS NOT NULL) as with_display_name,
    COUNT(*) FILTER (WHERE au.raw_user_meta_data->>'display_name' IS NULL) as without_display_name,
    COUNT(*) as total_users
FROM auth.users au;