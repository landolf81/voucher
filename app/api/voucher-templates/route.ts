import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// GET: 교환권 템플릿 목록 조회
export async function GET(request: NextRequest) {
  try {
    console.log('교환권 템플릿 목록 조회 API 호출');
    
    // Supabase 클라이언트 생성
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // voucher_templates 테이블에서 데이터 조회
    const { data, error } = await supabase
      .from('voucher_templates')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('교환권 템플릿 조회 오류:', error);
      return NextResponse.json(
        {
          success: false,
          message: '교환권 템플릿 조회 중 오류가 발생했습니다.'
        },
        { status: 500 }
      );
    }

    console.log('교환권 템플릿 조회 성공:', data?.length, '개');
    
    return NextResponse.json({
      success: true,
      data: data || []
    });
  } catch (error) {
    console.error('교환권 템플릿 목록 조회 오류:', error);
    return NextResponse.json(
      {
        success: false,
        message: '서버 오류가 발생했습니다.'
      },
      { status: 500 }
    );
  }
}

// POST: 교환권 템플릿 등록
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('교환권 템플릿 등록 API 호출:', body);
    
    // Supabase 클라이언트 생성
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 필수 필드 검증
    if (!body.voucher_name || !body.voucher_type || !body.expires_at) {
      return NextResponse.json(
        {
          success: false,
          message: '교환권명, 교환권 구분, 유효기간은 필수 입력 항목입니다.'
        },
        { status: 400 }
      );
    }

    const templateData = {
      voucher_name: body.voucher_name,
      voucher_type: body.voucher_type,
      expires_at: body.expires_at,
      selected_sites: body.selected_sites || [],
      notes: body.notes || '',
      status: body.status || 'active'
    };

    // voucher_templates 테이블에 데이터 삽입
    const { data, error } = await supabase
      .from('voucher_templates')
      .insert([templateData])
      .select()
      .single();

    if (error) {
      console.error('교환권 템플릿 등록 오류:', error);
      return NextResponse.json(
        {
          success: false,
          message: '교환권 템플릿 등록 중 오류가 발생했습니다.'
        },
        { status: 500 }
      );
    }

    console.log('교환권 템플릿 등록 성공:', data.id);
    
    return NextResponse.json({
      success: true,
      message: '교환권 템플릿이 등록되었습니다.',
      data: data
    });
    
  } catch (error) {
    console.error('교환권 템플릿 등록 오류:', error);
    return NextResponse.json(
      {
        success: false,
        message: '서버 오류가 발생했습니다.'
      },
      { status: 500 }
    );
  }
}

// PUT: 교환권 템플릿 수정
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { searchParams } = new URL(request.url);
    const templateId = searchParams.get('id');
    
    console.log('교환권 템플릿 수정 API 호출:', templateId, body);
    
    if (!templateId) {
      return NextResponse.json(
        {
          success: false,
          message: '템플릿 ID가 필요합니다.'
        },
        { status: 400 }
      );
    }

    // Supabase 클라이언트 생성
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 필수 필드 검증
    if (!body.voucher_name || !body.voucher_type || !body.expires_at) {
      return NextResponse.json(
        {
          success: false,
          message: '교환권명, 교환권 구분, 유효기간은 필수 입력 항목입니다.'
        },
        { status: 400 }
      );
    }

    const updateData = {
      voucher_name: body.voucher_name,
      voucher_type: body.voucher_type,
      expires_at: body.expires_at,
      selected_sites: body.selected_sites || [],
      notes: body.notes || '',
      status: body.status || 'active',
      updated_at: new Date().toISOString(),
      updated_by: null // 현재는 null로 설정, 추후 인증 시스템과 연동 시 user ID 설정
    };

    // voucher_templates 테이블 데이터 수정
    const { data, error } = await supabase
      .from('voucher_templates')
      .update(updateData)
      .eq('id', templateId)
      .select()
      .single();

    if (error) {
      console.error('교환권 템플릿 수정 오류:', error);
      return NextResponse.json(
        {
          success: false,
          message: '교환권 템플릿 수정 중 오류가 발생했습니다.',
          error: error.message
        },
        { status: 500 }
      );
    }

    console.log('교환권 템플릿 수정 성공:', data.id);
    
    return NextResponse.json({
      success: true,
      message: '교환권 템플릿이 수정되었습니다.',
      data: data
    });
    
  } catch (error) {
    console.error('교환권 템플릿 수정 오류:', error);
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
      'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}