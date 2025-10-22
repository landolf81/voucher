-- Fix audit_logs foreign key to allow cascade deletion
-- This allows vouchers to be deleted along with their audit logs

-- Drop existing constraint
ALTER TABLE audit_logs
DROP CONSTRAINT IF EXISTS audit_logs_voucher_id_fkey;

-- Add new constraint with ON DELETE CASCADE
ALTER TABLE audit_logs
ADD CONSTRAINT audit_logs_voucher_id_fkey
FOREIGN KEY (voucher_id) REFERENCES vouchers(id)
ON DELETE CASCADE;

-- Verify the constraint
SELECT
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    rc.delete_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints AS rc
    ON rc.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name = 'audit_logs'
    AND kcu.column_name = 'voucher_id';
