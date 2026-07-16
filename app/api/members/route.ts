import { createClient } from '@/lib/supabase';
import { NextResponse } from 'next/server';
import type {
  Member,
  MemberSearchParams,
  MemberListResponse,
  CreateMemberRequest
} from '@/types/member';

// GET /api/members - 조합원 목록 조회
export async function GET(request: Request) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const params: MemberSearchParams = {
      q: searchParams.get('q') || undefined,
      site_id: searchParams.get('site_id') || undefined,
      association_id: searchParams.get('association_id') || undefined,
      crop_id: searchParams.get('crop_id') || undefined,
      is_active: searchParams.get('is_active') === 'false' ? false : true,
      position: searchParams.get('position') || undefined,
      page: parseInt(searchParams.get('page') || '1'),
      page_size: parseInt(searchParams.get('page_size') || '50'),
      sort_by: (searchParams.get('sort_by') as any) || undefined,
      sort_order: (searchParams.get('sort_order') as any) || 'desc',
    };

    // 영농회 코드·성명 정렬을 위해 조인 뷰 사용
    let query = supabase
      .from('members_list_view')
      .select('*', { count: 'exact' });

    // Apply filters
    if (params.is_active !== undefined) {
      query = query.eq('is_active', params.is_active);
    }

    if (params.site_id) {
      query = query.eq('site_id', params.site_id);
    }

    if (params.association_id) {
      query = query.eq('association_id', params.association_id);
    }

    if (params.crop_id) {
      query = query.or(`main_crop_id.eq.${params.crop_id},sub_crop_id.eq.${params.crop_id}`);
    }

    // 직책 필터 (재임 중 기준: 종료일이 없거나 아직 지나지 않음)
    if (params.position) {
      const today = new Date().toISOString().split('T')[0];
      const { data: positionRows, error: positionError } = await supabase
        .from('member_positions')
        .select('member_id')
        .eq('position', params.position)
        .or(`end_date.is.null,end_date.gte.${today}`);

      if (positionError) {
        console.error('Failed to fetch member positions:', positionError);
        return NextResponse.json({ error: positionError.message }, { status: 500 });
      }

      const memberIds = [...new Set((positionRows || []).map((r: any) => r.member_id))];
      if (memberIds.length === 0) {
        const response: MemberListResponse = {
          members: [],
          total: 0,
          page: params.page!,
          page_size: params.page_size!,
        };
        return NextResponse.json(response);
      }
      query = query.in('id', memberIds);
    }

    // 통합 검색: 성명 / 영농회 / 직책(재임 중)
    if (params.q) {
      const orClauses = [`name.ilike.%${params.q}%`, `association_name.ilike.%${params.q}%`];

      const today = new Date().toISOString().split('T')[0];
      const { data: posRows, error: posError } = await supabase
        .from('member_positions')
        .select('member_id')
        .ilike('position', `%${params.q}%`)
        .or(`end_date.is.null,end_date.gte.${today}`);

      if (posError) {
        console.error('Failed to search member positions:', posError);
      } else {
        const posMemberIds = [...new Set((posRows || []).map((r: any) => r.member_id))];
        if (posMemberIds.length > 0) {
          orClauses.push(`id.in.(${posMemberIds.join(',')})`);
        }
      }

      query = query.or(orClauses.join(','));
    }

    // Apply sorting (기본: 영농회 코드 → 성명 순)
    if (params.sort_by) {
      query = query.order(params.sort_by, { ascending: params.sort_order === 'asc' });
    } else {
      query = query
        .order('association_code', { ascending: true })
        .order('name', { ascending: true });
    }

    // Apply pagination
    const from = (params.page! - 1) * params.page_size!;
    const to = from + params.page_size! - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      // members 테이블이 없는 경우 빈 결과 반환
      if (error.message.includes('does not exist') || error.message.includes('schema cache')) {
        console.warn('members 테이블이 존재하지 않습니다. 빈 결과를 반환합니다.');
        const response: MemberListResponse = {
          members: [],
          total: 0,
          page: params.page!,
          page_size: params.page_size!,
        };
        return NextResponse.json(response);
      }
      console.error('Failed to fetch members:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Transform data (뷰에 site_name/association_name 포함)
    const transformedData = (data || []).map((member: any) => ({
      ...member,
      site_name: member.site_name || '',
      association_name: member.association_name || '',
      // Default values for voucher stats (to be implemented later)
      issued_voucher_count: member.issued_voucher_count || 0,
      used_voucher_count: member.used_voucher_count || 0,
      total_issued_amount: member.total_issued_amount || 0,
      total_used_amount: member.total_used_amount || 0,
      remaining_amount: member.remaining_amount || 0,
    }));

    const response: MemberListResponse = {
      members: transformedData,
      total: count || 0,
      page: params.page!,
      page_size: params.page_size!,
    };

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('Error in GET /api/members:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/members - 조합원 등록
export async function POST(request: Request) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const body: CreateMemberRequest = await request.json();

    // Check if member_id already exists (association_id 기준으로 변경)
    const { data: existing } = await supabase
      .from('members')
      .select('id')
      .eq('association_id', body.member.association_id)
      .eq('member_id', body.member.member_id)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: '이미 존재하는 조합원 ID입니다.' },
        { status: 400 }
      );
    }

    // Get crop names if crop IDs are provided
    let main_crop_name = null;
    let sub_crop_name = null;

    if (body.member.main_crop_id) {
      const { data: mainCrop } = await supabase
        .from('crops')
        .select('crop_name')
        .eq('id', body.member.main_crop_id)
        .single();
      main_crop_name = mainCrop?.crop_name;
    }

    if (body.member.sub_crop_id) {
      const { data: subCrop } = await supabase
        .from('crops')
        .select('crop_name')
        .eq('id', body.member.sub_crop_id)
        .single();
      sub_crop_name = subCrop?.crop_name;
    }

    // Insert member
    const { data: member, error: memberError } = await supabase
      .from('members')
      .insert({
        ...body.member,
        main_crop_name,
        sub_crop_name,
      })
      .select()
      .single();

    if (memberError) {
      console.error('Failed to create member:', memberError);
      return NextResponse.json({ error: memberError.message }, { status: 500 });
    }

    // Insert grafting schedule if provided
    if (body.grafting_schedule && member) {
      const { error: scheduleError } = await supabase
        .from('grafting_schedules')
        .insert({
          ...body.grafting_schedule,
          member_id: member.id,
        });

      if (scheduleError) {
        console.error('Failed to create grafting schedule:', scheduleError);
        // Don't fail the entire request, just log the error
      }
    }

    return NextResponse.json({ member }, { status: 201 });
  } catch (error: any) {
    console.error('Error in POST /api/members:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
