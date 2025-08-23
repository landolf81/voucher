-- Minimal script to drop users table
-- Execute this in Supabase SQL Editor

-- 1. Remove foreign key constraints
ALTER TABLE vouchers DROP CONSTRAINT IF EXISTS vouchers_used_by_user_id_fkey;
ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_actor_user_id_fkey;
ALTER TABLE vouchers DROP CONSTRAINT IF EXISTS vouchers_recalled_by_user_id_fkey;

-- 2. Add new constraints pointing to user_profiles
ALTER TABLE vouchers ADD CONSTRAINT vouchers_used_by_user_id_fkey FOREIGN KEY (used_by_user_id) REFERENCES user_profiles(id);
ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES user_profiles(id);

-- 3. Drop users table
DROP TABLE IF EXISTS users CASCADE;

-- 4. Verify deletion
SELECT CASE 
  WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users' AND table_schema = 'public') 
  THEN 'users table still exists'
  ELSE 'users table successfully deleted'
END as result;