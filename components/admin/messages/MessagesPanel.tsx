'use client';

/**
 * 임직원 쪽지 — 1:1 / 그룹 대화
 *
 * - 데이터는 RLS 기반으로 클라이언트에서 직접 조회/작성 (schedule 패턴).
 * - 수신자 목록만 service_role API(/api/staff)로 가져온다 (auth.users 접근 필요).
 * - Realtime(messages) 구독으로 실시간 수신.
 * - 안읽음은 participant.last_read_at 기준. 스레드를 열면 읽음 처리.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabase';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useDevice } from '@/lib/hooks/useDevice';

interface ThreadRow {
  id: string;
  type: 'direct' | 'group';
  title: string | null;
  created_by: string | null;
  last_message_at: string | null;
}
interface ParticipantRow {
  thread_id: string;
  user_id: string;
  user_name: string | null;
  last_read_at: string;
}
interface MessageRow {
  id: string;
  thread_id: string;
  sender_id: string | null;
  sender_name: string | null;
  content: string;
  created_at: string;
}
interface StaffRow {
  id: string;
  name: string;
  role: string;
  site_id: string | null;
  site_name: string | null;
}

interface ThreadView {
  thread: ThreadRow;
  myLastRead: string;
  others: { user_id: string; user_name: string | null }[];
  label: string;
  unread: boolean;
}

export function MessagesPanel() {
  const supabase = getSupabaseClient();
  const db = supabase as any;
  const { user } = useAuth();
  const device = useDevice();
  const isMobile = device.isMobile;

  const [threads, setThreads] = useState<ThreadView[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);

  // 새 쪽지 모달
  const [composeOpen, setComposeOpen] = useState(false);
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Record<string, StaffRow>>({});
  const [groupTitle, setGroupTitle] = useState('');

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const activeIdRef = useRef<string | null>(null);
  const sendingRef = useRef(false);
  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  // ── 스레드 목록 로드 ──
  const loadThreads = useCallback(async () => {
    if (!user?.id) return;
    const { data: parts, error } = await db
      .from('message_participants')
      .select('thread_id, user_id, user_name, last_read_at, thread:message_threads(id, type, title, created_by, last_message_at)')
      .order('last_read_at', { ascending: false });
    if (error) {
      console.error('스레드 로드 실패:', error);
      return;
    }
    const rows = (parts || []) as any[];
    // 내가 속한 스레드 id
    const myThreadIds = rows.filter((r) => r.user_id === user.id).map((r) => r.thread_id);
    if (myThreadIds.length === 0) {
      setThreads([]);
      return;
    }
    // 스레드별 참가자 묶기
    const byThread = new Map<string, { thread: ThreadRow; parts: ParticipantRow[] }>();
    for (const r of rows) {
      if (!myThreadIds.includes(r.thread_id)) continue;
      if (!r.thread) continue;
      if (!byThread.has(r.thread_id)) {
        byThread.set(r.thread_id, { thread: r.thread as ThreadRow, parts: [] });
      }
      byThread.get(r.thread_id)!.parts.push({
        thread_id: r.thread_id,
        user_id: r.user_id,
        user_name: r.user_name,
        last_read_at: r.last_read_at,
      });
    }
    const views: ThreadView[] = [];
    byThread.forEach(({ thread, parts }) => {
      const mine = parts.find((p) => p.user_id === user.id);
      const others = parts.filter((p) => p.user_id !== user.id).map((p) => ({ user_id: p.user_id, user_name: p.user_name }));
      const myLastRead = mine?.last_read_at || '1970-01-01T00:00:00Z';
      const label =
        thread.type === 'group'
          ? thread.title || `그룹 (${parts.length}명)`
          : others[0]?.user_name || '(알 수 없음)';
      const unread = !!thread.last_message_at && new Date(thread.last_message_at) > new Date(myLastRead);
      views.push({ thread, myLastRead, others, label, unread });
    });
    views.sort((a, b) => {
      const ta = a.thread.last_message_at ? +new Date(a.thread.last_message_at) : 0;
      const tb = b.thread.last_message_at ? +new Date(b.thread.last_message_at) : 0;
      return tb - ta;
    });
    setThreads(views);
  }, [db, user?.id]);

  useEffect(() => {
    loadThreads();
  }, [loadThreads]);

  // ── 메시지 로드 + 읽음 처리 ──
  const markRead = useCallback(
    async (threadId: string) => {
      if (!user?.id) return;
      await db
        .from('message_participants')
        .update({ last_read_at: new Date().toISOString() })
        .eq('thread_id', threadId)
        .eq('user_id', user.id);
    },
    [db, user?.id]
  );

  const openThread = useCallback(
    async (threadId: string) => {
      setActiveId(threadId);
      setLoading(true);
      const { data, error } = await db
        .from('messages')
        .select('*')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true });
      setLoading(false);
      if (error) {
        console.error('메시지 로드 실패:', error);
        return;
      }
      setMessages((data as MessageRow[]) || []);
      await markRead(threadId);
      // 목록의 unread 해제
      setThreads((prev) => prev.map((t) => (t.thread.id === threadId ? { ...t, unread: false } : t)));
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    },
    [db, markRead]
  );

  // ── Realtime: 새 메시지 ──
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel('messages-rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload: any) => {
        const m = payload.new as MessageRow;
        // 자기 메시지는 send()에서 이미 낙관적으로 추가했으므로 Realtime 에서는 무시(중복 방지).
        if (m.sender_id !== user.id && m.thread_id === activeIdRef.current) {
          setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
          markRead(m.thread_id);
          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
        }
        loadThreads();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, user?.id, loadThreads, markRead]);

  // ── 메시지 전송 ──
  const send = async () => {
    const content = input.trim();
    if (!content || !activeId || !user?.id) return;
    if (sendingRef.current) return; // 동시 이중 호출(IME Enter 중복 등) 차단
    sendingRef.current = true;
    setSending(true);
    try {
      // insert 응답으로 받은 행을 즉시 화면에 추가(낙관적). Realtime 은 타인 메시지만 반영하므로 중복 없음.
      const { data: inserted, error } = await db
        .from('messages')
        .insert({
          thread_id: activeId,
          sender_id: user.id,
          sender_name: user.name,
          content,
        })
        .select()
        .single();
      if (error) throw error;
      if (inserted) {
        const row = inserted as MessageRow;
        setMessages((prev) => (prev.some((x) => x.id === row.id) ? prev : [...prev, row]));
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      }
      setInput('');
      await markRead(activeId);
    } catch (e: any) {
      console.error('전송 실패:', e);
      alert('전송에 실패했습니다. ' + (e?.message || ''));
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  // ── 새 쪽지: 직원 목록 ──
  const openCompose = async () => {
    setComposeOpen(true);
    setSelected({});
    setGroupTitle('');
    setSearch('');
    if (staff.length === 0) {
      setStaffLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch('/api/staff', {
          headers: { Authorization: `Bearer ${session?.access_token}` },
        });
        const json = await res.json();
        if (json.success) {
          setStaff((json.data.staff as StaffRow[]).filter((s) => s.id !== user?.id));
        } else {
          alert('직원 목록을 불러오지 못했습니다.');
        }
      } catch (e) {
        console.error(e);
        alert('직원 목록을 불러오지 못했습니다.');
      } finally {
        setStaffLoading(false);
      }
    }
  };

  const toggleSelect = (s: StaffRow) => {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[s.id]) delete next[s.id];
      else next[s.id] = s;
      return next;
    });
  };

  const startConversation = async () => {
    if (!user?.id) return;
    const targets = Object.values(selected);
    if (targets.length === 0) {
      alert('수신자를 선택하세요.');
      return;
    }
    const isGroup = targets.length > 1;
    if (isGroup && !groupTitle.trim()) {
      alert('그룹 제목을 입력하세요.');
      return;
    }

    // 1:1 기존 스레드 재사용
    if (!isGroup) {
      const target = targets[0];
      const existing = threads.find(
        (t) => t.thread.type === 'direct' && t.others.length === 1 && t.others[0].user_id === target.id
      );
      if (existing) {
        setComposeOpen(false);
        await openThread(existing.thread.id);
        return;
      }
    }

    try {
      const { data: created, error: tErr } = await db
        .from('message_threads')
        .insert({
          type: isGroup ? 'group' : 'direct',
          title: isGroup ? groupTitle.trim() : null,
          created_by: user.id,
          created_by_name: user.name,
        })
        .select()
        .single();
      if (tErr) throw tErr;
      const threadId = (created as ThreadRow).id;

      // bulk insert 는 행마다 키가 다르면 누락 키를 명시 null 로 채워 NOT NULL 을 위반하므로
      // 모든 행에 last_read_at 을 명시한다. 생성자는 읽음(now), 수신자는 안읽음(epoch).
      const epoch = '1970-01-01T00:00:00Z';
      const rows = [
        { thread_id: threadId, user_id: user.id, user_name: user.name, last_read_at: new Date().toISOString() },
        ...targets.map((t) => ({ thread_id: threadId, user_id: t.id, user_name: t.name, last_read_at: epoch })),
      ];
      const { error: pErr } = await db.from('message_participants').insert(rows);
      if (pErr) throw pErr;

      setComposeOpen(false);
      await loadThreads();
      await openThread(threadId);
    } catch (e: any) {
      console.error('대화 생성 실패:', e);
      alert('대화를 시작하지 못했습니다. ' + (e?.message || ''));
    }
  };

  const filteredStaff = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return staff;
    return staff.filter((s) => s.name.toLowerCase().includes(q) || (s.site_name || '').toLowerCase().includes(q));
  }, [staff, search]);

  const activeThread = threads.find((t) => t.thread.id === activeId);
  const showList = !isMobile || !activeId;
  const showChat = !isMobile || !!activeId;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 16, fontWeight: 700, color: '#1f2937' }}>쪽지</span>
        <button onClick={openCompose} style={primaryBtn}>＋ 새 쪽지</button>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 12, border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden', backgroundColor: '#fff' }}>
        {/* 스레드 목록 */}
        {showList && (
          <div style={{ width: isMobile ? '100%' : 300, borderRight: isMobile ? 'none' : '1px solid #f1f5f9', overflowY: 'auto' }}>
            {threads.length === 0 ? (
              <p style={{ color: '#9ca3af', fontSize: 13, padding: 16, textAlign: 'center' }}>대화가 없습니다.</p>
            ) : (
              threads.map((t) => (
                <div
                  key={t.thread.id}
                  onClick={() => openThread(t.thread.id)}
                  style={{
                    padding: '12px 14px',
                    borderBottom: '1px solid #f8fafc',
                    cursor: 'pointer',
                    backgroundColor: activeId === t.thread.id ? '#eff6ff' : 'transparent',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: t.unread ? 700 : 600, color: '#1f2937', fontSize: 14 }}>
                      {t.thread.type === 'group' ? '👥 ' : ''}
                      {t.label}
                    </span>
                    {t.unread && <span style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: '#ef4444' }} />}
                  </div>
                  <div style={{ color: '#9ca3af', fontSize: 11, marginTop: 2 }}>
                    {t.thread.last_message_at ? new Date(t.thread.last_message_at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* 대화 영역 */}
        {showChat && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            {!activeId ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#cbd5e1', fontSize: 14 }}>
                대화를 선택하세요.
              </div>
            ) : (
              <>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 8 }}>
                  {isMobile && (
                    <button onClick={() => setActiveId(null)} style={{ ...ghostBtn, padding: '4px 10px' }}>← 목록</button>
                  )}
                  <span style={{ fontWeight: 700, color: '#1f2937' }}>{activeThread?.label}</span>
                  {activeThread?.thread.type === 'group' && (
                    <span style={{ color: '#9ca3af', fontSize: 12 }}>
                      {(activeThread.others.map((o) => o.user_name).filter(Boolean).join(', '))}
                    </span>
                  )}
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: 16, backgroundColor: '#f8fafc' }}>
                  {loading && <p style={{ color: '#9ca3af', textAlign: 'center', fontSize: 13 }}>불러오는 중…</p>}
                  {messages.map((m) => {
                    const mine = m.sender_id === user?.id;
                    return (
                      <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: mine ? 'flex-end' : 'flex-start', marginBottom: 10 }}>
                        {!mine && <span style={{ fontSize: 11, color: '#6b7280', marginBottom: 2 }}>{m.sender_name}</span>}
                        <div style={{ maxWidth: '75%', padding: '8px 12px', borderRadius: 12, backgroundColor: mine ? '#2563eb' : '#fff', color: mine ? '#fff' : '#1f2937', border: mine ? 'none' : '1px solid #e5e7eb', fontSize: 14, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                          {m.content}
                        </div>
                        <span style={{ fontSize: 10, color: '#cbd5e1', marginTop: 2 }}>
                          {new Date(m.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    );
                  })}
                  <div ref={bottomRef} />
                </div>
                <div style={{ display: 'flex', gap: 8, padding: 12, borderTop: '1px solid #f1f5f9' }}>
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      // 한글 IME 조합 중 Enter(크롬에서 keydown 중복 발생) 는 무시
                      if (e.nativeEvent.isComposing || e.keyCode === 229) return;
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        send();
                      }
                    }}
                    placeholder="메시지를 입력하세요 (Enter 전송, Shift+Enter 줄바꿈)"
                    rows={1}
                    style={{ flex: 1, padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 10, fontSize: 15, fontFamily: 'inherit', resize: 'none', boxSizing: 'border-box' }}
                  />
                  <button onClick={send} disabled={sending || !input.trim()} style={{ ...primaryBtn, opacity: sending || !input.trim() ? 0.5 : 1 }}>
                    전송
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* 새 쪽지 모달 */}
      {composeOpen && (
        <div onClick={() => setComposeOpen(false)} style={modalBackdrop}>
          <div onClick={(e) => e.stopPropagation()} style={{ ...modalBox, maxWidth: 460 }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 17, fontWeight: 700 }}>새 쪽지</h3>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="이름 / 사업장 검색"
              style={{ ...inputStyle, marginBottom: 10 }}
            />
            {Object.keys(selected).length > 1 && (
              <input
                value={groupTitle}
                onChange={(e) => setGroupTitle(e.target.value)}
                placeholder="그룹 제목 (2명 이상 선택 시 필수)"
                style={{ ...inputStyle, marginBottom: 10 }}
              />
            )}
            <div style={{ maxHeight: 300, overflowY: 'auto', border: '1px solid #f1f5f9', borderRadius: 8 }}>
              {staffLoading ? (
                <p style={{ color: '#9ca3af', fontSize: 13, padding: 16, textAlign: 'center' }}>불러오는 중…</p>
              ) : filteredStaff.length === 0 ? (
                <p style={{ color: '#9ca3af', fontSize: 13, padding: 16, textAlign: 'center' }}>직원이 없습니다.</p>
              ) : (
                filteredStaff.map((s) => (
                  <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderBottom: '1px solid #f8fafc', cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!selected[s.id]} onChange={() => toggleSelect(s)} />
                    <span style={{ fontWeight: 600, color: '#1f2937', fontSize: 14 }}>{s.name}</span>
                    <span style={{ color: '#9ca3af', fontSize: 12 }}>{s.site_name || ''} · {s.role}</span>
                  </label>
                ))
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button onClick={() => setComposeOpen(false)} style={ghostBtn}>취소</button>
              <button onClick={startConversation} style={primaryBtn}>
                {Object.keys(selected).length > 1 ? '그룹 대화 시작' : '대화 시작'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 11px',
  border: '1px solid #d1d5db',
  borderRadius: 8,
  fontSize: 15,
  fontFamily: 'inherit',
  boxSizing: 'border-box',
};
const primaryBtn: React.CSSProperties = {
  padding: '9px 16px',
  backgroundColor: '#2563eb',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
};
const ghostBtn: React.CSSProperties = {
  padding: '9px 16px',
  backgroundColor: '#fff',
  color: '#374151',
  border: '1px solid #e5e7eb',
  borderRadius: 8,
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
};
const modalBackdrop: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(0,0,0,0.4)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 2000,
  padding: 16,
};
const modalBox: React.CSSProperties = {
  backgroundColor: '#fff',
  borderRadius: 14,
  width: '100%',
  maxHeight: '90vh',
  overflowY: 'auto',
  padding: 20,
};

export default MessagesPanel;
