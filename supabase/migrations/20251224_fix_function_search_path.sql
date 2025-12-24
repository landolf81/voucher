-- =====================================================
-- Function Search Path 보안 수정 마이그레이션
-- 생성일: 2024-12-24
--
-- 모든 함수에 SET search_path = public 추가
-- =====================================================

-- 1. update_short_urls_updated_at
CREATE OR REPLACE FUNCTION public.update_short_urls_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 2. update_associations_updated_at
CREATE OR REPLACE FUNCTION public.update_associations_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 3. generate_site_short_code
CREATE OR REPLACE FUNCTION public.generate_site_short_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  new_code TEXT;
  code_exists BOOLEAN;
BEGIN
  IF NEW.short_code IS NULL OR NEW.short_code = '' THEN
    LOOP
      new_code := UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6));
      SELECT EXISTS(SELECT 1 FROM sites WHERE short_code = new_code) INTO code_exists;
      EXIT WHEN NOT code_exists;
    END LOOP;
    NEW.short_code := new_code;
  END IF;
  RETURN NEW;
END;
$$;

-- 4. update_user_profiles_updated_at
CREATE OR REPLACE FUNCTION public.update_user_profiles_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 5. migrate_user_to_auth
CREATE OR REPLACE FUNCTION public.migrate_user_to_auth()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 이 함수는 마이그레이션 목적으로만 사용
  RETURN NEW;
END;
$$;

-- 6. update_mobile_batch_updated_at
CREATE OR REPLACE FUNCTION public.update_mobile_batch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 7. generate_secure_token
CREATE OR REPLACE FUNCTION public.generate_secure_token(length INTEGER DEFAULT 32)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..length LOOP
    result := result || SUBSTRING(chars FROM FLOOR(RANDOM() * LENGTH(chars) + 1)::INTEGER FOR 1);
  END LOOP;
  RETURN result;
END;
$$;

