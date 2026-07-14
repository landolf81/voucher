-- =====================================================
-- touch_appraisal_updated_at search_path 고정
-- 2026-07-14
-- =====================================================
-- 배경: 20260630_appraisal_board.sql에서 생성한 트리거 함수
-- touch_appraisal_updated_at()에 search_path가 고정되지 않아
-- 보안 advisor WARN(function_search_path_mutable) 발생.
-- 20260624_advisor_hardening.sql의 다른 touch_* 함수들과 동일 패턴으로 고정.

alter function public.touch_appraisal_updated_at() set search_path = public, pg_temp;

-- =====================================================
-- appraisals 버킷 익명 목록 조회(listing) 차단
-- =====================================================
-- 배경: advisor WARN public_bucket_allows_listing.
-- public 버킷의 객체 다운로드(/object/public/... 경로)는 RLS를 타지 않으므로
-- SELECT 정책이 없어도 getPublicUrl 접근(모바일 첨부 이미지)은 그대로 동작한다.
-- appraisals_read SELECT 정책의 유일한 효과는 list API로 파일 경로(사용자 UUID·
-- 파일명 포함)를 익명 열람 가능하게 하는 것뿐이며, 앱은 .list()를 쓰지 않는다.
-- → 정책 자체를 제거 (authenticated로 제한해도 advisor WARN은 남음).
-- 추후 앱에서 storage.list()가 필요해지면 to authenticated 정책으로 재생성할 것.

drop policy if exists "appraisals_read" on storage.objects;
