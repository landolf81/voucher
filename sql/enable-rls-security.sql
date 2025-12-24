-- Row Level Security (RLS) 정책 활성화 스크립트
-- 배포 전 필수 보안 설정

-- 1. sites 테이블 RLS 활성화 및 정책 설정
ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;

-- sites 테이블 정책: 인증된 사용자는 모든 사업장 조회 가능, 관리자만 수정 가능
CREATE POLICY "Allow authenticated users to view sites" ON public.sites
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow admin users to manage sites" ON public.sites
    FOR ALL USING (
        auth.role() = 'authenticated' AND 
        EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE user_id = auth.uid()::text 
            AND role = 'admin'
        )
    );

-- 2. user_profiles 테이블 RLS 활성화 및 정책 설정
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- user_profiles 테이블 정책: 본인 프로필 조회/수정, 관리자는 모든 프로필 관리
CREATE POLICY "Users can view own profile" ON public.user_profiles
    FOR SELECT USING (user_id = auth.uid()::text);

CREATE POLICY "Users can update own profile" ON public.user_profiles
    FOR UPDATE USING (user_id = auth.uid()::text);

CREATE POLICY "Admin can manage all profiles" ON public.user_profiles
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE user_id = auth.uid()::text 
            AND role = 'admin'
        )
    );

-- 3. vouchers 테이블 RLS 활성화 및 정책 설정
ALTER TABLE public.vouchers ENABLE ROW LEVEL SECURITY;

-- vouchers 테이블 정책: 사이트별 접근 권한
CREATE POLICY "Users can view vouchers from their site" ON public.vouchers
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles up
            JOIN public.voucher_templates vt ON vt.site_id = up.site_id
            WHERE up.user_id = auth.uid()::text 
            AND vt.id = vouchers.template_id
        )
        OR 
        EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE user_id = auth.uid()::text 
            AND role = 'admin'
        )
    );

CREATE POLICY "Staff can manage vouchers from their site" ON public.vouchers
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles up
            JOIN public.voucher_templates vt ON vt.site_id = up.site_id
            WHERE up.user_id = auth.uid()::text 
            AND vt.id = vouchers.template_id
            AND up.role IN ('admin', 'staff')
        )
        OR 
        EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE user_id = auth.uid()::text 
            AND role = 'admin'
        )
    );

-- 4. audit_logs 테이블 RLS 활성화 및 정책 설정
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- audit_logs 테이블 정책: 관리자만 접근, 일반 사용자는 본인 액션만 조회
CREATE POLICY "Users can view own audit logs" ON public.audit_logs
    FOR SELECT USING (
        user_id = auth.uid()::text
        OR 
        EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE user_id = auth.uid()::text 
            AND role = 'admin'
        )
    );

CREATE POLICY "System can insert audit logs" ON public.audit_logs
    FOR INSERT WITH CHECK (true);

-- 5. mobile_voucher_batches 테이블 RLS 활성화 및 정책 설정
ALTER TABLE public.mobile_voucher_batches ENABLE ROW LEVEL SECURITY;

-- mobile_voucher_batches 테이블 정책: 생성자 또는 같은 사이트 사용자만 접근
CREATE POLICY "Users can view mobile batches from their site" ON public.mobile_voucher_batches
    FOR SELECT USING (
        user_id = auth.uid()::text
        OR 
        EXISTS (
            SELECT 1 FROM public.user_profiles up1
            JOIN public.user_profiles up2 ON up1.site_id = up2.site_id
            WHERE up1.user_id = auth.uid()::text 
            AND up2.user_id = mobile_voucher_batches.user_id
        )
        OR 
        EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE user_id = auth.uid()::text 
            AND role = 'admin'
        )
    );

CREATE POLICY "Staff can manage mobile batches" ON public.mobile_voucher_batches
    FOR ALL USING (
        user_id = auth.uid()::text
        OR 
        EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE user_id = auth.uid()::text 
            AND role IN ('admin', 'staff')
        )
    );

