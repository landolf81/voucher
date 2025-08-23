-- ============================================
-- 트리거 존재 여부 및 문제 진단 스크립트
-- ============================================

-- 1. 현재 존재하는 트리거 확인
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'auth'
  AND event_object_table = 'users';

-- 2. public 스키마의 트리거 함수들 확인
SELECT 
  proname as function_name,
  prosrc as function_body
FROM pg_proc
WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  AND proname LIKE '%user%';

-- 3. auth.users와 public.users 데이터 비교
SELECT 
  'Total in auth.users' as description,
  COUNT(*) as count
FROM auth.users
UNION ALL
SELECT 
  'Total in public.users' as description,
  COUNT(*) as count
FROM public.users
UNION ALL
SELECT 
  'Missing in public.users' as description,
  COUNT(*) as count
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
WHERE pu.id IS NULL;