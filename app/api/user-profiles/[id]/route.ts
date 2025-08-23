import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { formatPhoneForDB, validateKoreanPhoneInput } from '@/lib/phone-utils';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = params.id;

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 사용자 프로필 조회
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select(`
        *,
        sites (
          id,
          site_name
        )
      `)
      .eq('id', userId)
      .single();

    if (error) {
      console.error('프로필 조회 오류:', error);
      return NextResponse.json({
        success: false,
        message: '사용자를 찾을 수 없습니다.'
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: profile
    });

  } catch (error) {
    console.error('사용자 조회 오류:', error);
    return NextResponse.json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { email, phone, name, role, site_id, is_active } = body;
    const userId = params.id;

    // 필수 필드 확인
    if (!name || !role || !site_id) {
      return NextResponse.json({
        success: false,
        message: '모든 필수 필드를 입력해주세요.'
      }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // user_profiles 업데이트
    const { error: profileError } = await supabase
      .from('user_profiles')
      .update({
        name,
        role,
        site_id,
        is_active,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (profileError) {
      console.error('프로필 업데이트 오류:', profileError);
      return NextResponse.json({
        success: false,
        message: '사용자 정보 업데이트에 실패했습니다.'
      }, { status: 500 });
    }

    // Auth 사용자의 이메일/전화번호 업데이트 (필요한 경우)
    if (email || phone) {
      const updateData: any = {};
      
      if (email) {
        updateData.email = email;
      }
      
      if (phone) {
        // 전화번호 형식 검증 및 변환
        try {
          const cleanedPhone = phone.replace(/[^0-9]/g, '');
          
          if (!validateKoreanPhoneInput(cleanedPhone)) {
            return NextResponse.json({
              success: false,
              message: '올바른 전화번호 형식이 아닙니다. (예: 01012345678)'
            }, { status: 400 });
          }
          
          updateData.phone = formatPhoneForDB(cleanedPhone);
        } catch (error: any) {
          return NextResponse.json({
            success: false,
            message: error.message || '전화번호 형식 오류'
          }, { status: 400 });
        }
      }
      
      const { error: authError } = await supabase.auth.admin.updateUserById(
        userId,
        updateData
      );
      
      if (authError) {
        console.error('Auth 사용자 업데이트 오류:', authError);
        return NextResponse.json({
          success: false,
          message: '사용자 이메일/전화번호 업데이트에 실패했습니다.'
        }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      message: '사용자 정보가 성공적으로 업데이트되었습니다.'
    });

  } catch (error) {
    console.error('사용자 업데이트 오류:', error);
    return NextResponse.json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = params.id;

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. 프로필 삭제
    const { error: profileError } = await supabase
      .from('user_profiles')
      .delete()
      .eq('id', userId);

    if (profileError) {
      console.error('프로필 삭제 오류:', profileError);
      return NextResponse.json({
        success: false,
        message: '사용자 프로필 삭제에 실패했습니다.'
      }, { status: 500 });
    }

    // 2. Auth 사용자 삭제 (service role 클라이언트 사용)
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (authError) {
      console.error('Auth 사용자 삭제 오류:', authError);
      // 프로필은 이미 삭제되었으므로 경고만 로그
      console.warn('Auth 사용자는 삭제되지 않았지만 프로필은 삭제되었습니다.');
    }

    return NextResponse.json({
      success: true,
      message: '사용자가 성공적으로 삭제되었습니다.'
    });

  } catch (error) {
    console.error('사용자 삭제 오류:', error);
    return NextResponse.json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    }, { status: 500 });
  }
}

// 사용자 활성화/비활성화 토글
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { is_active } = body;
    const userId = params.id;

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // user_profiles에서 활성화 상태 업데이트
    const { error: profileError } = await supabase
      .from('user_profiles')
      .update({
        is_active,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (profileError) {
      console.error('사용자 상태 업데이트 오류:', profileError);
      return NextResponse.json({
        success: false,
        message: '사용자 상태 업데이트에 실패했습니다.'
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `사용자가 성공적으로 ${is_active ? '활성화' : '비활성화'}되었습니다.`
    });

  } catch (error) {
    console.error('사용자 상태 업데이트 오류:', error);
    return NextResponse.json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    }, { status: 500 });
  }
}