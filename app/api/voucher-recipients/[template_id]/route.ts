import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { decryptVoucherData } from '@/lib/encryption';

export async function GET(
  request: NextRequest,
  { params }: { params: { template_id: string } }
) {
  try {
    const template_id = params.template_id;
    console.log('템플릿별 발행대상자 조회 API 호출, template_id:', template_id);

    // Supabase 사용
    console.log('Supabase 사용 - 템플릿별 발행대상자 조회');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // 해당 템플릿으로 발행된 교환권들의 수혜자 조회
    const { data: vouchers, error: voucherError } = await supabase
      .from('vouchers')
      .select('recipient_id')
      .eq('template_id', template_id);

    if (voucherError) {
      console.error('교환권 조회 오류:', voucherError);
      return NextResponse.json(
        {
          success: false,
          message: '교환권 조회에 실패했습니다.'
        },
        { status: 500 }
      );
    }

    if (!vouchers || vouchers.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        message: '해당 템플릿으로 발행된 교환권이 없습니다.'
      });
    }

    // 중복 제거된 수혜자 ID 목록
    const recipientIds = [...new Set(vouchers.map((v: { recipient_id: string }) => v.recipient_id))];

    // 수혜자 정보 조회
    const { data: recipients, error: recipientError } = await supabase
      .from('voucher_recipients')
      .select('*')
      .in('id', recipientIds);

    if (recipientError) {
      console.error('수혜자 조회 오류:', recipientError);
      return NextResponse.json(
        {
          success: false,
          message: '수혜자 조회에 실패했습니다.'
        },
        { status: 500 }
      );
    }

    // 수혜자 정보 복호화
    const result = recipients?.map((recipient: any) => {
      try {
        const decrypted = decryptVoucherData({
          encrypted_name: recipient.encrypted_name,
          encrypted_dob: recipient.encrypted_dob,
          encrypted_phone: recipient.encrypted_phone
        });

        return {
          id: recipient.id,
          member_id: recipient.member_id,
          farming_association: recipient.farming_association,
          name: decrypted.name,
          dob: decrypted.dob,
          phone: decrypted.phone,
          status: recipient.status,
          notes: recipient.notes,
          created_at: recipient.created_at
        };
      } catch (error) {
        console.error('수혜자 정보 복호화 실패:', error);
        return {
          id: recipient.id,
          member_id: recipient.member_id,
          farming_association: recipient.farming_association,
          name: '복호화 실패',
          dob: '복호화 실패',
          phone: '복호화 실패',
          status: recipient.status,
          notes: recipient.notes,
          created_at: recipient.created_at
        };
      }
    }) || [];

    return NextResponse.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('템플릿별 발행대상자 조회 오류:', error);
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
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}