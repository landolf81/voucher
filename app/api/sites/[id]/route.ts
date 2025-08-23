import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { z } from 'zod';

// 사업장 수정 스키마
const updateSiteSchema = z.object({
  site_name: z.string().min(2, '사업장명은 2자 이상이어야 합니다.').max(50, '사업장명은 50자 이하여야 합니다.').optional(),
  address: z.string().min(5, '주소를 입력해주세요.').optional(),
  phone: z.string().regex(/^0\d{1,2}-?\d{3,4}-?\d{4}$/, '올바른 전화번호를 입력해주세요.').optional(),
  fax: z.string().regex(/^0\d{1,2}-?\d{3,4}-?\d{4}$/, '올바른 팩스번호를 입력해주세요.').optional(),
  business_number: z.string().regex(/^\d{3}-\d{2}-\d{5}$/, '사업자번호 형식이 올바르지 않습니다.').optional(),
  status: z.enum(['active', 'inactive']).optional()
});

// GET: 특정 사업장 조회
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: siteId } = await params;
    console.log('사업장 조회 API 호출, site_id:', siteId);

    // Supabase 사용
    console.log('Supabase 사용 - 사업장 조회');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data: site, error } = await supabase
      .from('sites')
      .select('*')
      .eq('id', siteId)
      .single();

    if (error || !site) {
      console.error('Supabase 사업장 조회 오류:', error);
      return NextResponse.json(
        {
          success: false,
          message: '사업장을 찾을 수 없습니다.'
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: site
    });

  } catch (error) {
    console.error('사업장 조회 오류:', error);
    
    return NextResponse.json(
      {
        success: false,
        message: '서버 오류가 발생했습니다.'
      },
      { status: 500 }
    );
  }
}

// PUT: 사업장 정보 수정
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: siteId } = await params;
    const body = await request.json();

    console.log('사업장 수정 API 호출, site_id:', siteId);

    // 입력 검증
    const validation = updateSiteSchema.safeParse(body);
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

    const updates = validation.data;

    // Supabase 사용
    console.log('Supabase 사용 - 사업장 수정');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data: updatedSite, error } = await supabase
      .from('sites')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', siteId)
      .select()
      .single();

    if (error) {
      console.error('Supabase 사업장 수정 오류:', error);
      return NextResponse.json(
        {
          success: false,
          message: error.code === 'PGRST116' ? '사업장을 찾을 수 없습니다.' : '사업장 수정에 실패했습니다.'
        },
        { status: error.code === 'PGRST116' ? 404 : 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '사업장 정보가 성공적으로 수정되었습니다.',
      data: updatedSite
    });

  } catch (error) {
    console.error('사업장 수정 오류:', error);
    
    return NextResponse.json(
      {
        success: false,
        message: '서버 오류가 발생했습니다.'
      },
      { status: 500 }
    );
  }
}

// DELETE: 사업장 삭제
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: siteId } = await params;
    console.log('사업장 삭제 API 호출, site_id:', siteId);

    // Supabase 사용
    console.log('Supabase 사용 - 사업장 삭제');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // 사업장에 속한 사용자가 있는지 확인
    const { data: users } = await supabase
      .from('users')
      .select('id')
      .eq('site_id', siteId);
    
    if (users && users.length > 0) {
      return NextResponse.json(
        {
          success: false,
          message: '해당 사업장에 소속된 사용자가 있어 삭제할 수 없습니다.'
        },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('sites')
      .delete()
      .eq('id', siteId);

    if (error) {
      console.error('Supabase 사업장 삭제 오류:', error);
      return NextResponse.json(
        {
          success: false,
          message: error.code === 'PGRST116' ? '사업장을 찾을 수 없습니다.' : '사업장 삭제에 실패했습니다.'
        },
        { status: error.code === 'PGRST116' ? 404 : 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '사업장이 성공적으로 삭제되었습니다.'
    });

  } catch (error) {
    console.error('사업장 삭제 오류:', error);
    
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
      'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}