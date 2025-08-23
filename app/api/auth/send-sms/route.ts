import { NextRequest, NextResponse } from 'next/server';
import { getSMSService } from '@/lib/sms';
import { createClient } from '@/lib/supabase';
import { z } from 'zod';

// 요청 본문 검증 스키마
const sendSMSSchema = z.object({
  phone: z.string().min(10).max(15),
  message: z.string().min(1).max(200),
});

// 전화번호 마스킹 함수
function maskPhone(phone: string): string {
  if (phone.length < 10) return '***';
  // 010-****-5678 형태로 마스킹
  return phone.slice(0, 3) + '-****-' + phone.slice(-4);
}

export async function POST(request: NextRequest) {
  try {
    // 요청 본문 파싱
    const body = await request.json();
    
    // 입력 검증
    const validation = sendSMSSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { 
          success: false, 
          message: '유효하지 않은 요청입니다.',
          errors: validation.error.errors 
        },
        { status: 400 }
      );
    }

    const { phone, message } = validation.data;

    // SMS 서비스 인스턴스 가져오기
    const smsService = getSMSService();

    // SMS 발송
    const result = await smsService.sendMessage(phone, message);

    if (result.success) {
      return NextResponse.json(
        {
          success: true,
          message: result.message || 'SMS가 발송되었습니다.',
          maskedPhone: maskPhone(phone),
        },
        { status: 200 }
      );
    } else {
      return NextResponse.json(
        {
          success: false,
          message: result.message || 'SMS 발송에 실패했습니다.',
        },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('SMS 발송 API 오류:', error);
    
    return NextResponse.json(
      {
        success: false,
        message: '서버 오류가 발생했습니다.',
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
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}