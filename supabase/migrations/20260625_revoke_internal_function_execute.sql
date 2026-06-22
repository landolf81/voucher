-- Migration: 내부/서버 전용 SECURITY DEFINER 함수의 anon/authenticated EXECUTE 회수 (2026-06-25)
-- Supabase advisor: anon/authenticated_security_definer_function_executable (WARN) 정리.
-- Voucher-dev 적용·검증 완료(멱등). service_role/postgres 권한은 유지 → 서버 .rpc() 정상.
--
-- 주의: 이 함수들은 EXECUTE 가 PUBLIC 롤에 부여돼 있어 anon/authenticated 가 PUBLIC 으로 상속받는다.
--       따라서 anon/authenticated 뿐 아니라 반드시 PUBLIC 에서도 회수해야 효과가 있다.
--       service_role 은 별도(명시) grant 가 있고, 안전을 위해 루프에서 다시 명시 grant 한다.
--
-- 대상:
--   (a) 트리거 함수: 정의자 권한으로 실행되므로 invoker EXECUTE 불필요.
--   (b) service_role 서버에서만 호출되는 RPC: use_voucher_*, update_voucher_status_atomic,
--       track_short_url_click, cleanup_*, delete_vouchers_by_template, log_activity, log_bulk_issue,
--       queue_sms_notification, migrate_user_to_auth (전부 SUPABASE_SERVICE_ROLE_KEY 로만 호출됨 — 코드 확인).
--
-- 유지(의도): is_admin/get_user_role/get_user_site_id (RLS 정책 평가용; 일부 정책이 TO public 이라 anon 도 필요),
--             is_thread_owner/is_thread_participant, unread_counts(브라우저 RPC) → 그대로 둠(해당 WARN 은 수용).

do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and (
        p.prorettype = 'pg_catalog.trigger'::regtype
        or p.proname in (
          'cleanup_expired_mobile_batches','cleanup_expired_short_urls',
          'delete_vouchers_by_template','log_bulk_issue','use_voucher_by_serial',
          'use_voucher_with_notification','update_voucher_status_atomic',
          'track_short_url_click','log_activity','queue_sms_notification'
        )
        or (p.proname = 'migrate_user_to_auth' and p.prorettype <> 'pg_catalog.trigger'::regtype)
      )
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', r.sig);
    execute format('grant execute on function %s to service_role', r.sig);
  end loop;
end $$;
