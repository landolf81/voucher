'use client';

import React, { useState, useEffect, useCallback } from 'react';
import type { Member, MemberOverview, GraftingSchedule } from '@/types/member';
import { getSupabaseClient } from '@/lib/supabase';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useIsMobile } from '@/lib/hooks/useDevice';
import { X, Trash2 } from 'lucide-react';

interface MemberMemo {
  id: string;
  member_id: string;
  author_id: string | null;
  author_name: string | null;
  content: string;
  created_at: string;
}

interface MemberPosition {
  id: string;
  member_id: string;
  position: string;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
  created_at: string;
}

const POSITION_PRESETS = ['조합장', '대의원', '비상임이사', '비상임감사', '영농회장', '부녀회장'] as const;
const CUSTOM_POSITION = '__custom__';

function todayISO(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// 재임 중: 종료일이 없거나 아직 지나지 않은 경우
function isCurrentPosition(p: MemberPosition): boolean {
  return !p.end_date || p.end_date.split('T')[0] >= todayISO();
}

interface MemberDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  member: MemberOverview | null;
  onEdit?: () => void;
}

export function MemberDetailModal({ isOpen, onClose, member, onEdit }: MemberDetailModalProps) {
  const supabase = getSupabaseClient();
  const db = supabase as any;
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const isMobile = useIsMobile();
  const canWrite = user?.role === 'admin' || user?.role === 'staff';
  // 모바일에서는 경력(직책) 조회 전용 — 등록 폼·종료/삭제 버튼 숨김
  const showPositionActions = canWrite && !isMobile;

  const [detail, setDetail] = useState<Member | null>(null);
  const [schedules, setSchedules] = useState<GraftingSchedule[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 메모
  const [memos, setMemos] = useState<MemberMemo[]>([]);
  const [memoText, setMemoText] = useState('');
  const [memoSaving, setMemoSaving] = useState(false);

  // 접목 일정 등록
  const canWriteSchedule = canWrite;
  const [scheduleDate, setScheduleDate] = useState('');
  const [schedulePeriod, setSchedulePeriod] = useState<'오전' | '오후'>('오전');
  const [scheduleNotes, setScheduleNotes] = useState('');
  const [scheduleSaving, setScheduleSaving] = useState(false);

  // 경력 (직책 이력)
  const [positions, setPositions] = useState<MemberPosition[]>([]);
  const [positionType, setPositionType] = useState<string>(POSITION_PRESETS[0]);
  const [positionCustom, setPositionCustom] = useState('');
  const [positionStart, setPositionStart] = useState('');
  const [positionEnd, setPositionEnd] = useState('');
  const [positionNotes, setPositionNotes] = useState('');
  const [positionSaving, setPositionSaving] = useState(false);

  const loadPositions = useCallback(async (memberId: string) => {
    const { data } = await db
      .from('member_positions')
      .select('*')
      .eq('member_id', memberId)
      .order('start_date', { ascending: false, nullsFirst: false });
    setPositions((data as MemberPosition[]) || []);
  }, [db]);

  const loadSchedules = useCallback(async (memberId: string) => {
    const { data } = await db
      .from('grafting_schedules')
      .select('*')
      .eq('member_id', memberId)
      .order('year', { ascending: false });
    setSchedules((data as GraftingSchedule[]) || []);
  }, [db]);

  const loadMemos = useCallback(async (memberId: string) => {
    const { data } = await db
      .from('member_memos')
      .select('*')
      .eq('member_id', memberId)
      .order('created_at', { ascending: true });
    setMemos((data as MemberMemo[]) || []);
  }, [db]);

  useEffect(() => {
    if (!isOpen || !member) {
      setDetail(null);
      setSchedules([]);
      setMemos([]);
      setMemoText('');
      setScheduleDate('');
      setScheduleNotes('');
      setPositions([]);
      setPositionType(POSITION_PRESETS[0]);
      setPositionCustom('');
      setPositionStart('');
      setPositionEnd('');
      setPositionNotes('');
      setError('');
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError('');
    loadMemos(member.id);
    loadPositions(member.id);

    fetch(`/api/members/${member.id}`)
      .then(res => res.json().then(data => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (cancelled) return;
        if (ok && data.member) {
          setDetail(data.member);
          setSchedules(data.grafting_schedules || []);
        } else {
          setError(data.error || '조합원 정보를 불러오지 못했습니다.');
        }
      })
      .catch(() => {
        if (!cancelled) setError('서버 오류가 발생했습니다.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [isOpen, member, loadMemos, loadPositions]);

  const addMemo = async () => {
    if (!memoText.trim() || !member || !user?.id) return;
    const text = memoText.trim();
    setMemoSaving(true);
    const { error: insertError } = await db.from('member_memos').insert({
      member_id: member.id,
      author_id: user.id,
      author_name: user.name,
      content: text,
    });
    setMemoSaving(false);
    if (insertError) {
      alert('메모 저장에 실패했습니다.');
      return;
    }
    setMemoText('');
    await loadMemos(member.id);
  };

  const deleteMemo = async (memo: MemberMemo) => {
    if (!member) return;
    if (!confirm('이 메모를 삭제할까요?')) return;
    const { error: deleteError } = await db.from('member_memos').delete().eq('id', memo.id);
    if (deleteError) {
      alert('삭제에 실패했습니다.');
      return;
    }
    await loadMemos(member.id);
  };

  const addSchedule = async () => {
    if (!member || !user?.id || !scheduleDate) return;
    const year = new Date(scheduleDate).getFullYear();
    const existing = schedules.find(s => s.year === year);
    if (existing && !confirm(`${year}년 접목 일정이 이미 있습니다. 새 내용으로 덮어쓸까요?`)) return;

    setScheduleSaving(true);
    const { error: upsertError } = await db
      .from('grafting_schedules')
      .upsert(
        {
          member_id: member.id,
          year,
          grafting_date: scheduleDate,
          time_period: schedulePeriod,
          notes: scheduleNotes.trim() || null,
          created_by: user.id,
        },
        { onConflict: 'member_id,year' }
      );
    setScheduleSaving(false);
    if (upsertError) {
      alert('접목 일정 저장에 실패했습니다.');
      return;
    }
    setScheduleDate('');
    setScheduleNotes('');
    await loadSchedules(member.id);
  };

  const deleteSchedule = async (schedule: GraftingSchedule) => {
    if (!member) return;
    if (!confirm(`${schedule.year}년 접목 일정을 삭제할까요?`)) return;
    const { error: deleteError } = await db.from('grafting_schedules').delete().eq('id', schedule.id);
    if (deleteError) {
      alert('삭제에 실패했습니다.');
      return;
    }
    await loadSchedules(member.id);
  };

  // 영농회장/부녀회장 경력 ↔ 영농회 관리(chairman_name/women_chairman_name) 연동
  const chairmanField = (position: string): 'chairman_name' | 'women_chairman_name' | null => {
    if (position === '영농회장') return 'chairman_name';
    if (position === '부녀회장') return 'women_chairman_name';
    return null;
  };

  const syncAssociationChairman = async (position: string, mode: 'set' | 'clear') => {
    const field = chairmanField(position);
    const associationId = (detail || member)?.association_id;
    if (!field || !associationId || !member) return;
    try {
      if (mode === 'set') {
        await fetch(`/api/associations/${associationId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [field]: member.name }),
        });
      } else {
        // 현재 영농회에 등록된 이름이 이 조합원일 때만 비움
        const res = await fetch(`/api/associations/${associationId}`);
        const data = await res.json();
        if (data.success && data.data?.[field] === member.name) {
          await fetch(`/api/associations/${associationId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ [field]: '' }),
          });
        }
      }
    } catch (e) {
      console.error('영농회 연동 실패:', e);
    }
  };

  const addPosition = async () => {
    if (!member || !user?.id) return;
    const position = positionType === CUSTOM_POSITION ? positionCustom.trim() : positionType;
    if (!position) return;

    const isCurrent = !positionEnd || positionEnd >= todayISO();
    setPositionSaving(true);
    const { error: insertError } = await db.from('member_positions').insert({
      member_id: member.id,
      position,
      start_date: positionStart || null,
      end_date: positionEnd || null,
      notes: positionNotes.trim() || null,
      created_by: user.id,
    });
    if (insertError) {
      setPositionSaving(false);
      alert('경력 저장에 실패했습니다.');
      return;
    }
    // 재임 중인 영농회장/부녀회장이면 영농회 관리 화면에도 이름 반영
    if (isCurrent) await syncAssociationChairman(position, 'set');
    setPositionSaving(false);
    setPositionCustom('');
    setPositionStart('');
    setPositionEnd('');
    setPositionNotes('');
    await loadPositions(member.id);
  };

  const endPosition = async (p: MemberPosition) => {
    if (!member) return;
    if (!confirm(`'${p.position}' 직책을 오늘 날짜로 종료 처리할까요?`)) return;
    const { error: updateError } = await db
      .from('member_positions')
      .update({ end_date: todayISO() })
      .eq('id', p.id);
    if (updateError) {
      alert('종료 처리에 실패했습니다.');
      return;
    }
    await syncAssociationChairman(p.position, 'clear');
    await loadPositions(member.id);
  };

  const deletePosition = async (p: MemberPosition) => {
    if (!member) return;
    if (!confirm(`'${p.position}' 경력을 삭제할까요?`)) return;
    const { error: deleteError } = await db.from('member_positions').delete().eq('id', p.id);
    if (deleteError) {
      alert('삭제에 실패했습니다.');
      return;
    }
    // 재임 중이던 영농회장/부녀회장 경력을 지우면 영농회 이름도 정리
    if (isCurrentPosition(p)) await syncAssociationChairman(p.position, 'clear');
    await loadPositions(member.id);
  };

  if (!isOpen || !member) return null;

  // 상세 API 값 우선, 목록 데이터(영농회명·작물명 등 조인 결과)로 보강
  const m = { ...member, ...(detail || {}) };
  const associationName = m.association_name || member.association_name || '-';
  const mainCropName = m.main_crop_name || member.main_crop_name || '-';
  const subCropName = m.sub_crop_name || member.sub_crop_name || '-';

  const formatDate = (d?: string | null) => (d ? d.split('T')[0] : '-');

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
        padding: '20px'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '640px',
          maxHeight: '85vh',
          overflowY: 'auto',
          boxShadow: '0 10px 40px rgba(0,0,0,0.2)'
        }}
      >
        {/* 헤더 */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '20px 24px',
          borderBottom: '1px solid #e5e7eb',
          position: 'sticky',
          top: 0,
          backgroundColor: 'white',
          borderTopLeftRadius: '12px',
          borderTopRightRadius: '12px'
        }}>
          <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1a202c', margin: 0 }}>
            {m.member_type === '비조합원' ? '인물 상세' : '조합원 상세'} — {m.name}
            {m.member_type === '비조합원' && (
              <span style={{
                marginLeft: '8px',
                padding: '2px 8px',
                fontSize: '12px',
                fontWeight: 600,
                backgroundColor: '#f3f4f6',
                color: '#6b7280',
                borderRadius: '6px',
                verticalAlign: 'middle'
              }}>
                비조합원
              </span>
            )}
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {canWriteSchedule && onEdit && (
              <button
                onClick={onEdit}
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#fef3c7',
                  color: '#92400e',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer'
                }}
              >
                정보 수정
              </button>
            )}
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#6b7280',
              display: 'flex',
              alignItems: 'center',
              padding: '4px'
            }}
          >
            <X size={20} />
          </button>
          </div>
        </div>

        <div style={{ padding: '24px' }}>
          {error && (
            <div style={{
              backgroundColor: '#fee2e2',
              border: '1px solid #fca5a5',
              color: '#991b1b',
              padding: '12px',
              borderRadius: '8px',
              marginBottom: '16px'
            }}>
              {error}
            </div>
          )}

          {loading && (
            <div style={{ padding: '8px 0 16px', color: '#6b7280', fontSize: '14px' }}>
              상세 정보 불러오는 중...
            </div>
          )}

          {/* 기본 정보 */}
          <Section title="기본 정보">
            <Field label="성명" value={m.name} />
            {!isMobile && <Field label="조합원 ID" value={m.member_id || '-'} />}
            <Field label="영농회" value={associationName} />
            <Field label="생년월일" value={formatDate(m.date_of_birth)} />
            <Field label="증권번호" value={m.security_number || '-'} />
          </Section>

          {/* 경력 (직책 이력) — 기본 정보 바로 아래 */}
          <Section title={`경력 (${positions.length})`}>
            <div style={{ gridColumn: '1 / -1' }}>
              {positions.length === 0 ? (
                <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '12px' }}>
                  등록된 경력이 없습니다.
                </div>
              ) : (
                <div style={{ overflowX: 'auto', marginBottom: '12px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                        <th style={scheduleHeaderStyle}>직책</th>
                        <th style={scheduleHeaderStyle}>기간</th>
                        <th style={scheduleHeaderStyle}>비고</th>
                        {showPositionActions && <th style={scheduleHeaderStyle}></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {positions.map(p => (
                        <tr key={p.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                          <td style={scheduleCellStyle}>
                            {p.position}
                            {isCurrentPosition(p) && (
                              <span style={{
                                marginLeft: '6px',
                                padding: '1px 6px',
                                borderRadius: '9999px',
                                fontSize: '11px',
                                fontWeight: 600,
                                backgroundColor: '#dbeafe',
                                color: '#1d4ed8'
                              }}>
                                재임 중
                              </span>
                            )}
                          </td>
                          <td style={scheduleCellStyle}>
                            {formatDate(p.start_date)} ~ {p.end_date ? formatDate(p.end_date) : ''}
                          </td>
                          <td style={scheduleCellStyle}>{p.notes || '-'}</td>
                          {showPositionActions && (
                            <td style={{ ...scheduleCellStyle, textAlign: 'right' }}>
                              {isCurrentPosition(p) && (
                                <button
                                  onClick={() => endPosition(p)}
                                  style={{
                                    background: 'none',
                                    border: '1px solid #d1d5db',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    color: '#374151',
                                    fontSize: '12px',
                                    padding: '2px 8px',
                                    marginRight: '6px'
                                  }}
                                >
                                  종료
                                </button>
                              )}
                              <button
                                onClick={() => deletePosition(p)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  color: '#9ca3af',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  padding: '2px',
                                  verticalAlign: 'middle'
                                }}
                                title="경력 삭제"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {showPositionActions && (
                <div style={{
                  display: 'flex',
                  gap: '8px',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  backgroundColor: '#f9fafb',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  padding: '10px 12px'
                }}>
                  <select
                    value={positionType}
                    onChange={(e) => setPositionType(e.target.value)}
                    style={{
                      padding: '6px 10px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}
                  >
                    {POSITION_PRESETS.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                    <option value={CUSTOM_POSITION}>직접 입력</option>
                  </select>
                  {positionType === CUSTOM_POSITION && (
                    <input
                      type="text"
                      value={positionCustom}
                      onChange={(e) => setPositionCustom(e.target.value)}
                      placeholder="직책명 입력"
                      style={{
                        width: '120px',
                        padding: '6px 10px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '14px'
                      }}
                    />
                  )}
                  <input
                    type="date"
                    value={positionStart}
                    onChange={(e) => setPositionStart(e.target.value)}
                    title="시작일"
                    style={{
                      padding: '6px 10px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}
                  />
                  <span style={{ color: '#9ca3af', fontSize: '14px' }}>~</span>
                  <input
                    type="date"
                    value={positionEnd}
                    onChange={(e) => setPositionEnd(e.target.value)}
                    title="종료일 (비우면 재임 중)"
                    style={{
                      padding: '6px 10px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}
                  />
                  <input
                    type="text"
                    value={positionNotes}
                    onChange={(e) => setPositionNotes(e.target.value)}
                    placeholder="비고 (선택)"
                    style={{
                      flex: 1,
                      minWidth: '120px',
                      padding: '6px 10px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}
                  />
                  <button
                    onClick={addPosition}
                    disabled={positionSaving || (positionType === CUSTOM_POSITION && !positionCustom.trim())}
                    style={{
                      padding: '6px 16px',
                      backgroundColor:
                        positionSaving || (positionType === CUSTOM_POSITION && !positionCustom.trim())
                          ? '#93c5fd' : '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '14px',
                      fontWeight: 500,
                      cursor:
                        positionSaving || (positionType === CUSTOM_POSITION && !positionCustom.trim())
                          ? 'not-allowed' : 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {positionSaving ? '저장 중...' : '경력 등록'}
                  </button>
                  <div style={{ width: '100%', fontSize: '12px', color: '#9ca3af' }}>
                    종료일을 비우면 재임 중으로 등록됩니다. 영농회장·부녀회장을 재임 중으로 등록하면 영농회 관리의 이름도 함께 갱신됩니다.
                  </div>
                </div>
              )}
            </div>
          </Section>

          {/* 영농 정보 */}
          <Section title="영농 정보">
            <Field label="주작물" value={mainCropName} />
            <Field label="부작물" value={subCropName} />
            <Field label="접목 작업장 주소" value={m.grafting_workplace_address || '-'} wide />
          </Section>

          {/* 가입 정보 */}
          <Section title="가입 정보">
            <Field label="가입일" value={formatDate(m.join_date)} />
            <Field label="탈퇴일" value={formatDate(m.leave_date)} />
            <Field
              label="상태"
              value={
                <span style={{
                  padding: '2px 8px',
                  borderRadius: '9999px',
                  fontSize: '12px',
                  fontWeight: 600,
                  backgroundColor: m.is_active ? '#dcfce7' : '#f3f4f6',
                  color: m.is_active ? '#166534' : '#6b7280'
                }}>
                  {m.is_active ? '활성' : '비활성'}
                </span>
              }
            />
          </Section>

          {/* 교환권 현황 (목록 통계 기준) */}
          <Section title="교환권 현황">
            <Field
              label="발행"
              value={`${member.issued_voucher_count}건 / ${member.total_issued_amount.toLocaleString()}원`}
            />
            <Field
              label="사용"
              value={`${member.used_voucher_count}건 / ${member.total_used_amount.toLocaleString()}원`}
            />
            <Field
              label="잔액"
              value={
                <span style={{
                  color: member.remaining_amount > 0 ? '#059669' : '#6b7280',
                  fontWeight: 600
                }}>
                  {member.remaining_amount.toLocaleString()}원
                </span>
              }
            />
          </Section>

          {/* 접목 일정 */}
          <Section title="접목 일정">
            <div style={{ gridColumn: '1 / -1' }}>
              {schedules.length === 0 ? (
                <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '12px' }}>
                  등록된 접목 일정이 없습니다.
                </div>
              ) : (
                <div style={{ overflowX: 'auto', marginBottom: '12px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                        <th style={scheduleHeaderStyle}>연도</th>
                        <th style={scheduleHeaderStyle}>접목일</th>
                        <th style={scheduleHeaderStyle}>시간대</th>
                        <th style={scheduleHeaderStyle}>비고</th>
                        {canWriteSchedule && <th style={scheduleHeaderStyle}></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {schedules.map(s => (
                        <tr key={s.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                          <td style={scheduleCellStyle}>{s.year}</td>
                          <td style={scheduleCellStyle}>{formatDate(s.grafting_date)}</td>
                          <td style={scheduleCellStyle}>{s.time_period}</td>
                          <td style={scheduleCellStyle}>{s.notes || '-'}</td>
                          {canWriteSchedule && (
                            <td style={{ ...scheduleCellStyle, textAlign: 'right' }}>
                              <button
                                onClick={() => deleteSchedule(s)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  color: '#9ca3af',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  padding: '2px'
                                }}
                                title="일정 삭제"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {canWriteSchedule && (
                <div style={{
                  display: 'flex',
                  gap: '8px',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  backgroundColor: '#f9fafb',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  padding: '10px 12px'
                }}>
                  <input
                    type="date"
                    value={scheduleDate}
                    onChange={(e) => setScheduleDate(e.target.value)}
                    style={{
                      padding: '6px 10px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}
                  />
                  <select
                    value={schedulePeriod}
                    onChange={(e) => setSchedulePeriod(e.target.value as '오전' | '오후')}
                    style={{
                      padding: '6px 10px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}
                  >
                    <option value="오전">오전</option>
                    <option value="오후">오후</option>
                  </select>
                  <input
                    type="text"
                    value={scheduleNotes}
                    onChange={(e) => setScheduleNotes(e.target.value)}
                    placeholder="비고 (선택)"
                    style={{
                      flex: 1,
                      minWidth: '140px',
                      padding: '6px 10px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}
                  />
                  <button
                    onClick={addSchedule}
                    disabled={scheduleSaving || !scheduleDate}
                    style={{
                      padding: '6px 16px',
                      backgroundColor: scheduleSaving || !scheduleDate ? '#93c5fd' : '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '14px',
                      fontWeight: 500,
                      cursor: scheduleSaving || !scheduleDate ? 'not-allowed' : 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {scheduleSaving ? '저장 중...' : '일정 등록'}
                  </button>
                </div>
              )}
            </div>
          </Section>

          {/* 메모 */}
          <Section title={`메모 (${memos.length})`}>
            <div style={{ gridColumn: '1 / -1' }}>
              {memos.length === 0 ? (
                <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '12px' }}>
                  아직 남긴 메모가 없습니다.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                  {memos.map(memo => (
                    <div
                      key={memo.id}
                      style={{
                        backgroundColor: '#f9fafb',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        padding: '10px 12px'
                      }}
                    >
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '4px'
                      }}>
                        <div style={{ fontSize: '13px', color: '#374151' }}>
                          <span style={{ fontWeight: 600 }}>{memo.author_name || '알 수 없음'}</span>
                          <span style={{ color: '#9ca3af', marginLeft: '8px' }}>
                            {formatDateTime(memo.created_at)}
                          </span>
                        </div>
                        {(isAdmin || memo.author_id === user?.id) && (
                          <button
                            onClick={() => deleteMemo(memo)}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              color: '#9ca3af',
                              display: 'flex',
                              alignItems: 'center',
                              padding: '2px'
                            }}
                            title="메모 삭제"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                      <div style={{ fontSize: '14px', color: '#1f2937', whiteSpace: 'pre-wrap' }}>
                        {memo.content}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                <textarea
                  value={memoText}
                  onChange={(e) => setMemoText(e.target.value)}
                  placeholder="메모를 입력하세요"
                  rows={2}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                    resize: 'vertical',
                    fontFamily: 'inherit'
                  }}
                />
                <button
                  onClick={addMemo}
                  disabled={memoSaving || !memoText.trim()}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: memoSaving || !memoText.trim() ? '#93c5fd' : '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontWeight: 500,
                    cursor: memoSaving || !memoText.trim() ? 'not-allowed' : 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {memoSaving ? '저장 중...' : '등록'}
                </button>
              </div>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '24px' }}>
      <h4 style={{
        fontSize: '14px',
        fontWeight: 600,
        color: '#374151',
        margin: '0 0 12px 0',
        paddingBottom: '8px',
        borderBottom: '1px solid #e5e7eb'
      }}>
        {title}
      </h4>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '12px 20px'
      }}>
        {children}
      </div>
    </div>
  );
}

function Field({ label, value, wide }: { label: string; value: React.ReactNode; wide?: boolean }) {
  return (
    <div style={wide ? { gridColumn: '1 / -1' } : undefined}>
      <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '2px' }}>{label}</div>
      <div style={{ fontSize: '14px', color: '#1f2937' }}>{value}</div>
    </div>
  );
}

const scheduleHeaderStyle: React.CSSProperties = {
  padding: '8px 12px',
  textAlign: 'left',
  fontSize: '13px',
  fontWeight: 600,
  color: '#374151',
  whiteSpace: 'nowrap'
};

const scheduleCellStyle: React.CSSProperties = {
  padding: '8px 12px',
  color: '#1f2937',
  whiteSpace: 'nowrap'
};
