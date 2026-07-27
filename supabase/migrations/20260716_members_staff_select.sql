-- 조합원(members) 읽기를 직원(staff)에게 허용하는 SELECT 전용 정책.
-- 배경: 앱은 이미 /api/members(service role)로 직원에게 조합원 목록을 제공 중이라
-- RLS를 앱 현실과 일치시키는 변경. 쓰기는 여전히 admin 전용(is_admin() ALL 정책).
-- 이로써 security_invoker 뷰(members_list_view)도 staff JWT로 조회 가능해짐
-- (hermes-bot 전용 계정 role=staff 포함).
create policy "members_staff_select" on public.members
  for select to authenticated
  using (public.get_user_role() in ('super_admin', 'admin', 'staff'));
