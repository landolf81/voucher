-- Migration: 챗봇 응답 피드백 (chat_message_feedback)
-- Date: 2026-07-14
-- Purpose: 직원이 assistant 답변에 좋아요/싫어요 + 사유를 남기고,
--          관리자가 모아 보며 봇 품질(규정 오답·환각·말투 등)을 개선하기 위한 테이블.
--
-- 설계 결정:
--   - chat_messages 에 컬럼 추가 대신 별도 테이블: chat_messages 는 릴레이가 status 를
--     UPDATE 하는 큐 + REPLICA IDENTITY FULL + Realtime publication 이라 간섭을 피함.
--   - question_content/answer_content 를 스냅샷으로 비정규화: 관리자가 chat_messages
--     전체를 읽을 수 있게 RLS 를 넓히지 않고도(직원 대화 프라이버시 유지) 피드백이
--     달린 문답 쌍만 열람 가능. 피드백을 남긴다 = 그 문답을 관리자와 공유한다는 모델.
--   - user_name 스냅샷: appraisals.author_name 과 같은 패턴 (auth.users 조인 회피).
--   - Realtime publication 에는 추가하지 않음 (실시간성 불필요).

CREATE TABLE IF NOT EXISTS chat_message_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_name TEXT,
  rating TEXT NOT NULL CHECK (rating IN ('up', 'down')),
  reason TEXT CHECK (reason IN ('inaccurate', 'misunderstood', 'insufficient', 'tone', 'slow', 'other')),
  comment TEXT,
  question_content TEXT,
  answer_content TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (message_id) -- 메시지당 피드백 1건 (세션이 개인 소유라 사용자별 unique 불필요)
);

-- 관리자 목록(최신순) + 세션 단위 로드용 인덱스
CREATE INDEX IF NOT EXISTS idx_chat_feedback_created ON chat_message_feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_feedback_session ON chat_message_feedback(session_id);

-- ============================================
-- Row Level Security
-- ============================================
ALTER TABLE chat_message_feedback ENABLE ROW LEVEL SECURITY;

-- 본인 피드백만 CRUD. WITH CHECK 에서 세션 소유까지 검증해
-- 타인 세션의 message_id 로 피드백을 위조 삽입하는 것을 차단.
DROP POLICY IF EXISTS chat_feedback_own ON chat_message_feedback;
CREATE POLICY chat_feedback_own ON chat_message_feedback
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM chat_sessions s
      WHERE s.id = chat_message_feedback.session_id AND s.user_id = auth.uid()
    )
  );

-- 관리자는 전체 열람 (봇 품질 개선 목적의 읽기 전용)
DROP POLICY IF EXISTS chat_feedback_admin_read ON chat_message_feedback;
CREATE POLICY chat_feedback_admin_read ON chat_message_feedback
  FOR SELECT TO authenticated
  USING (public.is_admin());
