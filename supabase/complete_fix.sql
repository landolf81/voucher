-- ============================================
-- 완벽한 auth.users ↔ public.users 동기화 솔루션
-- ============================================

-- STEP 1: 기존 데이터 동기화
-- ============================================
INSERT INTO public.users (id, email, phone, role, name, site_id)
SELECT 
  au.id,
  au.email,
  au.phone,
  COALESCE(au.raw_user_meta_data->>'role', 'staff') as role,
  COALESCE(
    au.raw_user_meta_data->>'name',
    au.raw_user_meta_data->>'full_name',
    split_part(COALESCE(au.email, ''), '@', 1)
  ) as name,
  (au.raw_user_meta_data->>'site_id')::uuid as site_id
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 FROM public.users pu WHERE pu.id = au.id
);

-- STEP 2: 트리거 함수 생성 (INSERT 시)
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
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
    name = COALESCE(EXCLUDED.name, public.users.name),
    role = COALESCE(EXCLUDED.role, public.users.role);
  
  RETURN new;
EXCEPTION
  WHEN others THEN
    -- 오류 발생 시에도 auth 사용자는 생성되도록
    RAISE WARNING 'Failed to create public.users record: %', SQLERRM;
    RETURN new;
END;
$$;

-- STEP 3: INSERT 트리거 생성
-- ============================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- STEP 4: UPDATE 트리거 함수
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_user_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.users
  SET
    email = new.email,
    phone = new.phone,
    name = COALESCE(
      new.raw_user_meta_data->>'name',
      new.raw_user_meta_data->>'full_name',
      public.users.name
    ),
    role = COALESCE(new.raw_user_meta_data->>'role', public.users.role)
  WHERE id = new.id;
  
  -- 만약 public.users에 없으면 생성
  IF NOT FOUND THEN
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
    );
  END IF;
  
  RETURN new;
EXCEPTION
  WHEN others THEN
    RAISE WARNING 'Failed to update public.users record: %', SQLERRM;
    RETURN new;
END;
$$;

-- STEP 5: UPDATE 트리거 생성
-- ============================================
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE OF email, phone, raw_user_meta_data ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_update();

-- STEP 6: DELETE 트리거 함수
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_user_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  DELETE FROM public.users WHERE id = old.id;
  RETURN old;
EXCEPTION
  WHEN others THEN
    RAISE WARNING 'Failed to delete public.users record: %', SQLERRM;
    RETURN old;
END;
$$;

-- STEP 7: DELETE 트리거 생성
-- ============================================
DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users;
CREATE TRIGGER on_auth_user_deleted
  BEFORE DELETE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_delete();

-- STEP 8: RLS 정책 추가 (서비스 역할용)
-- ============================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 서비스 역할은 모든 작업 가능
CREATE POLICY "Service role can do anything" ON public.users
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 인증된 사용자는 자신의 정보 읽기 가능
CREATE POLICY "Users can view own record" ON public.users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- STEP 9: 검증 쿼리
-- ============================================
SELECT 
  'Verification Results' as title,
  (SELECT COUNT(*) FROM auth.users) as auth_users_count,
  (SELECT COUNT(*) FROM public.users) as public_users_count,
  (SELECT COUNT(*) FROM auth.users au 
   LEFT JOIN public.users pu ON au.id = pu.id 
   WHERE pu.id IS NULL) as missing_in_public,
  (SELECT COUNT(*) FROM information_schema.triggers 
   WHERE trigger_schema = 'auth' 
   AND event_object_table = 'users') as trigger_count;

-- STEP 10: 트리거 목록 확인
-- ============================================
SELECT 
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'auth' 
  AND event_object_table = 'users'
ORDER BY trigger_name;