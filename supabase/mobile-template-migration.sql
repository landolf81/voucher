-- Mobile Design Template System Migration
-- Creates tables and structures for mobile voucher template management

-- 1. Create voucher templates table (if it doesn't exist)
CREATE TABLE IF NOT EXISTS voucher_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_name TEXT NOT NULL,
  voucher_type TEXT DEFAULT 'standard',
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create mobile design templates table
CREATE TABLE IF NOT EXISTS mobile_design_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES voucher_templates(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  
  -- Design properties
  background_color TEXT DEFAULT '#ffffff',
  text_color TEXT DEFAULT '#000000',
  accent_color TEXT DEFAULT '#3b82f6',
  font_family TEXT DEFAULT 'Pretendard, sans-serif',
  font_size_base INTEGER DEFAULT 14,
  
  -- Layout properties
  width INTEGER DEFAULT 400,
  height INTEGER DEFAULT 400,
  padding INTEGER DEFAULT 20,
  border_radius INTEGER DEFAULT 12,
  
  -- Background image
  background_image_url TEXT,
  background_image_position TEXT DEFAULT 'center',
  background_image_size TEXT DEFAULT 'cover',
  
  -- Field positioning (JSON object)
  field_positions JSONB DEFAULT '{}',
  
  -- Template configuration
  template_config JSONB DEFAULT '{}',
  
  -- Status and metadata
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'draft')),
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(template_id) -- One mobile design per voucher template
);

-- 3. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_mobile_design_templates_template_id ON mobile_design_templates(template_id);
CREATE INDEX IF NOT EXISTS idx_mobile_design_templates_status ON mobile_design_templates(status);
CREATE INDEX IF NOT EXISTS idx_mobile_design_templates_is_default ON mobile_design_templates(is_default);
CREATE INDEX IF NOT EXISTS idx_voucher_templates_status ON voucher_templates(status);

-- 4. Add trigger to update updated_at
CREATE OR REPLACE FUNCTION update_mobile_template_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_mobile_template_updated_at
  BEFORE UPDATE ON mobile_design_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_mobile_template_updated_at();

CREATE TRIGGER trigger_update_voucher_template_updated_at
  BEFORE UPDATE ON voucher_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_mobile_template_updated_at();

-- 5. Insert default voucher template if none exists
INSERT INTO voucher_templates (voucher_name, voucher_type, status)
SELECT '기본 교환권 템플릿', 'standard', 'active'
WHERE NOT EXISTS (SELECT 1 FROM voucher_templates LIMIT 1);

-- 6. Insert default mobile design template
INSERT INTO mobile_design_templates (
  template_id,
  name,
  description,
  background_color,
  text_color,
  accent_color,
  field_positions,
  template_config,
  is_default
)
SELECT 
  vt.id,
  '기본 모바일 디자인',
  '깔끔하고 모던한 기본 모바일 교환권 디자인',
  '#ffffff',
  '#1f2937',
  '#3b82f6',
  '{
    "title": {"x": 200, "y": 40, "fontSize": 24, "fontWeight": "bold", "textAlign": "center"},
    "association": {"x": 200, "y": 70, "fontSize": 16, "textAlign": "center", "color": "#6b7280"},
    "amount": {"x": 200, "y": 140, "fontSize": 36, "fontWeight": "800", "textAlign": "center", "color": "#3b82f6"},
    "name": {"x": 80, "y": 200, "fontSize": 14, "fontWeight": "500"},
    "member_id": {"x": 80, "y": 225, "fontSize": 14},
    "issued_date": {"x": 80, "y": 250, "fontSize": 14},
    "serial_no": {"x": 200, "y": 320, "fontSize": 12, "fontFamily": "monospace", "textAlign": "center", "color": "#6b7280"},
    "qr_code": {"x": 200, "y": 280, "width": 80, "height": 80}
  }'::jsonb,
  '{
    "showBorder": true,
    "showShadow": true,
    "gradientBackground": false,
    "showLogo": false
  }'::jsonb,
  true
FROM voucher_templates vt
WHERE NOT EXISTS (SELECT 1 FROM mobile_design_templates LIMIT 1)
LIMIT 1;

-- 7. Add audit log entry
INSERT INTO audit_logs (action, details, created_at)
VALUES ('mobile_template_system_setup', 
        json_build_object(
          'migration_version', '1.0.0',
          'tables_created', ARRAY['voucher_templates', 'mobile_design_templates'],
          'default_templates_created', true
        ), 
        NOW());