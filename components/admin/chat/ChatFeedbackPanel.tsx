'use client';

/**
 * 챗봇 피드백 관리자 패널
 *
 * 직원들이 챗봇(assistant) 답변에 남긴 좋아요/싫어요 피드백을 모아 보는 화면.
 * chat_message_feedback 은 문답 원문(question/answer)을 스냅샷으로 갖고 있어
 * chat_messages RLS 를 넓히지 않고도 해당 문답만 열람 가능 (admin SELECT 정책).
 */

import React, { useCallback, useEffect, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabase';
import { ThumbsUp, ThumbsDown, ChevronDown, ChevronUp, MessageSquareWarning } from 'lucide-react';

type FeedbackRating = 'up' | 'down';
type RatingFilter = 'all' | FeedbackRating;

interface FeedbackRow {
  id: string;
  message_id: string;
  session_id: string;
  user_id: string;
  user_name: string | null;
  rating: FeedbackRating;
  reason: string | null;
  comment: string | null;
  question_content: string | null;
  answer_content: string | null;
  created_at: string;
  updated_at: string;
}

// chat_message_feedback.reason CHECK 값 ↔ 표시 라벨 (ChatAssistant 의 선택지와 동일)
const REASON_LABELS: Record<string, string> = {
  inaccurate: '부정확함',
  misunderstood: '질문 이해 못함',
  insufficient: '답변 불충분',
  tone: '말투·호칭 문제',
  slow: '너무 느림',
  other: '기타',
};

const LOAD_LIMIT = 500;

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('ko-KR', {
    year: '2-digit',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function ChatFeedbackPanel() {
  const supabase = getSupabaseClient();
  const db = supabase as any; // Database 타입 미생성 프로젝트 관행 (ChatAssistant 와 동일)

  const [rows, setRows] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<RatingFilter>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await db
      .from('chat_message_feedback')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(LOAD_LIMIT);
    setLoading(false);
    if (error) {
      console.error('피드백 로드 실패:', error);
      return;
    }
    setRows((data as unknown as FeedbackRow[]) || []);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  // ── 통계 (로드된 범위 기준) ─────────────────────
  const upCount = rows.filter((r) => r.rating === 'up').length;
  const downCount = rows.length - upCount;
  const satisfaction = rows.length > 0 ? Math.round((upCount / rows.length) * 100) : null;

  const reasonCounts = rows
    .filter((r) => r.rating === 'down' && r.reason)
    .reduce<Record<string, number>>((acc, r) => {
      acc[r.reason as string] = (acc[r.reason as string] || 0) + 1;
      return acc;
    }, {});

  const filtered = filter === 'all' ? rows : rows.filter((r) => r.rating === filter);

  const statCard = (label: string, value: React.ReactNode, color: string) => (
    <div
      style={{
        flex: 1,
        minWidth: '120px',
        backgroundColor: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: '12px',
        padding: '14px 16px',
      }}
    >
      <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>{label}</p>
      <p style={{ margin: '6px 0 0', fontSize: '22px', fontWeight: 700, color }}>{value}</p>
    </div>
  );

  const filterBtn = (value: RatingFilter, label: string) => (
    <button
      onClick={() => setFilter(value)}
      style={{
        padding: '6px 14px',
        borderRadius: '999px',
        border: `1px solid ${filter === value ? '#2563eb' : '#d1d5db'}`,
        backgroundColor: filter === value ? '#eff6ff' : '#fff',
        color: filter === value ? '#1d4ed8' : '#4b5563',
        fontSize: '13px',
        fontWeight: filter === value ? 600 : 400,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );

  return (
    <div>
      {/* 요약 통계 */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
        {statCard('전체 피드백', rows.length, '#111827')}
        {statCard('좋아요', upCount, '#2563eb')}
        {statCard('싫어요', downCount, '#dc2626')}
        {statCard('만족률', satisfaction === null ? '—' : `${satisfaction}%`, '#059669')}
      </div>

      {/* 싫어요 사유 분포 */}
      {downCount > 0 && (
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '16px' }}>
          {Object.entries(reasonCounts)
            .sort((a, b) => b[1] - a[1])
            .map(([reason, count]) => (
              <span
                key={reason}
                style={{
                  padding: '4px 10px',
                  borderRadius: '999px',
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#b91c1c',
                  fontSize: '12px',
                }}
              >
                {REASON_LABELS[reason] || reason} {count}
              </span>
            ))}
        </div>
      )}

      {/* 필터 */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
        {filterBtn('all', `전체 ${rows.length}`)}
        {filterBtn('up', `좋아요 ${upCount}`)}
        {filterBtn('down', `싫어요 ${downCount}`)}
      </div>

      {/* 목록 */}
      {loading ? (
        <p style={{ color: '#9ca3af', textAlign: 'center', padding: '40px 0' }}>불러오는 중…</p>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#9ca3af', padding: '48px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '10px' }}>
            <MessageSquareWarning size={32} />
          </div>
          <p style={{ margin: 0, fontSize: '14px' }}>피드백이 없습니다.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filtered.map((r) => {
            const expanded = expandedId === r.id;
            return (
              <div
                key={r.id}
                style={{
                  backgroundColor: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '12px',
                  padding: '14px 16px',
                }}
              >
                {/* 헤더 행 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      color: r.rating === 'up' ? '#2563eb' : '#dc2626',
                    }}
                  >
                    {r.rating === 'up' ? (
                      <ThumbsUp size={16} fill="currentColor" />
                    ) : (
                      <ThumbsDown size={16} fill="currentColor" />
                    )}
                  </span>
                  <span style={{ fontWeight: 600, fontSize: '14px', color: '#1f2937' }}>
                    {r.user_name || '직원'}
                  </span>
                  {r.rating === 'down' && r.reason && (
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '999px',
                        backgroundColor: '#fef2f2',
                        color: '#b91c1c',
                        fontSize: '12px',
                      }}
                    >
                      {REASON_LABELS[r.reason] || r.reason}
                    </span>
                  )}
                  <span style={{ marginLeft: 'auto', fontSize: '12px', color: '#9ca3af' }}>
                    {formatDateTime(r.created_at)}
                  </span>
                </div>

                {/* 코멘트 */}
                {r.comment && (
                  <p style={{ margin: '8px 0 0', fontSize: '14px', color: '#374151', whiteSpace: 'pre-wrap' }}>
                    {r.comment}
                  </p>
                )}

                {/* 문답 원문 토글 */}
                <button
                  onClick={() => setExpandedId(expanded ? null : r.id)}
                  style={{
                    marginTop: '10px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    border: 'none',
                    background: 'transparent',
                    color: '#2563eb',
                    fontSize: '13px',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  {expanded ? '문답 접기' : '문답 보기'}
                </button>

                {expanded && (
                  <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div
                      style={{
                        padding: '10px 12px',
                        borderRadius: '10px',
                        backgroundColor: '#eff6ff',
                        fontSize: '13px',
                        color: '#1e3a8a',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                      }}
                    >
                      <strong style={{ display: 'block', marginBottom: '4px', fontSize: '12px' }}>질문</strong>
                      {r.question_content || '(질문 기록 없음)'}
                    </div>
                    <div
                      style={{
                        padding: '10px 12px',
                        borderRadius: '10px',
                        backgroundColor: '#f3f4f6',
                        fontSize: '13px',
                        color: '#111827',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                      }}
                    >
                      <strong style={{ display: 'block', marginBottom: '4px', fontSize: '12px' }}>답변</strong>
                      {r.answer_content || '(답변 기록 없음)'}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default ChatFeedbackPanel;
