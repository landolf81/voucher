'use client';

/**
 * Hermes Chat 어시스턴트 (Supabase 큐 패턴)
 *
 * 흐름:
 *  - user 메시지를 chat_messages 에 status='pending' 으로 INSERT
 *  - 맥북 릴레이 스크립트가 폴링 → Hermes 호출 → assistant 응답 INSERT
 *  - 이 컴포넌트는 Supabase Realtime 으로 응답을 실시간 수신
 *
 * 내부 운영 도구(admin/staff)용. 자세한 백엔드 구성은 docs/hermes-chat-setup.md 참고.
 */

import React, { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react';
import { getSupabaseClient } from '@/lib/supabase';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useDevice } from '@/lib/hooks/useDevice';
import { X, Bot, AlertTriangle, ChevronDown, ThumbsUp, ThumbsDown } from 'lucide-react';

type Role = 'user' | 'assistant';
type Status = 'pending' | 'processing' | 'completed' | 'error';

interface ChatMessage {
  id: string;
  session_id: string;
  role: Role;
  content: string;
  status: Status;
  created_at: string;
}

type FeedbackRating = 'up' | 'down';
type FeedbackReason = 'inaccurate' | 'misunderstood' | 'insufficient' | 'tone' | 'slow' | 'other';

interface MessageFeedback {
  id: string;
  message_id: string;
  rating: FeedbackRating;
  reason: FeedbackReason | null;
  comment: string | null;
}

// 싫어요 사유 선택지 (chat_message_feedback.reason CHECK 와 일치해야 함)
const FEEDBACK_REASONS: { value: FeedbackReason; label: string }[] = [
  { value: 'inaccurate', label: '부정확함' },
  { value: 'misunderstood', label: '질문 이해 못함' },
  { value: 'insufficient', label: '답변 불충분' },
  { value: 'tone', label: '말투·호칭 문제' },
  { value: 'slow', label: '너무 느림' },
  { value: 'other', label: '기타' },
];

interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

const PAGE_SIZE = 30;

// 메시지 송수신 시각 표시 (예: "오후 3:07")
function formatMessageTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' });
}

// 같은(로컬) 날짜인지 비교 — 날짜가 바뀌면 이전 대화를 자동으로 이어가지 않기 위함
function isSameLocalDay(iso: string, ref: Date): boolean {
  const d = new Date(iso);
  return (
    d.getFullYear() === ref.getFullYear() &&
    d.getMonth() === ref.getMonth() &&
    d.getDate() === ref.getDate()
  );
}

