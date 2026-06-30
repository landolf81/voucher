-- Migration: 감정평가 요청 및 평가서 기록 게시판
-- Date: 2026-06-30
-- Purpose:
--   1) appraisals: 평가서(게시글) 1건. 대상물/물품·평가금액·평가자·평가일 + 본문(LLM 작성) + 첨부(사진/파일).
--   2) appraisal_comments: 직원 소통용 댓글.
--   3) appraisal_reads: 안읽음 뱃지 추적(공지와 동일 패턴).
--   - 전 직원 공유: SELECT 는 모든 authenticated. 작성/수정/삭제는 작성자 또는 admin.
--   - 에이전트(Hermes)는 서비스롤로 INSERT → RLS 우회. 사람도 직접 작성 가능.
--   - unread_counts() 에 appraisals 카운트 추가. Realtime publication 등록.
--   - 첨부 파일은 storage 버킷 'appraisals' (공개 읽기 / authenticated 업로드).

-- =====================================================================
-- 1. 테이블
-- =====================================================================
create table if not exists appraisals (
  id uuid primary key default gen_random_uuid(),
  title text not null,                              -- 글 제목(예: "○○ 중고 굴착기 감정")
  item_info text,                                   -- 대상물/물품 정보(종류·모델·상태 등)
  amount numeric,                                   -- 감정평가 금액(원)
  appraiser_name text,                              -- 평가자(사람 또는 'AI 감정')
  appraised_at date,                                -- 평가일
  body text,                                        -- 평가 본문(LLM 작성)
  attachments jsonb not null default '[]'::jsonb,   -- [{url, name, type}] 사진/파일
  status text not null default 'done' check (status in ('requested','in_progress','done')),
  created_by uuid references auth.users(id) on delete set null,
  created_by_name text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_appraisals_created on appraisals(created_at desc);

create table if not exists appraisal_comments (
  id uuid primary key default gen_random_uuid(),
  appraisal_id uuid not null references appraisals(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,
  author_name text,
  content text not null,
  created_at timestamptz default now()
);
create index if not exists idx_appraisal_comments on appraisal_comments(appraisal_id, created_at);

create table if not exists appraisal_reads (
  id uuid primary key default gen_random_uuid(),
  appraisal_id uuid not null references appraisals(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz default now(),
  unique (appraisal_id, user_id)
);
create index if not exists idx_appraisal_reads_user on appraisal_reads(user_id);

-- =====================================================================
-- 2. updated_at 갱신 트리거
-- =====================================================================
create or replace function touch_appraisal_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists trg_touch_appraisal on appraisals;
create trigger trg_touch_appraisal before update on appraisals
  for each row execute function touch_appraisal_updated_at();

-- =====================================================================
-- 3. unread_counts() 확장 (messages / announcements / appraisals)
-- =====================================================================
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
  ),
  apr as (
    select count(x.*)::int as c
    from appraisals x, me
    where not exists (
      select 1 from appraisal_reads r
      where r.appraisal_id = x.id and r.user_id = me.uid
    )
  )
  select json_build_object(
    'messages', (select c from msg),
    'announcements', (select c from ann),
    'appraisals', (select c from apr)
  );
$$;

revoke execute on function unread_counts() from anon, public;
grant execute on function unread_counts() to authenticated;

-- =====================================================================
-- 4. RLS
-- =====================================================================
alter table appraisals enable row level security;
alter table appraisal_comments enable row level security;
alter table appraisal_reads enable row level security;

-- appraisals: 전 직원 조회. 작성은 본인 명의. 수정/삭제는 작성자 또는 admin.
drop policy if exists apr_select on appraisals;
create policy apr_select on appraisals for select to authenticated
  using (true);

drop policy if exists apr_insert on appraisals;
create policy apr_insert on appraisals for insert to authenticated
  with check (created_by = auth.uid());

drop policy if exists apr_update on appraisals;
create policy apr_update on appraisals for update to authenticated
  using (created_by = auth.uid() or (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
  with check (created_by = auth.uid() or (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

drop policy if exists apr_delete on appraisals;
create policy apr_delete on appraisals for delete to authenticated
  using (created_by = auth.uid() or (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- appraisal_comments: 전 직원 조회. 작성은 본인 명의. 수정/삭제는 작성자 또는 admin.
drop policy if exists aprc_select on appraisal_comments;
create policy aprc_select on appraisal_comments for select to authenticated
  using (true);

drop policy if exists aprc_insert on appraisal_comments;
create policy aprc_insert on appraisal_comments for insert to authenticated
  with check (author_id = auth.uid());

drop policy if exists aprc_update on appraisal_comments;
create policy aprc_update on appraisal_comments for update to authenticated
  using (author_id = auth.uid() or (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
  with check (author_id = auth.uid() or (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

drop policy if exists aprc_delete on appraisal_comments;
create policy aprc_delete on appraisal_comments for delete to authenticated
  using (author_id = auth.uid() or (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- appraisal_reads: 본인 것 + admin 전체 조회. 작성은 본인 명의.
drop policy if exists aprr_select on appraisal_reads;
create policy aprr_select on appraisal_reads for select to authenticated
  using (user_id = auth.uid() or (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

drop policy if exists aprr_insert on appraisal_reads;
create policy aprr_insert on appraisal_reads for insert to authenticated
  with check (user_id = auth.uid());

-- =====================================================================
-- 5. Realtime publication
-- =====================================================================
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='appraisals') then
    alter publication supabase_realtime add table appraisals;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='appraisal_comments') then
    alter publication supabase_realtime add table appraisal_comments;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='appraisal_reads') then
    alter publication supabase_realtime add table appraisal_reads;
  end if;
end $$;

-- =====================================================================
-- 6. 첨부 파일 storage 버킷 (사진/평가서 PDF 등)
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('appraisals', 'appraisals', true)
on conflict (id) do nothing;

drop policy if exists "appraisals_read" on storage.objects;
create policy "appraisals_read" on storage.objects for select
  using (bucket_id = 'appraisals');

drop policy if exists "appraisals_write" on storage.objects;
create policy "appraisals_write" on storage.objects for insert to authenticated
  with check (bucket_id = 'appraisals');

drop policy if exists "appraisals_delete" on storage.objects;
create policy "appraisals_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'appraisals');
