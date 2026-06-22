import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { formatPhoneForDisplay, formatPhoneForDB, validateKoreanPhoneInput } from '@/lib/phone-utils';
import { hasCompleteProfile, getAuthz, type UserMetadata } from '@/lib/types/auth';

// Supabase Admin 클라이언트 싱글톤 (매 요청마다 생성 방지)
let supabaseAdminInstance: ReturnType<typeof createClient> | null = null;

function getSupabaseAdmin() {
  if (!supabaseAdminInstance) {
    supabaseAdminInstance = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return supabaseAdminInstance;
}

/**
 * GET: 사용자 목록 조회
 * - auth.users.user_metadata만 사용 (user_profiles 폴백 제거)
 */
export async function GET() {
  try {
    const supabaseAdmin = getSupabaseAdmin();

    // 병렬로 auth.users와 sites 조회 (API 호출 최소화)
    const [authResult, sitesResult] = await Promise.all([
      supabaseAdmin.auth.admin.listUsers(),
      supabaseAdmin.from('sites').select('id, site_name').order('site_name')
    ]);

    if (authResult.error) {
      console.error('Auth 사용자 조회 오류:', authResult.error);
      return NextResponse.json({
        success: false,
        message: 'Auth 사용자 조회에 실패했습니다.'
      }, { status: 500 });
    }

    if (sitesResult.error) {
      console.error('사업장 조회 오류:', sitesResult.error);
      return NextResponse.json({
        success: false,
        message: '사업장 목록 조회에 실패했습니다.'
      }, { status: 500 });
    }

    const sitesMap = new Map((sitesResult.data || []).map((s: { id: string; site_name: string }) => [s.id, s.site_name]));

    // 사용자 데이터 변환 (모든 사용자 포함, 불완전한 metadata도 표시)
    const users = authResult.data.users
      .map(authUser => {
        const metadata = authUser.user_metadata || {};
        const authz = getAuthz(authUser);
        const site_id = authz?.site_id || '';
        const phone = authUser.phone || '';
        const displayPhone = formatPhoneForDisplay(phone);

        return {
          id: authUser.id,
          display_name: metadata.display_name || '',
          user_id: metadata.display_name || '',
          name: metadata.name || authUser.email?.split('@')[0] || '미설정',
          role: authz?.role || 'viewer',
          site_id,
          site_name: site_id ? (sitesMap.get(site_id) || '') : '',
          is_active: authz?.is_active ?? true,
          email: authUser.email || '',
          phone: phone,
          phone_masked: displayPhone || '***-****-****',
          last_sign_in_at: authUser.last_sign_in_at,
          email_confirmed_at: authUser.email_confirmed_at,
          oauth_provider: metadata.oauth_provider,
          oauth_provider_id: metadata.oauth_provider_id,
          has_complete_profile: hasCompleteProfile(authUser)
        };
      });

    // 캐싱 헤더 추가 (60초간 캐시)
    const response = NextResponse.json({
      success: true,
      data: {
        users: users.sort((a, b) => (b.last_sign_in_at || '').localeCompare(a.last_sign_in_at || '')),
        sites: sitesResult.data || []
      }
    });

    response.headers.set('Cache-Control', 'private, max-age=60, stale-while-revalidate=30');
    return response;

  } catch (error) {
    console.error('사용자 목록 조회 오류:', error);
    return NextResponse.json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('API 수신 데이터:', body);
    
    const { email, name, phone, role, site_id, user_id, is_active = true } = body;
    console.log('파싱된 필드들:', { email, name, phone, role, site_id, user_id, is_active });

    // 필수 필드 확인 (이메일과 비밀번호 제외)
    const missingFields = [];
    if (!name) missingFields.push('name');
    if (!phone) missingFields.push('phone');
    if (!role) missingFields.push('role');
    if (!site_id) missingFields.push('site_id');
    if (!user_id) missingFields.push('user_id');
    
    if (missingFields.length > 0) {
      console.log('누락된 필드들:', missingFields);
      return NextResponse.json({
        success: false,
        message: `다음 필수 필드가 누락되었습니다: ${missingFields.join(', ')}`
      }, { status: 400 });
    }

    // Auth 사용자 생성 (싱글톤 클라이언트 사용)
    const supabaseAdmin = getSupabaseAdmin();
    
    // 전화번호 형식 검증 및 변환
    console.log('전화번호 검증 시작:', phone);
    const cleanedPhone = phone.replace(/[^0-9]/g, '');
    console.log('정리된 전화번호:', cleanedPhone);
    
    if (!validateKoreanPhoneInput(cleanedPhone)) {
      console.log('전화번호 검증 실패:', cleanedPhone);
      return NextResponse.json({
        success: false,
        message: '올바른 전화번호 형식이 아닙니다. (예: 01012345678)'
      }, { status: 400 });
    }
    const formattedPhone = formatPhoneForDB(cleanedPhone);
    console.log('DB용 전화번호:', formattedPhone);
    
    // 임시 비밀번호로 사용자 생성 (나중에 비밀번호 재설정 필요)
    const tempPassword = Math.random().toString(36).slice(-12) + 'A1!'; // 임시 복잡한 비밀번호
    console.log('Auth 사용자 생성 시도:', { email, phone: formattedPhone });
    
    // 프로필(사용자 수정 가능)은 user_metadata, 권한(수정 불가)은 app_metadata 에 저장
    const userMetadata: UserMetadata = {
      display_name: user_id,  // 사원번호
      name: name,
    };

    // 이메일이 있으면 이메일과 전화번호 모두로, 없으면 전화번호만으로 생성
    const createUserData: any = {
      phone: formattedPhone,
      password: tempPassword,
      phone_confirm: true,
      user_metadata: userMetadata,
      app_metadata: {
        role: role,
        site_id: site_id,
        is_active: is_active ?? true,
      }
    };

    if (email) {
      createUserData.email = email;
      createUserData.email_confirm = true;
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser(createUserData);
    
    console.log('Auth 사용자 생성 결과:', { authData: !!authData, error: authError });

    if (authError) {
      console.error('Auth 사용자 생성 오류:', authError);
      let errorMessage = 'Auth 사용자 생성에 실패했습니다.';
      
      if (authError.message.includes('already registered')) {
        if (authError.message.includes('email')) {
          errorMessage = '이미 등록된 이메일입니다.';
        } else if (authError.message.includes('phone')) {
          errorMessage = '이미 등록된 전화번호입니다.';
        } else {
          errorMessage = '이미 등록된 사용자입니다.';
        }
      }
      
      return NextResponse.json({
        success: false,
        message: errorMessage
      }, { status: 400 });
    }

    if (!authData.user) {
      return NextResponse.json({
        success: false,
        message: 'Auth 사용자 생성에 실패했습니다.'
      }, { status: 400 });
    }

    // user_metadata에 모든 정보가 저장되었으므로 user_profiles 테이블 사용 안함
    console.log('사용자 생성 완료 (user_metadata만 사용):', authData.user.id);

    return NextResponse.json({
      success: true,
      message: '사용자가 성공적으로 생성되었습니다.',
      data: { user_id: authData.user.id }
    });

  } catch (error) {
    console.error('사용자 생성 오류 (catch 블록):', error);
    return NextResponse.json({
      success: false,
      message: '서버 오류가 발생했습니다.',
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}