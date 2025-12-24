-- 템플릿별 교환권 대량 삭제를 위한 RPC 함수
CREATE OR REPLACE FUNCTION delete_vouchers_by_template(
  p_template_id UUID,
  p_exclude_statuses TEXT[] DEFAULT ARRAY['used', 'disposed']
)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
  template_name TEXT;
BEGIN
  -- 템플릿 이름 조회
  SELECT voucher_name INTO template_name 
  FROM voucher_templates 
  WHERE id = p_template_id;

  -- 템플릿 ID로 교환권 삭제 (사용되거나 폐기된 것 제외)
  DELETE FROM vouchers 
  WHERE template_id = p_template_id 
    AND status != ALL(p_exclude_statuses);
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  -- 삭제 로그 기록
  IF deleted_count > 0 THEN
    INSERT INTO audit_logs (
      action,
      action_type, 
      details,
      created_at
    ) VALUES (
      format('템플릿 "%s"의 교환권 %s개 대량 삭제', template_name, deleted_count),
      'bulk_delete',
      json_build_object(
        'template_id', p_template_id,
        'template_name', template_name,
        'deleted_count', deleted_count,
        'excluded_statuses', p_exclude_statuses
      ),
      NOW()
    );
  END IF;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC 함수 권한 설정
GRANT EXECUTE ON FUNCTION delete_vouchers_by_template(UUID, TEXT[]) TO anon;
GRANT EXECUTE ON FUNCTION delete_vouchers_by_template(UUID, TEXT[]) TO authenticated;