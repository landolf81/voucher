import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// PUT: 교환권 템플릿 수정
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const templateId = params.id;
    
    console.log('교환권 템플릿 수정 API 호출:', templateId, body);
    
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
      updated_at: new Date().toISOString()
    };

    // voucher_templates 테이블 업데이트
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
          message: '교환권 템플릿 수정 중 오류가 발생했습니다.'
        },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        {
          success: false,
          message: '해당 교환권 템플릿을 찾을 수 없습니다.'
        },
        { status: 404 }
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

// DELETE: 교환권 템플릿 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const templateId = params.id;
    
    console.log('교환권 템플릿 삭제 API 호출:', templateId);
    
    // Supabase 클라이언트 생성
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 이미 발급된 교환권이 있는지 확인
    const { data: vouchers, error: checkError } = await supabase
      .from('vouchers')
      .select('id')
      .eq('template_id', templateId)
      .limit(1);

    if (checkError) {
      console.error('교환권 확인 오류:', checkError);
      return NextResponse.json(
        {
          success: false,
          message: '템플릿 사용 여부 확인 중 오류가 발생했습니다.'
        },
        { status: 500 }
      );
    }

    if (vouchers && vouchers.length > 0) {
      return NextResponse.json(
        {
          success: false,
          message: '이미 발급된 교환권이 있는 템플릿은 삭제할 수 없습니다.'
        },
        { status: 400 }
      );
    }

    // voucher_templates 테이블에서 삭제
    const { error } = await supabase
      .from('voucher_templates')
      .delete()
      .eq('id', templateId);

    if (error) {
      console.error('교환권 템플릿 삭제 오류:', error);
      return NextResponse.json(
        {
          success: false,
          message: '교환권 템플릿 삭제 중 오류가 발생했습니다.'
        },
        { status: 500 }
      );
    }

    console.log('교환권 템플릿 삭제 성공:', templateId);
    
    return NextResponse.json({
      success: true,
      message: '교환권 템플릿이 삭제되었습니다.'
    });
    
  } catch (error) {
    console.error('교환권 템플릿 삭제 오류:', error);
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
      'Access-Control-Allow-Methods': 'PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}