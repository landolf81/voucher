create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

create table if not exists sites (
  id uuid primary key default gen_random_uuid(),
  site_name text not null
);

create table if not exists users (
  id uuid primary key default uuid_generate_v4(),
  email text unique,
  phone text unique,
  name text,
  role text check (role in ('admin','staff')) default 'staff',
  site_id uuid references sites(id) on delete set null
);

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

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  voucher_id uuid references vouchers(id),
  action text not null,
  actor_user_id uuid references users(id),
  site_id uuid references sites(id),
  created_at timestamptz default now(),
  details jsonb
);

create index if not exists idx_vouchers_serial on vouchers(serial_no);
create index if not exists idx_vouchers_status on vouchers(status);
create index if not exists idx_vouchers_used_at on vouchers(used_at);

-- Atomic "use voucher" RPC using serial
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
