-- 폐기된 public.users 미러 테이블 잔재 정리
--
-- 배경:
--   과거 auth.users 를 1:1 확장하던 public.users 테이블이 있었고, 아래 트리거가
--   auth 사용자 생성/수정/삭제 시 public.users 행을 동기화했다.
--   이후 사용자 데이터는 auth.users 의 user_metadata / app_metadata 로 흡수되고
--   public.users 테이블은 제거됐다(현재 information_schema 에 없음).
--   그런데 트리거/함수는 남아있어, auth 사용자 조작 때마다 없는 테이블을 건드리다
--   실패하며 로그에 WARNING 을 남긴다(EXCEPTION 으로 잡혀 auth 동작 자체는 정상).
--
-- 조치: 트리거 3개와 함수 3개를 제거한다. 동작 변경 없음(이미 no-op + 경고만).

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users;

DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.handle_user_update();
DROP FUNCTION IF EXISTS public.handle_user_delete();