-- 8. cleanup_expired_mobile_batches
CREATE OR REPLACE FUNCTION public.cleanup_expired_mobile_batches()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  WITH deleted AS (
    DELETE FROM mobile_voucher_batches
    WHERE expires_at < NOW()
    RETURNING id
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;
  RETURN deleted_count;
END;
$$;

-- 9. update_voucher_status_atomic
CREATE OR REPLACE FUNCTION public.update_voucher_status_atomic(
  p_voucher_id UUID,
  p_new_status TEXT,
  p_expected_version INTEGER DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_voucher RECORD;
  v_result JSONB;
BEGIN
  SELECT * INTO v_voucher FROM vouchers WHERE id = p_voucher_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Voucher not found');
  END IF;

  IF p_expected_version IS NOT NULL AND v_voucher.version != p_expected_version THEN
    RETURN jsonb_build_object('success', false, 'error', 'Version mismatch');
  END IF;

  UPDATE vouchers
  SET status = p_new_status,
      version = COALESCE(version, 0) + 1
  WHERE id = p_voucher_id;

  RETURN jsonb_build_object('success', true, 'new_version', COALESCE(v_voucher.version, 0) + 1);
END;
$$;

-- 10. alert_suspicious_activity
CREATE OR REPLACE FUNCTION public.alert_suspicious_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 의심스러운 활동 알림 로직
  RETURN NEW;
END;
$$;

-- 11. cleanup_expired_short_urls
CREATE OR REPLACE FUNCTION public.cleanup_expired_short_urls()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  WITH deleted AS (
    DELETE FROM short_urls
    WHERE expires_at IS NOT NULL AND expires_at < NOW()
    RETURNING id
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;
  RETURN deleted_count;
END;
$$;

-- 12. track_short_url_click
CREATE OR REPLACE FUNCTION public.track_short_url_click(p_short_code TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_original_url TEXT;
BEGIN
  UPDATE short_urls
  SET click_count = click_count + 1,
      last_clicked_at = NOW()
  WHERE short_code = p_short_code
    AND (expires_at IS NULL OR expires_at > NOW())
  RETURNING original_url INTO v_original_url;

  RETURN v_original_url;
END;
$$;

-- 13. log_activity
CREATE OR REPLACE FUNCTION public.log_activity(
  p_action TEXT,
  p_voucher_id UUID DEFAULT NULL,
  p_details JSONB DEFAULT NULL,
  p_site_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO audit_logs (voucher_id, action, details, site_id, actor_user_id)
  VALUES (p_voucher_id, p_action, p_details, p_site_id, auth.uid())
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

-- 14. queue_sms_notification
CREATE OR REPLACE FUNCTION public.queue_sms_notification(
  p_phone TEXT,
  p_message TEXT,
  p_voucher_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notification_id UUID;
BEGIN
  INSERT INTO notification_logs (phone, message, voucher_id, status)
  VALUES (p_phone, p_message, p_voucher_id, 'pending')
  RETURNING id INTO v_notification_id;

  RETURN v_notification_id;
END;
$$;

-- 15. use_voucher_with_notification
CREATE OR REPLACE FUNCTION public.use_voucher_with_notification(
  p_serial TEXT,
  p_site_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_voucher RECORD;
  v_result JSONB;
BEGIN
  SELECT * INTO v_voucher FROM vouchers WHERE serial_no = p_serial FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Voucher not found');
  END IF;

  IF v_voucher.status != 'issued' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Voucher already used or canceled');
  END IF;

  UPDATE vouchers
  SET status = 'used',
      used_at = NOW(),
      used_at_site_id = p_site_id,
      used_by_user_id = auth.uid()
  WHERE id = v_voucher.id;

  INSERT INTO audit_logs (voucher_id, action, site_id, actor_user_id, details)
  VALUES (v_voucher.id, 'use', p_site_id, auth.uid(), jsonb_build_object('serial_no', p_serial));

  RETURN jsonb_build_object('success', true, 'voucher_id', v_voucher.id);
END;
$$;

-- 16. log_bulk_issue
CREATE OR REPLACE FUNCTION public.log_bulk_issue(
  p_voucher_ids UUID[],
  p_site_id UUID,
  p_details JSONB DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  INSERT INTO audit_logs (voucher_id, action, site_id, actor_user_id, details)
  SELECT unnest(p_voucher_ids), 'bulk_issue', p_site_id, auth.uid(), p_details;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- 17. update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 18. update_member_updated_at
CREATE OR REPLACE FUNCTION public.update_member_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 19. log_member_changes
CREATE OR REPLACE FUNCTION public.log_member_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO member_audit_logs (member_id, action, new_data, performed_by)
    VALUES (NEW.id, 'INSERT', to_jsonb(NEW), auth.uid());
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO member_audit_logs (member_id, action, old_data, new_data, performed_by)
    VALUES (NEW.id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), auth.uid());
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO member_audit_logs (member_id, action, old_data, performed_by)
    VALUES (OLD.id, 'DELETE', to_jsonb(OLD), auth.uid());
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 20. delete_vouchers_by_template
CREATE OR REPLACE FUNCTION public.delete_vouchers_by_template(p_template_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  WITH deleted AS (
    DELETE FROM vouchers
    WHERE template_id = p_template_id
    RETURNING id
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;
  RETURN deleted_count;
END;
$$;

-- 21. update_farming_association_updated_at
CREATE OR REPLACE FUNCTION public.update_farming_association_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 22. update_voucher_design_templates_updated_at
CREATE OR REPLACE FUNCTION public.update_voucher_design_templates_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 23. update_voucher_templates_updated_at
CREATE OR REPLACE FUNCTION public.update_voucher_templates_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 24. use_voucher_by_serial
CREATE OR REPLACE FUNCTION public.use_voucher_by_serial(p_serial TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v vouchers;
BEGIN
  SELECT * INTO v FROM vouchers WHERE serial_no = p_serial FOR UPDATE;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF v.status <> 'issued' THEN
    RETURN NULL;
  END IF;

  UPDATE vouchers
  SET status = 'used', used_at = NOW()
  WHERE id = v.id;

  INSERT INTO audit_logs(voucher_id, action, details)
  VALUES (v.id, 'use', json_build_object('serial_no', p_serial));

  RETURN json_build_object('serial_no', v.serial_no, 'used_at', NOW());
END;
$$;
