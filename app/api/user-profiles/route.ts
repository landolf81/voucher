import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { formatPhoneForDisplay, formatPhoneForDB, validateKoreanPhoneInput } from '@/lib/phone-utils';

export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // user_profiles와 sites를 조인하여 조회
    const { data: profiles, error: profilesError } = await supabase
      .from('user_profiles')
      .select(`
        *,
        sites (
          id,
          site_name
        )
      `)
      .order('created_at', { ascending: false });

    if (profilesError) {
      console.error('프로필 조회 오류:', profilesError);
      return NextResponse.json({
        success: false,
        message: '사용자 목록 조회에 실패했습니다.'
      }, { status: 500 });
    }

    // auth.users에서 이메일 정보 조회 (service role 클라이언트 사용)
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (authError) {
      console.error('Auth 사용자 조회 오류:', authError);
      return NextResponse.json({
        success: false,
        message: 'Auth 사용자 조회에 실패했습니다.'
      }, { status: 500 });
    }

    // 프로필과 auth 사용자 정보 병합
    const usersWithAuth = profiles?.map(profile => {
      const authUser = authUsers.users.find(u => u.id === profile.id);
      const phone = authUser?.phone || '';
      const displayPhone = formatPhoneForDisplay(phone);
      
      return {
        ...profile,
        email: authUser?.email || '',
        phone: phone,
        phone_masked: displayPhone || '***-****-****',
        last_sign_in_at: authUser?.last_sign_in_at,
        email_confirmed_at: authUser?.email_confirmed_at
      };
    }) || [];

    // sites 목록도 별도로 조회
    const { data: sites, error: sitesError } = await supabase
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

    return NextResponse.json({
      success: true,
      data: {
        users: usersWithAuth,
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
    
    // 이메일이 있으면 이메일과 전화번호 모두로, 없으면 전화번호만으로 생성
    const createUserData: any = {
      phone: formattedPhone,
      password: tempPassword,
      phone_confirm: true,  // 전화번호 확인 자동 처리
      user_metadata: {
        user_id: user_id,  // 사원번호를 user_metadata에 저장
        name: name  // 실제 이름도 함께 저장
      }
    };
    
    if (email) {
      createUserData.email = email;
      createUserData.email_confirm = true; // 이메일 확인 자동 처리
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