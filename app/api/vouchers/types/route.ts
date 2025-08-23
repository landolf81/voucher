import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

// GET: 등록된 교환권 종류 목록 조회
export async function GET(request: NextRequest) {
  try {
    console.log('교환권 종류 목록 조회 API 호출');

    // Supabase 사용
    console.log('Supabase 사용 - 교환권 종류 조회');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    try {
      // voucher_templates 테이블에서 교환권 종류 조회
      const { data: templates, error } = await supabase
        .from('voucher_templates')
        .select('id, voucher_name, template_name')
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Supabase 교환권 종류 조회 오류:', error);
        return NextResponse.json(
          {
            success: false,
            message: '교환권 종류 조회에 실패했습니다.'
          },
          { status: 500 }
        );
      }

      // 템플릿에서 교환권 종류 추출 (중복 제거)
      const voucherTypes = Array.from(new Set(
        (templates || []).map(template => {
          const typeName = template.voucher_name || template.template_name || '일반교환권';
          return {
            id: typeName.toLowerCase().replace(/\s+/g, '_'),
            name: typeName,
            template_id: template.id
          };
        })
      ));

      // 기본 "전체" 옵션 추가
      const allTypes = [
        { id: 'all', name: '전체', template_id: null },
        ...voucherTypes
      ];

      return NextResponse.json({
        success: true,
        data: allTypes
      });
    } catch (error) {
      console.error('교환권 종류 조회 처리 오류:', error);
      return NextResponse.json(
        {
          success: false,
          message: '서버 오류가 발생했습니다.'
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('교환권 종류 조회 API 오류:', error);
    
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
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}