-- Migration: role 신뢰 출처를 user_metadata → app_metadata 로 이전
-- Date: 2026-06-23
-- Why:
--   user_metadata 는 로그인 사용자가 supabase.auth.updateUser({ data: {...} }) 로
--   직접 수정할 수 있다. 따라서 role/site_id 를 user_metadata 에서 읽는 모든 RLS·서버
--   검사는 일반 사용자가 자기 권한을 admin 으로, 또는 site_id 를 타 사업장으로 위조해
--   우회할 수 있었다 (Supabase advisor: rls_references_user_metadata, ERROR).
--   app_metadata(raw_app_meta_data) 는 service_role(admin API)로만 변경 가능하고
--   클라이언트 updateUser 로는 수정할 수 없으므로 권한(authorization)의 신뢰 출처로 적합하다.
--
-- 이 마이그레이션이 하는 일:
--   1) 모든 사용자의 role/site_id/is_active 를 user_metadata → app_metadata 로 백필 (멱등)
--   2) get_user_role / get_user_site_id / is_admin 헬퍼를 app_metadata 기준으로 재정의
--   3) role/site_id 를 user_metadata(JWT 또는 raw_user_meta_data)에서 읽던 모든 RLS 정책을
--      위 헬퍼 호출로 교체
--
-- 주의: vouchers / audit_logs / mobile_* 정책은 이미 public.is_admin() 을 사용하므로
--       (1)(2) 만으로 자동으로 안전해진다 (별도 교체 불필요).
--
-- 참고: Supabase CLI(db push)는 마이그레이션 파일을 자체 트랜잭션으로 감싸 적용하므로
--       이 파일에는 명시적 begin/commit 을 두지 않는다 (전체가 원자적으로 적용됨).

-- =====================================================
-- 1. 백필: user_metadata → app_metadata (멱등)
--    이미 app_metadata 에 값이 있으면 user_metadata 값으로 덮어쓰되,
--    user_metadata 에도 없고 app_metadata 에만 있는 값은 보존한다.
-- =====================================================
update auth.users u
set raw_app_meta_data =
  coalesce(u.raw_app_meta_data, '{}'::jsonb)
  || jsonb_strip_nulls(jsonb_build_object(
       'role',      coalesce(u.raw_user_meta_data->>'role',    u.raw_app_meta_data->>'role'),
       'site_id',   coalesce(u.raw_user_meta_data->>'site_id', u.raw_app_meta_data->>'site_id'),
       'is_active', coalesce(u.raw_user_meta_data->'is_active', u.raw_app_meta_data->'is_active', 'true'::jsonb)
     ))
where coalesce(u.raw_user_meta_data->>'role', u.raw_app_meta_data->>'role') is not null
   or coalesce(u.raw_user_meta_data->>'site_id', u.raw_app_meta_data->>'site_id') is not null;

-- =====================================================
-- 2. 헬퍼 재정의 (app_metadata 기준)
--    SECURITY DEFINER + auth.users 직접 조회 → JWT 클레임 staleness 영향 없음.
--    (auth.jwt() 가 아니라 라이브 테이블을 읽으므로 토큰 갱신 전에도 최신값 적용)
-- =====================================================
create or replace function public.get_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select raw_app_meta_data->>'role' from auth.users where id = auth.uid()),
    'viewer'
  );
$$;

create or replace function public.get_user_site_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select nullif(raw_app_meta_data->>'site_id', '')::uuid
  from auth.users
  where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.get_user_role() in ('super_admin', 'admin');
$$;

-- =====================================================
-- 3. RLS 정책 교체: user_metadata 참조 → 헬퍼 호출
-- =====================================================

