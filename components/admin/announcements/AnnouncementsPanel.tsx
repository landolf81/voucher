'use client';

/**
 * 공지 — 전체 / 사업장 공지 + 필독(읽음) 추적
 *
 * - 조회: 모든 직원(RLS로 본인 scope 만). 작성/수정/삭제: admin 만.
 * - 공지를 펼쳐 내용을 보면 읽음 처리(announcement_reads upsert).
 * - admin 은 공지별 미열람자 명단 확인 가능.
 * - Realtime(announcements) 구독으로 실시간 반영.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabase';
import { useAuth } from '@/lib/contexts/AuthContext';

interface Announcement {
  id: string;
  title: string;
  content: string;
  scope: 'all' | 'site';
  site_id: string | null;
  pinned: boolean;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
}
interface SiteRow {
  id: string;
  site_name: string;
}
interface StaffRow {
  id: string;
  name: string;
  role: string;
  site_id: string | null;
  site_name: string | null;
}

interface FormState {
  id: string | null;
  title: string;
  content: string;
  scope: 'all' | 'site';
  site_id: string;
  pinned: boolean;
}

const emptyForm = (): FormState => ({ id: null, title: '', content: '', scope: 'all', site_id: '', pinned: false });

export function AnnouncementsPanel() {
  const supabase = getSupabaseClient();
  const db = supabase as any;
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [items, setItems] = useState<Announcement[]>([]);
  const [readSet, setReadSet] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<string | null>(null);
  const [sites, setSites] = useState<SiteRow[]>([]);

  const [editorOpen, setEditorOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);

  // 미열람자 모달
  const [unreadOpen, setUnreadOpen] = useState(false);
  const [unreadList, setUnreadList] = useState<StaffRow[]>([]);
  const [readCount, setReadCount] = useState(0);
  const [unreadLoading, setUnreadLoading] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) return;
    const { data, error } = await db
      .from('announcements')
      .select('*')
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) {
      console.error('공지 로드 실패:', error);
      return;
    }
    setItems((data as Announcement[]) || []);

    const { data: reads } = await db
      .from('announcement_reads')
      .select('announcement_id')
      .eq('user_id', user.id);
    setReadSet(new Set((reads || []).map((r: any) => r.announcement_id)));
  }, [db, user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  // 사이트 목록 (admin 작성용)
  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      const { data } = await db.from('sites').select('id, site_name').order('site_name');
      setSites((data as SiteRow[]) || []);
    })();
  }, [db, isAdmin]);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel('announcements-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, load]);

  const markRead = async (id: string) => {
    if (!user?.id || readSet.has(id)) return;
    await db
      .from('announcement_reads')
      .upsert({ announcement_id: id, user_id: user.id }, { onConflict: 'announcement_id,user_id', ignoreDuplicates: true });
    setReadSet((prev) => new Set(prev).add(id));
  };

  const toggleExpand = (a: Announcement) => {
    if (expanded === a.id) {
      setExpanded(null);
    } else {
      setExpanded(a.id);
      markRead(a.id);
    }
  };

  const openCreate = () => {
    setForm(emptyForm());
    setEditorOpen(true);
  };
  const openEdit = (a: Announcement) => {
    setForm({ id: a.id, title: a.title, content: a.content, scope: a.scope, site_id: a.site_id || '', pinned: a.pinned });
    setEditorOpen(true);
  };

  const save = async () => {
    if (!form.title.trim() || !form.content.trim()) {
      alert('제목과 내용을 입력하세요.');
      return;
    }
    if (form.scope === 'site' && !form.site_id) {
      alert('사업장을 선택하세요.');
      return;
    }
    if (!user?.id) return;
    setSaving(true);
    try {
      if (form.id) {
        const { error } = await db
          .from('announcements')
          .update({
            title: form.title.trim(),
            content: form.content.trim(),
            scope: form.scope,
            site_id: form.scope === 'site' ? form.site_id : null,
            pinned: form.pinned,
          })
          .eq('id', form.id);
        if (error) throw error;
      } else {
        const { error } = await db.from('announcements').insert({
          title: form.title.trim(),
          content: form.content.trim(),
          scope: form.scope,
          site_id: form.scope === 'site' ? form.site_id : null,
          pinned: form.pinned,
          created_by: user.id,
          created_by_name: user.name,
        });
        if (error) throw error;
      }
      setEditorOpen(false);
      await load();
    } catch (e: any) {
      console.error('공지 저장 실패:', e);
      alert('저장에 실패했습니다. ' + (e?.message || ''));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (a: Announcement) => {
    if (!confirm('이 공지를 삭제할까요?')) return;
    const { error } = await db.from('announcements').delete().eq('id', a.id);
    if (error) {
      alert('삭제에 실패했습니다.');
      return;
    }
    await load();
  };

  const showUnread = async (a: Announcement) => {
    setUnreadOpen(true);
    setUnreadLoading(true);
    setUnreadList([]);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const [staffRes, readsRes] = await Promise.all([
        fetch('/api/staff', { headers: { Authorization: `Bearer ${session?.access_token}` } }).then((r) => r.json()),
        db.from('announcement_reads').select('user_id').eq('announcement_id', a.id),
      ]);
      const allStaff: StaffRow[] = staffRes.success ? staffRes.data.staff : [];
      const targets = a.scope === 'site' ? allStaff.filter((s) => s.site_id === a.site_id) : allStaff;
      const readUserIds = new Set((readsRes.data || []).map((r: any) => r.user_id));
      setReadCount(targets.filter((s) => readUserIds.has(s.id)).length);
      setUnreadList(targets.filter((s) => !readUserIds.has(s.id)));
    } catch (e) {
      console.error(e);
      alert('미열람자 조회에 실패했습니다.');
    } finally {
      setUnreadLoading(false);
    }
  };

  const siteName = (id: string | null) => sites.find((s) => s.id === id)?.site_name || (user?.site_id === id ? user?.site_name : '') || '사업장';

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 16, fontWeight: 700, color: '#1f2937' }}>공지</span>
        {isAdmin && <button onClick={openCreate} style={primaryBtn}>＋ 공지 작성</button>}
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {items.length === 0 ? (
          <p style={{ color: '#9ca3af', fontSize: 14, textAlign: 'center', padding: 24 }}>공지가 없습니다.</p>
        ) : (
          items.map((a) => {
            const isRead = readSet.has(a.id);
            const open = expanded === a.id;
            return (
              <div key={a.id} style={{ border: '1px solid #e5e7eb', borderRadius: 12, backgroundColor: '#fff', marginBottom: 10, overflow: 'hidden' }}>
                <div onClick={() => toggleExpand(a)} style={{ padding: '14px 16px', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  {!isRead && <span style={{ marginTop: 6, width: 8, height: 8, borderRadius: 999, backgroundColor: '#ef4444', flexShrink: 0 }} />}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      {a.pinned && <span style={{ fontSize: 11, color: '#dc2626' }}>📌 고정</span>}
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, backgroundColor: a.scope === 'all' ? '#dbeafe' : '#dcfce7', color: a.scope === 'all' ? '#1d4ed8' : '#15803d' }}>
                        {a.scope === 'all' ? '전체' : siteName(a.site_id)}
                      </span>
                      <span style={{ fontWeight: isRead ? 600 : 700, color: '#1f2937', fontSize: 15 }}>{a.title}</span>
                    </div>
                    <div style={{ color: '#9ca3af', fontSize: 12, marginTop: 4 }}>
                      {a.created_by_name} · {new Date(a.created_at).toLocaleString('ko-KR', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <span style={{ color: '#cbd5e1' }}>{open ? '▲' : '▼'}</span>
                </div>
                {open && (
                  <div style={{ padding: '0 16px 16px', borderTop: '1px solid #f8fafc' }}>
                    <p style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: '#374151', fontSize: 14, lineHeight: 1.6, margin: '12px 0' }}>
                      {a.content}
                    </p>
                    {isAdmin && (
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <button onClick={() => showUnread(a)} style={ghostBtn}>미열람자</button>
                        <button onClick={() => openEdit(a)} style={ghostBtn}>수정</button>
                        <button onClick={() => remove(a)} style={{ ...ghostBtn, color: '#dc2626', borderColor: '#fecaca' }}>삭제</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* 작성/수정 모달 */}
      {editorOpen && (
        <div onClick={() => setEditorOpen(false)} style={modalBackdrop}>
          <div onClick={(e) => e.stopPropagation()} style={{ ...modalBox, maxWidth: 520 }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 17, fontWeight: 700 }}>{form.id ? '공지 수정' : '공지 작성'}</h3>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="제목" style={{ ...inputStyle, marginBottom: 10 }} />
            <textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder="내용" rows={8} style={{ ...inputStyle, marginBottom: 10, resize: 'vertical' }} />
            <div style={{ display: 'flex', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
              <select value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value as 'all' | 'site' })} style={{ ...inputStyle, width: 'auto' }}>
                <option value="all">전체 공지</option>
                <option value="site">사업장 공지</option>
              </select>
              {form.scope === 'site' && (
                <select value={form.site_id} onChange={(e) => setForm({ ...form, site_id: e.target.value })} style={{ ...inputStyle, width: 'auto' }}>
                  <option value="">사업장 선택</option>
                  {sites.map((s) => (
                    <option key={s.id} value={s.id}>{s.site_name}</option>
                  ))}
                </select>
              )}
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
                <input type="checkbox" checked={form.pinned} onChange={(e) => setForm({ ...form, pinned: e.target.checked })} />
                상단 고정
              </label>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
              <button onClick={() => setEditorOpen(false)} style={ghostBtn}>취소</button>
              <button onClick={save} disabled={saving} style={primaryBtn}>{saving ? '저장 중…' : '저장'}</button>
            </div>
          </div>
        </div>
      )}

      {/* 미열람자 모달 */}
      {unreadOpen && (
        <div onClick={() => setUnreadOpen(false)} style={modalBackdrop}>
          <div onClick={(e) => e.stopPropagation()} style={{ ...modalBox, maxWidth: 420 }}>
            <h3 style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 700 }}>미열람자</h3>
            {!unreadLoading && (
              <p style={{ color: '#6b7280', fontSize: 13, margin: '0 0 12px' }}>
                읽음 {readCount}명 · 미열람 {unreadList.length}명
              </p>
            )}
            <div style={{ maxHeight: 320, overflowY: 'auto', border: '1px solid #f1f5f9', borderRadius: 8 }}>
              {unreadLoading ? (
                <p style={{ color: '#9ca3af', fontSize: 13, padding: 16, textAlign: 'center' }}>불러오는 중…</p>
              ) : unreadList.length === 0 ? (
                <p style={{ color: '#15803d', fontSize: 13, padding: 16, textAlign: 'center' }}>전원이 확인했습니다 ✅</p>
              ) : (
                unreadList.map((s) => (
                  <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', borderBottom: '1px solid #f8fafc', fontSize: 14 }}>
                    <span style={{ color: '#1f2937', fontWeight: 600 }}>{s.name}</span>
                    <span style={{ color: '#9ca3af', fontSize: 12 }}>{s.site_name || ''}</span>
                  </div>
                ))
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
              <button onClick={() => setUnreadOpen(false)} style={ghostBtn}>닫기</button>
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
  padding: '7px 14px',
  backgroundColor: '#fff',
  color: '#374151',
  border: '1px solid #e5e7eb',
  borderRadius: 8,
  fontSize: 13,
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

export default AnnouncementsPanel;
