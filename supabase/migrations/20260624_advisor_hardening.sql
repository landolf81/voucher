-- Migration: Supabase 보안 advisor WARN 정리 (2026-06-24)
-- Voucher-dev 에 MCP 로 적용·검증 완료. 멱등(재실행 안전).
--
-- 대상:
--   1) function_search_path_mutable (3): 트리거 함수에 search_path 고정
--   2) rls_policy_always_true 중 public(anon 포함) 역할에 ALL/true 를 허용하던 정책 축소
--      → 실제 앱 접근은 전부 service_role 서버(RLS 우회) 또는 인증 브라우저 세션이라 동작 변화 없음
--
-- 미처리(별도 판단 필요, 이 마이그레이션 범위 아님):
--   - *_security_definer_function_executable: RLS 헬퍼(is_admin 등)의 EXECUTE 회수는 RLS 전체를
--     깨뜨릴 수 있어 함수별 검토 필요
--   - pg_graphql_*_table_exposed: RLS 가 여전히 적용되어 위험도 낮음. GraphQL 미사용 시 스키마 단위 제한 권장
--   - voucher_templates 의 authenticated/ALL/true 정책 2개: 직원 템플릿 관리 의도로 보여 유지

-- =====================================================
-- 1. 트리거 함수 search_path 고정 (동작 변화 없음)
-- =====================================================
alter function public.touch_schedule_updated_at()     set search_path = public, pg_temp;
alter function public.touch_chat_session_updated_at() set search_path = public, pg_temp;
alter function public.touch_announcement_updated_at() set search_path = public, pg_temp;

-- =====================================================
-- 2. 과도한 anon 노출 RLS 정책 축소
-- =====================================================

-- 2a. mobile_voucher_access_logs: 이름과 달리 역할이 public 이라 anon/authenticated 가 로그를
--     전부 조작 가능했음. 쓰기는 service_role 서버에서만 수행(RLS 우회) → 정책 제거.
--     (결과적으로 RLS enabled + no policy = 클라이언트 접근 차단, 의도된 상태)
drop policy if exists "Service role can manage access logs" on public.mobile_voucher_access_logs;

-- 2b. sites: public/ALL/true → 인증 읽기 + admin 쓰기 (anon 차단)
drop policy if exists "Allow all operations on sites" on public.sites;
drop policy if exists sites_select_authenticated on public.sites;
drop policy if exists sites_write_admin on public.sites;
create policy sites_select_authenticated on public.sites
  for select to authenticated using (true);
create policy sites_write_admin on public.sites
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- 2c. voucher_design_templates: public/ALL·SELECT/true → 인증 읽기 + admin 쓰기 (anon 차단)
drop policy if exists "voucher_design_templates_write_policy" on public.voucher_design_templates;
drop policy if exists "voucher_design_templates_read_policy"  on public.voucher_design_templates;
drop policy if exists vdt_select_authenticated on public.voucher_design_templates;
drop policy if exists vdt_write_admin on public.voucher_design_templates;
create policy vdt_select_authenticated on public.voucher_design_templates
  for select to authenticated using (true);
create policy vdt_write_admin on public.voucher_design_templates
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
