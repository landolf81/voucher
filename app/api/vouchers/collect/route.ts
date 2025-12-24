import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { z } from 'zod';

// 교환권 회수 스키마
const collectVoucherSchema = z.object({
  serial_no: z.string().min(1, '일련번호를 입력해주세요.'),
  reason: z.string().optional(),
  notes: z.string().optional()
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('교환권 회수 API 호출:', body);

    // 입력 검증
    const validation = collectVoucherSchema.safeParse(body);
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

    const { serial_no, reason, notes } = validation.data;

    // Supabase 클라이언트 생성
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY! // 서비스 역할 키 사용
    );

    // 현재 사용자 정보 가져오기 (실제 구현에서는 JWT 토큰에서 추출)
    // TODO: 실제 구현에서는 인증된 사용자 ID를 가져와야 함
    const currentUserId = 'temp_user_id';
    const currentUserRole = 'admin'; // TODO: 실제 사용자 역할 가져오기

    // 관리자 권한 확인
    if (currentUserRole !== 'admin') {
      return NextResponse.json(
        {
          success: false,
          message: '교환권 회수는 관리자만 수행할 수 있습니다.'
        },
        { status: 403 }
      );
    }

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

    // 교환권 상태 확인 - 발행된 상태에서만 회수 가능
    if (voucher.status !== 'issued') {
      let statusMessage = '';
      switch (voucher.status) {
        case 'used':
          statusMessage = '이미 사용된 교환권은 회수할 수 없습니다.';
          break;
        case 'recalled':
          statusMessage = '이미 회수된 교환권입니다.';
          break;
        case 'disposed':
          statusMessage = '이미 폐기된 교환권입니다.';
          break;
        case 'registered':
          statusMessage = '아직 발행되지 않은 교환권입니다.';
          break;
        default:
          statusMessage = '회수할 수 없는 상태의 교환권입니다.';
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

    // 교환권 상태를 'recalled'로 업데이트
    const { error: updateError } = await supabase
      .from('vouchers')
      .update({
        status: 'recalled',
        recalled_at: new Date().toISOString(),
        recalled_by_user_id: currentUserId,
        recall_reason: reason || notes || '관리자에 의한 회수'
      })
      .eq('id', voucher.id);

    if (updateError) {
      console.error('교환권 회수 업데이트 오류:', updateError);
      return NextResponse.json(
        {
          success: false,
          message: '교환권 회수에 실패했습니다.'
        },
        { status: 500 }
      );
    }

    // 감사 로그 추가
    const { error: auditError } = await supabase
      .from('audit_logs')
      .insert({
        action: 'voucher_collected',
        target_type: 'voucher',
        target_id: voucher.id,
        user_id: currentUserId,
        details: {
          serial_no: serial_no,
          reason: reason,
          notes: notes,
          previous_status: voucher.status,
          new_status: 'recalled',
          collected_at: new Date().toISOString()
        },
        ip_address: request.headers.get('x-forwarded-for') || 'unknown'
      });

    if (auditError) {
      console.error('감사 로그 추가 오류:', auditError);
      // 감사 로그 실패는 전체 작업을 중단시키지 않음
    }

    console.log('교환권 회수 완료:', {
      serial_no,
      reason,
      notes,
      collected_at: new Date().toISOString()
    });

    return NextResponse.json({
      success: true,
      message: '교환권이 성공적으로 회수되었습니다.',
      data: {
        serial_no: voucher.serial_no,
        collected_at: new Date().toISOString(),
        reason: reason,
        notes: notes,
        previous_status: voucher.status,
        current_status: 'recalled'
      }
    });

  } catch (error) {
    console.error('교환권 회수 오류:', error);
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