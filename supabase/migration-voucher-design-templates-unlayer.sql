-- Unlayer 에디터 지원을 위한 voucher_design_templates 테이블 업데이트

-- 1. 이미지 URL을 선택적으로 변경
ALTER TABLE voucher_design_templates 
ALTER COLUMN a4_image_url DROP NOT NULL,
ALTER COLUMN mobile_image_url DROP NOT NULL;

-- 2. Unlayer 에디터 관련 필드 추가
ALTER TABLE voucher_design_templates
ADD COLUMN IF NOT EXISTS template_html text,
ADD COLUMN IF NOT EXISTS template_css text,
ADD COLUMN IF NOT EXISTS grapesjs_data jsonb,
ADD COLUMN IF NOT EXISTS mobile_template_html text,
ADD COLUMN IF NOT EXISTS mobile_template_css text,
ADD COLUMN IF NOT EXISTS mobile_grapesjs_data jsonb;

-- 3. 코멘트 추가
COMMENT ON COLUMN voucher_design_templates.template_html IS 'A4 템플릿 HTML (Unlayer 에디터)';
COMMENT ON COLUMN voucher_design_templates.template_css IS 'A4 템플릿 CSS (Unlayer 에디터)';
COMMENT ON COLUMN voucher_design_templates.grapesjs_data IS 'A4 템플릿 디자인 JSON (Unlayer 에디터)';
COMMENT ON COLUMN voucher_design_templates.mobile_template_html IS '모바일 템플릿 HTML (Unlayer 에디터)';
COMMENT ON COLUMN voucher_design_templates.mobile_template_css IS '모바일 템플릿 CSS (Unlayer 에디터)';
COMMENT ON COLUMN voucher_design_templates.mobile_grapesjs_data IS '모바일 템플릿 디자인 JSON (Unlayer 에디터)';