import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    // URL 파라미터에서 사용자 ID 가져오기
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json(
        { ok: false, message: '사용자 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    // Service role key를 사용하여 Supabase 클라이언트 생성
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 사용자 프로필 가져오기 (id 필드로 조회)
    const { data: userProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('role, site_id')
      .eq('id', userId)
      .single();

    if (profileError || !userProfile) {
      console.error('프로필 조회 오류:', profileError);
      return NextResponse.json(
        { ok: false, message: '사용자 정보를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 오늘 날짜 범위 설정 (한국 시간 기준)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // 쿼리 구성
    let query = supabase
      .from('vouchers')
      .select(`
        *,
        used_by_user:user_profiles!vouchers_used_by_user_id_fkey(name),
        used_at_site:sites!vouchers_used_at_site_id_fkey(site_name)
      `)
      .eq('status', 'used')
      .gte('used_at', today.toISOString())
      .lt('used_at', tomorrow.toISOString())
      .order('used_at', { ascending: false });

    // 관리자가 아닌 경우 사업장 필터링
    if (userProfile.role !== 'admin' && userProfile.site_id) {
      query = query.eq('used_at_site_id', userProfile.site_id);
    }

    const { data: vouchers, error: vouchersError } = await query;

    if (vouchersError) {
      console.error('오늘 사용된 교환권 조회 오류:', vouchersError);
      return NextResponse.json(
        { ok: false, message: '데이터 조회에 실패했습니다.' },
        { status: 500 }
      );
    }

    // 데이터 포맷팅
    const formattedVouchers = (vouchers || []).map(voucher => ({
      id: voucher.id,
      serial_no: voucher.serial_no,
      amount: voucher.amount,
      association: voucher.association,
      member_id: voucher.member_id,
      name: voucher.name,
      used_at: voucher.used_at,
      used_by: voucher.used_by_user?.name || '알 수 없음',
      site_name: voucher.used_at_site?.site_name || '알 수 없음'
    }));

    return NextResponse.json({
      ok: true,
      data: formattedVouchers,
      count: formattedVouchers.length,
      isAdmin: userProfile.role === 'admin'
    });

  } catch (error) {
    console.error('오늘 사용된 교환권 조회 오류:', error);
    return NextResponse.json(
      {
        ok: false,
        message: '서버 오류가 발생했습니다.',
        error: error instanceof Error ? error.message : '알 수 없는 오류'
      },
      { status: 500 }
    );
  }
}