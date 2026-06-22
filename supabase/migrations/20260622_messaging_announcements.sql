-- Migration: 임직원 쪽지(1:1·그룹) + 공지(전체·사업장, 읽음 추적)
-- Date: 2026-06-22
-- Purpose:
--   1) 쪽지: thread 기반(message_threads / message_participants / messages). 1:1과 그룹 통합.
--   2) 공지: announcements(scope all|site) + announcement_reads(필독 확인).
--   - 사용자 마스터는 auth.users + user_metadata. FK는 auth.users(id). 표시용 이름은 비정규화 컬럼.
--   - RLS는 SECURITY DEFINER 헬퍼로 재귀 회피. role 판별은 auth.jwt()->user_metadata->>'role'.
--   - 실시간(messages / announcements)은 supabase_realtime publication 등록.

-- =====================================================================
-- 1. 쪽지 테이블
-- =====================================================================
create table if not exists message_threads (
  id uuid primary key default gen_random_uuid(),
  type text not null default 'direct' check (type in ('direct','group')),
  title text,                                   -- group 전용 제목
  created_by uuid references auth.users(id) on delete set null,
  created_by_name text,
  last_message_at timestamptz default now(),
  created_at timestamptz default now()
);

create table if not exists message_participants (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references message_threads(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  user_name text,
  last_read_at timestamptz not null default 'epoch',  -- 안읽음 계산 기준(처음엔 모두 안읽음)
  joined_at timestamptz default now(),
  unique (thread_id, user_id)
);
create index if not exists idx_participants_user on message_participants(user_id);
create index if not exists idx_participants_thread on message_participants(thread_id);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references message_threads(id) on delete cascade,
  sender_id uuid references auth.users(id) on delete set null,
  sender_name text,
  content text not null,
  created_at timestamptz default now()
);
create index if not exists idx_messages_thread on messages(thread_id, created_at);

-- =====================================================================
-- 2. 공지 테이블
-- =====================================================================
create table if not exists announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  scope text not null default 'all' check (scope in ('all','site')),
  site_id uuid,                                 -- scope='site'일 때 대상 사업장
  pinned boolean default false,
  created_by uuid references auth.users(id) on delete set null,
  created_by_name text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_announcements_created on announcements(created_at desc);

create table if not exists announcement_reads (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references announcements(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz default now(),
  unique (announcement_id, user_id)
);
create index if not exists idx_ann_reads_user on announcement_reads(user_id);

-- =====================================================================
-- 3. 헬퍼 함수 (RLS 재귀 회피 / 카운트)
-- =====================================================================
create or replace function is_thread_participant(p_thread uuid, p_user uuid)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from message_participants
    where thread_id = p_thread and user_id = p_user
  );
$$;

create or replace function is_thread_owner(p_thread uuid, p_user uuid)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from message_threads
    where id = p_thread and created_by = p_user
  );
$$;

-- 헤더 뱃지용 통합 안읽음 카운트
create or replace function unread_counts()
returns json
language sql
security definer
stable
set search_path = public, pg_temp
as $$
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
        or (a.scope = 'site'
            and a.site_id::text = (auth.jwt() -> 'user_metadata' ->> 'site_id'))
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
$$;

-- =====================================================================
-- 4. last_message_at 자동 갱신 트리거 (메시지 작성 시)
-- =====================================================================
create or replace function touch_thread_on_message()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update message_threads set last_message_at = new.created_at where id = new.thread_id;
  return new;
end;
$$;

drop trigger if exists trg_touch_thread on messages;
create trigger trg_touch_thread after insert on messages
  for each row execute function touch_thread_on_message();

-- announcements.updated_at 갱신
create or replace function touch_announcement_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists trg_touch_announcement on announcements;
create trigger trg_touch_announcement before update on announcements
  for each row execute function touch_announcement_updated_at();

-- =====================================================================
-- 5. RLS
-- =====================================================================
alter table message_threads enable row level security;
alter table message_participants enable row level security;
alter table messages enable row level security;
alter table announcements enable row level security;
alter table announcement_reads enable row level security;

-- message_threads
drop policy if exists mt_select on message_threads;
create policy mt_select on message_threads for select to authenticated
  using (is_thread_participant(id, auth.uid()) or created_by = auth.uid());

drop policy if exists mt_insert on message_threads;
create policy mt_insert on message_threads for insert to authenticated
  with check (created_by = auth.uid());

-- message_participants
drop policy if exists mp_select on message_participants;
create policy mp_select on message_participants for select to authenticated
  using (is_thread_participant(thread_id, auth.uid()));

drop policy if exists mp_insert on message_participants;
create policy mp_insert on message_participants for insert to authenticated
  with check (user_id = auth.uid() or is_thread_owner(thread_id, auth.uid()));

drop policy if exists mp_update on message_participants;
create policy mp_update on message_participants for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- messages
drop policy if exists msg_select on messages;
create policy msg_select on messages for select to authenticated
  using (is_thread_participant(thread_id, auth.uid()));

drop policy if exists msg_insert on messages;
create policy msg_insert on messages for insert to authenticated
  with check (sender_id = auth.uid() and is_thread_participant(thread_id, auth.uid()));

-- announcements (작성/수정/삭제는 admin만)
drop policy if exists ann_select on announcements;
create policy ann_select on announcements for select to authenticated
  using (
    scope = 'all'
    or (scope = 'site' and site_id::text = (auth.jwt() -> 'user_metadata' ->> 'site_id'))
    or (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

drop policy if exists ann_insert on announcements;
create policy ann_insert on announcements for insert to authenticated
  with check ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin' and created_by = auth.uid());

drop policy if exists ann_update on announcements;
create policy ann_update on announcements for update to authenticated
  using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

drop policy if exists ann_delete on announcements;
create policy ann_delete on announcements for delete to authenticated
  using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- announcement_reads (본인 것 + admin은 전체 조회 가능)
drop policy if exists ar_select on announcement_reads;
create policy ar_select on announcement_reads for select to authenticated
  using (user_id = auth.uid() or (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

drop policy if exists ar_insert on announcement_reads;
create policy ar_insert on announcement_reads for insert to authenticated
  with check (user_id = auth.uid());

-- SECURITY DEFINER 함수는 authenticated 만 실행 (anon 노출 차단)
revoke execute on function is_thread_participant(uuid,uuid) from anon, public;
revoke execute on function is_thread_owner(uuid,uuid) from anon, public;
revoke execute on function unread_counts() from anon, public;
grant execute on function is_thread_participant(uuid,uuid) to authenticated;
grant execute on function is_thread_owner(uuid,uuid) to authenticated;
grant execute on function unread_counts() to authenticated;

-- =====================================================================
-- 6. Realtime publication
-- =====================================================================
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='messages') then
    alter publication supabase_realtime add table messages;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='announcements') then
    alter publication supabase_realtime add table announcements;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='message_participants') then
    alter publication supabase_realtime add table message_participants;
  end if;
end $$;
