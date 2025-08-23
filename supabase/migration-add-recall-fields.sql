-- 교환권 회수 기능을 위한 데이터베이스 스키마 업데이트

-- vouchers 테이블에 recalled 상태 추가
ALTER TABLE vouchers 
DROP CONSTRAINT IF EXISTS vouchers_status_check;

ALTER TABLE vouchers 
ADD CONSTRAINT vouchers_status_check 
CHECK (status in ('issued','used','canceled','recalled'));

-- vouchers 테이블에 회수 관련 필드 추가
ALTER TABLE vouchers 
ADD COLUMN IF NOT EXISTS recalled_at timestamptz,
ADD COLUMN IF NOT EXISTS recalled_by_user_id uuid references users(id),
ADD COLUMN IF NOT EXISTS recalled_at_site_id uuid references sites(id),
ADD COLUMN IF NOT EXISTS recall_method text check (recall_method in ('manual','barcode','qrcode'));

-- 회수 관련 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_vouchers_recalled_at ON vouchers(recalled_at);
CREATE INDEX IF NOT EXISTS idx_vouchers_recalled_by ON vouchers(recalled_by_user_id);
CREATE INDEX IF NOT EXISTS idx_vouchers_recall_method ON vouchers(recall_method);

-- 회수 기록을 위한 audit_logs 개선
ALTER TABLE audit_logs 
ADD COLUMN IF NOT EXISTS recall_method text,
ADD COLUMN IF NOT EXISTS recall_reason text;

-- 회수된 교환권 조회를 위한 뷰 생성
CREATE OR REPLACE VIEW recalled_vouchers_view AS
SELECT 
  v.id,
  v.serial_no,
  v.amount,
  v.association,
  v.name,
  v.status,
  v.issued_at,
  v.recalled_at,
  v.recall_method,
  u.name as recalled_by_name,
  s.site_name as recalled_at_site,
  v.notes
FROM vouchers v
LEFT JOIN users u ON v.recalled_by_user_id = u.id
LEFT JOIN sites s ON v.recalled_at_site_id = s.id
WHERE v.status = 'recalled'
ORDER BY v.recalled_at DESC;

-- 교환권 상태별 통계를 위한 뷰 생성
CREATE OR REPLACE VIEW voucher_status_stats AS
SELECT 
  status,
  COUNT(*) as count,
  SUM(amount) as total_amount
FROM vouchers 
GROUP BY status;

-- 회수 방법별 통계를 위한 뷰 생성
CREATE OR REPLACE VIEW recall_method_stats AS
SELECT 
  recall_method,
  COUNT(*) as count,
  SUM(amount) as total_amount
FROM vouchers 
WHERE status = 'recalled' AND recall_method IS NOT NULL
GROUP BY recall_method;

-- 감사 로그 테이블 확장
ALTER TABLE audit_logs 
ADD COLUMN IF NOT EXISTS ip_address text,
ADD COLUMN IF NOT EXISTS user_agent text;

-- 감사 로그 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_name ON audit_logs(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_user ON audit_logs(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- 교환권 회수 함수 (단일)
CREATE OR REPLACE FUNCTION recall_voucher_by_id(
  p_voucher_id uuid,
  p_reason text DEFAULT '',
  p_recalled_by_user_id uuid DEFAULT NULL,
  p_recalled_at_site_id uuid DEFAULT NULL,
  p_recall_method text DEFAULT 'manual'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_voucher vouchers%ROWTYPE;
  v_result json;
BEGIN
  -- 교환권 조회 및 잠금
  SELECT * INTO v_voucher 
  FROM vouchers 
  WHERE id = p_voucher_id 
  FOR UPDATE;

  -- 교환권 존재 여부 확인
  IF NOT FOUND THEN
    RETURN json_build_object(
      'ok', false,
      'message', '교환권을 찾을 수 없습니다.',
      'error_code', 'VOUCHER_NOT_FOUND'
    );
  END IF;

  -- 이미 회수된 교환권인지 확인
  IF v_voucher.status = 'recalled' THEN
    RETURN json_build_object(
      'ok', false,
      'message', '이미 회수된 교환권입니다.',
      'error_code', 'ALREADY_RECALLED'
    );
  END IF;

  -- 이미 사용된 교환권인지 확인
  IF v_voucher.status = 'used' THEN
    RETURN json_build_object(
      'ok', false,
      'message', '이미 사용된 교환권입니다.',
      'error_code', 'ALREADY_USED'
    );
  END IF;

  -- 교환권 회수 처리
  UPDATE vouchers 
  SET 
    status = 'recalled',
    recalled_at = COALESCE(CURRENT_TIMESTAMP, NOW()),
    recalled_by_user_id = p_recalled_by_user_id,
    recalled_at_site_id = p_recalled_at_site_id,
    recall_method = p_recall_method,
    notes = CASE 
      WHEN p_reason != '' THEN 
        COALESCE(notes, '') || 
        (CASE WHEN notes IS NOT NULL AND notes != '' THEN '; ' ELSE '' END) || 
        '회수사유: ' || p_reason
      ELSE notes
    END
  WHERE id = p_voucher_id;

  -- 감사 로그 기록
  INSERT INTO audit_logs (
    voucher_id, 
    action, 
    actor_user_id, 
    site_id, 
    recall_method,
    recall_reason,
    details
  ) VALUES (
    p_voucher_id,
    'recalled',
    p_recalled_by_user_id,
    p_recalled_at_site_id,
    p_recall_method,
    p_reason,
    json_build_object(
      'serial_no', v_voucher.serial_no,
      'amount', v_voucher.amount,
      'previous_status', v_voucher.status,
      'recall_method', p_recall_method
    )
  );

  -- 결과 반환
  RETURN json_build_object(
    'ok', true,
    'message', '교환권이 성공적으로 회수되었습니다.',
    'voucher', json_build_object(
      'id', v_voucher.id,
      'serial_no', v_voucher.serial_no,
      'amount', v_voucher.amount,
      'status', 'recalled'
    )
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'ok', false,
      'message', '교환권 회수 중 오류가 발생했습니다: ' || SQLERRM,
      'error_code', 'RECALL_ERROR'
    );
END;
$$;