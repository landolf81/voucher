import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { generateSerialNumber, getNextSequenceNumber, validateSerialNumber } from '@/lib/serial-number';

// POST: 기존 발행된 교환권들에 일련번호 자동 부여
export async function POST(request: NextRequest) {
  try {
    console.log('교환권 일련번호 자동 부여 API 호출');

    // Supabase 사용
    console.log('Supabase 사용 - 일련번호 자동 부여');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // 일련번호가 없거나 유효하지 않은 교환권들 조회
    const { data: vouchers, error: fetchError } = await supabase
      .from('vouchers')
      .select('*')
      .or('serial_no.is.null,serial_no.eq.');

    if (fetchError) {
      console.error('교환권 조회 오류:', fetchError);
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
        message: '일련번호가 필요한 교환권이 없습니다.',
        data: { updated: 0, total: 0 }
      });
    }

    // 기존 유효한 일련번호들 조회
    const { data: existingVouchers, error: existingError } = await supabase
      .from('vouchers')
      .select('serial_no')
      .not('serial_no', 'is', null);

    if (existingError) {
      console.error('기존 일련번호 조회 오류:', existingError);
      return NextResponse.json(
        {
          success: false,
          message: '기존 일련번호 조회에 실패했습니다.'
        },
        { status: 500 }
      );
    }

    const existingSerials = (existingVouchers || [])
      .map((v: { serial_no: string }) => v.serial_no)
      .filter((s: string) => s && s.length === 14 && validateSerialNumber(s));

    let sequenceCounter = getNextSequenceNumber(existingSerials);
    let updatedCount = 0;

    // 발행일자 순으로 정렬하여 일련번호 부여
    const sortedVouchers = vouchers.sort((a: any, b: any) => 
      new Date(a.issued_at).getTime() - new Date(b.issued_at).getTime()
    );

    for (const voucher of sortedVouchers) {
      const issueDate = new Date(voucher.issued_at);
      let serialNumber = generateSerialNumber(sequenceCounter, issueDate);
      
      // 중복 체크
      while (existingSerials.includes(serialNumber)) {
        sequenceCounter++;
        serialNumber = generateSerialNumber(sequenceCounter, issueDate);
      }

      // 교환권 업데이트
      const { error: updateError } = await supabase
        .from('vouchers')
        .update({ serial_no: serialNumber })
        .eq('id', voucher.id);

      if (updateError) {
        console.error(`교환권 ${voucher.id} 업데이트 오류:`, updateError);
        continue;
      }

      existingSerials.push(serialNumber);
      updatedCount++;
      sequenceCounter++;
    }

    console.log(`Supabase - 일련번호 자동 부여 완료: ${updatedCount}개 교환권 업데이트`);

    return NextResponse.json({
      success: true,
      message: `일련번호 자동 부여가 완료되었습니다. (${updatedCount}개 교환권 업데이트)`,
      data: { updated: updatedCount, total: vouchers.length }
    });
  } catch (error) {
    console.error('일련번호 자동 부여 오류:', error);
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