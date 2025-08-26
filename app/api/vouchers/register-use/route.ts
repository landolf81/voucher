import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { z } from 'zod';

// 교환권 사용 등록 스키마 (개선된 버전)
const registerUseSchema = z.object({
  serial_no: z.string().min(1, '일련번호를 입력해주세요.'),
  usage_location: z.string().min(1, '사용처를 입력해주세요.'),
  site_id: z.string().uuid('유효한 사업장 ID가 필요합니다.').optional(),
  notes: z.string().optional(),
  usage_amount: z.number().optional(), // 실제 사용 금액 (부분 사용 지원)
  customer_info: z.object({
    name: z.string().optional(),
    phone: z.string().optional()
  }).optional()
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('교환권 사용 등록 API 호출:', body);

    // 입력 검증
    const validation = registerUseSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          message: '입력 정보가 올바르지 않습니다.',
          errors: validation.error.errors
        },
        { status: 400 }
      );
    }

    const { serial_no, usage_location, site_id, notes, usage_amount, customer_info } = validation.data;

    // Supabase 클라이언트 생성
    const supabase = supabaseServer();

    // 현재 사용자 정보 가져오기 (실제 구현에서는 JWT 토큰에서 추출)
    // TODO: 실제 구현에서는 인증된 사용자 ID를 가져와야 함
    const currentUserId = 'temp_user_id';
    const currentSiteId = site_id || 'temp_site_id'; // 사용자의 사업장 ID

    // 교환권 조회
    const { data: voucher, error: findError } = await supabase
      .from('vouchers')
      .select('*')
      .eq('serial_no', serial_no)
      .single();

    if (findError || !voucher) {
      return NextResponse.json(
        {
          success: false,
          message: '해당 일련번호의 교환권을 찾을 수 없습니다.'
        },
        { status: 404 }
      );
    }

    // 교환권 상태 확인 - 발행된 상태에서만 사용 가능
    if (voucher.status !== 'issued') {
      let statusMessage = '';
      switch (voucher.status) {
        case 'used':
          statusMessage = '이미 사용된 교환권입니다.';
          break;
        case 'recalled':
          statusMessage = '회수된 교환권은 사용할 수 없습니다.';
          break;
        case 'disposed':
          statusMessage = '폐기된 교환권은 사용할 수 없습니다.';
          break;
        case 'registered':
          statusMessage = '아직 발행되지 않은 교환권입니다.';
          break;
        default:
          statusMessage = '사용할 수 없는 상태의 교환권입니다.';
      }
      
      return NextResponse.json(
        {
          success: false,
          message: statusMessage,
          current_status: voucher.status
        },
        { status: 400 }
      );
    }

    // 사용 금액 검증 (부분 사용 지원)
    const actualUsageAmount = usage_amount || voucher.amount;
    if (usage_amount && usage_amount > voucher.amount) {
      return NextResponse.json(
        {
          success: false,
          message: `사용 금액(${usage_amount})이 교환권 금액(${voucher.amount})을 초과할 수 없습니다.`
        },
        { status: 400 }
      );
    }

    // 교환권 상태를 'used'로 업데이트
    const updateData: any = {
      status: 'used',
      used_at: new Date().toISOString(),
      used_by_user_id: currentUserId,
      used_at_site_id: currentSiteId,
      usage_location: usage_location,
      notes: notes || ''
    };

    // 부분 사용인 경우 사용 금액 기록
    if (usage_amount && usage_amount < voucher.amount) {
      updateData.usage_amount = usage_amount;
      updateData.remaining_amount = voucher.amount - usage_amount;
    }

    // 고객 정보가 제공된 경우 기록
    if (customer_info) {
      updateData.customer_name = customer_info.name;
      updateData.customer_phone = customer_info.phone;
    }

    const { error: updateError } = await supabase
      .from('vouchers')
      .update(updateData)
      .eq('id', voucher.id);

    if (updateError) {
      console.error('교환권 사용 업데이트 오류:', updateError);
      return NextResponse.json(
        {
          success: false,
          message: '교환권 사용 등록에 실패했습니다.'
        },
        { status: 500 }
      );
    }

    // 감사 로그 추가
    const { error: auditError } = await supabase
      .from('audit_logs')
      .insert({
        action: 'voucher_usage_registered',
        target_type: 'voucher',
        target_id: voucher.id,
        user_id: currentUserId,
        site_id: currentSiteId,
        details: {
          serial_no: serial_no,
          usage_location: usage_location,
          usage_amount: actualUsageAmount,
          voucher_amount: voucher.amount,
          partial_use: usage_amount && usage_amount < voucher.amount,
          remaining_amount: usage_amount ? voucher.amount - usage_amount : 0,
          customer_info: customer_info,
          notes: notes,
          previous_status: voucher.status,
          new_status: 'used',
          registered_at: new Date().toISOString()
        },
        ip_address: request.headers.get('x-forwarded-for') || 'unknown'
      });

    if (auditError) {
      console.error('감사 로그 추가 오류:', auditError);
      // 감사 로그 실패는 전체 작업을 중단시키지 않음
    }

    // SMS 알림 발송 (전화번호가 있는 경우)
    let smsResult = null;
    if (voucher.phone) {
      try {
        // 사용처 이름 조회 (만약 site_id가 있다면)
        let siteName = usage_location;
        if (currentSiteId && currentSiteId !== 'temp_site_id') {
          try {
            const { data: siteData } = await supabase
              .from('sites')
              .select('site_name')
              .eq('id', currentSiteId)
              .single();
            if (siteData) {
              siteName = siteData.site_name;
            }
          } catch (siteError) {
            console.warn('사업장 이름 조회 실패, 기본값 사용:', siteError);
          }
        }

        // 템플릿 정보 조회
        let templateName = '교환권';
        if (voucher.template_id) {
          try {
            const { data: templateData } = await supabase
              .from('voucher_templates')
              .select('voucher_name')
              .eq('id', voucher.template_id)
              .single();
            if (templateData) {
              templateName = templateData.voucher_name;
            }
          } catch (templateError) {
            console.warn('템플릿 정보 조회 실패, 기본값 사용:', templateError);
          }
        }

        const smsResponse = await fetch(new URL('/api/notifications/send-sms', request.url).toString(), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            phone: voucher.phone,
            message: `[교환권 사용] ${voucher.name || '회원'}님의 "${templateName}" ${new Date().toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })} ${siteName}에서 사용되었습니다. 금액: ${actualUsageAmount.toLocaleString()}원`,
            messageType: 'voucher_used',
            voucherId: voucher.id,
            recipientName: voucher.name
          })
        });

        if (smsResponse.ok) {
          const responseText = await smsResponse.text();
          try {
            smsResult = JSON.parse(responseText);
            console.log('SMS 발송 성공:', smsResult);
          } catch (parseError) {
            console.error('SMS 응답 파싱 오류:', responseText.substring(0, 200) + '...');
            smsResult = { ok: false, error: 'Invalid JSON response' };
          }
        } else {
          const errorText = await smsResponse.text();
          console.warn(`SMS 발송 실패 (${serial_no}): ${smsResponse.status} - ${errorText.substring(0, 200) + '...'}`);
        }
      } catch (smsError) {
        console.error(`SMS 발송 오류 (${serial_no}):`, smsError.message || smsError);
      }
    }

    console.log('교환권 사용 등록 완료:', {
      serial_no,
      usage_location,
      usage_amount: actualUsageAmount,
      notes,
      site_id: currentSiteId,
      user_id: currentUserId,
      sms_sent: !!smsResult?.ok
    });

    return NextResponse.json({
      success: true,
      message: '교환권 사용이 성공적으로 등록되었습니다.',
      data: {
        serial_no: voucher.serial_no,
        used_at: new Date().toISOString(),
        usage_location: usage_location,
        usage_amount: actualUsageAmount,
        voucher_amount: voucher.amount,
        partial_use: usage_amount && usage_amount < voucher.amount,
        remaining_amount: usage_amount ? voucher.amount - usage_amount : 0,
        notes: notes,
        user_id: currentUserId,
        site_id: currentSiteId,
        previous_status: voucher.status,
        current_status: 'used',
        sms_sent: !!smsResult?.ok,
        phone: voucher.phone
      }
    });

  } catch (error) {
    console.error('교환권 사용 등록 오류:', error);
    return NextResponse.json(
      {
        success: false,
        message: '서버 오류가 발생했습니다.'
      },
      { status: 500 }
    );
  }
}

// OPTIONS 요청 처리 (CORS)
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}