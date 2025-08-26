import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

// Twilio 클라이언트 초기화 (필요 시)
let twilioClient: any = null;

function getTwilioClient() {
  if (!twilioClient && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    const twilio = require('twilio');
    twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  }
  return twilioClient;
}

// POST: SMS 발송 처리
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      phone,
      message,
      messageType,
      voucherId,
      auditLogId,
      recipientName
    } = body;

    // 필수 필드 검증
    if (!phone || !message || !messageType) {
      return NextResponse.json({
        ok: false,
        error: 'MISSING_REQUIRED_FIELDS',
        message: 'phone, message, messageType은 필수입니다.'
      }, { status: 400 });
    }

    // 전화번호 형식 정규화
    const normalizedPhone = normalizePhoneNumber(phone);
    
    const supabase = supabaseServer();

    // 알림 설정 확인
    const { data: preferences } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('phone', normalizedPhone)
      .eq('is_active', true)
      .single();

    // 알림 타입별 수신 여부 확인
    if (preferences) {
      if (messageType === 'voucher_used' && !preferences.receive_usage_notifications) {
        return NextResponse.json({
          ok: false,
          error: 'NOTIFICATIONS_DISABLED',
          message: '사용 알림이 비활성화되어 있습니다.'
        });
      }
      if (messageType === 'voucher_issued' && !preferences.receive_issue_notifications) {
        return NextResponse.json({
          ok: false,
          error: 'NOTIFICATIONS_DISABLED',
          message: '발행 알림이 비활성화되어 있습니다.'
        });
      }
      
      // 알림 가능 시간 확인
      const now = new Date();
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      
      if (preferences.notification_time_start && preferences.notification_time_end) {
        if (currentTime < preferences.notification_time_start || currentTime > preferences.notification_time_end) {
          // 알림 시간 외에는 큐에만 저장
          const { data: queuedNotification } = await supabase
            .rpc('queue_sms_notification', {
              p_phone: normalizedPhone,
              p_message: message,
              p_message_type: messageType,
              p_voucher_id: voucherId || null,
              p_audit_log_id: auditLogId || null,
              p_recipient_name: recipientName || null
            });

          return NextResponse.json({
            ok: true,
            message: '알림이 예약되었습니다. 설정된 시간에 발송됩니다.',
            queued: true,
            notificationId: queuedNotification
          });
        }
      }
    }

    // SMS 발송
    let sendResult = null;
    let status = 'failed';
    let errorMessage = null;
    let providerMessageId = null;

    try {
      const client = getTwilioClient();
      
      if (client) {
        // Twilio를 통한 실제 SMS 발송 (Alphanumeric Sender ID 사용)
        const twilioMessage = await client.messages.create({
          body: message,
          to: formatPhoneForTwilio(normalizedPhone),
          from: process.env.TWILIO_SENDER_ID || '선남농협'
        });

        status = 'sent';
        providerMessageId = twilioMessage.sid;
        sendResult = {
          success: true,
          messageId: twilioMessage.sid,
          status: twilioMessage.status
        };
      } else {
        // Twilio 설정이 없는 경우 (개발 환경)
        console.log(`[SMS 시뮬레이션] To: ${normalizedPhone}, Message: ${message}`);
        status = 'sent';
        providerMessageId = `sim_${Date.now()}`;
        sendResult = {
          success: true,
          messageId: providerMessageId,
          simulated: true
        };
      }
    } catch (error: any) {
      console.error('SMS 발송 오류:', error);
      status = 'failed';
      errorMessage = error.message || 'SMS 발송 실패';
    }

    // 발송 로그 기록
    const { data: notificationLog, error: logError } = await supabase
      .from('notification_logs')
      .insert({
        phone: normalizedPhone,
        recipient_name: recipientName,
        message_type: messageType,
        message_content: message,
        voucher_id: voucherId || null,
        audit_log_id: auditLogId || null,
        status: status,
        sent_at: status === 'sent' ? new Date().toISOString() : null,
        error_message: errorMessage,
        provider: 'twilio',
        provider_message_id: providerMessageId
      })
      .select()
      .single();

    if (logError) {
      console.error('알림 로그 기록 오류:', logError);
    }

    return NextResponse.json({
      ok: status === 'sent',
      message: status === 'sent' ? 'SMS가 성공적으로 발송되었습니다.' : 'SMS 발송에 실패했습니다.',
      notificationId: notificationLog?.id,
      result: sendResult,
      status: status
    });

  } catch (error) {
    console.error('SMS 발송 API 오류:', error);
    return NextResponse.json({
      ok: false,
      error: 'INTERNAL_ERROR',
      message: '서버 오류가 발생했습니다.'
    }, { status: 500 });
  }
}

