'use client';

/**
 * 감정평가 게시판 — 평가서(요청·기록) + 직원 댓글 + 안읽음 추적
 *
 * - 조회: 전 직원(RLS authenticated 전체). 작성: 누구나(본인 명의). 수정/삭제: 작성자 또는 admin.
 * - 평가서 1건 = 글 1개. 구분(부동산/공장물건/기타)에 따라 입력 필드가 달라짐:
 *   · 부동산(기본): 소재지·물건종류·토지/건물면적
 *   · 공장물건: 부동산 필드 + 기계·기구 정보(item_info)
 *   · 기타: 대상 물품 정보(item_info)
 * - 공통: 감정평가액·평가자·평가일 + 본문(LLM 작성 가능) + 첨부(사진/파일).
 * - 글을 펼치면 읽음 처리(appraisal_reads upsert) → 헤더 뱃지 갱신.
 * - 댓글로 직원 간 소통. Realtime(appraisals / appraisal_comments) 구독.
 * - 첨부는 storage 버킷 'appraisals' 에 업로드 후 공개 URL 저장.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabase';
import { useAuth } from '@/lib/contexts/AuthContext';

interface Attachment {
  url: string;
  name: string;
  type: string;
}
type Category = 'real_estate' | 'factory' | 'other';

interface Appraisal {
  id: string;
  title: string;
  category: Category;
  location: string | null;
  property_type: string | null;
  land_area: string | null;
  building_area: string | null;
  item_info: string | null;
  amount: number | null;
  appraiser_name: string | null;
  appraised_at: string | null;
  body: string | null;
  attachments: Attachment[];
  status: 'requested' | 'in_progress' | 'done';
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
}
interface Comment {
  id: string;
  appraisal_id: string;
  author_id: string | null;
  author_name: string | null;
  content: string;
  created_at: string;
}

interface FormState {
  id: string | null;
  title: string;
  category: Category;
  location: string;
  property_type: string;
  land_area: string;
  building_area: string;
  item_info: string;
  amount: string;
  appraiser_name: string;
  appraised_at: string;
  body: string;
  status: 'requested' | 'in_progress' | 'done';
  attachments: Attachment[];
}

const todayStr = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

const emptyForm = (name?: string): FormState => ({
  id: null,
  title: '',
  category: 'real_estate',
  location: '',
  property_type: '',
  land_area: '',
  building_area: '',
  item_info: '',
  amount: '',
  appraiser_name: name || '',
  appraised_at: todayStr(),
  body: '',
  status: 'done',
  attachments: [],
});

const STATUS_META: Record<Appraisal['status'], { label: string; bg: string; fg: string }> = {
  requested: { label: '요청됨', bg: '#fef9c3', fg: '#a16207' },
  in_progress: { label: '진행중', bg: '#dbeafe', fg: '#1d4ed8' },
  done: { label: '완료', bg: '#dcfce7', fg: '#15803d' },
};

const CATEGORY_META: Record<Category, { label: string; bg: string; fg: string; titlePlaceholder: string }> = {
  real_estate: { label: '부동산', bg: '#e0e7ff', fg: '#4338ca', titlePlaceholder: '예: 남양주시 ○○동 토지·건물 감정' },
  factory: { label: '공장물건', bg: '#ffedd5', fg: '#c2410c', titlePlaceholder: '예: ○○공장 (토지·건물·기계기구) 감정' },
  other: { label: '기타', bg: '#f1f5f9', fg: '#475569', titlePlaceholder: '예: ○○ 중고 굴착기 감정' },
};

// 물건 종류 자주 쓰는 값 (datalist 제안용 — 자유 입력 가능)
const PROPERTY_TYPE_SUGGESTIONS = ['토지', '토지·건물', '아파트', '다세대·연립', '단독주택', '상가', '임야', '전·답', '공장', '창고'];

const isImage = (a: Attachment) => a.type?.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(a.name);

export function AppraisalsPanel() {
  const supabase = getSupabaseClient();
  const db = supabase as any;
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [items, setItems] = useState<Appraisal[]>([]);
  const [readSet, setReadSet] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<string | null>(null);

  const [editorOpen, setEditorOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // 댓글
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [commentLoading, setCommentLoading] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) return;
    const [{ data, error }, { data: reads }] = await Promise.all([
      db.from('appraisals').select('*').order('created_at', { ascending: false }),
      db.from('appraisal_reads').select('appraisal_id').eq('user_id', user.id),
    ]);
    if (error) {
      console.error('감정평가 로드 실패:', error);
      return;
    }
    setReadSet(new Set((reads || []).map((r: any) => r.appraisal_id)));
    setItems(
      ((data as any[]) || []).map((d) => ({ ...d, attachments: Array.isArray(d.attachments) ? d.attachments : [] })) as Appraisal[]
    );
  }, [db, user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const loadComments = useCallback(async (appraisalId: string) => {
    setCommentLoading(true);
    const { data } = await db
      .from('appraisal_comments')
      .select('*')
      .eq('appraisal_id', appraisalId)
      .order('created_at', { ascending: true });
    setComments((data as Comment[]) || []);
    setCommentLoading(false);
  }, [db]);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel('appraisals-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appraisals' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appraisal_comments' }, (payload: any) => {
        const row = payload.new || payload.old;
        if (row?.appraisal_id && row.appraisal_id === expanded) loadComments(row.appraisal_id);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, load, loadComments, expanded]);

  const markRead = async (id: string) => {
    if (!user?.id || readSet.has(id)) return;
    await db
      .from('appraisal_reads')
      .upsert({ appraisal_id: id, user_id: user.id }, { onConflict: 'appraisal_id,user_id', ignoreDuplicates: true });
    setReadSet((prev) => new Set(prev).add(id));
  };

  const toggleExpand = (a: Appraisal) => {
    if (expanded === a.id) {
      setExpanded(null);
      setComments([]);
    } else {
      setExpanded(a.id);
      setComments([]);
      markRead(a.id);
      loadComments(a.id);
    }
  };

  const openCreate = () => {
    setForm(emptyForm(user?.name));
    setEditorOpen(true);
  };
  const openEdit = (a: Appraisal) => {
    setForm({
      id: a.id,
      title: a.title,
      category: a.category || 'real_estate',
      location: a.location || '',
      property_type: a.property_type || '',
      land_area: a.land_area || '',
      building_area: a.building_area || '',
      item_info: a.item_info || '',
      amount: a.amount != null ? String(a.amount) : '',
      appraiser_name: a.appraiser_name || '',
      appraised_at: a.appraised_at || todayStr(),
      body: a.body || '',
      status: a.status,
      attachments: a.attachments || [],
    });
    setEditorOpen(true);
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0 || !user?.id) return;
    setUploading(true);
    try {
      const uploaded: Attachment[] = [];
      for (const file of Array.from(files)) {
        const safe = file.name.replace(/[^\w.\-가-힣]/g, '_');
        const path = `${user.id}/${Date.now()}_${safe}`;
        const { error } = await supabase.storage.from('appraisals').upload(path, file, { upsert: false });
        if (error) {
          console.error('업로드 실패:', error);
          alert(`파일 업로드 실패: ${file.name}`);
          continue;
        }
        const { data: pub } = supabase.storage.from('appraisals').getPublicUrl(path);
        uploaded.push({ url: pub.publicUrl, name: file.name, type: file.type });
      }
      setForm((f) => ({ ...f, attachments: [...f.attachments, ...uploaded] }));
    } finally {
      setUploading(false);
    }
  };

  const removeAttachment = (idx: number) => {
    setForm((f) => ({ ...f, attachments: f.attachments.filter((_, i) => i !== idx) }));
  };

  const save = async () => {
    if (!form.title.trim()) {
      alert('제목을 입력하세요.');
      return;
    }
    if (form.amount && isNaN(Number(form.amount))) {
      alert('평가 금액은 숫자만 입력하세요.');
      return;
    }
    if (!user?.id) return;
    setSaving(true);
    try {
      // 숨겨진 카테고리의 필드도 폼 상태를 그대로 저장 — 카테고리를 오가도 기존 값이 유실되지 않게
      const payload = {
        title: form.title.trim(),
        category: form.category,
        location: form.location.trim() || null,
        property_type: form.property_type.trim() || null,
        land_area: form.land_area.trim() || null,
        building_area: form.building_area.trim() || null,
        item_info: form.item_info.trim() || null,
        amount: form.amount ? Number(form.amount) : null,
        appraiser_name: form.appraiser_name.trim() || null,
        appraised_at: form.appraised_at || null,
        body: form.body.trim() || null,
        status: form.status,
        attachments: form.attachments,
      };
      if (form.id) {
        const { error } = await db.from('appraisals').update(payload).eq('id', form.id);
        if (error) throw error;
      } else {
        const { error } = await db.from('appraisals').insert({
          ...payload,
          created_by: user.id,
          created_by_name: user.name,
        });
        if (error) throw error;
      }
      setEditorOpen(false);
      await load();
    } catch (e: any) {
      console.error('감정평가 저장 실패:', e);
      alert('저장에 실패했습니다. ' + (e?.message || ''));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (a: Appraisal) => {
    if (!confirm('이 평가서를 삭제할까요?')) return;
    const { error } = await db.from('appraisals').delete().eq('id', a.id);
    if (error) {
      alert('삭제에 실패했습니다.');
      return;
    }
    if (expanded === a.id) setExpanded(null);
    await load();
  };

  const addComment = async () => {
    if (!commentText.trim() || !expanded || !user?.id) return;
    const text = commentText.trim();
    setCommentText('');
    const { error } = await db.from('appraisal_comments').insert({
      appraisal_id: expanded,
      author_id: user.id,
      author_name: user.name,
      content: text,
    });
    if (error) {
      alert('댓글 작성에 실패했습니다.');
      setCommentText(text);
      return;
    }
    await loadComments(expanded);
  };

  const deleteComment = async (c: Comment) => {
    if (!confirm('댓글을 삭제할까요?')) return;
    const { error } = await db.from('appraisal_comments').delete().eq('id', c.id);
    if (error) {
      alert('삭제에 실패했습니다.');
      return;
    }
    if (expanded) await loadComments(expanded);
  };

  const canEdit = (a: Appraisal) => isAdmin || a.created_by === user?.id;
  const fmtAmount = (n: number | null) => (n == null ? null : `${n.toLocaleString('ko-KR')}원`);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 16, fontWeight: 700, color: '#1f2937' }}>감정평가 게시판</span>
        <button onClick={openCreate} style={primaryBtn}>＋ 평가서 작성</button>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {items.length === 0 ? (
          <p style={{ color: '#9ca3af', fontSize: 14, textAlign: 'center', padding: 24 }}>등록된 평가서가 없습니다.</p>
        ) : (
          items.map((a) => {
            const isRead = readSet.has(a.id);
            const open = expanded === a.id;
            const sm = STATUS_META[a.status];
            const cm = CATEGORY_META[a.category] || CATEGORY_META.real_estate;
            return (
              <div key={a.id} style={{ border: '1px solid #e5e7eb', borderRadius: 12, backgroundColor: '#fff', marginBottom: 10, overflow: 'hidden' }}>
                <div onClick={() => toggleExpand(a)} style={{ padding: '14px 16px', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  {!isRead && <span style={{ marginTop: 6, width: 8, height: 8, borderRadius: 999, backgroundColor: '#ef4444', flexShrink: 0 }} />}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, backgroundColor: cm.bg, color: cm.fg, fontWeight: 600 }}>{cm.label}</span>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, backgroundColor: sm.bg, color: sm.fg }}>{sm.label}</span>
                      <span style={{ fontWeight: isRead ? 600 : 700, color: '#1f2937', fontSize: 15 }}>{a.title}</span>
                      {a.amount != null && (
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#0f766e' }}>{fmtAmount(a.amount)}</span>
                      )}
                    </div>
                    <div style={{ color: '#9ca3af', fontSize: 12, marginTop: 4 }}>
                      {a.location && <span style={{ color: '#6b7280' }}>📍 {a.location}{a.property_type ? ` · ${a.property_type}` : ''} &nbsp;</span>}
                      {a.created_by_name} · {new Date(a.created_at).toLocaleString('ko-KR', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <span style={{ color: '#cbd5e1' }}>{open ? '▲' : '▼'}</span>
                </div>
                {open && (
                  <div style={{ padding: '0 16px 16px', borderTop: '1px solid #f8fafc' }}>
                    {/* 메타 그리드 */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8, margin: '12px 0' }}>
                      {a.location && <Field label="소재지" value={a.location} />}
                      {a.property_type && <Field label="물건 종류" value={a.property_type} />}
                      {a.land_area && <Field label="토지 면적" value={a.land_area} />}
                      {a.building_area && <Field label="건물 면적" value={a.building_area} />}
                      {a.item_info && <Field label={a.category === 'factory' ? '기계·기구' : '대상물/물품'} value={a.item_info} />}
                      {a.amount != null && <Field label="감정평가액" value={fmtAmount(a.amount)!} strong />}
                      {a.appraiser_name && <Field label="평가자" value={a.appraiser_name} />}
                      {a.appraised_at && <Field label="평가일" value={a.appraised_at} />}
                    </div>

                    {a.body && (
                      <p style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: '#374151', fontSize: 14, lineHeight: 1.6, margin: '4px 0 12px' }}>
                        {a.body}
                      </p>
                    )}

                    {/* 첨부 */}
                    {a.attachments?.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                        {a.attachments.map((att, i) =>
                          isImage(att) ? (
                            <a key={i} href={att.url} target="_blank" rel="noreferrer">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={att.url} alt={att.name} style={{ width: 92, height: 92, objectFit: 'cover', borderRadius: 8, border: '1px solid #e5e7eb' }} />
                            </a>
                          ) : (
                            <a key={i} href={att.url} target="_blank" rel="noreferrer" style={{ ...ghostBtn, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                              📎 {att.name}
                            </a>
                          )
                        )}
                      </div>
                    )}

                    {canEdit(a) && (
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginBottom: 12 }}>
                        <button onClick={() => openEdit(a)} style={ghostBtn}>수정</button>
                        <button onClick={() => remove(a)} style={{ ...ghostBtn, color: '#dc2626', borderColor: '#fecaca' }}>삭제</button>
                      </div>
                    )}

                    {/* 댓글 */}
                    <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 12 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 8 }}>댓글 {comments.length > 0 ? `(${comments.length})` : ''}</div>
                      {commentLoading ? (
                        <p style={{ color: '#9ca3af', fontSize: 13 }}>불러오는 중…</p>
                      ) : (
                        comments.map((c) => (
                          <div key={c.id} style={{ display: 'flex', gap: 8, padding: '6px 0', alignItems: 'flex-start' }}>
                            <div style={{ flex: 1 }}>
                              <span style={{ fontWeight: 600, fontSize: 13, color: '#1f2937' }}>{c.author_name || '직원'}</span>
                              <span style={{ color: '#9ca3af', fontSize: 11, marginLeft: 6 }}>
                                {new Date(c.created_at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </span>
                              <div style={{ fontSize: 14, color: '#374151', whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginTop: 2 }}>{c.content}</div>
                            </div>
                            {(isAdmin || c.author_id === user?.id) && (
                              <button onClick={() => deleteComment(c)} style={{ ...ghostBtn, padding: '2px 8px', fontSize: 12 }}>삭제</button>
                            )}
                          </div>
                        ))
                      )}
                      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                        <input
                          value={commentText}
                          onChange={(e) => setCommentText(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addComment(); } }}
                          placeholder="댓글을 입력하세요"
                          style={{ ...inputStyle, flex: 1 }}
                        />
                        <button onClick={addComment} style={primaryBtn}>등록</button>
                      </div>
                    </div>
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
          <div onClick={(e) => e.stopPropagation()} style={{ ...modalBox, maxWidth: 560 }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 17, fontWeight: 700 }}>{form.id ? '평가서 수정' : '평가서 작성'}</h3>

            <Label>구분</Label>
            <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
              {(Object.keys(CATEGORY_META) as Category[]).map((c) => (
                <button
                  key={c}
                  onClick={() => setForm({ ...form, category: c })}
                  style={{
                    ...ghostBtn,
                    flex: 1,
                    backgroundColor: form.category === c ? CATEGORY_META[c].bg : '#fff',
                    color: form.category === c ? CATEGORY_META[c].fg : '#6b7280',
                    borderColor: form.category === c ? CATEGORY_META[c].fg : '#e5e7eb',
                    fontWeight: 700,
                  }}
                >
                  {CATEGORY_META[c].label}
                </button>
              ))}
            </div>

            <Label>제목 *</Label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder={CATEGORY_META[form.category].titlePlaceholder} style={{ ...inputStyle, marginBottom: 10 }} />

            {form.category !== 'other' && (
              <>
                <Label>소재지</Label>
                <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="예: 경기도 남양주시 ○○읍 ○○리 123-4" style={{ ...inputStyle, marginBottom: 10 }} />

                <div style={{ display: 'flex', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 140px' }}>
                    <Label>물건 종류</Label>
                    <input list="appraisal-property-types" value={form.property_type} onChange={(e) => setForm({ ...form, property_type: e.target.value })} placeholder="예: 토지·건물" style={inputStyle} />
                    <datalist id="appraisal-property-types">
                      {PROPERTY_TYPE_SUGGESTIONS.map((t) => <option key={t} value={t} />)}
                    </datalist>
                  </div>
                  <div style={{ flex: '1 1 130px' }}>
                    <Label>토지 면적</Label>
                    <input value={form.land_area} onChange={(e) => setForm({ ...form, land_area: e.target.value })} placeholder="예: 1,234㎡" style={inputStyle} />
                  </div>
                  <div style={{ flex: '1 1 130px' }}>
                    <Label>건물 면적</Label>
                    <input value={form.building_area} onChange={(e) => setForm({ ...form, building_area: e.target.value })} placeholder="예: 456.7㎡" style={inputStyle} />
                  </div>
                </div>
              </>
            )}

            {form.category !== 'real_estate' && (
              <>
                <Label>{form.category === 'factory' ? '기계·기구 정보' : '대상물/물품 정보'}</Label>
                <input value={form.item_info} onChange={(e) => setForm({ ...form, item_info: e.target.value })} placeholder={form.category === 'factory' ? '예: 프레스 3대, CNC 선반 2대 등' : '종류·모델·상태 등'} style={{ ...inputStyle, marginBottom: 10 }} />
              </>
            )}

            <div style={{ display: 'flex', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 160px' }}>
                <Label>감정평가액(원)</Label>
                <input value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value.replace(/[^\d]/g, '') })} inputMode="numeric" placeholder="숫자만" style={inputStyle} />
              </div>
              <div style={{ flex: '1 1 120px' }}>
                <Label>상태</Label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as FormState['status'] })} style={inputStyle}>
                  <option value="requested">요청됨</option>
                  <option value="in_progress">진행중</option>
                  <option value="done">완료</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 160px' }}>
                <Label>평가자</Label>
                <input value={form.appraiser_name} onChange={(e) => setForm({ ...form, appraiser_name: e.target.value })} placeholder="평가자 이름" style={inputStyle} />
              </div>
              <div style={{ flex: '1 1 160px' }}>
                <Label>평가일</Label>
                <input type="date" value={form.appraised_at} onChange={(e) => setForm({ ...form, appraised_at: e.target.value })} style={inputStyle} />
              </div>
            </div>

            <Label>평가 본문</Label>
            <textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="평가 의견·근거·산출 내역 등" rows={7} style={{ ...inputStyle, marginBottom: 10, resize: 'vertical' }} />

            <Label>첨부 (사진/파일)</Label>
            <input type="file" multiple onChange={(e) => handleUpload(e.target.files)} style={{ marginBottom: 8, fontSize: 13 }} />
            {uploading && <p style={{ color: '#6b7280', fontSize: 12, margin: '0 0 8px' }}>업로드 중…</p>}
            {form.attachments.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                {form.attachments.map((att, i) => (
                  <div key={i} style={{ position: 'relative' }}>
                    {isImage(att) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={att.url} alt={att.name} style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8, border: '1px solid #e5e7eb' }} />
                    ) : (
                      <div style={{ ...ghostBtn, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📎 {att.name}</div>
                    )}
                    <button onClick={() => removeAttachment(i)} style={{ position: 'absolute', top: -8, right: -8, width: 20, height: 20, borderRadius: 999, border: 'none', backgroundColor: '#ef4444', color: '#fff', fontSize: 12, cursor: 'pointer', lineHeight: '20px', padding: 0 }}>×</button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
              <button onClick={() => setEditorOpen(false)} style={ghostBtn}>취소</button>
              <button onClick={save} disabled={saving || uploading} style={primaryBtn}>{saving ? '저장 중…' : '저장'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div style={{ backgroundColor: '#f8fafc', borderRadius: 8, padding: '8px 10px' }}>
      <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 14, color: strong ? '#0f766e' : '#1f2937', fontWeight: strong ? 700 : 500, wordBreak: 'break-word' }}>{value}</div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>{children}</div>;
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

export default AppraisalsPanel;
