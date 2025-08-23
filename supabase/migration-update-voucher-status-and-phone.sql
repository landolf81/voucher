-- 교환권 상태 체계 및 phone 컬럼 추가 마이그레이션
-- 등록 -> 발행 -> 사용/회수/폐기 상태로 변경

-- 1. 먼저 phone 컬럼과 member_id 컬럼 추가 (필수 아님)
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS member_id text;

-- 2. 새로운 상태 enum으로 변경하기 전에 기존 데이터 처리
-- 현재 'issued' -> 'issued', 'used' -> 'used', 'canceled' -> 'canceled' 유지

-- 3. status 체크 제약조건 제거
ALTER TABLE vouchers DROP CONSTRAINT IF EXISTS vouchers_status_check;

-- 4. 새로운 상태 체크 제약조건 추가
-- 등록(registered) -> 발행(issued) -> 사용(used)/회수(recalled)/폐기(disposed)
ALTER TABLE vouchers ADD CONSTRAINT vouchers_status_check 
  CHECK (status IN ('registered', 'issued', 'used', 'recalled', 'disposed'));

-- 5. 회수 관련 컬럼 추가 (기존에 있을 수 있으니 IF NOT EXISTS 사용)
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS recalled_at timestamptz;
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS recalled_by_user_id uuid REFERENCES users(id);
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS recall_reason text;

-- 6. 폐기 관련 컬럼 추가
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS disposed_at timestamptz;
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS disposed_by_user_id uuid REFERENCES users(id);
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS disposal_reason text;

-- 7. 기존 데이터의 기본 상태 업데이트 (issued를 그대로 유지)
-- 데이터가 있다면 현재 'issued' 상태를 그대로 유지

-- 8. use_voucher_by_serial 함수 업데이트
CREATE OR REPLACE FUNCTION use_voucher_by_serial(p_serial text)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE v vouchers;
BEGIN
  SELECT * INTO v FROM vouchers WHERE serial_no = p_serial FOR UPDATE;
  IF NOT FOUND THEN
    RETURN null;
  END IF;
  -- 발행된 상태에서만 사용 가능
  IF v.status <> 'issued' THEN
    RETURN null;
  END IF;
  UPDATE vouchers
     SET status='used', used_at=NOW()
   WHERE id = v.id;
  INSERT INTO audit_logs(voucher_id, action, details)
  VALUES (v.id, 'use', json_build_object('serial_no', p_serial));
  RETURN json_build_object('serial_no', v.serial_no, 'used_at', NOW());
END;
$$;

-- 9. 교환권 회수 함수 추가
CREATE OR REPLACE FUNCTION recall_voucher_by_serial(
  p_serial text, 
  p_user_id uuid, 
  p_reason text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE v vouchers;
BEGIN
  SELECT * INTO v FROM vouchers WHERE serial_no = p_serial FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', '교환권을 찾을 수 없습니다.');
  END IF;
  -- 발행된 상태에서만 회수 가능
  IF v.status <> 'issued' THEN
    RETURN json_build_object('success', false, 'message', '발행된 교환권만 회수할 수 있습니다.');
  END IF;
  UPDATE vouchers
     SET status='recalled', 
         recalled_at=NOW(), 
         recalled_by_user_id=p_user_id,
         recall_reason=p_reason
   WHERE id = v.id;
  INSERT INTO audit_logs(voucher_id, action, actor_user_id, details)
  VALUES (v.id, 'recall', p_user_id, json_build_object(
    'serial_no', p_serial, 
    'reason', p_reason,
    'recalled_at', NOW()
  ));
  RETURN json_build_object('success', true, 'serial_no', v.serial_no, 'recalled_at', NOW());
END;
$$;

-- 10. 교환권 폐기 함수 추가
CREATE OR REPLACE FUNCTION dispose_voucher_by_serial(
  p_serial text, 
  p_user_id uuid, 
  p_reason text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE v vouchers;
BEGIN
  SELECT * INTO v FROM vouchers WHERE serial_no = p_serial FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', '교환권을 찾을 수 없습니다.');
  END IF;
  -- 발행되거나 회수된 상태에서 폐기 가능
  IF v.status NOT IN ('issued', 'recalled') THEN
    RETURN json_build_object('success', false, 'message', '발행되거나 회수된 교환권만 폐기할 수 있습니다.');
  END IF;
  UPDATE vouchers
     SET status='disposed', 
         disposed_at=NOW(), 
         disposed_by_user_id=p_user_id,
         disposal_reason=p_reason
   WHERE id = v.id;
  INSERT INTO audit_logs(voucher_id, action, actor_user_id, details)
  VALUES (v.id, 'dispose', p_user_id, json_build_object(
    'serial_no', p_serial, 
    'reason', p_reason,
    'disposed_at', NOW()
  ));
  RETURN json_build_object('success', true, 'serial_no', v.serial_no, 'disposed_at', NOW());
END;
$$;

-- 11. 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_vouchers_phone ON vouchers(phone);
CREATE INDEX IF NOT EXISTS idx_vouchers_member_id ON vouchers(member_id);
CREATE INDEX IF NOT EXISTS idx_vouchers_recalled_at ON vouchers(recalled_at);
CREATE INDEX IF NOT EXISTS idx_vouchers_disposed_at ON vouchers(disposed_at);

-- 12. 중복 제약조건 확인을 위한 쿼리 (실행 시 확인용)
-- SELECT column_name, is_nullable, data_type, character_maximum_length
-- FROM information_schema.columns 
-- WHERE table_name = 'vouchers' AND table_schema = 'public'
-- ORDER BY ordinal_position;

-- SELECT conname, contype, pg_get_constraintdef(oid) as definition
-- FROM pg_constraint 
-- WHERE conrelid = 'vouchers'::regclass
-- ORDER BY conname;