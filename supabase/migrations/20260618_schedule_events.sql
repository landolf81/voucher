-- Migration: 직원 일정관리 (팀 공유 캘린더)
-- Date: 2026-06-18
-- Purpose: 전체 공유 팀 캘린더 이벤트 테이블.
--   - 조회: 인증 사용자 전체
--   - 생성: 본인 명의
--   - 수정/삭제: 본인 것 또는 admin (auth.jwt의 user_metadata.role 사용)

create table if not exists schedule_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  start_at timestamptz not null,
  end_at timestamptz not null,
  all_day boolean default false,
  location text,
  color text default '#2563eb',
  created_by uuid references auth.users(id) on delete set null,
  created_by_name text,
  site_id uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_schedule_events_time on schedule_events(start_at, end_at);

alter table schedule_events enable row level security;

drop policy if exists schedule_select on schedule_events;
create policy schedule_select on schedule_events for select to authenticated using (true);

drop policy if exists schedule_insert on schedule_events;
create policy schedule_insert on schedule_events for insert to authenticated
  with check (created_by = auth.uid());

drop policy if exists schedule_update on schedule_events;
create policy schedule_update on schedule_events for update to authenticated
  using (created_by = auth.uid() or (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
  with check (created_by = auth.uid() or (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

drop policy if exists schedule_delete on schedule_events;
create policy schedule_delete on schedule_events for delete to authenticated
  using (created_by = auth.uid() or (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

create or replace function touch_schedule_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

drop trigger if exists trg_touch_schedule on schedule_events;
create trigger trg_touch_schedule before update on schedule_events
  for each row execute function touch_schedule_updated_at();

-- Realtime (프론트엔드 실시간 반영)
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='schedule_events') then
    alter publication supabase_realtime add table schedule_events;
  end if;
end $$;
