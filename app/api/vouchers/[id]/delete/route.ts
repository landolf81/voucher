import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { success: false, message: '교환권 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    // Supabase 클라이언트 생성
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 먼저 교환권 정보 조회 (삭제 전 상태 확인)
    const { data: voucher, error: fetchError } = await supabase
      .from('vouchers')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError) {
      console.error('교환권 조회 오류:', fetchError);
      return NextResponse.json(
        { success: false, message: '교환권을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 사용된 교환권은 삭제 불가
    if (voucher.status === 'used') {
      return NextResponse.json(
        { success: false, message: '사용된 교환권은 삭제할 수 없습니다.' },
        { status: 400 }
      );
    }

    // 교환권 삭제
    const { error: deleteError } = await supabase
      .from('vouchers')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('교환권 삭제 오류:', deleteError);
      return NextResponse.json(
        { success: false, message: '교환권 삭제에 실패했습니다.' },
        { status: 500 }
      );
    }

    // 감사 로그 추가
    try {
      await supabase
        .from('audit_logs')
        .insert({
          voucher_id: id,
          action: 'delete_voucher',
          details: {
            serial_no: voucher.serial_no,
            name: voucher.name,
            amount: voucher.amount,
            previous_status: voucher.status
          }
        });
    } catch (logError) {
      console.error('감사 로그 추가 실패:', logError);
      // 로그 실패는 무시하고 계속 진행
    }

    return NextResponse.json({
      success: true,
      message: `교환권 ${voucher.serial_no}이 삭제되었습니다.`
    });

  } catch (error) {
    console.error('교환권 삭제 API 오류:', error);
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}