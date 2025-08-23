import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { encryptVoucherData } from '@/lib/encryption';
import { z } from 'zod';
import { nanoid } from 'nanoid';

// 개별 발급 스키마
const manualIssueSchema = z.object({
  voucher_name: z.string().min(1).max(100),
  amount: z.number().positive().int(),
  member_id: z.string().min(1).max(50),
  farming_association: z.string().min(1).max(100),
  name: z.string().min(1).max(50),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '생년월일 형식이 올바르지 않습니다.'),
  phone: z.string().min(10).max(15).regex(/^[\d-+().\s]+$/, '휴대폰 번호 형식이 올바르지 않습니다.'),
  voucher_type: z.enum(['fixed', 'amount']).default('fixed'),
  expires_at: z.string().optional(),
  usage_location: z.string().optional(),
  notes: z.string().optional().default('')
});

// 일련번호 생성 함수
function generateSerialNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const randomId = nanoid(6).toUpperCase();
  return `VCH${timestamp}${randomId}`;
}

// 고유 일련번호 생성 (중복 확인 포함)
async function generateUniqueSerialNumber(checkExisting: (serial: string) => Promise<boolean>): Promise<string> {
  const maxAttempts = 50; // 최대 50회 시도
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const serial = generateSerialNumber();
    
    if (!(await checkExisting(serial))) {
      return serial;
    }
  }
  
  throw new Error('고유한 일련번호 생성에 실패했습니다. 다시 시도해주세요.');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('개별 발급 API 호출:', body);

    // 입력 검증
    const validation = manualIssueSchema.safeParse({
      ...body,
      amount: parseInt(body.amount, 10)
    });
    
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

    const { voucher_name, amount, member_id, farming_association, name, dob, phone, voucher_type, expires_at, usage_location, notes } = validation.data;

    // Supabase 사용
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    
    const checkExisting = async (serial: string) => {
      const { data } = await supabase
        .from('vouchers')
        .select('id')
        .eq('serial_no', serial)
        .single();
      return data !== null;
    };

    // 고유 일련번호 생성
    const serialNumber = await generateUniqueSerialNumber(checkExisting);
    console.log('생성된 일련번호:', serialNumber);

    // 개인정보 암호화
    const { encrypted_name, encrypted_dob, encrypted_phone } = encryptVoucherData({ name, dob, phone });

    const voucherData = {
      serial_no: serialNumber,
      voucher_name,
      amount,
      member_id,
      farming_association,
      encrypted_name,
      encrypted_dob,
      encrypted_phone,
      voucher_type,
      status: 'active',
      issued_at: new Date().toISOString(),
      expires_at: expires_at || null,
      usage_location: usage_location || null,
      notes
    };

    // 데이터베이스에 저장
    console.log('Supabase 사용 - 교환권 개별 발급');

    const { data: newVoucher, error } = await supabase
      .from('vouchers')
      .insert([voucherData])
      .select()
      .single();

    if (error) {
      console.error('Supabase 교환권 발급 오류:', error);
      return NextResponse.json(
        {
          success: false,
          message: '교환권 발급에 실패했습니다.'
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '교환권이 성공적으로 발급되었습니다.',
      voucher: {
        id: newVoucher.id,
        serial_no: newVoucher.serial_no,
        voucher_name: newVoucher.voucher_name,
        amount: newVoucher.amount,
        member_id: newVoucher.member_id,
        farming_association: newVoucher.farming_association,
        voucher_type: newVoucher.voucher_type,
        status: newVoucher.status,
        issued_at: newVoucher.issued_at
      }
    });
  } catch (error) {
    console.error('개별 발급 API 오류:', error);
    
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : '서버 오류가 발생했습니다.'
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