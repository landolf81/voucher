-- 테스트 사이트 데이터
INSERT INTO sites (id, site_name) VALUES 
  ('11111111-1111-1111-1111-111111111111', '테스트 매장')
ON CONFLICT (id) DO NOTHING;

-- 테스트 사용자 데이터
INSERT INTO users (id, phone, name, role, site_id) VALUES 
  ('22222222-2222-2222-2222-222222222222', '01012345678', '테스트 사용자', 'staff', '11111111-1111-1111-1111-111111111111')
ON CONFLICT (phone) DO NOTHING;

-- 관리자 사용자 추가
INSERT INTO users (id, phone, name, role, site_id) VALUES 
  ('33333333-3333-3333-3333-333333333333', '01087654321', '관리자', 'admin', '11111111-1111-1111-1111-111111111111')
ON CONFLICT (phone) DO NOTHING;