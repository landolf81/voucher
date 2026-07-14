-- =====================================================================
-- 감정평가 게시판 RLS: user_metadata 참조 → public.is_admin() 교체
-- =====================================================================
-- 배경: 20260630_appraisal_board.sql이 admin 판별에
--   (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
-- 패턴을 사용해 보안 advisor ERROR(rls_references_user_metadata) 5건 재발.
-- user_metadata는 사용자가 supabase.auth.updateUser()로 직접 수정할 수
-- 있어 권한 위조가 가능하므로, 20260623_role_to_app_metadata.sql에서
-- 도입한 app_metadata 기반 public.is_admin() 헬퍼로 교체한다.
-- 대상: appraisals(apr_update, apr_delete),
--       appraisal_comments(aprc_update, aprc_delete),
--       appraisal_reads(aprr_select)

do $$ begin if to_regclass('public.appraisals') is not null then
  drop policy if exists apr_update on public.appraisals;
  create policy apr_update on public.appraisals for update to authenticated
    using (created_by = auth.uid() or public.is_admin())
    with check (created_by = auth.uid() or public.is_admin());

  drop policy if exists apr_delete on public.appraisals;
  create policy apr_delete on public.appraisals for delete to authenticated
    using (created_by = auth.uid() or public.is_admin());
end if; end $$;

do $$ begin if to_regclass('public.appraisal_comments') is not null then
  drop policy if exists aprc_update on public.appraisal_comments;
  create policy aprc_update on public.appraisal_comments for update to authenticated
    using (author_id = auth.uid() or public.is_admin())
    with check (author_id = auth.uid() or public.is_admin());

  drop policy if exists aprc_delete on public.appraisal_comments;
  create policy aprc_delete on public.appraisal_comments for delete to authenticated
    using (author_id = auth.uid() or public.is_admin());
end if; end $$;

do $$ begin if to_regclass('public.appraisal_reads') is not null then
  drop policy if exists aprr_select on public.appraisal_reads;
  create policy aprr_select on public.appraisal_reads for select to authenticated
    using (user_id = auth.uid() or public.is_admin());
end if; end $$;