// GET: 알림 로그 조회
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const phone = searchParams.get('phone');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const supabase = supabaseServer();

    let query = supabase
      .from('notification_logs')
      .select('*, vouchers(serial_no, name, amount)')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (phone) {
      query = query.eq('phone', normalizePhoneNumber(phone));
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('알림 로그 조회 오류:', error);
      return NextResponse.json({
        ok: false,
        error: 'FETCH_FAILED',
        message: '알림 로그 조회에 실패했습니다.'
      }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      data: data || [],
      total: count || 0,
      limit,
      offset
    });

  } catch (error) {
    console.error('알림 로그 조회 API 오류:', error);
    return NextResponse.json({
      ok: false,
      error: 'INTERNAL_ERROR',
      message: '서버 오류가 발생했습니다.'
    }, { status: 500 });
  }
}

// 전화번호 정규화 함수
function normalizePhoneNumber(phone: string): string {
  // 모든 특수문자 제거
  let normalized = phone.replace(/[^0-9]/g, '');
  
  // 한국 번호 형식으로 정규화
  if (normalized.startsWith('82')) {
    normalized = '0' + normalized.substring(2);
  } else if (normalized.startsWith('+82')) {
    normalized = '0' + normalized.substring(3);
  }
  
  return normalized;
}

// Twilio용 전화번호 형식 변환
function formatPhoneForTwilio(phone: string): string {
  let formatted = normalizePhoneNumber(phone);
  
  // 한국 번호를 국제 형식으로 변환
  if (formatted.startsWith('0')) {
    formatted = '+82' + formatted.substring(1);
  } else if (!formatted.startsWith('+')) {
    formatted = '+' + formatted;
  }
  
  return formatted;
}

// PATCH: 알림 재발송
export async function PATCH(req: NextRequest) {
  try {
    const { notificationId } = await req.json();

    if (!notificationId) {
      return NextResponse.json({
        ok: false,
        error: 'MISSING_NOTIFICATION_ID',
        message: 'notificationId가 필요합니다.'
      }, { status: 400 });
    }

    const supabase = supabaseServer();

    // 알림 정보 조회
    const { data: notification, error: fetchError } = await supabase
      .from('notification_logs')
      .select('*')
      .eq('id', notificationId)
      .single();

    if (fetchError || !notification) {
      return NextResponse.json({
        ok: false,
        error: 'NOTIFICATION_NOT_FOUND',
        message: '알림을 찾을 수 없습니다.'
      }, { status: 404 });
    }

    // 재발송 시도
    const response = await fetch(new URL('/api/notifications/send-sms', req.url).toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        phone: notification.phone,
        message: notification.message_content,
        messageType: notification.message_type,
        voucherId: notification.voucher_id,
        auditLogId: notification.audit_log_id,
        recipientName: notification.recipient_name
      })
    });

    const result = await response.json();

    // 재시도 횟수 업데이트
    await supabase
      .from('notification_logs')
      .update({
        retry_count: (notification.retry_count || 0) + 1,
        updated_at: new Date().toISOString()
      })
      .eq('id', notificationId);

    return NextResponse.json(result);

  } catch (error) {
    console.error('알림 재발송 오류:', error);
    return NextResponse.json({
      ok: false,
      error: 'INTERNAL_ERROR',
      message: '서버 오류가 발생했습니다.'
    }, { status: 500 });
  }
}