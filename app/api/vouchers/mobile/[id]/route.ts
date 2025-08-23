import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

// GET: 모바일 교환권 정보 조회
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: voucherId } = await params;
    console.log('모바일 교환권 조회 API 호출, voucher_id:', voucherId);

    // Supabase 사용
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    // 교환권 데이터 조회
    const { data: voucher, error } = await supabase
      .from('vouchers')
      .select(`
        *,
        voucher_templates(*),
        voucher_design_templates(*)
      `)
      .eq('id', voucherId)
      .single();

    if (error || !voucher) {
      console.error('교환권 조회 오류:', error);
      return NextResponse.json(
        {
          success: false,
          message: '교환권을 찾을 수 없습니다.'
        },
        { status: 404 }
      );
    }

    // 모바일 교환권 데이터 구성
    const mobileVoucherData = {
      id: voucher.id,
      serial_no: voucher.serial_no,
      voucher_name: (voucher as any).voucher_templates?.voucher_name || 'Unknown',
      amount: voucher.amount,
      member_id: voucher.member_id,
      association: voucher.association,
      name: voucher.name,
      dob: voucher.dob,
      phone: voucher.phone,
      issued_at: voucher.issued_at,
      status: voucher.status,
      qr_code: `${voucher.serial_no}|${voucher.member_id}`,
      mobile_image: (voucher as any).mobile_image || null,
      template_html: (voucher as any).voucher_templates?.template_html || null,
      site_id: voucher.site_id || 'default'
    };

    return NextResponse.json({
      success: true,
      data: mobileVoucherData
    });

  } catch (error) {
    console.error('모바일 교환권 조회 오류:', error);
    
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