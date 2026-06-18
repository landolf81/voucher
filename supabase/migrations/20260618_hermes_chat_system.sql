-- Migration: Hermes Chat System (Supabase 큐 패턴)
-- Date: 2026-06-18
-- Purpose: Vercel 프론트엔드 ↔ Supabase ↔ Mac 릴레이/Hermes 간 채팅 큐 테이블 생성
--
-- 흐름:
--   1. 프론트엔드가 chat_messages 에 user 메시지를 status='pending' 으로 INSERT
--   2. 맥북 릴레이가 pending 메시지를 폴링 → Hermes 호출 → assistant 응답 INSERT
--   3. 프론트엔드는 Realtime 구독으로 assistant 응답을 실시간 수신

-- ============================================
-- 1. chat_sessions (대화 세션)
-- ============================================
CREATE TABLE IF NOT EXISTS chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT DEFAULT '새 대화',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. chat_messages (대화 메시지 = 작업 큐)
-- ============================================
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'processing', 'completed', 'error')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 세션별 시간순 조회 + 릴레이의 pending 폴링용 인덱스
CREATE INDEX IF NOT EXISTS idx_messages_session ON chat_messages(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_pending ON chat_messages(status, created_at)
  WHERE role = 'user' AND status = 'pending';

-- ============================================
-- 3. updated_at 자동 갱신 트리거 (세션 정렬용)
-- ============================================
CREATE OR REPLACE FUNCTION touch_chat_session_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE chat_sessions SET updated_at = NOW() WHERE id = NEW.session_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_chat_session ON chat_messages;
CREATE TRIGGER trg_touch_chat_session
  AFTER INSERT ON chat_messages
  FOR EACH ROW EXECUTE FUNCTION touch_chat_session_updated_at();

-- ============================================
-- 4. Row Level Security
-- ============================================
-- 내부 운영 도구(admin/staff) 용도. 스펙대로 모든 작업 허용.
-- 릴레이가 anon 키로 UPDATE/INSERT 하므로 anon + authenticated 모두 허용한다.
-- ⚠️ 보안 강화 시: 릴레이는 service_role 키 사용 + 정책을 authenticated 로 좁히고
--    chat_sessions 에 user_id 컬럼을 추가해 본인 대화만 조회하도록 변경 권장.
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS chat_sessions_all ON chat_sessions;
CREATE POLICY chat_sessions_all ON chat_sessions
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS chat_messages_all ON chat_messages;
CREATE POLICY chat_messages_all ON chat_messages
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- ============================================
-- 5. Realtime 활성화 (프론트엔드 구독에 필수)
-- ============================================
-- chat_messages 의 INSERT/UPDATE 가 Realtime 으로 전달되도록 publication 에 추가.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'chat_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
  END IF;
END $$;

-- UPDATE(status 변경) payload 에 이전 값까지 포함되도록 full replica identity 설정
ALTER TABLE chat_messages REPLICA IDENTITY FULL;
