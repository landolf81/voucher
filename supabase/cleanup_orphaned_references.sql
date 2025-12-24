ALTER TABLE vouchers DROP CONSTRAINT IF EXISTS vouchers_used_by_user_id_fkey;

ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_actor_user_id_fkey;

ALTER TABLE vouchers DROP CONSTRAINT IF EXISTS vouchers_recalled_by_user_id_fkey;

DELETE FROM audit_logs WHERE actor_user_id IS NOT NULL AND actor_user_id NOT IN (SELECT id FROM user_profiles);

DELETE FROM vouchers WHERE used_by_user_id IS NOT NULL AND used_by_user_id NOT IN (SELECT id FROM user_profiles);

DROP TABLE IF EXISTS users CASCADE;

ALTER TABLE vouchers ADD CONSTRAINT vouchers_used_by_user_id_fkey FOREIGN KEY (used_by_user_id) REFERENCES user_profiles(id);

ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES user_profiles(id);