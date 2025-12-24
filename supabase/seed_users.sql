-- ============================================
-- 초기 사용자 데이터 시드 (테스트용)
-- ============================================

-- 1. 사업장 데이터 추가
INSERT INTO sites (id, site_name) VALUES
  ('11111111-1111-1111-1111-111111111111', '농협하나로마트 강남점'),
  ('22222222-2222-2222-2222-222222222222', '지역농산물판매소 서초점')
ON CONFLICT (id) DO NOTHING;

-- 2. 사용자 데이터 추가
INSERT INTO users (id, email, phone, name, role, site_id) VALUES
  -- 관리자 계정
  ('33333333-3333-3333-3333-333333333333', 
   'admin@example.com', 
   '01087654321', 
   '관리자', 
   'admin', 
   '11111111-1111-1111-1111-111111111111'),
  
  -- 직원 계정
  ('22222222-2222-2222-2222-222222222222', 
   'staff@example.com', 
   '01023456789', 
   '직원 사용자', 
   'staff', 
   '11111111-1111-1111-1111-111111111111'),
  
  -- 조회 전용 계정
  ('11111111-1111-1111-1111-111111111111', 
   'viewer@example.com', 
   '01012345678', 
   '조회 사용자', 
   'staff', 
   '11111111-1111-1111-1111-111111111111')
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  phone = EXCLUDED.phone,
  name = EXCLUDED.name,
  role = EXCLUDED.role,
  site_id = EXCLUDED.site_id;

-- 3. auth.users에도 동일한 사용자 추가 (Supabase Auth 사용 시)
-- 주의: 이 부분은 Supabase Dashboard에서 수동으로 추가하거나
-- Supabase Auth Admin API를 사용해야 할 수 있습니다.

-- 4. 사용자 확인
SELECT 
  u.id,
  u.email,
  u.phone,
  u.name,
  u.role,
  s.site_name
FROM users u
LEFT JOIN sites s ON u.site_id = s.id
ORDER BY u.role, u.name;

-- 5. 테스트용 로그인 정보 출력
SELECT 
  '테스트 계정 정보' as title,
  'admin' as user_id,
  '01087654321' as phone,
  'admin' as role
UNION ALL
SELECT 
  '',
  'staff' as user_id,
  '01023456789' as phone,
  'staff' as role
UNION ALL
SELECT 
  '',
  'viewer' as user_id,
  '01012345678' as phone,
  'viewer' as role;