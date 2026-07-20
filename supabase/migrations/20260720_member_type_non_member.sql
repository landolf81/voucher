-- Migration: 비조합원(부녀회장·영농회장 등)도 조합원 대장에서 함께 관리
-- Applied: 2026-07-20 (Supabase MCP apply_migration: member_type_non_member)

-- 구분 필드 추가
ALTER TABLE members ADD COLUMN IF NOT EXISTS member_type TEXT NOT NULL DEFAULT '조합원';

ALTER TABLE members DROP CONSTRAINT IF EXISTS members_member_type_check;
ALTER TABLE members ADD CONSTRAINT members_member_type_check
  CHECK (member_type IN ('조합원', '비조합원'));

COMMENT ON COLUMN members.member_type IS '조합원 | 비조합원 (비조합원 영농회장·부녀회장 등 인물 관리용)';

-- 비조합원은 조합원번호·생년월일이 없을 수 있음
ALTER TABLE members ALTER COLUMN member_id DROP NOT NULL;
ALTER TABLE members ALTER COLUMN date_of_birth DROP NOT NULL;

-- 목록 뷰에 member_type 노출 (security_invoker 유지)
CREATE OR REPLACE VIEW members_list_view WITH (security_invoker = true) AS
SELECT m.id,
    m.site_id,
    m.name,
    m.member_id,
    m.security_number,
    m.date_of_birth,
    m.phone,
    m.address,
    m.main_crop_id,
    m.main_crop_name,
    m.sub_crop_id,
    m.sub_crop_name,
    m.grafting_workplace_address,
    m.grafting_workplace_lat,
    m.grafting_workplace_lng,
    m.join_date,
    m.leave_date,
    m.is_active,
    m.created_at,
    m.updated_at,
    m.created_by,
    m.updated_by,
    m.association_id,
    m.gender,
    a.name AS association_name,
    CASE
        WHEN a.short_code ~ '^\d+$'::text THEN a.short_code::integer
        ELSE 999999
    END AS association_code,
    s.site_name,
    m.member_type
FROM members m
    LEFT JOIN associations a ON a.id = m.association_id
    LEFT JOIN sites s ON s.id = m.site_id;
