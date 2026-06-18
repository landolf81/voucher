'use client';

/**
 * 직원 일정관리 — 팀 공유 주간 캘린더
 *
 * - 전체 공유: 모든 인증 사용자가 전체 일정 조회
 * - 생성: 누구나 / 수정·삭제: 본인 작성 또는 admin (RLS로 강제)
 * - 주간 보기(7일). 모바일은 세로 리스트로 반응형. Realtime 으로 실시간 반영.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { startOfWeek, addDays, addWeeks, format, parseISO } from 'date-fns';
import { getSupabaseClient } from '@/lib/supabase';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useDevice } from '@/lib/hooks/useDevice';

interface ScheduleEvent {
  id: string;
  title: string;
  description?: string | null;
  start_at: string;
  end_at: string;
  all_day?: boolean | null;
  location?: string | null;
  color?: string | null;
  created_by?: string | null;
  created_by_name?: string | null;
  site_id?: string | null;
}

const WEEK_LABELS = ['일', '월', '화', '수', '목', '금', '토'];
const COLORS = [
  { name: '파랑', v: '#2563eb' },
  { name: '초록', v: '#16a34a' },
  { name: '빨강', v: '#dc2626' },
  { name: '보라', v: '#7c3aed' },
  { name: '주황', v: '#ea580c' },
  { name: '회색', v: '#6b7280' },
];

interface FormState {
  id: string | null;
  title: string;
  date: string; // yyyy-MM-dd
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  allDay: boolean;
  location: string;
  description: string;
  color: string;
  ownerId: string | null;
}

const emptyForm = (date: Date): FormState => ({
  id: null,
  title: '',
  date: format(date, 'yyyy-MM-dd'),
  startTime: '09:00',
  endTime: '10:00',
  allDay: false,
  location: '',
  description: '',
  color: COLORS[0].v,
  ownerId: null,
});

export function ScheduleCalendar() {
  const supabase = getSupabaseClient();
  const db = supabase as any;
  const { user } = useAuth();
  const device = useDevice();
  const isMobile = device.isMobile;

  const [anchor, setAnchor] = useState<Date>(() => new Date());
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<FormState>(() => emptyForm(new Date()));
  const [saving, setSaving] = useState(false);

  const weekStart = useMemo(() => startOfWeek(anchor, { weekStartsOn: 0 }), [anchor]);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const weekEnd = useMemo(() => addDays(weekStart, 7), [weekStart]);

  const isAdmin = user?.role === 'admin';
  const canEdit = (e: ScheduleEvent) => isAdmin || e.created_by === user?.id;

  // ── 주간 일정 로드 (해당 주와 겹치는 모든 이벤트) ──
  const loadEvents = useCallback(async () => {
    setLoading(true);
    const { data, error } = await db
      .from('schedule_events')
      .select('*')
      .lt('start_at', weekEnd.toISOString())
      .gt('end_at', weekStart.toISOString())
      .order('start_at', { ascending: true });
    setLoading(false);
    if (error) {
      console.error('일정 로드 실패:', error);
      return;
    }
    setEvents((data as unknown as ScheduleEvent[]) || []);
  }, [db, weekStart, weekEnd]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  // ── Realtime: 일정 변경 시 현재 주 재로드 ──
  useEffect(() => {
    const channel = supabase
      .channel('schedule-events')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'schedule_events' },
        () => loadEvents()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, loadEvents]);

  // 특정 날짜와 겹치는 이벤트
  const eventsForDay = (day: Date): ScheduleEvent[] => {
    const dayStart = new Date(day);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(day);
    dayEnd.setHours(23, 59, 59, 999);
    return events
      .filter((e) => {
        const s = parseISO(e.start_at);
        const en = parseISO(e.end_at);
        return s <= dayEnd && en >= dayStart;
      })
      .sort((a, b) => +parseISO(a.start_at) - +parseISO(b.start_at));
  };

  const openCreate = (day: Date) => {
    setForm(emptyForm(day));
    setModalOpen(true);
  };

  const openEdit = (e: ScheduleEvent) => {
    const s = parseISO(e.start_at);
    const en = parseISO(e.end_at);
    setForm({
      id: e.id,
      title: e.title,
      date: format(s, 'yyyy-MM-dd'),
      startTime: format(s, 'HH:mm'),
      endTime: format(en, 'HH:mm'),
      allDay: !!e.all_day,
      location: e.location || '',
      description: e.description || '',
      color: e.color || COLORS[0].v,
      ownerId: e.created_by ?? null,
    });
    setModalOpen(true);
  };

  const save = async () => {
    if (!form.title.trim()) {
      alert('제목을 입력하세요.');
      return;
    }
    if (!user?.id) {
      alert('로그인 정보를 확인할 수 없습니다.');
      return;
    }
    const startISO = form.allDay
      ? new Date(`${form.date}T00:00:00`).toISOString()
      : new Date(`${form.date}T${form.startTime}:00`).toISOString();
    const endISO = form.allDay
      ? new Date(`${form.date}T23:59:00`).toISOString()
      : new Date(`${form.date}T${form.endTime}:00`).toISOString();
    if (new Date(endISO) < new Date(startISO)) {
      alert('종료 시간이 시작보다 빠릅니다.');
      return;
    }

    setSaving(true);
    try {
      if (form.id) {
        const { error } = await db
          .from('schedule_events')
          .update({
            title: form.title.trim(),
            description: form.description || null,
            start_at: startISO,
            end_at: endISO,
            all_day: form.allDay,
            location: form.location || null,
            color: form.color,
          })
          .eq('id', form.id);
        if (error) throw error;
      } else {
        const { error } = await db.from('schedule_events').insert({
          title: form.title.trim(),
          description: form.description || null,
          start_at: startISO,
          end_at: endISO,
          all_day: form.allDay,
          location: form.location || null,
          color: form.color,
          created_by: user.id,
          created_by_name: user.name,
          site_id: user.site_id ?? null,
        });
        if (error) throw error;
      }
      setModalOpen(false);
      await loadEvents();
    } catch (e: any) {
      console.error('일정 저장 실패:', e);
      alert('저장에 실패했습니다. ' + (e?.message || ''));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!form.id) return;
    if (!confirm('이 일정을 삭제할까요?')) return;
    const { error } = await db.from('schedule_events').delete().eq('id', form.id);
    if (error) {
      alert('삭제에 실패했습니다.');
      return;
    }
    setModalOpen(false);
    await loadEvents();
  };

  const rangeLabel = `${format(weekStart, 'yyyy.M.d')} ~ ${format(addDays(weekStart, 6), 'M.d')}`;
  const today = new Date();
  const isToday = (d: Date) => format(d, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd');
  const formEditable = !form.id || isAdmin || form.ownerId === user?.id;

  const eventCard = (e: ScheduleEvent) => (
    <div
      key={e.id}
      onClick={() => openEdit(e)}
      title={e.title}
      style={{
        borderLeft: `3px solid ${e.color || '#2563eb'}`,
        backgroundColor: '#f8fafc',
        borderRadius: '6px',
        padding: '6px 8px',
        marginBottom: '6px',
        cursor: 'pointer',
        fontSize: '13px',
      }}
    >
      <div style={{ color: '#6b7280', fontSize: '11px' }}>
        {e.all_day ? '종일' : format(parseISO(e.start_at), 'HH:mm')}
      </div>
      <div style={{ fontWeight: 600, color: '#1f2937', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {e.title}
      </div>
      {e.created_by_name && (
        <div style={{ color: '#9ca3af', fontSize: '11px' }}>{e.created_by_name}</div>
      )}
    </div>
  );

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* 헤더 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '16px',
          flexWrap: 'wrap',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button onClick={() => setAnchor(addWeeks(anchor, -1))} style={navBtn}>◀</button>
          <button onClick={() => setAnchor(new Date())} style={{ ...navBtn, width: 'auto', padding: '0 14px' }}>오늘</button>
          <button onClick={() => setAnchor(addWeeks(anchor, 1))} style={navBtn}>▶</button>
          <span style={{ fontSize: '16px', fontWeight: 700, color: '#1f2937', marginLeft: '6px' }}>{rangeLabel}</span>
        </div>
        <button onClick={() => openCreate(new Date())} style={primaryBtn}>＋ 새 일정</button>
      </div>

      {/* 본문 */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {loading && <p style={{ color: '#9ca3af', textAlign: 'center', padding: '8px' }}>불러오는 중…</p>}

        {isMobile ? (
          // 모바일: 세로 리스트
          <div>
            {days.map((d) => {
              const evs = eventsForDay(d);
              return (
                <div key={d.toISOString()} style={{ marginBottom: '14px' }}>
                  <div
                    onClick={() => openCreate(d)}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '6px 8px',
                      borderRadius: '8px',
                      backgroundColor: isToday(d) ? '#eff6ff' : '#f9fafb',
                      fontWeight: 700,
                      color: isToday(d) ? '#1d4ed8' : '#374151',
                      marginBottom: '6px',
                      cursor: 'pointer',
                    }}
                  >
                    <span>{format(d, 'M/d')} ({WEEK_LABELS[d.getDay()]})</span>
                    <span style={{ color: '#9ca3af', fontSize: '18px' }}>＋</span>
                  </div>
                  {evs.length === 0 ? (
                    <p style={{ color: '#cbd5e1', fontSize: '12px', padding: '2px 8px' }}>일정 없음</p>
                  ) : (
                    evs.map(eventCard)
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          // 데스크탑: 7일 그리드
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px', minHeight: '100%' }}>
            {days.map((d) => {
              const evs = eventsForDay(d);
              return (
                <div
                  key={d.toISOString()}
                  style={{
                    border: '1px solid #e5e7eb',
                    borderRadius: '10px',
                    backgroundColor: '#fff',
                    display: 'flex',
                    flexDirection: 'column',
                    minHeight: '240px',
                  }}
                >
                  <div
                    style={{
                      padding: '8px',
                      borderBottom: '1px solid #f1f5f9',
                      textAlign: 'center',
                      fontWeight: 700,
                      fontSize: '13px',
                      color: d.getDay() === 0 ? '#dc2626' : d.getDay() === 6 ? '#2563eb' : '#374151',
                      backgroundColor: isToday(d) ? '#eff6ff' : 'transparent',
                      borderTopLeftRadius: '10px',
                      borderTopRightRadius: '10px',
                    }}
                  >
                    {WEEK_LABELS[d.getDay()]} {format(d, 'd')}
                  </div>
                  <div style={{ flex: 1, padding: '8px', overflowY: 'auto' }}>
                    {evs.map(eventCard)}
                  </div>
                  <button
                    onClick={() => openCreate(d)}
                    style={{
                      border: 'none',
                      borderTop: '1px solid #f1f5f9',
                      backgroundColor: 'transparent',
                      color: '#9ca3af',
                      padding: '6px',
                      cursor: 'pointer',
                      fontSize: '13px',
                    }}
                  >
                    ＋ 추가
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 추가/편집 모달 */}
      {modalOpen && (
        <div
          onClick={() => setModalOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
            padding: '16px',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#fff',
              borderRadius: '14px',
              width: '100%',
              maxWidth: '440px',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '20px',
            }}
          >
            <h3 style={{ margin: '0 0 16px', fontSize: '17px', fontWeight: 700 }}>
              {form.id ? '일정 편집' : '새 일정'}
            </h3>

            <Field label="제목">
              <input
                value={form.title}
                disabled={!formEditable}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="일정 제목"
                style={inputStyle}
              />
            </Field>

            <Field label="날짜">
              <input
                type="date"
                value={form.date}
                disabled={!formEditable}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                style={inputStyle}
              />
            </Field>

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '8px 0', fontSize: '14px' }}>
              <input
                type="checkbox"
                checked={form.allDay}
                disabled={!formEditable}
                onChange={(e) => setForm({ ...form, allDay: e.target.checked })}
              />
              종일
            </label>

            {!form.allDay && (
              <div style={{ display: 'flex', gap: '8px' }}>
                <Field label="시작">
                  <input
                    type="time"
                    value={form.startTime}
                    disabled={!formEditable}
                    onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                    style={inputStyle}
                  />
                </Field>
                <Field label="종료">
                  <input
                    type="time"
                    value={form.endTime}
                    disabled={!formEditable}
                    onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                    style={inputStyle}
                  />
                </Field>
              </div>
            )}

            <Field label="장소">
              <input
                value={form.location}
                disabled={!formEditable}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="(선택)"
                style={inputStyle}
              />
            </Field>

            <Field label="메모">
              <textarea
                value={form.description}
                disabled={!formEditable}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="(선택)"
                rows={2}
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </Field>

            <Field label="색상">
              <div style={{ display: 'flex', gap: '8px' }}>
                {COLORS.map((c) => (
                  <span
                    key={c.v}
                    onClick={() => formEditable && setForm({ ...form, color: c.v })}
                    title={c.name}
                    style={{
                      width: '26px',
                      height: '26px',
                      borderRadius: '999px',
                      backgroundColor: c.v,
                      cursor: formEditable ? 'pointer' : 'default',
                      border: form.color === c.v ? '3px solid #111827' : '2px solid #e5e7eb',
                    }}
                  />
                ))}
              </div>
            </Field>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}>
              <div>
                {form.id && formEditable && (
                  <button onClick={remove} style={{ ...ghostBtn, color: '#dc2626', borderColor: '#fecaca' }}>
                    삭제
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => setModalOpen(false)} style={ghostBtn}>닫기</button>
                {formEditable && (
                  <button onClick={save} disabled={saving} style={primaryBtn}>
                    {saving ? '저장 중…' : '저장'}
                  </button>
                )}
              </div>
            </div>
            {!formEditable && (
              <p style={{ color: '#9ca3af', fontSize: '12px', marginTop: '10px' }}>
                * 본인이 등록한 일정 또는 관리자만 수정/삭제할 수 있습니다.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '10px', flex: 1 }}>
      <label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>{label}</label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 11px',
  border: '1px solid #d1d5db',
  borderRadius: '8px',
  fontSize: '16px',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
};

const navBtn: React.CSSProperties = {
  width: '36px',
  height: '36px',
  borderRadius: '8px',
  border: '1px solid #e5e7eb',
  backgroundColor: '#fff',
  cursor: 'pointer',
  fontSize: '14px',
};

const primaryBtn: React.CSSProperties = {
  padding: '9px 16px',
  backgroundColor: '#2563eb',
  color: '#fff',
  border: 'none',
  borderRadius: '8px',
  fontSize: '14px',
  fontWeight: 600,
  cursor: 'pointer',
};

const ghostBtn: React.CSSProperties = {
  padding: '9px 16px',
  backgroundColor: '#fff',
  color: '#374151',
  border: '1px solid #e5e7eb',
  borderRadius: '8px',
  fontSize: '14px',
  fontWeight: 600,
  cursor: 'pointer',
};

export default ScheduleCalendar;
