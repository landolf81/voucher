'use client';

import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Ticket, CheckCircle, XCircle, SquarePen } from 'lucide-react';

interface ActivityLog {
  id: string;
  action: string;
  action_type: string;
  created_at: string;
  quantity?: number;
  total_amount?: number;
  details?: any;
  serial_no?: string;
  voucher_amount?: number;
  voucher_holder?: string;
  association?: string;
  template_name?: string;
  template_type?: string;
  actor_name?: string;
  actor_user_id?: string;
  site_name?: string;
  used_by_name?: string;
  used_by_user_id?: string;
}

export function ActivityFeed() {
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const limit = 20;

  // 활동 로그 조회
  const fetchActivities = async (reset = false) => {
    try {
      setLoading(true);
      const offset = reset ? 0 : (page - 1) * limit;
      
      let url = `/api/audit/log-activity?limit=${limit}&offset=${offset}`;
      if (filter !== 'all') {
        url += `&actionType=${filter}`;
      }

      const response = await fetch(url);
      const result = await response.json();

      if (result.ok) {
        if (reset) {
          setActivities(result.data);
        } else {
          setActivities(prev => [...prev, ...result.data]);
        }
        setHasMore(result.data.length === limit);
      }
    } catch (error) {
      console.error('활동 로그 조회 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivities(true);
  }, [filter]);

  // 액션 타입별 아이콘과 색상
  const getActionStyle = (actionType: string) => {
    switch (actionType) {
      case 'issue':
      case 'bulk_issue':
        return { icon: Ticket, color: '#10b981', bgColor: '#d1fae5' };
      case 'use':
      case 'bulk_use':
        return { icon: CheckCircle, color: '#3b82f6', bgColor: '#dbeafe' };
      case 'cancel':
      case 'recall':
        return { icon: XCircle, color: '#ef4444', bgColor: '#fee2e2' };
      default:
        return { icon: SquarePen, color: '#6b7280', bgColor: '#f3f4f6' };
    }
  };

  // 활동 설명 생성
  const getActivityDescription = (activity: ActivityLog) => {
    const { action_type, actor_name, quantity, total_amount, site_name } = activity;
    
    switch (action_type) {
      case 'bulk_issue':
        return `${actor_name || '사용자'}님이 ${activity.template_name || '교환권'} ${quantity || 0}매를 발급했습니다.`;
      case 'use':
        return `${activity.used_by_name || '사용자'}님이 ${site_name || '사업장'}에서 교환권 ${formatAmount(activity.voucher_amount || 0)}을 사용했습니다.`;
      case 'issue':
        return `${actor_name || '사용자'}님이 ${activity.voucher_holder}님의 교환권을 발급했습니다.`;
      case 'cancel':
        return `${actor_name || '사용자'}님이 교환권을 취소했습니다.`;
      default:
        return activity.action;
    }
  };

  // 금액 포맷
  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW'
    }).format(amount);
  };

  // 시간 포맷
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return '방금 전';
    if (minutes < 60) return `${minutes}분 전`;
    if (hours < 24) return `${hours}시간 전`;
    if (days < 7) return `${days}일 전`;
    
    return format(date, 'yyyy년 MM월 dd일 HH:mm', { locale: ko });
  };

  return (
    <div style={{
      backgroundColor: 'white',
      borderRadius: '12px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      overflow: 'hidden'
    }}>
      {/* 헤더 */}
      <div style={{
        padding: '20px',
        borderBottom: '1px solid #e5e7eb'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h3 style={{
            fontSize: '18px',
            fontWeight: '600',
            color: '#111827',
            margin: 0
          }}>
            실시간 활동
          </h3>
          
          {/* 필터 */}
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{
              padding: '6px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '14px',
              backgroundColor: 'white',
              cursor: 'pointer'
            }}
          >
            <option value="all">전체</option>
            <option value="issue">발행</option>
            <option value="bulk_issue">대량발행</option>
            <option value="use">사용</option>
            <option value="cancel">취소</option>
          </select>
        </div>
      </div>

      {/* 활동 리스트 */}
      <div style={{
        maxHeight: '500px',
        overflowY: 'auto'
      }}>
        {loading && activities.length === 0 ? (
          <div style={{
            padding: '40px',
            textAlign: 'center',
            color: '#6b7280'
          }}>
            로딩 중...
          </div>
        ) : activities.length === 0 ? (
          <div style={{
            padding: '40px',
            textAlign: 'center',
            color: '#6b7280'
          }}>
            활동 내역이 없습니다.
          </div>
        ) : (
          <>
            {activities.map((activity) => {
              const style = getActionStyle(activity.action_type);
              
              return (
                <div
                  key={activity.id}
                  style={{
                    padding: '16px 20px',
                    borderBottom: '1px solid #f3f4f6',
                    display: 'flex',
                    gap: '12px',
                    alignItems: 'start',
                    transition: 'background-color 0.2s',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f9fafb';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  {/* 아이콘 */}
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    backgroundColor: style.bgColor,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: style.color,
                    flexShrink: 0
                  }}>
                    <style.icon size={18} />
                  </div>

                  {/* 내용 */}
                  <div style={{
                    flex: 1,
                    minWidth: 0
                  }}>
                    <div style={{
                      fontSize: '14px',
                      color: '#111827',
                      marginBottom: '4px',
                      lineHeight: '1.4'
                    }}>
                      {getActivityDescription(activity)}
                    </div>
                    
                    {/* 상세 정보 */}
                    <div style={{
                      display: 'flex',
                      gap: '12px',
                      fontSize: '12px',
                      color: '#6b7280'
                    }}>
                      <span>{formatTime(activity.created_at)}</span>
                      {activity.serial_no && (
                        <span>#{activity.serial_no}</span>
                      )}
                      {activity.association && (
                        <span>{activity.association}</span>
                      )}
                    </div>
                  </div>

                  {/* 금액 */}
                  {activity.total_amount && (
                    <div style={{
                      fontSize: '14px',
                      fontWeight: '600',
                      color: style.color,
                      flexShrink: 0
                    }}>
                      {formatAmount(activity.total_amount)}
                    </div>
                  )}
                </div>
              );
            })}

            {/* 더보기 버튼 */}
            {hasMore && !loading && (
              <div style={{
                padding: '16px',
                textAlign: 'center'
              }}>
                <button
                  onClick={() => {
                    setPage(prev => prev + 1);
                    fetchActivities(false);
                  }}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#f3f4f6',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '14px',
                    color: '#374151',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#e5e7eb';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#f3f4f6';
                  }}
                >
                  더 보기
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}