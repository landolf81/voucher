-- =====================================================
-- Function Search Path 보안 수정 마이그레이션 V2
-- 생성일: 2024-12-24
--
-- 오버로드된 함수들의 search_path 설정
-- =====================================================

-- 1. cleanup_expired_short_urls (days_before 버전)
CREATE OR REPLACE FUNCTION public.cleanup_expired_short_urls(days_before integer DEFAULT 7)
RETURNS TABLE(deleted_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
    cleanup_date TIMESTAMP WITH TIME ZONE;
    result_count INTEGER;
BEGIN
    cleanup_date := NOW() - INTERVAL '1 day' * days_before;

    DELETE FROM short_urls
    WHERE expires_at < cleanup_date;

    GET DIAGNOSTICS result_count = ROW_COUNT;

    INSERT INTO audit_logs (action, details)
    VALUES (
        'short_urls_cleanup',
        jsonb_build_object(
            'cleanup_date', cleanup_date,
            'days_before', days_before,
            'deleted_count', result_count
        )
    );

    RETURN QUERY SELECT result_count;
END;
$function$;

-- 2. delete_vouchers_by_template (exclude_statuses 버전)
CREATE OR REPLACE FUNCTION public.delete_vouchers_by_template(
  p_template_id uuid,
  p_exclude_statuses text[] DEFAULT ARRAY['used'::text, 'disposed'::text]
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  deleted_count INTEGER;
  template_name TEXT;
BEGIN
  SELECT voucher_name INTO template_name
  FROM voucher_templates
  WHERE id = p_template_id;

  DELETE FROM vouchers
  WHERE template_id = p_template_id
    AND status != ALL(p_exclude_statuses);

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

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
$function$;

-- 3. log_activity (extended 버전)
CREATE OR REPLACE FUNCTION public.log_activity(
  p_action text,
  p_action_type text,
  p_actor_user_id uuid,
  p_site_id uuid,
  p_voucher_id uuid DEFAULT NULL::uuid,
  p_quantity integer DEFAULT 1,
  p_total_amount numeric DEFAULT NULL::numeric,
  p_details jsonb DEFAULT '{}'::jsonb,
  p_target_phone text DEFAULT NULL::text,
  p_target_name text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO audit_logs (
    action,
    action_type,
    actor_user_id,
    site_id,
    voucher_id,
    quantity,
    total_amount,
    details,
    target_phone,
    target_name,
    created_at
  ) VALUES (
    p_action,
    p_action_type,
    p_actor_user_id,
    p_site_id,
    p_voucher_id,
    p_quantity,
    p_total_amount,
    p_details,
    p_target_phone,
    p_target_name,
    NOW()
  ) RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$function$;

-- 4. log_bulk_issue (extended 버전)
CREATE OR REPLACE FUNCTION public.log_bulk_issue(
  p_template_id uuid,
  p_quantity integer,
  p_total_amount numeric,
  p_actor_user_id uuid,
  p_site_id uuid,
  p_association text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_log_id UUID;
  v_template_name TEXT;
BEGIN
  SELECT voucher_name INTO v_template_name
  FROM voucher_templates
  WHERE id = p_template_id;

  v_log_id := log_activity(
    format('bulk_issue_%s_vouchers', p_quantity),
    'bulk_issue',
    p_actor_user_id,
    p_site_id,
    NULL,
    p_quantity,
    p_total_amount,
    json_build_object(
      'template_id', p_template_id,
      'template_name', v_template_name,
      'association', p_association,
      'issued_at', NOW()
    )::jsonb
  );

  RETURN v_log_id;
END;
$function$;

-- 5. migrate_user_to_auth (extended 버전)
CREATE OR REPLACE FUNCTION public.migrate_user_to_auth(
  user_email text,
  user_phone text,
  user_name text,
  user_role text,
  user_site_id uuid,
  user_is_active boolean DEFAULT true
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  new_user_id uuid;
BEGIN
  RETURN new_user_id;
END;
$function$;

-- 6. queue_sms_notification (extended 버전)
CREATE OR REPLACE FUNCTION public.queue_sms_notification(
  p_phone text,
  p_message text,
  p_message_type text,
  p_voucher_id uuid DEFAULT NULL::uuid,
  p_audit_log_id uuid DEFAULT NULL::uuid,
  p_recipient_name text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_notification_id UUID;
  v_prefs RECORD;
BEGIN
  SELECT * INTO v_prefs
  FROM notification_preferences
  WHERE phone = p_phone AND is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    INSERT INTO notification_preferences (phone, is_active)
    VALUES (p_phone, true)
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_prefs IS NOT NULL THEN
    IF p_message_type = 'voucher_used' AND NOT v_prefs.receive_usage_notifications THEN
      RETURN NULL;
    END IF;
    IF p_message_type = 'voucher_issued' AND NOT v_prefs.receive_issue_notifications THEN
      RETURN NULL;
    END IF;
    IF p_message_type = 'voucher_canceled' AND NOT v_prefs.receive_cancel_notifications THEN
      RETURN NULL;
    END IF;
  END IF;

  INSERT INTO notification_logs (
    phone,
    recipient_name,
    message_type,
    message_content,
    voucher_id,
    audit_log_id,
    status
  ) VALUES (
    p_phone,
    p_recipient_name,
    p_message_type,
    p_message,
    p_voucher_id,
    p_audit_log_id,
    'queued'
  ) RETURNING id INTO v_notification_id;

  RETURN v_notification_id;
END;
$function$;

-- 7. track_short_url_click (varchar 버전)
CREATE OR REPLACE FUNCTION public.track_short_url_click(p_short_code character varying)
RETURNS TABLE(original_url text, is_expired boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
    url_record RECORD;
    is_expired_flag BOOLEAN := FALSE;
BEGIN
    UPDATE short_urls
    SET
        click_count = click_count + 1,
        last_clicked_at = NOW(),
        updated_at = NOW()
    WHERE short_code = p_short_code
    RETURNING * INTO url_record;

    IF NOT FOUND THEN
        RETURN QUERY SELECT NULL::TEXT, TRUE;
        RETURN;
    END IF;

    IF url_record.expires_at < NOW() THEN
        is_expired_flag := TRUE;
    END IF;

    RETURN QUERY SELECT url_record.original_url, is_expired_flag;
END;
$function$;

-- 8. update_voucher_status_atomic (varchar 버전)
CREATE OR REPLACE FUNCTION public.update_voucher_status_atomic(
  p_token character varying,
  p_new_status character varying,
  p_expected_version integer
)
RETURNS TABLE(success boolean, new_version integer, status character varying)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_updated_count INTEGER;
  v_new_version INTEGER;
  v_status VARCHAR;
BEGIN
  UPDATE vouchers
  SET
    status = p_new_status,
    version = version + 1,
    used_at = CASE
      WHEN p_new_status = 'used' THEN NOW()
      ELSE used_at
    END
  WHERE
    mobile_link_token = p_token
    AND version = p_expected_version
    AND status != p_new_status
  RETURNING version, status INTO v_new_version, v_status;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  RETURN QUERY SELECT
    v_updated_count > 0 as success,
    v_new_version,
    v_status;
END;
$function$;

-- 9. use_voucher_with_notification (3 params 버전)
CREATE OR REPLACE FUNCTION public.use_voucher_with_notification(
  p_serial text,
  p_user_id uuid,
  p_site_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_voucher vouchers;
  v_log_id UUID;
  v_notification_id UUID;
  v_message TEXT;
  v_site_name TEXT;
  v_user_name TEXT;
BEGIN
  SELECT * INTO v_voucher FROM vouchers WHERE serial_no = p_serial FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'VOUCHER_NOT_FOUND');
  END IF;

  IF v_voucher.status <> 'issued' THEN
    RETURN json_build_object('success', false, 'error', 'VOUCHER_ALREADY_USED');
  END IF;

  SELECT site_name INTO v_site_name FROM sites WHERE id = p_site_id;

  SELECT raw_user_meta_data->>'name' INTO v_user_name
  FROM auth.users WHERE id = p_user_id;

  UPDATE vouchers
  SET
    status = 'used',
    used_at = NOW(),
    used_by_user_id = p_user_id,
    used_at_site_id = p_site_id
  WHERE id = v_voucher.id;

  v_log_id := log_activity(
    'voucher_used',
    'use',
    p_user_id,
    p_site_id,
    v_voucher.id,
    1,
    v_voucher.amount,
    json_build_object(
      'serial_no', v_voucher.serial_no,
      'holder_name', v_voucher.name,
      'association', v_voucher.association,
      'site_name', v_site_name,
      'user_name', v_user_name
    )::jsonb,
    v_voucher.phone,
    v_voucher.name
  );

  IF v_voucher.phone IS NOT NULL THEN
    v_message := format(
      '[교환권 사용] %s님의 교환권이 %s %s에서 사용되었습니다. 금액: %s원',
      v_voucher.name,
      to_char(NOW(), 'MM/DD HH24:MI'),
      v_site_name,
      to_char(v_voucher.amount, 'FM999,999,999')
    );

    v_notification_id := queue_sms_notification(
      v_voucher.phone,
      v_message,
      'voucher_used',
      v_voucher.id,
      v_log_id,
      v_voucher.name
    );
  END IF;

  RETURN json_build_object(
    'success', true,
    'voucher_id', v_voucher.id,
    'serial_no', v_voucher.serial_no,
    'amount', v_voucher.amount,
    'used_at', NOW(),
    'notification_queued', v_notification_id IS NOT NULL
  );
END;
$function$;