export function ChatAssistant() {
  const supabase = getSupabaseClient();
  // 이 프로젝트의 Supabase 클라이언트는 Database 타입이 없어 insert/update 페이로드가
  // never 로 추론됨 → 데이터 연산은 느슨한 별칭(db)으로 처리 (결과는 명시적으로 캐스팅).
  const db = supabase as any;
  const { user } = useAuth();
  const device = useDevice();
  const isMobile = device.isMobile;

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);

  // ── 답변 피드백 상태 ───────────────────────────
  // message_id → 피드백. 세션의 피드백 전체를 한 번에 로드해 유지.
  const [feedbackMap, setFeedbackMap] = useState<Record<string, MessageFeedback>>({});
  const [downFormFor, setDownFormFor] = useState<string | null>(null); // 사유 입력 폼이 열린 메시지 id
  const [downReason, setDownReason] = useState<FeedbackReason | null>(null);
  const [downComment, setDownComment] = useState('');
  const [savingFeedback, setSavingFeedback] = useState(false);

  const messagesRef = useRef<HTMLDivElement>(null);
  const loadOlderRef = useRef<(() => void) | null>(null);
  const atBottomRef = useRef(true); // 현재 사용자가 맨 아래 근처인지
  // 초기/세션 로드 시 페인트 직전에 맨 아래로 보내 "스크롤 점프"가 안 보이게 하는 플래그
  const pendingScrollBottomRef = useRef(false);

  // 마지막 user 메시지가 아직 답변되지 않았으면 대기 상태
  const waiting = (() => {
    if (messages.length === 0) return false;
    const last = messages[messages.length - 1];
    return last.role === 'user' && last.status !== 'completed' && last.status !== 'error';
  })();

  const lastError = (() => {
    const last = messages[messages.length - 1];
    return last?.role === 'user' && last.status === 'error';
  })();

  // 메시지 컨테이너만 직접 맨 아래로 스크롤. 기본은 즉시(instant) — smooth 는
  // 페이지 전체를 애니메이션으로 끌어당겨 "확 도는" 현상을 유발하므로 새 메시지에만 옵션 사용.
  const scrollToBottom = useCallback((smooth = false) => {
    requestAnimationFrame(() => {
      const el = messagesRef.current;
      if (!el) return;
      el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
    });
  }, []);

  // 위쪽 근처 → 이전 대화 자동 로드, 하단 여부 추적 → "맨 아래로" 버튼 표시
  const handleScroll = useCallback(() => {
    const el = messagesRef.current;
    if (!el) return;
    if (el.scrollTop < 60) loadOlderRef.current?.();
    const atBottom = el.scrollHeight - el.clientHeight - el.scrollTop < 80;
    atBottomRef.current = atBottom;
    setShowScrollButton(!atBottom);
  }, []);

  // ── 세션 목록 로드 ──────────────────────────────
  const loadSessions = useCallback(async () => {
    if (!user?.id) return;
    const { data, error } = await db
      .from('chat_sessions')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });
    if (error) {
      console.error('세션 로드 실패:', error);
      return;
    }
    const list = (data as unknown as ChatSession[]) || [];
    setSessions(list);
    // 날짜가 바뀌면 이전 대화를 자동으로 이어가지 않음.
    // 가장 최근 세션이 '오늘' 갱신된 경우에만 자동 선택하고,
    // 그렇지 않으면 빈 상태로 두어 첫 메시지 전송 시 새 대화가 생성되게 함.
    setActiveSessionId((prev) => {
      if (prev) return prev;
      const latest = list[0];
      if (latest && isSameLocalDay(latest.updated_at, new Date())) return latest.id;
      return null;
    });
  }, [supabase, user?.id]);

  // ── 메시지 로드 ────────────────────────────────
  // 최근 PAGE_SIZE 개만 로드 (최신순으로 가져와 화면엔 시간순으로 표시)
  const loadMessages = useCallback(
    async (sessionId: string) => {
      setLoadingMessages(true);
      const { data, error } = await db
        .from('chat_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);
      setLoadingMessages(false);
      if (error) {
        console.error('메시지 로드 실패:', error);
        return;
      }
      const rows = ((data as unknown as ChatMessage[]) || []).slice().reverse();
      setHasMore(rows.length === PAGE_SIZE);
      pendingScrollBottomRef.current = true; // 페인트 직전에 하단 고정 (아래 useLayoutEffect)
      setMessages(rows);
    },
    [supabase]
  );

  // ── 답변 피드백 로드/저장 ─────────────────────
  // 세션 단위로 전량 로드 (피드백 수가 적어 페이징 불필요)
  const loadFeedback = useCallback(
    async (sessionId: string) => {
      const { data, error } = await db
        .from('chat_message_feedback')
        .select('id, message_id, rating, reason, comment')
        .eq('session_id', sessionId);
      if (error) {
        console.error('피드백 로드 실패:', error);
        return;
      }
      const map: Record<string, MessageFeedback> = {};
      for (const row of (data as unknown as MessageFeedback[]) || []) map[row.message_id] = row;
      setFeedbackMap(map);
    },
    [supabase]
  );

  // 해당 assistant 답변의 직전 user 질문 (관리자 열람용 스냅샷)
  const findQuestionFor = useCallback(
    (message: ChatMessage): string => {
      const idx = messages.findIndex((m) => m.id === message.id);
      for (let i = idx - 1; i >= 0; i--) {
        if (messages[i].role === 'user') return messages[i].content;
      }
      return '';
    },
    [messages]
  );

  const upsertFeedback = useCallback(
    async (message: ChatMessage, rating: FeedbackRating, reason: FeedbackReason | null, comment: string | null) => {
      if (!user?.id) return;
      setSavingFeedback(true);
      try {
        const { data, error } = await db
          .from('chat_message_feedback')
          .upsert(
            {
              message_id: message.id,
              session_id: message.session_id,
              user_id: user.id,
              user_name: user.name,
              rating,
              reason,
              comment: comment?.trim() || null,
              question_content: findQuestionFor(message),
              answer_content: message.content,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'message_id' }
          )
          .select('id, message_id, rating, reason, comment')
          .single();
        if (error) {
          console.error('피드백 저장 실패:', error);
          alert('피드백 저장에 실패했습니다.');
          return;
        }
        const row = data as unknown as MessageFeedback;
        setFeedbackMap((prev) => ({ ...prev, [row.message_id]: row }));
        setDownFormFor(null);
      } finally {
        setSavingFeedback(false);
      }
    },
    [supabase, user?.id, user?.name, findQuestionFor]
  );

  const removeFeedback = useCallback(
    async (messageId: string) => {
      const { error } = await db.from('chat_message_feedback').delete().eq('message_id', messageId);
      if (error) {
        console.error('피드백 삭제 실패:', error);
        return;
      }
      setFeedbackMap((prev) => {
        const next = { ...prev };
        delete next[messageId];
        return next;
      });
      setDownFormFor(null);
    },
    [supabase]
  );

  // 좋아요: 토글 (재클릭 시 취소)
  const handleThumbUp = useCallback(
    (message: ChatMessage) => {
      if (savingFeedback) return;
      const cur = feedbackMap[message.id];
      if (cur?.rating === 'up') {
        removeFeedback(message.id);
      } else {
        setDownFormFor(null);
        upsertFeedback(message, 'up', null, null);
      }
    },
    [feedbackMap, savingFeedback, upsertFeedback, removeFeedback]
  );

  // 싫어요: 사유 폼 토글 (기존 값 프리필)
  const handleThumbDown = useCallback(
    (message: ChatMessage) => {
      if (savingFeedback) return;
      if (downFormFor === message.id) {
        setDownFormFor(null);
        return;
      }
      const cur = feedbackMap[message.id];
      setDownReason(cur?.rating === 'down' ? cur.reason : null);
      setDownComment(cur?.rating === 'down' ? cur.comment || '' : '');
      setDownFormFor(message.id);
    },
    [downFormFor, feedbackMap, savingFeedback]
  );

  // 위로 스크롤 시 이전 대화 더 불러오기 (스크롤 위치 보존)
  const loadOlder = useCallback(async () => {
    if (loadingMore || !hasMore || messages.length === 0) return;
    const oldest = messages[0];
    setLoadingMore(true);
    const el = messagesRef.current;
    const prevScrollHeight = el?.scrollHeight ?? 0;
    const { data, error } = await db
      .from('chat_messages')
      .select('*')
      .eq('session_id', oldest.session_id)
      .lt('created_at', oldest.created_at)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE);
    setLoadingMore(false);
    if (error) {
      console.error('이전 대화 로드 실패:', error);
      return;
    }
    const older = ((data as unknown as ChatMessage[]) || []).slice().reverse();
    setHasMore(older.length === PAGE_SIZE);
    if (older.length === 0) return;
    setMessages((prev) => {
      const seen = new Set(prev.map((m) => m.id));
      const merged = [...older.filter((m) => !seen.has(m.id)), ...prev];
      return merged;
    });
    // prepend 후 스크롤 위치를 유지해 화면이 튀지 않게 함
    requestAnimationFrame(() => {
      const cur = messagesRef.current;
      if (cur) cur.scrollTop = cur.scrollHeight - prevScrollHeight;
    });
  }, [supabase, loadingMore, hasMore, messages]);

  // 스크롤 핸들러가 항상 최신 loadOlder 를 호출하도록 ref 유지
  useEffect(() => {
    loadOlderRef.current = loadOlder;
  }, [loadOlder]);

  // ── 새 대화 생성 ───────────────────────────────
  const createSession = useCallback(async () => {
    if (!user?.id) {
      alert('로그인 정보를 확인할 수 없습니다.');
      return null;
    }
    const { data, error } = await db
      .from('chat_sessions')
      .insert({ title: '새 대화', user_id: user.id })
      .select()
      .single();
    if (error) {
      console.error('세션 생성 실패:', error);
      return null;
    }
    const session = data as unknown as ChatSession;
    setSessions((prev) => [session, ...prev]);
    setActiveSessionId(session.id);
    setMessages([]);
    return session.id;
  }, [supabase, user?.id]);

  // ── 메시지 전송 ───────────────────────────────
  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || sending || waiting) return;

    setSending(true);
    try {
      let sessionId = activeSessionId;
      if (!sessionId) {
        sessionId = await createSession();
        if (!sessionId) return;
      }

      // 첫 메시지면 세션 제목을 메시지 앞부분으로 갱신
      const isFirst = messages.length === 0;

      const { error } = await db.from('chat_messages').insert({
        session_id: sessionId,
        role: 'user',
        content: text,
        status: 'pending',
      });
      if (error) {
        console.error('메시지 전송 실패:', error);
        alert('메시지 전송에 실패했습니다.');
        return;
      }

      if (isFirst) {
        const title = text.length > 30 ? text.slice(0, 30) + '…' : text;
        await db.from('chat_sessions').update({ title }).eq('id', sessionId);
        setSessions((prev) =>
          prev.map((s) => (s.id === sessionId ? { ...s, title } : s))
        );
      }

      setInput('');
      // Realtime 이 INSERT 를 전달하지만, 본인 INSERT 즉시 반영을 위해 낙관적 갱신은 reload 로 처리
      await loadMessages(sessionId);
    } finally {
      setSending(false);
    }
  }, [input, sending, waiting, activeSessionId, messages.length, supabase, createSession, loadMessages]);

  // ── 세션 삭제 ─────────────────────────────────
  const deleteSession = useCallback(
    async (sessionId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (!confirm('이 대화를 삭제할까요?')) return;
      await db.from('chat_sessions').delete().eq('id', sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      if (activeSessionId === sessionId) {
        setActiveSessionId(null);
        setMessages([]);
      }
    },
    [supabase, activeSessionId]
  );

  // 초기 로드
  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // 활성 세션 변경 시 메시지 + 피드백 로드
  useEffect(() => {
    if (activeSessionId) {
      loadMessages(activeSessionId);
      loadFeedback(activeSessionId);
    } else {
      setFeedbackMap({});
    }
    setDownFormFor(null);
  }, [activeSessionId, loadMessages, loadFeedback]);

  // 초기/세션 로드로 메시지가 바뀌면 "페인트 직전"에 하단으로 고정 → 점프가 안 보임
  useLayoutEffect(() => {
    if (!pendingScrollBottomRef.current) return;
    pendingScrollBottomRef.current = false;
    const el = messagesRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    atBottomRef.current = true;
    setShowScrollButton(false);
  }, [messages]);

  // ── Realtime 구독 ─────────────────────────────
  useEffect(() => {
    if (!activeSessionId) return;

    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    const handleRow = (payload: any) => {
      const row = payload.new as ChatMessage;
      if (!row?.id) return;
      setMessages((prev) => {
        const idx = prev.findIndex((m) => m.id === row.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = row;
          return next;
        }
        return [...prev, row];
      });
      // 강제 스크롤 금지: 이미 하단일 때만 따라가고(애니메이션 없이),
      // 위로 올려둔 상태면 움직이지 않고 "맨 아래로" 버튼만 표시
      if (atBottomRef.current) {
        scrollToBottom();
      } else {
        setShowScrollButton(true);
      }
    };

    (async () => {
      // ⚠️ chat_messages RLS 가 owner-only(session.user_id = auth.uid())라
      // Realtime postgres_changes 는 소켓에 실린 JWT 로 RLS 를 재평가함.
      // 소켓이 anon 토큰 상태로 구독되면 auth.uid() = NULL → 이벤트 0건 →
      // 새로고침 전까지 답변 미수신. 구독 직전에 사용자 토큰을 명시 주입한다.
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (token) await supabase.realtime.setAuth(token);
      if (cancelled) return;

      channel = supabase
        .channel(`chat-${activeSessionId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'chat_messages',
            filter: `session_id=eq.${activeSessionId}`,
          },
          handleRow
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [activeSessionId, supabase, scrollToBottom]);


  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 0, gap: isMobile ? 0 : '16px' }}>
      {/* 사이드바: 세션 목록 (데스크탑 전용) */}
      {!isMobile && (
      <div
        style={{
          width: '260px',
          flexShrink: 0,
          backgroundColor: '#fff',
          border: '1px solid #e5e7eb',
          borderRadius: '12px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '12px' }}>
          <button
            onClick={() => createSession()}
            style={{
              width: '100%',
              padding: '10px',
              backgroundColor: '#2563eb',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            + 새 대화
          </button>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 8px 8px' }}>
          {sessions.map((s) => (
            <div
              key={s.id}
              onClick={() => setActiveSessionId(s.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 12px',
                marginBottom: '4px',
                borderRadius: '8px',
                cursor: 'pointer',
                backgroundColor: activeSessionId === s.id ? '#eff6ff' : 'transparent',
                color: activeSessionId === s.id ? '#1d4ed8' : '#374151',
                fontSize: '14px',
              }}
            >
              <span
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {s.title || '새 대화'}
              </span>
              <span
                onClick={(e) => deleteSession(s.id, e)}
                style={{ color: '#9ca3af', padding: '0 4px', display: 'inline-flex', alignItems: 'center' }}
                title="삭제"
              >
                <X size={12} />
              </span>
            </div>
          ))}
          {sessions.length === 0 && (
            <p style={{ color: '#9ca3af', fontSize: '13px', textAlign: 'center', padding: '20px 0' }}>
              대화가 없습니다.
            </p>
          )}
        </div>
      </div>
      )}

      {/* 메인: 대화 영역 */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          backgroundColor: '#fff',
          border: isMobile ? 'none' : '1px solid #e5e7eb',
          borderRadius: isMobile ? 0 : '12px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* 모바일 전용 컨트롤 바 (세션 선택 + 새 대화) */}
        {isMobile && (
          <div
            style={{
              flexShrink: 0,
              display: 'flex',
              gap: '8px',
              padding: '10px 12px',
              borderBottom: '1px solid #e5e7eb',
              alignItems: 'center',
            }}
          >
            <select
              value={activeSessionId ?? ''}
              onChange={(e) => setActiveSessionId(e.target.value || null)}
              style={{
                flex: 1,
                minWidth: 0,
                padding: '8px 10px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '16px',
                backgroundColor: '#fff',
              }}
            >
              {sessions.length === 0 && <option value="">대화 없음</option>}
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title || '새 대화'}
                </option>
              ))}
            </select>
            <button
              onClick={() => createSession()}
              style={{
                flexShrink: 0,
                padding: '8px 14px',
                backgroundColor: '#2563eb',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              + 새 대화
            </button>
          </div>
        )}

        {/* 메시지 목록 */}
        <div
          ref={messagesRef}
          onScroll={handleScroll}
          style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: isMobile ? '14px' : '20px' }}
        >
          {/* 이전 대화 더보기 (위로 스크롤 시 자동 로드 + 수동 버튼) */}
          {!loadingMessages && messages.length > 0 && (hasMore || loadingMore) && (
            <div style={{ textAlign: 'center', padding: '4px 0 12px' }}>
              {loadingMore ? (
                <span style={{ color: '#9ca3af', fontSize: '13px' }}>이전 대화 불러오는 중…</span>
              ) : (
                <button
                  onClick={() => loadOlder()}
                  style={{
                    padding: '6px 14px',
                    backgroundColor: '#f3f4f6',
                    color: '#374151',
                    border: '1px solid #e5e7eb',
                    borderRadius: '999px',
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  이전 대화 더보기
                </button>
              )}
            </div>
          )}

          {loadingMessages ? (
            <p style={{ color: '#9ca3af', textAlign: 'center' }}>불러오는 중…</p>
          ) : messages.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#9ca3af', marginTop: '60px' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}><Bot size={40} /></div>
              <p style={{ fontSize: '15px' }}>업무 규정, 기안문 작성, 데이터 조회 등 무엇이든 물어보세요.</p>
            </div>
          ) : (
            messages.map((m) => (
              <div
                key={m.id}
                style={{
                  display: 'flex',
                  justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
                  marginBottom: '12px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: m.role === 'user' ? 'flex-end' : 'flex-start',
                    maxWidth: '75%',
                  }}
                >
                  <div
                    style={{
                      padding: '10px 14px',
                      borderRadius: '12px',
                      backgroundColor: m.role === 'user' ? '#2563eb' : '#f3f4f6',
                      color: m.role === 'user' ? '#fff' : '#111827',
                      fontSize: '14px',
                      lineHeight: 1.6,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}
                  >
                    {m.content}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '4px 4px 0' }}>
                    <span style={{ fontSize: '11px', color: '#9ca3af' }}>
                      {formatMessageTime(m.created_at)}
                    </span>
                    {/* 답변 피드백 (완료된 assistant 답변에만) */}
                    {m.role === 'assistant' && m.status === 'completed' && (
                      <span style={{ display: 'inline-flex', gap: '2px' }}>
                        <button
                          onClick={() => handleThumbUp(m)}
                          disabled={savingFeedback}
                          title={feedbackMap[m.id]?.rating === 'up' ? '좋아요 취소' : '좋아요'}
                          aria-label="좋아요"
                          style={{
                            border: 'none',
                            background: 'transparent',
                            padding: '2px 4px',
                            cursor: savingFeedback ? 'default' : 'pointer',
                            color: feedbackMap[m.id]?.rating === 'up' ? '#2563eb' : '#c4c9d2',
                            display: 'inline-flex',
                            alignItems: 'center',
                          }}
                        >
                          <ThumbsUp size={14} fill={feedbackMap[m.id]?.rating === 'up' ? 'currentColor' : 'none'} />
                        </button>
                        <button
                          onClick={() => handleThumbDown(m)}
                          disabled={savingFeedback}
                          title={feedbackMap[m.id]?.rating === 'down' ? '싫어요 수정' : '싫어요'}
                          aria-label="싫어요"
                          style={{
                            border: 'none',
                            background: 'transparent',
                            padding: '2px 4px',
                            cursor: savingFeedback ? 'default' : 'pointer',
                            color: feedbackMap[m.id]?.rating === 'down' ? '#dc2626' : '#c4c9d2',
                            display: 'inline-flex',
                            alignItems: 'center',
                          }}
                        >
                          <ThumbsDown size={14} fill={feedbackMap[m.id]?.rating === 'down' ? 'currentColor' : 'none'} />
                        </button>
                      </span>
                    )}
                  </div>

                  {/* 싫어요 사유 입력 폼 (인라인) */}
                  {downFormFor === m.id && (
                    <div
                      style={{
                        marginTop: '6px',
                        padding: '10px 12px',
                        border: '1px solid #e5e7eb',
                        borderRadius: '10px',
                        backgroundColor: '#fff',
                        width: '100%',
                        boxSizing: 'border-box',
                      }}
                    >
                      <p style={{ margin: '0 0 8px', fontSize: '12px', fontWeight: 600, color: '#374151' }}>
                        어떤 점이 아쉬웠나요?
                      </p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                        {FEEDBACK_REASONS.map((r) => (
                          <button
                            key={r.value}
                            onClick={() => setDownReason(r.value)}
                            style={{
                              padding: '4px 10px',
                              borderRadius: '999px',
                              border: `1px solid ${downReason === r.value ? '#dc2626' : '#d1d5db'}`,
                              backgroundColor: downReason === r.value ? '#fef2f2' : '#fff',
                              color: downReason === r.value ? '#dc2626' : '#4b5563',
                              fontSize: '12px',
                              cursor: 'pointer',
                            }}
                          >
                            {r.label}
                          </button>
                        ))}
                      </div>
                      <textarea
                        value={downComment}
                        onChange={(e) => setDownComment(e.target.value)}
                        placeholder="자세한 내용 (선택)"
                        rows={2}
                        style={{
                          width: '100%',
                          boxSizing: 'border-box',
                          resize: 'none',
                          padding: '8px 10px',
                          border: '1px solid #d1d5db',
                          borderRadius: '8px',
                          fontSize: isMobile ? '16px' : '13px',
                          fontFamily: 'inherit',
                          marginBottom: '8px',
                        }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                        {feedbackMap[m.id]?.rating === 'down' && (
                          <button
                            onClick={() => removeFeedback(m.id)}
                            disabled={savingFeedback}
                            style={{
                              padding: '6px 12px',
                              border: '1px solid #d1d5db',
                              borderRadius: '8px',
                              backgroundColor: '#fff',
                              color: '#6b7280',
                              fontSize: '12px',
                              cursor: 'pointer',
                              marginRight: 'auto',
                            }}
                          >
                            피드백 삭제
                          </button>
                        )}
                        <button
                          onClick={() => setDownFormFor(null)}
                          style={{
                            padding: '6px 12px',
                            border: '1px solid #d1d5db',
                            borderRadius: '8px',
                            backgroundColor: '#fff',
                            color: '#4b5563',
                            fontSize: '12px',
                            cursor: 'pointer',
                          }}
                        >
                          취소
                        </button>
                        <button
                          onClick={() => upsertFeedback(m, 'down', downReason, downComment)}
                          disabled={savingFeedback || !downReason}
                          style={{
                            padding: '6px 14px',
                            border: 'none',
                            borderRadius: '8px',
                            backgroundColor: savingFeedback || !downReason ? '#fca5a5' : '#dc2626',
                            color: '#fff',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: savingFeedback || !downReason ? 'not-allowed' : 'pointer',
                          }}
                        >
                          {savingFeedback ? '저장 중…' : '제출'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}

          {waiting && (
            <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '12px' }}>
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: '12px',
                  backgroundColor: '#f3f4f6',
                  color: '#6b7280',
                  fontSize: '14px',
                }}
              >
                <span className="hermes-typing">답변 작성 중…</span>
              </div>
            </div>
          )}

          {lastError && (
            <p style={{ color: '#dc2626', fontSize: '13px', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <AlertTriangle size={14} /> 응답 처리에 실패했습니다. 릴레이/Hermes 서버 상태를 확인하세요.
            </p>
          )}
        </div>

        {/* 맨 아래로 이동 버튼 (위로 올려둔 동안만 표시, 강제 스크롤 대신 수동 이동) */}
        {showScrollButton && (
          <button
            onClick={() => {
              scrollToBottom();
              atBottomRef.current = true;
              setShowScrollButton(false);
            }}
            aria-label="맨 아래로"
            style={{
              position: 'absolute',
              right: '16px',
              bottom: '76px',
              zIndex: 5,
              width: '40px',
              height: '40px',
              borderRadius: '999px',
              border: '1px solid #e5e7eb',
              backgroundColor: '#fff',
              color: '#2563eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            }}
          >
            <ChevronDown size={20} />
          </button>
        )}

        {/* 입력창 */}
        <div style={{ borderTop: '1px solid #e5e7eb', padding: '12px', display: 'flex', gap: '8px' }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="메시지를 입력하세요. (Shift+Enter 줄바꿈)"
            rows={1}
            style={{
              flex: 1,
              resize: 'none',
              padding: '10px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              // iOS는 16px 미만 입력 포커스 시 자동 줌인 → 모바일은 16px로 고정해 확대 방지
              fontSize: isMobile ? '16px' : '14px',
              fontFamily: 'inherit',
              lineHeight: 1.5,
              maxHeight: '120px',
            }}
          />
          <button
            onClick={sendMessage}
            disabled={sending || waiting || !input.trim()}
            style={{
              padding: '0 20px',
              backgroundColor: sending || waiting || !input.trim() ? '#93c5fd' : '#2563eb',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: sending || waiting || !input.trim() ? 'not-allowed' : 'pointer',
            }}
          >
            전송
          </button>
        </div>
      </div>
    </div>
  );
}

export default ChatAssistant;
