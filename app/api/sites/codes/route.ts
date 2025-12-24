import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { z } from 'zod';

// 사업장 코드 업데이트 스키마
const updateSiteCodeSchema = z.object({
  site_id: z.string().uuid('올바른 사이트 ID를 입력해주세요.'),
  short_code: z.string()
    .min(1, '코드를 입력해주세요.')
    .max(10, '코드는 10자 이하여야 합니다.')
    .regex(/^[A-Z0-9]+$/, '코드는 대문자와 숫자만 사용할 수 있습니다.')
});

// GET: 사업장 코드 목록 조회
export async function GET(request: NextRequest) {
  try {
    console.log('사업장 코드 목록 조회 API 호출');

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 모든 사업장의 코드 정보 조회
    const { data: sites, error } = await supabase
      .from('sites')
      .select('id, site_name, short_code, status')
      .order('site_name');

    if (error) {
      console.error('Supabase 사업장 코드 조회 오류:', error);
      return NextResponse.json(
        {
          success: false,
          message: '사업장 코드를 조회할 수 없습니다.'
        },
        { status: 500 }
      );
    }

    // 코드 통계 생성
    const stats = {
      total_sites: sites?.length || 0,
      coded_sites: sites?.filter(s => s.short_code)?.length || 0,
      active_sites: sites?.filter(s => s.status === 'active')?.length || 0
    };

    return NextResponse.json({
      success: true,
      data: sites || [],
      stats: stats
    });

  } catch (error) {
    console.error('사업장 코드 조회 API 오류:', error);
    return NextResponse.json(
      {
        success: false,
        message: '서버 오류가 발생했습니다.'
      },
      { status: 500 }
    );
  }
}

// PUT: 사업장 코드 업데이트 (관리자 전용)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('사업장 코드 업데이트 API 호출:', body);

    // 입력 검증
    const validation = updateSiteCodeSchema.safeParse(body);
    if (!validation.success) {
      console.error('입력 검증 실패:', validation.error.errors);
      return NextResponse.json(
        {
          success: false,
          message: '입력 정보가 올바르지 않습니다.',
          errors: validation.error.errors
        },
        { status: 400 }
      );
    }

    const { site_id, short_code } = validation.data;

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. 대상 사업장 존재 여부 확인
    const { data: targetSite, error: findError } = await supabase
      .from('sites')
      .select('id, site_name, short_code')
      .eq('id', site_id)
      .single();

    if (findError || !targetSite) {
      return NextResponse.json(
        {
          success: false,
          message: '해당 사업장을 찾을 수 없습니다.'
        },
        { status: 404 }
      );
    }

    // 2. 코드 중복 확인 (다른 사업장에서 이미 사용 중인지)
    const { data: duplicateSite, error: duplicateError } = await supabase
      .from('sites')
      .select('id, site_name')
      .eq('short_code', short_code.toUpperCase())
      .neq('id', site_id)
      .maybeSingle();

    if (duplicateError) {
      console.error('코드 중복 확인 오류:', duplicateError);
      return NextResponse.json(
        {
          success: false,
          message: '코드 중복 확인 중 오류가 발생했습니다.'
        },
        { status: 500 }
      );
    }

    if (duplicateSite) {
      return NextResponse.json(
        {
          success: false,
          message: `코드 '${short_code.toUpperCase()}'는 이미 '${duplicateSite.site_name}'에서 사용 중입니다.`
        },
        { status: 409 }
      );
    }

    // 3. 코드 업데이트
    const { data: updatedSite, error: updateError } = await supabase
      .from('sites')
      .update({ 
        short_code: short_code.toUpperCase()
      })
      .eq('id', site_id)
      .select()
      .single();

    if (updateError) {
      console.error('사업장 코드 업데이트 오류:', updateError);
      return NextResponse.json(
        {
          success: false,
          message: '사업장 코드 업데이트에 실패했습니다.'
        },
        { status: 500 }
      );
    }

    // 4. 감사 로그 추가
    const { error: auditError } = await supabase
      .from('audit_logs')
      .insert({
        action: 'site_code_updated',
        actor_user_id: null, // TODO: 실제 사용자 인증 구현 시 수정
        site_id: site_id,
        details: {
          site_name: targetSite.site_name,
          old_code: targetSite.short_code,
          new_code: short_code.toUpperCase(),
          updated_at: new Date().toISOString()
        }
      });

    if (auditError) {
      console.error('감사 로그 추가 오류:', auditError);
      // 감사 로그 실패는 전체 작업을 중단시키지 않음
    }

    return NextResponse.json({
      success: true,
      message: `'${targetSite.site_name}'의 코드가 '${short_code.toUpperCase()}'로 업데이트되었습니다.`,
      data: updatedSite
    });

  } catch (error) {
    console.error('사업장 코드 업데이트 API 오류:', error);
    return NextResponse.json(
      {
        success: false,
        message: '서버 오류가 발생했습니다.'
      },
      { status: 500 }
    );
  }
}

// DELETE: 사업장 코드 제거 (관리자 전용)
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const siteId = searchParams.get('site_id');

    if (!siteId) {
      return NextResponse.json(
        {
          success: false,
          message: '사이트 ID가 필요합니다.'
        },
        { status: 400 }
      );
    }

    console.log('사업장 코드 제거 API 호출:', { siteId });

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. 대상 사업장 존재 여부 확인
    const { data: targetSite, error: findError } = await supabase
      .from('sites')
      .select('id, site_name, short_code')
      .eq('id', siteId)
      .single();

    if (findError || !targetSite) {
      return NextResponse.json(
        {
          success: false,
          message: '해당 사업장을 찾을 수 없습니다.'
        },
        { status: 404 }
      );
    }

    // 2. 코드 제거 (NULL로 설정)
    const { error: updateError } = await supabase
      .from('sites')
      .update({ short_code: null })
      .eq('id', siteId);

    if (updateError) {
      console.error('사업장 코드 제거 오류:', updateError);
      return NextResponse.json(
        {
          success: false,
          message: '사업장 코드 제거에 실패했습니다.'
        },
        { status: 500 }
      );
    }

    // 3. 감사 로그 추가
    const { error: auditError } = await supabase
      .from('audit_logs')
      .insert({
        action: 'site_code_removed',
        actor_user_id: null, // TODO: 실제 사용자 인증 구현 시 수정
        site_id: siteId,
        details: {
          site_name: targetSite.site_name,
          removed_code: targetSite.short_code,
          removed_at: new Date().toISOString()
        }
      });

    if (auditError) {
      console.error('감사 로그 추가 오류:', auditError);
      // 감사 로그 실패는 전체 작업을 중단시키지 않음
    }

    return NextResponse.json({
      success: true,
      message: `'${targetSite.site_name}'의 코드가 제거되었습니다.`
    });

  } catch (error) {
    console.error('사업장 코드 제거 API 오류:', error);
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