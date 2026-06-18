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

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { getSupabaseClient } from '@/lib/supabase';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useDevice } from '@/lib/hooks/useDevice';

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

interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
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

  const bottomRef = useRef<HTMLDivElement>(null);

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

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }));
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
    setActiveSessionId((prev) => prev ?? list[0]?.id ?? null);
  }, [supabase, user?.id]);

  // ── 메시지 로드 ────────────────────────────────
  const loadMessages = useCallback(
    async (sessionId: string) => {
      setLoadingMessages(true);
      const { data, error } = await db
        .from('chat_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });
      setLoadingMessages(false);
      if (error) {
        console.error('메시지 로드 실패:', error);
        return;
      }
      setMessages((data as unknown as ChatMessage[]) || []);
      scrollToBottom();
    },
    [supabase, scrollToBottom]
  );

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

  // 활성 세션 변경 시 메시지 로드
  useEffect(() => {
    if (activeSessionId) loadMessages(activeSessionId);
  }, [activeSessionId, loadMessages]);

  // ── Realtime 구독 ─────────────────────────────
  useEffect(() => {
    if (!activeSessionId) return;

    const channel = supabase
      .channel(`chat-${activeSessionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_messages',
          filter: `session_id=eq.${activeSessionId}`,
        },
        (payload: any) => {
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
          scrollToBottom();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeSessionId, supabase, scrollToBottom]);

  useEffect(() => {
    scrollToBottom();
  }, [messages.length, scrollToBottom]);

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
                style={{ color: '#9ca3af', fontSize: '12px', padding: '0 4px' }}
                title="삭제"
              >
                ✕
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
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: isMobile ? '14px' : '20px' }}>
          {loadingMessages ? (
            <p style={{ color: '#9ca3af', textAlign: 'center' }}>불러오는 중…</p>
          ) : messages.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#9ca3af', marginTop: '60px' }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>🤖</div>
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
                    maxWidth: '75%',
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
            <p style={{ color: '#dc2626', fontSize: '13px', textAlign: 'center' }}>
              ⚠️ 응답 처리에 실패했습니다. 릴레이/Hermes 서버 상태를 확인하세요.
            </p>
          )}

          <div ref={bottomRef} />
        </div>

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
