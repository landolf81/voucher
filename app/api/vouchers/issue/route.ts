import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { z } from 'zod';

// 교환권 발행 스키마
const voucherIssueSchema = z.object({
  voucher_ids: z.array(z.string().uuid()).min(1).max(1000)
});

// POST: 등록된 교환권을 발행 상태로 변경
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('교환권 발행 API 호출:', body);

    // 입력 검증
    const validation = voucherIssueSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          message: '입력 데이터가 올바르지 않습니다.',
          errors: validation.error.errors
        },
        { status: 400 }
      );
    }

    const { voucher_ids } = validation.data;

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 발행할 교환권들의 상태 확인
    const { data: vouchers, error: selectError } = await supabase
      .from('vouchers')
      .select('id, serial_no, status')
      .in('id', voucher_ids);

    if (selectError) {
      console.error('교환권 조회 오류:', selectError);
      return NextResponse.json(
        {
          success: false,
          message: '교환권 조회 중 오류가 발생했습니다.'
        },
        { status: 500 }
      );
    }

    if (!vouchers || vouchers.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: '발행할 교환권을 찾을 수 없습니다.'
        },
        { status: 404 }
      );
    }

    // 등록된 상태 또는 이미 발행된 상태의 교환권만 발행/재발행 가능
    const nonIssuableVouchers = vouchers.filter(v => v.status !== 'registered' && v.status !== 'issued');
    if (nonIssuableVouchers.length > 0) {
      const invalidStatuses = [...new Set(nonIssuableVouchers.map(v => v.status))].join(', ');
      return NextResponse.json(
        {
          success: false,
          message: `등록된 상태 또는 발행된 상태의 교환권만 (재)발행할 수 있습니다. (${nonIssuableVouchers.length}개가 ${invalidStatuses} 상태)`
        },
        { status: 400 }
      );
    }

    // 재발행과 신규 발행 구분
    const reissueVouchers = vouchers.filter(v => v.status === 'issued');
    const newIssueVouchers = vouchers.filter(v => v.status === 'registered');
    
    // 발행 가능한 교환권들을 발행 상태로 변경
    const issuableIds = vouchers.map(v => v.id);
    
    const { error: updateError } = await supabase
      .from('vouchers')
      .update({ 
        status: 'issued',
        issued_at: new Date().toISOString()
      })
      .in('id', issuableIds);

    if (updateError) {
      console.error('Supabase 교환권 발행 오류:', updateError);
      return NextResponse.json(
        {
          success: false,
          message: '교환권 발행 중 오류가 발생했습니다.'
        },
        { status: 500 }
      );
    }

    // 감사 로그 추가
    if (issuableIds.length > 0) {
      const auditLogs = issuableIds.map((id, index) => ({
        voucher_id: id,
        action: reissueVouchers.some(v => v.id === id) ? 'voucher_reissued' : 'voucher_issued',
        actor_user_id: null, // API 호출자 정보가 있으면 추가
        site_id: null,
        details: {
          serial_no: vouchers[index].serial_no,
          previous_status: vouchers[index].status,
          new_status: 'issued',
          issued_at: new Date().toISOString(),
          is_reissue: reissueVouchers.some(v => v.id === id)
        }
      }));

      const { error: auditError } = await supabase
        .from('audit_logs')
        .insert(auditLogs);

      if (auditError) {
        console.error('감사 로그 추가 오류:', auditError);
        // 감사 로그 실패는 전체 작업을 중단시키지 않음
      }
    }

    console.log(`${issuableIds.length}개 교환권 발행 완료 (신규: ${newIssueVouchers.length}, 재발행: ${reissueVouchers.length})`);

    return NextResponse.json({
      success: true,
      message: `${issuableIds.length}개의 교환권이 성공적으로 발행되었습니다. (신규: ${newIssueVouchers.length}, 재발행: ${reissueVouchers.length})`,
      data: {
        issuedCount: issuableIds.length,
        newIssueCount: newIssueVouchers.length,
        reissueCount: reissueVouchers.length,
        issuedIds: issuableIds
      }
    });

  } catch (error) {
    console.error('교환권 발행 API 오류:', error);
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