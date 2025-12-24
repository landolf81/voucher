-- =====================================================
-- RLS 보안 문제 수정 마이그레이션
-- 생성일: 2024-12-24
--
-- 이 프로젝트는 user_profiles 테이블 대신
-- auth.users의 raw_user_meta_data를 사용합니다.
-- =====================================================

-- =====================================================
-- 0. Helper 함수 생성 (user_metadata에서 role 조회)
-- public 스키마에 생성 (auth 스키마는 권한 없음)
-- =====================================================

-- 현재 사용자의 role 조회 함수
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()),
    'viewer'
  );
$$;

-- 현재 사용자의 site_id 조회 함수
CREATE OR REPLACE FUNCTION public.get_user_site_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (raw_user_meta_data->>'site_id')::UUID
  FROM auth.users
  WHERE id = auth.uid();
$$;

-- 관리자 여부 확인 함수
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.get_user_role() IN ('super_admin', 'admin');
$$;

-- =====================================================
-- 1. RLS 활성화 (비활성화된 테이블들)
-- =====================================================

-- sites 테이블 RLS 활성화 (정책은 이미 존재함)
ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;

-- vouchers 테이블 RLS 활성화
ALTER TABLE public.vouchers ENABLE ROW LEVEL SECURITY;

-- audit_logs 테이블 RLS 활성화
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- mobile_design_templates 테이블 RLS 활성화
ALTER TABLE public.mobile_design_templates ENABLE ROW LEVEL SECURITY;

-- mobile_voucher_batches 테이블 RLS 활성화
ALTER TABLE public.mobile_voucher_batches ENABLE ROW LEVEL SECURITY;

-- mobile_batch_vouchers 테이블 RLS 활성화
ALTER TABLE public.mobile_batch_vouchers ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 2. RLS 정책 생성 (vouchers 테이블)
-- 주의: vouchers 테이블에는 site_id가 없고 used_at_site_id만 있음
-- association 기반으로 접근 제어하거나, 인증된 사용자 모두 접근 허용
-- =====================================================

-- 기존 정책 삭제 (있을 경우)
DROP POLICY IF EXISTS "vouchers_select_policy" ON public.vouchers;
DROP POLICY IF EXISTS "vouchers_insert_policy" ON public.vouchers;
DROP POLICY IF EXISTS "vouchers_update_policy" ON public.vouchers;
DROP POLICY IF EXISTS "vouchers_delete_policy" ON public.vouchers;

-- 인증된 사용자는 모든 바우처 조회 가능
CREATE POLICY "vouchers_select_policy" ON public.vouchers
    FOR SELECT
    USING (auth.role() = 'authenticated');

-- 인증된 사용자는 바우처 생성 가능
CREATE POLICY "vouchers_insert_policy" ON public.vouchers
    FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

-- 인증된 사용자는 바우처 수정 가능
CREATE POLICY "vouchers_update_policy" ON public.vouchers
    FOR UPDATE
    USING (auth.role() = 'authenticated');

-- 삭제는 관리자만 가능
CREATE POLICY "vouchers_delete_policy" ON public.vouchers
    FOR DELETE
    USING (
        auth.role() = 'authenticated' AND public.is_admin()
    );

-- =====================================================
-- 3. RLS 정책 생성 (audit_logs 테이블)
-- =====================================================

DROP POLICY IF EXISTS "audit_logs_select_policy" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_insert_policy" ON public.audit_logs;

-- 관리자만 감사 로그 조회 가능
CREATE POLICY "audit_logs_select_policy" ON public.audit_logs
    FOR SELECT
    USING (
        auth.role() = 'authenticated' AND public.is_admin()
    );

-- 인증된 사용자는 로그 생성 가능 (시스템에서 자동 생성)
CREATE POLICY "audit_logs_insert_policy" ON public.audit_logs
    FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

-- =====================================================
-- 4. RLS 정책 생성 (mobile_design_templates 테이블)
-- =====================================================

DROP POLICY IF EXISTS "mobile_design_templates_select_policy" ON public.mobile_design_templates;
DROP POLICY IF EXISTS "mobile_design_templates_insert_policy" ON public.mobile_design_templates;
DROP POLICY IF EXISTS "mobile_design_templates_update_policy" ON public.mobile_design_templates;
DROP POLICY IF EXISTS "mobile_design_templates_delete_policy" ON public.mobile_design_templates;

-- 모든 인증된 사용자가 템플릿 조회 가능
CREATE POLICY "mobile_design_templates_select_policy" ON public.mobile_design_templates
    FOR SELECT
    USING (auth.role() = 'authenticated');

-- 관리자만 템플릿 생성/수정/삭제 가능
CREATE POLICY "mobile_design_templates_insert_policy" ON public.mobile_design_templates
    FOR INSERT
    WITH CHECK (
        auth.role() = 'authenticated' AND public.is_admin()
    );

