import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isValidUserMetadata } from '@/lib/types/auth';

// Supabase Admin 클라이언트 싱글톤
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

export async function POST(request: NextRequest) {
  try {
    const { user_id, email, phone, auto_lookup, preferred_method } = await request.json();

    if (auto_lookup && user_id) {
      // 자동 조회 모드
    } else if (!user_id || (!email && !phone)) {
      return NextResponse.json({
        success: false,
        message: 'user_id와 email 또는 phone이 필요합니다.'
      }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    // auth.users에서 display_name으로 사용자 검색
    const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers();

    if (authError) {
      console.error('Auth users 조회 오류:', authError);
      return NextResponse.json({
        success: false,
        message: '사용자 인증 정보 조회 중 오류가 발생했습니다.'
      }, { status: 500 });
    }

    // display_name이나 user_metadata에서 user_id와 일치하는 사용자 찾기
    const targetAuthUser = authUsers.users.find(user => {
      const displayName = user.user_metadata?.display_name || user.user_metadata?.user_id;
      return displayName === user_id || user.id === user_id;
    });

    if (!targetAuthUser) {
      return NextResponse.json({
        success: false,
        message: '등록되지 않은 사용자 ID입니다.'
      }, { status: 404 });
    }

    const metadata = targetAuthUser.user_metadata;

    // user_metadata에서 is_active 확인
    if (isValidUserMetadata(metadata) && metadata.is_active === false) {
      return NextResponse.json({
        success: false,
        message: '비활성화된 사용자입니다.'
      }, { status: 403 });
    }

    // 사용자 정보 결정 (user_metadata만 사용)
    let userName: string;
    let userRole: string;
    let siteId: string | null;

    if (isValidUserMetadata(metadata)) {
      userName = metadata.name;
      userRole = metadata.role;
      siteId = metadata.site_id;
    } else {
      userName = targetAuthUser.user_metadata?.display_name || user_id;
      userRole = 'user';
      siteId = null;
    }

    // auto_lookup 모드인 경우 auth.users에서 이메일/전화번호 정보 조회
    let finalEmail = email;
    let finalPhone = phone;
    let authMethod = null;

    if (auto_lookup) {
      finalEmail = targetAuthUser.email;
      finalPhone = targetAuthUser.phone;

      // 이메일 우선 정책
      if (finalEmail && preferred_method !== 'sms') {
        finalPhone = null;
        authMethod = 'email';
      } else if (preferred_method === 'email') {
        finalPhone = null;
        if (!finalEmail) {
          return NextResponse.json({
            success: false,
            message: '해당 사용자의 이메일 정보가 등록되어 있지 않습니다.'
          }, { status: 400 });
        }
      } else if (preferred_method === 'sms' && finalEmail) {
        return NextResponse.json({
          success: false,
          message: '이메일이 등록된 사용자는 이메일 인증만 사용할 수 있습니다.',
          redirect_to_email: true,
          has_email: true
        }, { status: 400 });
      } else if (preferred_method === 'sms') {
        finalEmail = null;
        if (!finalPhone) {
          return NextResponse.json({
            success: false,
            message: '해당 사용자의 전화번호 정보가 등록되어 있지 않습니다.'
          }, { status: 400 });
        }
      } else {
        if (finalEmail) {
          finalPhone = null;
        } else if (!finalEmail && !finalPhone) {
          return NextResponse.json({
            success: false,
            message: '해당 사용자의 이메일 또는 전화번호 정보가 등록되어 있지 않습니다.'
          }, { status: 400 });
        }
      }
    }

    // 일반 클라이언트로 OTP 전송
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    let result;

    if (finalEmail) {
      result = await supabase.auth.signInWithOtp({
        email: finalEmail,
        options: {
          shouldCreateUser: false,
          data: {
            user_id: user_id,
            display_name: user_id,
            name: userName,
            role: userRole,
            site_id: siteId,
            auth_user_id: targetAuthUser.id
          }
        }
      });
      authMethod = 'email';
    } else if (finalPhone) {
      let e164Phone;
      if (finalPhone.startsWith('+')) {
        e164Phone = finalPhone;
      } else if (finalPhone.startsWith('82')) {
        e164Phone = `+${finalPhone}`;
      } else if (finalPhone.startsWith('010')) {
        e164Phone = `+82${finalPhone.substring(1)}`;
      } else {
        e164Phone = `+82${finalPhone}`;
      }
      result = await supabase.auth.signInWithOtp({
        phone: e164Phone,
        options: {
          channel: 'sms',
          data: {
            user_id: user_id,
            display_name: user_id,
            name: userName,
            role: userRole,
            site_id: siteId,
            auth_user_id: targetAuthUser.id
          }
        }
      });
      authMethod = 'sms';
    }

    if (result?.error) {
      console.error('OTP 전송 오류:', result.error);
      return NextResponse.json({
        success: false,
        message: 'OTP 전송에 실패했습니다.',
        error: result.error.message
      }, { status: 500 });
    }

    const authMethodText = authMethod === 'email' ? '인증 코드가 이메일로' : '인증 코드가 SMS로';

    return NextResponse.json({
      success: true,
      message: `${userName}님, ${authMethodText} 전송되었습니다.`,
      user: {
        user_id: user_id,
        display_name: user_id,
        name: userName,
        role: userRole
      },
      auth_method: authMethod,
      auto_lookup: !!auto_lookup,
      actual_phone: authMethod === 'sms' ? finalPhone : null,
      actual_email: authMethod === 'email' ? finalEmail : null,
      needs_email_setup: authMethod === 'sms' && !targetAuthUser.email,
      has_email: !!targetAuthUser.email
    });

  } catch (error) {
    console.error('사용자 연결 오류:', error);
    return NextResponse.json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    }, { status: 500 });
  }
}
