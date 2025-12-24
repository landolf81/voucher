import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

// GET: 사용처 목록 조회
export async function GET(request: NextRequest) {
  try {
    console.log('사용처 목록 조회 API 호출');

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 모든 사이트 목록 조회 (사용처로 활용 가능한 모든 사이트)
    const { data: sites, error } = await supabase
      .from('sites')
      .select('id, site_name')
      .order('site_name');

    if (error) {
      console.error('사용처 목록 조회 오류:', error);
      return NextResponse.json(
        {
          success: false,
          message: '사용처 목록 조회에 실패했습니다.'
        },
        { status: 500 }
      );
    }

    // 사이트 이름 목록 생성
    const siteNames = sites?.map(s => s.site_name).filter(Boolean) || [];

    console.log(`사용처 목록 조회 완료: ${siteNames.length}개`);

    return NextResponse.json({
      success: true,
      data: siteNames,
      message: `${siteNames.length}개의 사용처를 조회했습니다.`
    });

  } catch (error) {
    console.error('사용처 목록 조회 API 오류:', error);
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