CREATE POLICY "mobile_design_templates_update_policy" ON public.mobile_design_templates
    FOR UPDATE
    USING (
        auth.role() = 'authenticated' AND public.is_admin()
    );

CREATE POLICY "mobile_design_templates_delete_policy" ON public.mobile_design_templates
    FOR DELETE
    USING (
        auth.role() = 'authenticated' AND public.is_admin()
    );

-- =====================================================
-- 5. RLS 정책 생성 (mobile_voucher_batches 테이블)
-- =====================================================

DROP POLICY IF EXISTS "mobile_voucher_batches_select_policy" ON public.mobile_voucher_batches;
DROP POLICY IF EXISTS "mobile_voucher_batches_insert_policy" ON public.mobile_voucher_batches;
DROP POLICY IF EXISTS "mobile_voucher_batches_update_policy" ON public.mobile_voucher_batches;
DROP POLICY IF EXISTS "mobile_voucher_batches_delete_policy" ON public.mobile_voucher_batches;

CREATE POLICY "mobile_voucher_batches_select_policy" ON public.mobile_voucher_batches
    FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "mobile_voucher_batches_insert_policy" ON public.mobile_voucher_batches
    FOR INSERT
    WITH CHECK (
        auth.role() = 'authenticated' AND public.is_admin()
    );

CREATE POLICY "mobile_voucher_batches_update_policy" ON public.mobile_voucher_batches
    FOR UPDATE
    USING (
        auth.role() = 'authenticated' AND public.is_admin()
    );

CREATE POLICY "mobile_voucher_batches_delete_policy" ON public.mobile_voucher_batches
    FOR DELETE
    USING (
        auth.role() = 'authenticated' AND public.is_admin()
    );

-- =====================================================
-- 6. RLS 정책 생성 (mobile_batch_vouchers 테이블)
-- =====================================================

DROP POLICY IF EXISTS "mobile_batch_vouchers_select_policy" ON public.mobile_batch_vouchers;
DROP POLICY IF EXISTS "mobile_batch_vouchers_insert_policy" ON public.mobile_batch_vouchers;
DROP POLICY IF EXISTS "mobile_batch_vouchers_update_policy" ON public.mobile_batch_vouchers;
DROP POLICY IF EXISTS "mobile_batch_vouchers_delete_policy" ON public.mobile_batch_vouchers;

CREATE POLICY "mobile_batch_vouchers_select_policy" ON public.mobile_batch_vouchers
    FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "mobile_batch_vouchers_insert_policy" ON public.mobile_batch_vouchers
    FOR INSERT
    WITH CHECK (
        auth.role() = 'authenticated' AND public.is_admin()
    );

CREATE POLICY "mobile_batch_vouchers_update_policy" ON public.mobile_batch_vouchers
    FOR UPDATE
    USING (
        auth.role() = 'authenticated' AND public.is_admin()
    );

CREATE POLICY "mobile_batch_vouchers_delete_policy" ON public.mobile_batch_vouchers
    FOR DELETE
    USING (
        auth.role() = 'authenticated' AND public.is_admin()
    );

-- =====================================================
-- 7. SECURITY DEFINER 뷰 수정
-- =====================================================

-- suspicious_voucher_access 뷰를 SECURITY INVOKER로 변경
-- vouchers 테이블: created_at이 없고 issued_at 사용
DROP VIEW IF EXISTS public.suspicious_voucher_access;
CREATE VIEW public.suspicious_voucher_access
WITH (security_invoker = true)
AS
SELECT
    v.id,
    v.serial_no,
    v.status,
    v.issued_at,
    v.used_at,
    v.used_at_site_id
FROM public.vouchers v
WHERE v.status = 'used'
AND v.used_at IS NOT NULL
AND v.used_at < v.issued_at;

-- member_overview 뷰 삭제 (user_profiles 테이블이 없으므로)
-- 이 프로젝트는 auth.users의 user_metadata를 사용함
DROP VIEW IF EXISTS public.member_overview;

-- =====================================================
-- 8. Service Role 우회 정책 (API 서버용)
-- =====================================================
-- 주의: service_role 키를 사용하는 서버 측 요청은 RLS를 우회합니다.
-- 이는 정상적인 동작이며, API 엔드포인트에서 service_role을 사용할 때
-- 추가적인 권한 검증을 수행해야 합니다.

COMMENT ON TABLE public.vouchers IS 'RLS enabled. Service role bypasses RLS for API operations.';
COMMENT ON TABLE public.audit_logs IS 'RLS enabled. Only admins can view, authenticated users can insert.';
COMMENT ON TABLE public.mobile_design_templates IS 'RLS enabled. Authenticated users can view, admins can modify.';
COMMENT ON TABLE public.mobile_voucher_batches IS 'RLS enabled. Authenticated users can view, admins can modify.';
COMMENT ON TABLE public.mobile_batch_vouchers IS 'RLS enabled. Authenticated users can view, admins can modify.';
