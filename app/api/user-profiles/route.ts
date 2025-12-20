import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { formatPhoneForDisplay, formatPhoneForDB, validateKoreanPhoneInput } from '@/lib/phone-utils';
import { isValidUserMetadata, type UserMetadata } from '@/lib/types/auth';

/**
 * GET: 사용자 목록 조회
 * - user_metadata 우선 사용, user_profiles 폴백
 */
export async function GET() {
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. auth.users 목록 조회
    const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers();

    if (authError) {
      console.error('Auth 사용자 조회 오류:', authError);
      return NextResponse.json({
        success: false,
        message: 'Auth 사용자 조회에 실패했습니다.'
      }, { status: 500 });
    }

    // 2. sites 목록 조회
    const { data: sites, error: sitesError } = await supabaseAdmin
      .from('sites')
      .select('id, site_name')
      .order('site_name');

    if (sitesError) {
      console.error('사업장 조회 오류:', sitesError);
      return NextResponse.json({
        success: false,
        message: '사업장 목록 조회에 실패했습니다.'
      }, { status: 500 });
    }

    const sitesMap = new Map(sites?.map(s => [s.id, s.site_name]) || []);

    // 3. user_profiles 조회 (폴백용)
    const { data: profiles } = await supabaseAdmin
      .from('user_profiles')
      .select('*');

    const profilesMap = new Map(profiles?.map(p => [p.id, p]) || []);

    // 4. 사용자 데이터 병합 (user_metadata 우선, user_profiles 폴백)
    const users = authUsers.users.map(authUser => {
      const metadata = authUser.user_metadata;
      const profile = profilesMap.get(authUser.id);
      const phone = authUser.phone || '';
      const displayPhone = formatPhoneForDisplay(phone);

      // user_metadata가 유효하면 사용
      if (isValidUserMetadata(metadata)) {
        return {
          id: authUser.id,
          display_name: metadata.display_name,
          user_id: metadata.display_name, // 호환성 유지
          name: metadata.name,
          role: metadata.role,
          site_id: metadata.site_id,
          site_name: sitesMap.get(metadata.site_id) || '',
          is_active: metadata.is_active ?? true,
          email: authUser.email || '',
          phone: phone,
          phone_masked: displayPhone || '***-****-****',
          last_sign_in_at: authUser.last_sign_in_at,
          email_confirmed_at: authUser.email_confirmed_at,
          oauth_provider: metadata.oauth_provider,
          oauth_provider_id: metadata.oauth_provider_id,
          source: 'user_metadata'
        };
      }

      // 폴백: user_profiles 사용
      if (profile) {
        return {
          id: authUser.id,
          display_name: profile.user_id,
          user_id: profile.user_id,
          name: profile.name,
          role: profile.role,
          site_id: profile.site_id,
          site_name: sitesMap.get(profile.site_id) || '',
          is_active: profile.is_active ?? true,
          email: authUser.email || '',
          phone: phone,
          phone_masked: displayPhone || '***-****-****',
          last_sign_in_at: authUser.last_sign_in_at,
          email_confirmed_at: authUser.email_confirmed_at,
          oauth_provider: profile.oauth_provider,
          oauth_provider_id: profile.oauth_provider_id,
          source: 'user_profiles'
        };
      }

      // 프로필이 없는 사용자 (관리용)
      return {
        id: authUser.id,
        display_name: authUser.user_metadata?.display_name || '',
        user_id: '',
        name: authUser.user_metadata?.name || '(프로필 없음)',
        role: 'viewer',
        site_id: '',
        site_name: '',
        is_active: false,
        email: authUser.email || '',
        phone: phone,
        phone_masked: displayPhone || '***-****-****',
        last_sign_in_at: authUser.last_sign_in_at,
        email_confirmed_at: authUser.email_confirmed_at,
        source: 'none'
      };
    }).filter(u => u.user_id || u.display_name); // 프로필 있는 사용자만 반환

    return NextResponse.json({
      success: true,
      data: {
        users: users.sort((a, b) => (b.last_sign_in_at || '').localeCompare(a.last_sign_in_at || '')),
        sites: sites || []
      }
    });

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

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // 1. Auth 사용자 생성 (service role 클라이언트 사용)
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
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
    
    // user_metadata에 모든 프로필 정보 저장
    const userMetadata: UserMetadata = {
      display_name: user_id,  // 사원번호
      name: name,
      role: role,
      site_id: site_id,
      is_active: is_active ?? true,
    };

    // 이메일이 있으면 이메일과 전화번호 모두로, 없으면 전화번호만으로 생성
    const createUserData: any = {
      phone: formattedPhone,
      password: tempPassword,
      phone_confirm: true,
      user_metadata: userMetadata
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

    // 2. 프로필 생성
    const { error: profileError } = await supabase
      .from('user_profiles')
      .insert([{
        id: authData.user.id,
        name,
        role,
        site_id,
        user_id,
        is_active
      }]);

    if (profileError) {
      console.error('프로필 생성 오류:', profileError);
      
      // Auth 사용자는 생성되었으므로 롤백을 위해 삭제
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      
      return NextResponse.json({
        success: false,
        message: '프로필 생성에 실패했습니다.'
      }, { status: 500 });
    }

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