-- 3a. schedule_events (기존: auth.jwt() -> 'user_metadata' ->> 'role')
do $$ begin if to_regclass('public.schedule_events') is not null then
  drop policy if exists schedule_update on public.schedule_events;
  create policy schedule_update on public.schedule_events for update to authenticated
    using (created_by = auth.uid() or public.is_admin())
    with check (created_by = auth.uid() or public.is_admin());

  drop policy if exists schedule_delete on public.schedule_events;
  create policy schedule_delete on public.schedule_events for delete to authenticated
    using (created_by = auth.uid() or public.is_admin());
end if; end $$;

-- 3b. announcements / announcement_reads (기존: auth.jwt() -> 'user_metadata' ->> 'role'|'site_id')
do $$ begin if to_regclass('public.announcements') is not null then
  drop policy if exists ann_select on public.announcements;
  create policy ann_select on public.announcements for select to authenticated
    using (
      scope = 'all'
      or (scope = 'site' and site_id = public.get_user_site_id())
      or public.is_admin()
    );

  drop policy if exists ann_insert on public.announcements;
  create policy ann_insert on public.announcements for insert to authenticated
    with check (public.is_admin() and created_by = auth.uid());

  drop policy if exists ann_update on public.announcements;
  create policy ann_update on public.announcements for update to authenticated
    using (public.is_admin())
    with check (public.is_admin());

  drop policy if exists ann_delete on public.announcements;
  create policy ann_delete on public.announcements for delete to authenticated
    using (public.is_admin());
end if; end $$;

do $$ begin if to_regclass('public.announcement_reads') is not null then
  drop policy if exists ar_select on public.announcement_reads;
  create policy ar_select on public.announcement_reads for select to authenticated
    using (user_id = auth.uid() or public.is_admin());
end if; end $$;

-- 3c. associations (기존: SELECT raw_user_meta_data->>'role' ... = 'admin')
do $$ begin if to_regclass('public.associations') is not null then
  drop policy if exists "Admin can manage associations" on public.associations;
  create policy "Admin can manage associations" on public.associations for all to authenticated
    using (public.is_admin());
end if; end $$;

-- 3d. members / grafting_schedules / member_audit_logs (기존: raw_user_meta_data->>'role')
do $$ begin if to_regclass('public.members') is not null then
  drop policy if exists "Admin can do everything with members" on public.members;
  create policy "Admin can do everything with members" on public.members for all to authenticated
    using (public.is_admin());
end if; end $$;

do $$ begin if to_regclass('public.grafting_schedules') is not null then
  drop policy if exists "Admin can do everything with grafting schedules" on public.grafting_schedules;
  create policy "Admin can do everything with grafting schedules" on public.grafting_schedules for all to authenticated
    using (public.is_admin());
end if; end $$;

do $$ begin if to_regclass('public.member_audit_logs') is not null then
  drop policy if exists "Admin can read member audit logs" on public.member_audit_logs;
  create policy "Admin can read member audit logs" on public.member_audit_logs for select to authenticated
    using (public.is_admin());
end if; end $$;

-- 3e. unread_counts() SECURITY DEFINER 함수: site 범위 공지 카운트의 site_id 출처를
--     user_metadata → get_user_site_id()(app_metadata) 로 교체
do $$ begin if to_regclass('public.announcements') is not null then
  create or replace function public.unread_counts()
  returns json
  language sql
  security definer
  stable
  set search_path = public, pg_temp
  as $fn$
    with me as (select auth.uid() as uid),
    msg as (
      select count(m.*)::int as c
      from message_participants p
      join me on me.uid = p.user_id
      join messages m on m.thread_id = p.thread_id
      where m.created_at > p.last_read_at
        and m.sender_id is distinct from p.user_id
    ),
    ann as (
      select count(a.*)::int as c
      from announcements a, me
      where (
          a.scope = 'all'
          or (a.scope = 'site' and a.site_id = public.get_user_site_id())
        )
        and not exists (
          select 1 from announcement_reads r
          where r.announcement_id = a.id and r.user_id = me.uid
        )
    )
    select json_build_object(
      'messages', (select c from msg),
      'announcements', (select c from ann)
    );
  $fn$;
end if; end $$;