-- 6. mobile_batch_vouchers 테이블 RLS 활성화 및 정책 설정
ALTER TABLE public.mobile_batch_vouchers ENABLE ROW LEVEL SECURITY;

-- mobile_batch_vouchers 테이블 정책: 배치 접근 권한과 동일
CREATE POLICY "Users can view mobile batch vouchers" ON public.mobile_batch_vouchers
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.mobile_voucher_batches mvb
            JOIN public.user_profiles up1 ON mvb.user_id = up1.user_id
            JOIN public.user_profiles up2 ON up1.site_id = up2.site_id
            WHERE mvb.id = mobile_batch_vouchers.batch_id
            AND up2.user_id = auth.uid()::text
        )
        OR 
        EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE user_id = auth.uid()::text 
            AND role = 'admin'
        )
    );

CREATE POLICY "Staff can manage mobile batch vouchers" ON public.mobile_batch_vouchers
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE user_id = auth.uid()::text 
            AND role IN ('admin', 'staff')
        )
    );

-- 7. mobile_design_templates 테이블 RLS 활성화 및 정책 설정
ALTER TABLE public.mobile_design_templates ENABLE ROW LEVEL SECURITY;

-- mobile_design_templates 테이블 정책: 템플릿 소유자 사이트 기반 접근
CREATE POLICY "Users can view mobile design templates" ON public.mobile_design_templates
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.voucher_templates vt
            JOIN public.user_profiles up ON vt.site_id = up.site_id
            WHERE vt.id = mobile_design_templates.template_id
            AND up.user_id = auth.uid()::text
        )
        OR 
        EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE user_id = auth.uid()::text 
            AND role = 'admin'
        )
    );

CREATE POLICY "Staff can manage mobile design templates" ON public.mobile_design_templates
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.voucher_templates vt
            JOIN public.user_profiles up ON vt.site_id = up.site_id
            WHERE vt.id = mobile_design_templates.template_id
            AND up.user_id = auth.uid()::text
            AND up.role IN ('admin', 'staff')
        )
        OR 
        EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE user_id = auth.uid()::text 
            AND role = 'admin'
        )
    );

-- 공개 접근이 필요한 기능을 위한 추가 정책들

-- 모바일 교환권 조회 (토큰 기반 공개 접근)
CREATE POLICY "Public access to vouchers via mobile token" ON public.vouchers
    FOR SELECT USING (mobile_link_token IS NOT NULL);

-- 모바일 배치 공개 접근 (링크 토큰 기반)
CREATE POLICY "Public access to mobile batches via link token" ON public.mobile_voucher_batches
    FOR SELECT USING (link_token IS NOT NULL);

-- 배치 교환권 연결 테이블 공개 접근
CREATE POLICY "Public access to batch vouchers for mobile" ON public.mobile_batch_vouchers
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.mobile_voucher_batches mvb
            WHERE mvb.id = mobile_batch_vouchers.batch_id
            AND mvb.link_token IS NOT NULL
        )
    );

COMMENT ON TABLE public.sites IS 'RLS enabled - 사업장 정보 테이블';
COMMENT ON TABLE public.user_profiles IS 'RLS enabled - 사용자 프로필 테이블';
COMMENT ON TABLE public.vouchers IS 'RLS enabled - 교환권 테이블';
COMMENT ON TABLE public.audit_logs IS 'RLS enabled - 감사 로그 테이블';
COMMENT ON TABLE public.mobile_voucher_batches IS 'RLS enabled - 모바일 교환권 배치 테이블';
COMMENT ON TABLE public.mobile_batch_vouchers IS 'RLS enabled - 모바일 배치 교환권 연결 테이블';
COMMENT ON TABLE public.mobile_design_templates IS 'RLS enabled - 모바일 디자인 템플릿 테이블';