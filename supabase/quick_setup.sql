-- ============================================
-- 빠른 설정 스크립트 (순서대로 실행)
-- ============================================

-- STEP 1: 기본 스키마 생성
-- ============================================
create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

-- 사업장 테이블
create table if not exists sites (
  id uuid primary key default gen_random_uuid(),
  site_name text not null
);

-- 사용자 테이블 (created_at 포함)
create table if not exists users (
  id uuid primary key default uuid_generate_v4(),
  user_id text unique,
  email text unique,
  phone text unique,
  name text,
  role text check (role in ('admin','staff')) default 'staff',
  site_id uuid references sites(id) on delete set null,
  created_at timestamptz default now()
);

-- 교환권 테이블
create table if not exists vouchers (
  id uuid primary key default gen_random_uuid(),
  serial_no text unique not null,
  amount numeric not null,
  association text not null,
  name text not null,
  dob date not null,
  status text not null default 'issued' check (status in ('issued','used','canceled')),
  issued_at timestamptz default now(),
  used_at timestamptz,
  used_by_user_id uuid references users(id),
  used_at_site_id uuid references sites(id),
  notes text
);

-- 감사 로그 테이블
create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  voucher_id uuid references vouchers(id),
  action text not null,
  actor_user_id uuid references users(id),
  site_id uuid references sites(id),
  created_at timestamptz default now(),
  details jsonb
);

-- 인덱스 생성
create index if not exists idx_vouchers_serial on vouchers(serial_no);
create index if not exists idx_vouchers_status on vouchers(status);
create index if not exists idx_vouchers_used_at on vouchers(used_at);

-- STEP 2: 초기 데이터 생성
-- ============================================

-- 사업장 데이터
INSERT INTO sites (id, site_name) VALUES
  ('11111111-1111-1111-1111-111111111111', '농협하나로마트 강남점'),
  ('22222222-2222-2222-2222-222222222222', '지역농산물판매소 서초점')
ON CONFLICT (id) DO UPDATE SET
  site_name = EXCLUDED.site_name;

-- 사용자 데이터
INSERT INTO users (id, user_id, email, phone, name, role, site_id) VALUES
  -- 관리자
  ('33333333-3333-3333-3333-333333333333', 
   'admin', 
   'admin@example.com', 
   '01087654321', 
   '관리자', 
   'admin', 
   '11111111-1111-1111-1111-111111111111'),
  
  -- 직원
  ('22222222-2222-2222-2222-222222222222', 
   'staff', 
   'staff@example.com', 
   '01023456789', 
   '직원 사용자', 
   'staff', 
   '11111111-1111-1111-1111-111111111111'),
  
  -- 조회용
  ('11111111-1111-1111-1111-111111111111', 
   'viewer', 
   'viewer@example.com', 
   '01012345678', 
   '조회 사용자', 
   'staff', 
   '11111111-1111-1111-1111-111111111111')
ON CONFLICT (id) DO UPDATE SET
  user_id = EXCLUDED.user_id,
  email = EXCLUDED.email,
  phone = EXCLUDED.phone,
  name = EXCLUDED.name,
  role = EXCLUDED.role,
  site_id = EXCLUDED.site_id;

-- STEP 3: 확인
-- ============================================

-- 테이블 생성 확인
SELECT 
  table_name,
  'created' as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('users', 'sites', 'vouchers', 'audit_logs')
ORDER BY table_name;

-- 사용자 데이터 확인
SELECT 
  'User created:' as message,
  user_id,
  phone,
  name,
  role
FROM users
ORDER BY role, user_id;

-- 사업장 데이터 확인
SELECT 
  'Site created:' as message,
  site_name
FROM sites;

-- RPC 함수 생성
-- ============================================
create or replace function use_voucher_by_serial(p_serial text)
returns json
language plpgsql
as $$
declare v vouchers;
begin
  select * into v from vouchers where serial_no = p_serial for update;
  if not found then
    return null;
  end if;
  if v.status <> 'issued' then
    return null;
  end if;
  update vouchers
     set status='used', used_at=now()
   where id = v.id;
  insert into audit_logs(voucher_id, action, details)
  values (v.id, 'use', json_build_object('serial_no', p_serial));
  return json_build_object('serial_no', v.serial_no, 'used_at', now());
end;
$$;