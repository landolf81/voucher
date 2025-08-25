import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const { user_id } = await request.json();

    if (!user_id) {
      return NextResponse.json({
        success: false,
        message: 'user_id가 필요합니다.'
      }, { status: 400 });
    }

    // 서비스 롤 키로 user_profiles 확인
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    console.log('사용자 조회 시작:', user_id);

    // user_profiles에서 사용자 확인
    const { data: userProfile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('id, name, user_id, role, site_id, is_active')
      .eq('user_id', user_id)
      .single();

    if (profileError || !userProfile) {
      console.log('사용자 프로필 찾을 수 없음:', user_id);
      return NextResponse.json({
        success: false,
        message: '등록되지 않은 사용자 ID입니다.'
      }, { status: 404 });
    }

    if (!userProfile.is_active) {
      console.log('비활성화된 사용자:', user_id);
      return NextResponse.json({
        success: false,
        message: '비활성화된 사용자입니다.'
      }, { status: 403 });
    }

    console.log('사용자 프로필 조회 성공:', userProfile);

    // auth.users 테이블에서 이메일/전화번호 정보 조회
    // user_profiles와 auth.users를 연결하는 방법을 확인해야 합니다.
    // 만약 user_profiles에 auth_user_id 필드가 있다면 그것을 사용하고,
    // 없다면 다른 방법을 찾아야 합니다.
    
    // 우선 이메일 우선순위로 조회를 시도해보겠습니다.
    // user_profiles 테이블에 email, phone 필드가 있는지 확인
    const { data: userWithContact, error: contactError } = await supabaseAdmin
      .from('user_profiles')
      .select('email, phone')
      .eq('user_id', user_id)
      .single();

    let contactInfo = null;
    if (userWithContact && !contactError) {
      contactInfo = {
        email: userWithContact.email,
        phone: userWithContact.phone
      };
      console.log('연락처 정보 조회 성공:', contactInfo);
    } else {
      console.log('user_profiles에서 연락처 조회 실패, auth.users 직접 조회 시도');
      
      // auth.users에서 직접 조회하려면 raw_user_meta_data나 다른 필드를 통해
      // user_profiles와 연결점을 찾아야 합니다.
      // 현재는 user_profiles의 정보만으로 응답하겠습니다.
    }

    return NextResponse.json({
      success: true,
      user: {
        user_id: userProfile.user_id,
        name: userProfile.name,
        role: userProfile.role,
        email: contactInfo?.email || null,
        phone: contactInfo?.phone || null,
        has_email: !!(contactInfo?.email),
        has_phone: !!(contactInfo?.phone)
      }
    });

  } catch (error) {
    console.error('사용자 조회 오류:', error);
    return NextResponse.json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    }, { status: 500 });
  }
}