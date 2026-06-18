-- Migration: Chat 사용자 격리 (user_id + RLS)
-- Date: 2026-06-18
-- Purpose: 대화를 사용자별로 분리. 로그인한 사용자는 본인 세션/메시지만 접근.
--   - 릴레이는 service_role 키 사용 → RLS 우회하므로 모든 pending 처리/응답 INSERT 가능
--   - 브라우저(authenticated) 클라이언트는 auth.uid() 기준으로 본인 것만 보임

-- 1) user_id 컬럼 추가
ALTER TABLE chat_sessions
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_chat_sessions_user
  ON chat_sessions(user_id, updated_at DESC);

-- 2) 기존(테스트로 생성된) 세션을 현재 사용자에게 귀속 — 안 그러면 격리 후 안 보임
UPDATE chat_sessions
SET user_id = (SELECT id FROM auth.users WHERE email = 'landolf@naver.com' LIMIT 1)
WHERE user_id IS NULL;

-- 3) allow-all 정책 제거 후, 본인 것만 접근하는 정책으로 교체
DROP POLICY IF EXISTS chat_sessions_all ON chat_sessions;
DROP POLICY IF EXISTS chat_messages_all ON chat_messages;

CREATE POLICY chat_sessions_own ON chat_sessions
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY chat_messages_own ON chat_messages
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM chat_sessions s
    WHERE s.id = chat_messages.session_id AND s.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM chat_sessions s
    WHERE s.id = chat_messages.session_id AND s.user_id = auth.uid()
  ));
