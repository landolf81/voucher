import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      action,
      actionType,
      voucherId,
      quantity = 1,
      totalAmount,
      details = {},
      targetPhone,
      targetName
    } = body;

    // 필수 필드 검증
    if (!action || !actionType) {
      return NextResponse.json({
        ok: false,
        error: 'MISSING_REQUIRED_FIELDS',
        message: 'action과 actionType은 필수입니다.'
      }, { status: 400 });
    }

    const supabase = supabaseServer();

    // 현재 사용자 정보 가져오기
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.user) {
      return NextResponse.json({
        ok: false,
        error: 'UNAUTHORIZED',
        message: '로그인이 필요합니다.'
      }, { status: 401 });
    }

    // 사용자 프로필 조회
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('id, name, site_id')
      .eq('user_id', session.user.id)
      .single();

    if (!userProfile) {
      return NextResponse.json({
        ok: false,
        error: 'USER_PROFILE_NOT_FOUND',
        message: '사용자 프로필을 찾을 수 없습니다.'
      }, { status: 404 });
    }

    // IP 주소 추출
    const ipAddress = req.headers.get('x-forwarded-for') || 
                     req.headers.get('x-real-ip') || 
                     'unknown';
    
    // User Agent 추출
    const userAgent = req.headers.get('user-agent') || 'unknown';

    // 활동 로그 기록
    const { data: logData, error: logError } = await supabase
      .rpc('log_activity', {
        p_action: action,
        p_action_type: actionType,
        p_actor_user_id: userProfile.id,
        p_site_id: userProfile.site_id,
        p_voucher_id: voucherId || null,
        p_quantity: quantity,
        p_total_amount: totalAmount || null,
        p_details: {
          ...details,
          ip_address: ipAddress,
          user_agent: userAgent,
          timestamp: new Date().toISOString()
        },
        p_target_phone: targetPhone || null,
        p_target_name: targetName || null
      });

    if (logError) {
      console.error('활동 로그 기록 오류:', logError);
      return NextResponse.json({
        ok: false,
        error: 'LOG_FAILED',
        message: '활동 로그 기록에 실패했습니다.'
      }, { status: 500 });
    }

    // 특정 액션에 대한 추가 처리
    switch (actionType) {
      case 'bulk_issue':
        // 대량 발행 시 통계 업데이트
        await updateIssueStatistics(supabase, quantity, totalAmount);
        break;
        
      case 'use':
        // 사용 시 통계 업데이트
        await updateUsageStatistics(supabase, userProfile.site_id, totalAmount);
        break;
    }

    return NextResponse.json({
      ok: true,
      message: '활동이 성공적으로 기록되었습니다.',
      logId: logData,
      action: action,
      actionType: actionType,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('활동 로그 API 오류:', error);
    return NextResponse.json({
      ok: false,
      error: 'INTERNAL_ERROR',
      message: '서버 오류가 발생했습니다.'
    }, { status: 500 });
  }
}

// 발행 통계 업데이트 함수
async function updateIssueStatistics(supabase: any, quantity: number, amount: number | null) {
  try {
    // 오늘 날짜 기준 통계 업데이트
    const today = new Date().toISOString().split('T')[0];
    
    const { error } = await supabase
      .from('daily_statistics')
      .upsert({
        date: today,
        issued_count: quantity,
        issued_amount: amount || 0
      }, {
        onConflict: 'date',
        ignoreDuplicates: false
      });

    if (error) {
      console.error('발행 통계 업데이트 오류:', error);
    }
  } catch (error) {
    console.error('통계 업데이트 실패:', error);
  }
}

// 사용 통계 업데이트 함수
async function updateUsageStatistics(supabase: any, siteId: string | null, amount: number | null) {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    const { error } = await supabase
      .from('daily_statistics')
      .upsert({
        date: today,
        site_id: siteId,
        used_count: 1,
        used_amount: amount || 0
      }, {
        onConflict: 'date,site_id',
        ignoreDuplicates: false
      });

    if (error) {
      console.error('사용 통계 업데이트 오류:', error);
    }
  } catch (error) {
    console.error('통계 업데이트 실패:', error);
  }
}

// GET: 활동 로그 조회
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const actionType = searchParams.get('actionType');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const supabase = supabaseServer();

    // 기본 쿼리
    let query = supabase
      .from('activity_summary')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // 필터 적용
    if (actionType) {
      query = query.eq('action_type', actionType);
    }

    if (startDate) {
      query = query.gte('created_at', startDate);
    }

    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('활동 로그 조회 오류:', error);
      return NextResponse.json({
        ok: false,
        error: 'FETCH_FAILED',
        message: '활동 로그 조회에 실패했습니다.'
      }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      data: data || [],
      total: count || 0,
      limit,
      offset
    });

  } catch (error) {
    console.error('활동 로그 조회 API 오류:', error);
    return NextResponse.json({
      ok: false,
      error: 'INTERNAL_ERROR',
      message: '서버 오류가 발생했습니다.'
    }, { status: 500 });
  }
}