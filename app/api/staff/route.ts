import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';

/**
 * GET /api/staff
 * 인증된 사용자에게 임직원 목록을 반환한다 (쪽지 수신자 선택 / 공지 미열람자 명단용).
 *
 * - 사용자 마스터는 auth.users + user_metadata 이므로 service_role 의 admin API 로 조회한다.
 * - 비활성(is_active === false) 사용자는 제외한다.
 * - sites 테이블에서 site_name 을 매핑한다.
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, message: '인증 토큰이 필요합니다.' },
        { status: 401 }
      );
    }
    const token = authHeader.split(' ')[1];

    const admin = supabaseServer();

    // 토큰 검증
    const { data: { user }, error: authError } = await admin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json(
        { success: false, message: '유효하지 않은 토큰입니다.' },
        { status: 401 }
      );
    }

    // 사이트 매핑
    const { data: sites } = await admin
      .from('sites')
      .select('id, site_name');
    const siteMap = new Map<string, string>(
      (sites || []).map((s: any) => [String(s.id), s.site_name as string])
    );

    // auth.users 페이지네이션 조회 (직원 규모 대비 충분한 상한)
    const staff: Array<{
      id: string;
      name: string;
      display_name: string;
      role: string;
      site_id: string | null;
      site_name: string | null;
      is_active: boolean;
    }> = [];

    const perPage = 1000;
    for (let page = 1; page <= 10; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
      if (error) {
        console.error('listUsers 오류:', error);
        return NextResponse.json(
          { success: false, message: '직원 목록 조회에 실패했습니다.' },
          { status: 500 }
        );
      }
      const users = data?.users || [];
      for (const u of users) {
        const meta = (u.user_metadata || {}) as Record<string, any>;
        const isActive = meta.is_active ?? true;
        if (isActive === false) continue;
        if (!meta.role) continue; // 프로필 미설정(메타데이터 없는) 계정 제외
        const siteId = meta.site_id ? String(meta.site_id) : null;
        staff.push({
          id: u.id,
          name: meta.name || meta.display_name || u.email || '(이름없음)',
          display_name: meta.display_name || '',
          role: meta.role,
          site_id: siteId,
          site_name: siteId ? siteMap.get(siteId) ?? null : null,
          is_active: true,
        });
      }
      if (users.length < perPage) break;
    }

    staff.sort((a, b) => a.name.localeCompare(b.name, 'ko'));

    return NextResponse.json({ success: true, data: { staff } });
  } catch (error: any) {
    console.error('직원 목록 조회 오류:', error);
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
