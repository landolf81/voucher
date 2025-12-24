import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { encryptVoucherData } from '@/lib/encryption';
import { z } from 'zod';

// 발행대상자 등록 스키마 (개별 금액 포함)
const voucherRecipientSchema = z.object({
  template_id: z.string().min(1, '교환권 템플릿 ID를 선택해주세요.'),
  member_id: z.string().min(1, '조합원 ID를 입력해주세요.').max(50),
  farming_association: z.string().min(1, '영농회를 입력해주세요.').max(100),
  name: z.string().min(1, '이름을 입력해주세요.').max(50),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '생년월일 형식이 올바르지 않습니다.'),
  phone: z.string().min(10, '휴대폰 번호를 입력해주세요.').max(15),
  amount: z.number().positive('금액은 0보다 커야 합니다.').int('금액은 정수여야 합니다.'),
  status: z.enum(['registered', 'issued', 'printed', 'delivered']).default('registered'),
  notes: z.string().optional().default('')
});

// GET: 발행대상자 목록 조회
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const templateId = url.searchParams.get('template_id');

    console.log('발행대상자 목록 조회 API 호출, template_id:', templateId);

    if (!templateId) {
      return NextResponse.json(
        {
          success: false,
          message: '교환권 템플릿 ID가 필요합니다.'
        },
        { status: 400 }
      );
    }

    // Supabase 사용
    console.log('Supabase 사용 - 발행대상자 목록 조회');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data, error } = await supabase
      .from('voucher_recipients')
      .select('*')
      .eq('template_id', templateId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase 발행대상자 조회 오류:', error);
      return NextResponse.json(
        {
          success: false,
          message: '발행대상자 목록을 불러오는데 실패했습니다.'
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data || []
    });
  } catch (error) {
    console.error('발행대상자 목록 조회 오류:', error);
    return NextResponse.json(
      {
        success: false,
        message: '서버 오류가 발생했습니다.'
      },
      { status: 500 }
    );
  }
}

// POST: 발행대상자 등록 (개별 등록)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('발행대상자 등록 API 호출:', body);

    // 입력 검증
    const validation = voucherRecipientSchema.safeParse(body);

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

    const { template_id, member_id, farming_association, name, dob, phone, amount, status, notes } = validation.data;

    // 개인정보 암호화
    const { encrypted_name, encrypted_dob, encrypted_phone } = encryptVoucherData({ name, dob, phone });

    const recipientData = {
      template_id,
      member_id,
      farming_association,
      encrypted_name,
      encrypted_dob,
      encrypted_phone,
      amount,
      status,
      notes
    };

    // Supabase 사용
    console.log('Supabase 사용 - 발행대상자 등록');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data: newRecipient, error } = await supabase
      .from('voucher_recipients')
      .insert([{
        ...recipientData,
        created_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) {
      console.error('Supabase 발행대상자 등록 오류:', error);
      return NextResponse.json(
        {
          success: false,
          message: '발행대상자 등록에 실패했습니다.'
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '발행대상자가 성공적으로 등록되었습니다.',
      data: newRecipient
    });
  } catch (error) {
    console.error('발행대상자 등록 오류:', error);
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
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}