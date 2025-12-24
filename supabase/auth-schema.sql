-- 인증 시스템 관련 테이블 추가

-- users 테이블에 phone 컬럼 추가 (기존 테이블 수정)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS phone TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- phone 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_site_id ON users(site_id);

-- SMS 인증 정보 테이블 (데이터베이스 기반 SMS 인증용)
CREATE TABLE IF NOT EXISTS sms_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER DEFAULT 0,
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  verified_at TIMESTAMPTZ,
  ip_address TEXT,
  user_agent TEXT
);

-- SMS 인증 인덱스
CREATE INDEX IF NOT EXISTS idx_sms_verifications_phone ON sms_verifications(phone);
CREATE INDEX IF NOT EXISTS idx_sms_verifications_expires_at ON sms_verifications(expires_at);
CREATE INDEX IF NOT EXISTS idx_sms_verifications_created_at ON sms_verifications(created_at);

-- 사용자 등록 요청 테이블 (관리자가 사용자 등록)
CREATE TABLE IF NOT EXISTS user_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT CHECK (role IN ('admin', 'staff')) DEFAULT 'staff',
  site_id UUID REFERENCES sites(id),
  registered_by_user_id UUID REFERENCES users(id),
  registration_status TEXT CHECK (registration_status IN ('pending', 'verified', 'completed', 'expired')) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  verified_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days')
);

-- 사용자 등록 인덱스
CREATE INDEX IF NOT EXISTS idx_user_registrations_phone ON user_registrations(phone);
CREATE INDEX IF NOT EXISTS idx_user_registrations_status ON user_registrations(registration_status);
CREATE INDEX IF NOT EXISTS idx_user_registrations_expires_at ON user_registrations(expires_at);

-- 세션 관리 테이블 (JWT 토큰 관리)
CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT UNIQUE NOT NULL, -- JWT 토큰의 해시값
  device_info JSONB, -- 디바이스 정보 (User-Agent, IP 등)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  last_accessed_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE
);

-- 세션 인덱스
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token_hash ON user_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_sessions_is_active ON user_sessions(is_active);

-- SMS 발송 로그 테이블 (운영 환경용)
CREATE TABLE IF NOT EXISTS sms_send_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  message_type TEXT CHECK (message_type IN ('verification', 'notification', 'marketing')) DEFAULT 'verification',
  message_content TEXT,
  provider TEXT DEFAULT 'mock', -- mock, ncp_sens 등
  status TEXT CHECK (status IN ('pending', 'sent', 'failed', 'delivered')) DEFAULT 'pending',
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  error_message TEXT,
  cost NUMERIC(10, 2), -- SMS 발송 비용
  created_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB -- 추가 메타데이터
);

-- SMS 발송 로그 인덱스
CREATE INDEX IF NOT EXISTS idx_sms_send_logs_phone ON sms_send_logs(phone);
CREATE INDEX IF NOT EXISTS idx_sms_send_logs_status ON sms_send_logs(status);
CREATE INDEX IF NOT EXISTS idx_sms_send_logs_created_at ON sms_send_logs(created_at);

-- RLS (Row Level Security) 정책

-- users 테이블 RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- 관리자는 모든 사용자 조회 가능
CREATE POLICY "admin_can_view_all_users" ON users
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );

-- 사용자는 자신의 정보만 조회 가능
CREATE POLICY "users_can_view_own_profile" ON users
  FOR SELECT
  USING (id = auth.uid());

-- 관리자만 사용자 생성 가능
CREATE POLICY "admin_can_create_users" ON users
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );

-- 관리자는 모든 사용자 수정 가능
CREATE POLICY "admin_can_update_all_users" ON users
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );

-- 사용자는 자신의 일부 정보만 수정 가능 (name, phone)
CREATE POLICY "users_can_update_own_profile" ON users
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (
    -- role과 site_id는 변경 불가
    role = (SELECT role FROM users WHERE id = auth.uid()) AND
    site_id = (SELECT site_id FROM users WHERE id = auth.uid())
  );

-- SMS 인증 테이블 RLS
ALTER TABLE sms_verifications ENABLE ROW LEVEL SECURITY;

-- 누구나 SMS 인증 생성 가능 (로그인 전)
CREATE POLICY "anyone_can_create_sms_verification" ON sms_verifications
  FOR INSERT
  WITH CHECK (true);

-- 누구나 자신의 전화번호로 SMS 인증 조회 가능
CREATE POLICY "can_view_own_sms_verification" ON sms_verifications
  FOR SELECT
  USING (true); -- 실제로는 애플리케이션 레벨에서 제어

