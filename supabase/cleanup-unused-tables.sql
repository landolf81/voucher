-- =============================================
-- DB 정리 스크립트: 사용하지 않는 테이블 삭제
-- 실행 전 반드시 백업하세요!
-- =============================================

-- =============================================
-- 1단계: 교환권 시스템과 무관한 테이블 삭제
-- (다른 프로젝트 기반에서 가져온 것으로 보임)
-- =============================================

-- 1.1 SNS/커뮤니티 관련 테이블
DROP TABLE IF EXISTS posts CASCADE;
DROP TABLE IF EXISTS comments CASCADE;
DROP TABLE IF EXISTS likes CASCADE;
DROP TABLE IF EXISTS post_tags CASCADE;
DROP TABLE IF EXISTS tags CASCADE;
DROP TABLE IF EXISTS tag_groups CASCADE;
DROP TABLE IF EXISTS tag_permissions CASCADE;
DROP TABLE IF EXISTS relationships CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS dm_attachments CASCADE;

-- 1.2 회원/사용자 관련 (auth.users로 대체됨)
DROP TABLE IF EXISTS members CASCADE;
DROP TABLE IF EXISTS member_overview CASCADE;
DROP TABLE IF EXISTS member_audit_logs CASCADE;
DROP TABLE IF EXISTS user_badges CASCADE;
DROP TABLE IF EXISTS badge_types CASCADE;
DROP TABLE IF EXISTS user_sanctions CASCADE;
DROP TABLE IF EXISTS admin_roles CASCADE;

-- 1.3 농업 관련 테이블
DROP TABLE IF EXISTS crops CASCADE;
DROP TABLE IF EXISTS farming_associations CASCADE;
DROP TABLE IF EXISTS grafting_schedules CASCADE;

-- 1.4 마켓/거래 관련 테이블
DROP TABLE IF EXISTS trade_items CASCADE;
DROP TABLE IF EXISTS market_alerts CASCADE;
DROP TABLE IF EXISTS ads CASCADE;

-- 1.5 신고/알림 관련 테이블
DROP TABLE IF EXISTS reports CASCADE;
DROP TABLE IF EXISTS report_categories CASCADE;
DROP TABLE IF EXISTS notification_logs CASCADE;
DROP TABLE IF EXISTS notification_preferences CASCADE;

-- 1.6 백업 테이블 (필요 없으면 삭제)
DROP TABLE IF EXISTS auth_users_backup_before_display_name CASCADE;

-- =============================================
-- 2단계: 정리 확인
-- =============================================

-- 남아있어야 할 테이블 (교환권 시스템 핵심 테이블)
-- ✅ sites - 사업장
-- ✅ vouchers - 교환권
-- ✅ voucher_templates - 교환권 템플릿
-- ✅ voucher_design_templates - 교환권 디자인 템플릿
-- ✅ audit_logs - 감사 로그
-- ✅ short_urls - 단축 URL
-- ✅ mobile_design_templates - 모바일 디자인 템플릿
-- ✅ mobile_voucher_batches - 모바일 바우처 배치
-- ✅ mobile_batch_vouchers - 모바일 배치 바우처
-- ✅ mobile_voucher_access_logs - 모바일 접근 로그
-- ✅ suspicious_voucher_access - 의심스러운 접근 로그

-- 남아있는 테이블 목록 확인
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- 예상 결과: 11개 테이블만 남아야 함
-- audit_logs, mobile_batch_vouchers, mobile_design_templates,
-- mobile_voucher_access_logs, mobile_voucher_batches, short_urls,
-- sites, suspicious_voucher_access, voucher_design_templates,
-- voucher_templates, vouchers
