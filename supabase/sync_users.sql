-- ============================================
-- auth.users와 public.users 동기화 스크립트
-- ============================================

-- 1. 현재 불일치 상태 확인
-- auth.users에 있지만 public.users에 없는 사용자 조회
SELECT 
  au.id,
  au.email,
  au.phone,
  au.created_at,
  au.raw_user_meta_data
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
WHERE pu.id IS NULL;

-- 2. 누락된 사용자를 public.users에 추가
INSERT INTO public.users (id, email, phone, role, name)
SELECT 
  au.id,
  au.email,
  au.phone,
  COALESCE(au.raw_user_meta_data->>'role', 'staff') as role,
  COALESCE(
    au.raw_user_meta_data->>'name',
    au.raw_user_meta_data->>'full_name',
    split_part(COALESCE(au.email, ''), '@', 1)
  ) as name
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
WHERE pu.id IS NULL;

-- 3. 자동 동기화를 위한 트리거 함수 생성
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email, phone, name, role, site_id)
  VALUES (
    new.id,
    new.email,
    new.phone,
    COALESCE(
      new.raw_user_meta_data->>'name',
      new.raw_user_meta_data->>'full_name',
      split_part(COALESCE(new.email, ''), '@', 1)
    ),
    COALESCE(new.raw_user_meta_data->>'role', 'staff'),
    (new.raw_user_meta_data->>'site_id')::uuid
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    phone = EXCLUDED.phone,
    name = EXCLUDED.name;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. 기존 트리거 삭제 (있을 경우)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 5. 새 트리거 생성
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 6. 사용자 업데이트 시 동기화 트리거
CREATE OR REPLACE FUNCTION public.handle_user_update()
RETURNS trigger AS $$
BEGIN
  UPDATE public.users
  SET
    email = new.email,
    phone = new.phone,
    name = COALESCE(
      new.raw_user_meta_data->>'name',
      new.raw_user_meta_data->>'full_name',
      name
    )
  WHERE id = new.id;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. 업데이트 트리거 생성
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;

CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_update();

-- 8. 사용자 삭제 시 동기화 트리거
CREATE OR REPLACE FUNCTION public.handle_user_delete()
RETURNS trigger AS $$
BEGIN
  DELETE FROM public.users WHERE id = old.id;
  RETURN old;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. 삭제 트리거 생성
DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users;

CREATE TRIGGER on_auth_user_deleted
  BEFORE DELETE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_delete();

-- 10. 동기화 결과 확인
SELECT 
  'Auth Users' as source,
  COUNT(*) as count
FROM auth.users
UNION ALL
SELECT 
  'Public Users' as source,
  COUNT(*) as count
FROM public.users;

-- 11. 상세 비교
SELECT 
  COALESCE(au.id, pu.id) as user_id,
  CASE 
    WHEN au.id IS NULL THEN 'Public Only'
    WHEN pu.id IS NULL THEN 'Auth Only'
    ELSE 'Both'
  END as status,
  au.email as auth_email,
  pu.email as public_email,
  au.phone as auth_phone,
  pu.phone as public_phone,
  pu.role,
  pu.name
FROM auth.users au
FULL OUTER JOIN public.users pu ON au.id = pu.id
ORDER BY status, user_id;