-- 사용자 등록 테이블 RLS
ALTER TABLE user_registrations ENABLE ROW LEVEL SECURITY;

-- 관리자만 등록 요청 생성 가능
CREATE POLICY "admin_can_create_registration" ON user_registrations
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );

-- 관리자는 모든 등록 요청 조회 가능
CREATE POLICY "admin_can_view_all_registrations" ON user_registrations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );

-- 세션 테이블 RLS
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- 사용자는 자신의 세션만 조회 가능
CREATE POLICY "users_can_view_own_sessions" ON user_sessions
  FOR SELECT
  USING (user_id = auth.uid());

-- 사용자는 자신의 세션 생성 가능
CREATE POLICY "users_can_create_own_sessions" ON user_sessions
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- 사용자는 자신의 세션 삭제 가능 (로그아웃)
CREATE POLICY "users_can_delete_own_sessions" ON user_sessions
  FOR DELETE
  USING (user_id = auth.uid());

-- SMS 발송 로그 RLS
ALTER TABLE sms_send_logs ENABLE ROW LEVEL SECURITY;

-- 관리자만 SMS 로그 조회 가능
CREATE POLICY "admin_can_view_sms_logs" ON sms_send_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );

-- 함수: SMS 인증 코드 검증 및 처리
CREATE OR REPLACE FUNCTION verify_sms_code(
  p_phone TEXT,
  p_code TEXT
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_verification sms_verifications;
  v_result JSON;
BEGIN
  -- 가장 최근의 유효한 인증 정보 조회
  SELECT * INTO v_verification
  FROM sms_verifications
  WHERE phone = p_phone
    AND verified = FALSE
    AND expires_at > NOW()
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  -- 인증 정보 없음
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', FALSE,
      'message', '인증 정보를 찾을 수 없습니다.'
    );
  END IF;

  -- 시도 횟수 초과
  IF v_verification.attempts >= 3 THEN
    UPDATE sms_verifications
    SET verified = FALSE
    WHERE id = v_verification.id;
    
    RETURN json_build_object(
      'success', FALSE,
      'message', '인증 시도 횟수를 초과했습니다.'
    );
  END IF;

  -- 인증번호 불일치
  IF v_verification.code != p_code THEN
    UPDATE sms_verifications
    SET attempts = attempts + 1
    WHERE id = v_verification.id;
    
    RETURN json_build_object(
      'success', FALSE,
      'message', '인증번호가 일치하지 않습니다.',
      'remaining_attempts', 3 - v_verification.attempts - 1
    );
  END IF;

  -- 인증 성공
  UPDATE sms_verifications
  SET verified = TRUE,
      verified_at = NOW()
  WHERE id = v_verification.id;

  RETURN json_build_object(
    'success', TRUE,
    'message', '인증이 완료되었습니다.'
  );
END;
$$;

-- 함수: 만료된 데이터 정리
CREATE OR REPLACE FUNCTION cleanup_expired_data()
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  -- 만료된 SMS 인증 정보 삭제
  DELETE FROM sms_verifications
  WHERE expires_at < NOW() - INTERVAL '1 day';

  -- 만료된 사용자 등록 요청 상태 업데이트
  UPDATE user_registrations
  SET registration_status = 'expired'
  WHERE expires_at < NOW()
    AND registration_status = 'pending';

  -- 만료된 세션 비활성화
  UPDATE user_sessions
  SET is_active = FALSE
  WHERE expires_at < NOW()
    AND is_active = TRUE;

  -- 오래된 SMS 로그 삭제 (30일 이상)
  DELETE FROM sms_send_logs
  WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$;

-- 정기적인 정리 작업을 위한 트리거 (선택사항)
-- 실제로는 cron job이나 scheduled task로 실행하는 것을 권장
-- SELECT cleanup_expired_data();

-- 샘플 데이터 (개발용)
-- 사업장 추가
INSERT INTO sites (site_name) VALUES 
  ('본사'),
  ('지점1'),
  ('지점2')
ON CONFLICT DO NOTHING;

-- 관리자 계정 추가 (개발용)
-- 전화번호: 010-1234-5678
INSERT INTO users (phone, name, role, site_id)
SELECT 
  '01012345678',
  '관리자',
  'admin',
  (SELECT id FROM sites WHERE site_name = '본사' LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM users WHERE phone = '01012345678'
);

-- 직원 계정 추가 (개발용)
-- 전화번호: 010-8765-4321
INSERT INTO users (phone, name, role, site_id)
SELECT 
  '01087654321',
  '직원1',
  'staff',
  (SELECT id FROM sites WHERE site_name = '지점1' LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM users WHERE phone = '01087654321'
);