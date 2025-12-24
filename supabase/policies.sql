alter table vouchers enable row level security;
alter table audit_logs enable row level security;
alter table users enable row level security;
alter table sites enable row level security;

create policy "voucher_read_all_auth" on vouchers for select
  to authenticated using (true);

create policy "voucher_update_admin" on vouchers for update
  to authenticated using (exists (select 1 from users u where u.id = auth.uid() and u.role = 'admin'));

create policy "audit_read_admin" on audit_logs for select
  to authenticated using (exists (select 1 from users u where u.id = auth.uid() and u.role = 'admin'));
