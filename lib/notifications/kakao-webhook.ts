/**
 * 카카오워크 웹훅 알림 시스템
 * 관리자 내부 알림용
 */

interface WebhookMessage {
  text: string;
  blocks?: WebhookBlock[];
}

interface WebhookBlock {
  type: 'header' | 'text' | 'description' | 'button' | 'divider';
  text?: string;
  content?: {
    title?: string;
    description?: string;
  };
  button?: {
    text: string;
    style: 'default' | 'primary' | 'danger';
  };
}

// 알림 타입 정의
type NotificationType =
  | 'voucher_issued'      // 교환권 발행
  | 'voucher_used'        // 교환권 사용
  | 'voucher_cancelled'   // 교환권 취소
  | 'member_created'      // 조합원 등록
  | 'batch_completed'     // 일괄 발행 완료
  | 'error'               // 시스템 에러
  | 'custom';             // 커스텀 알림

interface NotificationPayload {
  type: NotificationType;
  title: string;
  message: string;
  details?: Record<string, string | number>;
  url?: string;
  level?: 'info' | 'success' | 'warning' | 'error';
}

/**
 * 카카오워크 웹훅으로 메시지 전송
 */
export async function sendKakaoWorkNotification(payload: NotificationPayload): Promise<boolean> {
  const webhookUrl = process.env.KAKAOWORK_WEBHOOK_URL;

  if (!webhookUrl) {
    console.warn('KAKAOWORK_WEBHOOK_URL이 설정되지 않았습니다.');
    return false;
  }

  try {
    const emoji = getEmoji(payload.level || 'info');
    const blocks = buildBlocks(payload);

    const message: WebhookMessage = {
      text: `${emoji} ${payload.title}`,
      blocks
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      console.error('카카오워크 웹훅 전송 실패:', response.status, await response.text());
      return false;
    }

    console.log('카카오워크 알림 전송 성공:', payload.type);
    return true;
  } catch (error) {
    console.error('카카오워크 웹훅 에러:', error);
    return false;
  }
}

/**
 * 레벨에 따른 이모지 반환
 */
function getEmoji(level: string): string {
  switch (level) {
    case 'success': return '✅';
    case 'warning': return '⚠️';
    case 'error': return '🚨';
    default: return 'ℹ️';
  }
}

/**
 * 메시지 블록 구성
 */
function buildBlocks(payload: NotificationPayload): WebhookBlock[] {
  const blocks: WebhookBlock[] = [
    {
      type: 'header',
      text: payload.title
    },
    {
      type: 'text',
      text: payload.message
    }
  ];

  // 상세 정보가 있으면 추가
  if (payload.details && Object.keys(payload.details).length > 0) {
    blocks.push({ type: 'divider' });

    for (const [key, value] of Object.entries(payload.details)) {
      blocks.push({
        type: 'description',
        content: {
          title: key,
          description: String(value)
        }
      });
    }
  }

  return blocks;
}

// ===== 편의 함수들 =====

/**
 * 교환권 발행 알림
 */
export async function notifyVoucherIssued(data: {
  serialNo: string;
  amount: number;
  memberName: string;
  association: string;
  issuerName?: string;
}): Promise<boolean> {
  return sendKakaoWorkNotification({
    type: 'voucher_issued',
    title: '교환권 발행',
    message: `${data.memberName}님에게 교환권이 발행되었습니다.`,
    level: 'success',
    details: {
      '교환권번호': data.serialNo,
      '금액': `${data.amount.toLocaleString()}원`,
      '조합원': data.memberName,
      '영농회': data.association,
      ...(data.issuerName && { '발행자': data.issuerName })
    }
  });
}

/**
 * 교환권 사용 알림
 */
export async function notifyVoucherUsed(data: {
  serialNo: string;
  amount: number;
  memberName: string;
  usedAt: string;
  storeName?: string;
}): Promise<boolean> {
  return sendKakaoWorkNotification({
    type: 'voucher_used',
    title: '교환권 사용',
    message: `교환권이 사용되었습니다.`,
    level: 'info',
    details: {
      '교환권번호': data.serialNo,
      '금액': `${data.amount.toLocaleString()}원`,
      '사용자': data.memberName,
      '사용일시': data.usedAt,
      ...(data.storeName && { '사용처': data.storeName })
    }
  });
}

/**
 * 일괄 발행 완료 알림
 */
export async function notifyBatchCompleted(data: {
  batchName: string;
  totalCount: number;
  successCount: number;
  failedCount: number;
  issuerName?: string;
}): Promise<boolean> {
  const level = data.failedCount > 0 ? 'warning' : 'success';

  return sendKakaoWorkNotification({
    type: 'batch_completed',
    title: '일괄 발행 완료',
    message: `${data.batchName} 일괄 발행이 완료되었습니다.`,
    level,
    details: {
      '배치명': data.batchName,
      '전체': `${data.totalCount}건`,
      '성공': `${data.successCount}건`,
      '실패': `${data.failedCount}건`,
      ...(data.issuerName && { '발행자': data.issuerName })
    }
  });
}

/**
 * 조합원 등록 알림
 */
export async function notifyMemberCreated(data: {
  memberName: string;
  memberId: string;
  association: string;
}): Promise<boolean> {
  return sendKakaoWorkNotification({
    type: 'member_created',
    title: '조합원 등록',
    message: `새로운 조합원이 등록되었습니다.`,
    level: 'info',
    details: {
      '성명': data.memberName,
      '조합원ID': data.memberId,
      '영농회': data.association
    }
  });
}

/**
 * 시스템 에러 알림
 */
export async function notifySystemError(data: {
  errorType: string;
  message: string;
  location?: string;
  stack?: string;
}): Promise<boolean> {
  return sendKakaoWorkNotification({
    type: 'error',
    title: '시스템 에러',
    message: data.message,
    level: 'error',
    details: {
      '에러 유형': data.errorType,
      ...(data.location && { '발생 위치': data.location }),
      '발생 시각': new Date().toLocaleString('ko-KR')
    }
  });
}

/**
 * 일일 요약 알림
 */
export async function notifyDailySummary(data: {
  date: string;
  issuedCount: number;
  issuedAmount: number;
  usedCount: number;
  usedAmount: number;
}): Promise<boolean> {
  return sendKakaoWorkNotification({
    type: 'custom',
    title: '일일 요약 보고',
    message: `${data.date} 교환권 현황입니다.`,
    level: 'info',
    details: {
      '발행': `${data.issuedCount}건 / ${data.issuedAmount.toLocaleString()}원`,
      '사용': `${data.usedCount}건 / ${data.usedAmount.toLocaleString()}원`,
      '기준일': data.date
    }
  });
}
