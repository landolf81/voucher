import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { z } from 'zod';

// 사업장 등록 스키마
const createSiteSchema = z.object({
  site_name: z.string().min(1, '사업장명을 입력해주세요.').max(100, '사업장명은 100자 이하여야 합니다.'),
  address: z.string().optional(),
  phone: z.string().optional(),
  fax: z.string().optional(),
  business_number: z.string().optional(),
  status: z.enum(['active', 'inactive']).default('active')
});

// GET: 사업장 목록 조회
export async function GET(request: NextRequest) {
  try {
    console.log('사업장 목록 조회 API 호출');

    // 환경변수 확인
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('환경변수 누락:', { 
        url: supabaseUrl ? 'set' : 'missing', 
        key: supabaseKey ? 'set' : 'missing' 
      });
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    // Supabase 사용
    console.log('Supabase 사용 - 사업장 목록 조회');
    const supabase = supabaseServer();

    const { data: sites, error } = await supabase
      .from('sites')
      .select('*')
      .order('site_name');

    if (error) {
      console.error('Supabase 사업장 조회 오류:', error);
      return NextResponse.json(
        {
          success: false,
          message: '사업장 목록 조회에 실패했습니다.'
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: sites || []
    });

  } catch (error) {
    console.error('사업장 목록 조회 오류:', error);
    
    return NextResponse.json(
      {
        success: false,
        message: '서버 오류가 발생했습니다.'
      },
      { status: 500 }
    );
  }
}

// POST: 새 사업장 등록
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('사업장 등록 API 호출:', body.site_name);

    // 입력 검증
    const validation = createSiteSchema.safeParse(body);
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

    const siteData = validation.data;

    // Supabase 사용
    console.log('Supabase 사용 - 사업장 등록');
    const supabase = supabaseServer();

    // 현재 sites 테이블은 site_name만 지원
    const { data: newSite, error } = await supabase
      .from('sites')
      .insert([{ site_name: siteData.site_name }])
      .select()
      .single();

    if (error) {
      console.error('Supabase 사업장 등록 오류:', error);
      
      // 중복 오류 처리
      if (error.code === '23505') {
        return NextResponse.json(
          {
            success: false,
            message: '이미 존재하는 사업장명 또는 사업자번호입니다.'
          },
          { status: 400 }
        );
      }

      return NextResponse.json(
        {
          success: false,
          message: '사업장 등록에 실패했습니다.'
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '사업장이 성공적으로 등록되었습니다.',
      data: newSite
    });

  } catch (error) {
    console.error('사업장 등록 오류:', error);
    
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