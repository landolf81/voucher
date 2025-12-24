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
      page: parseInt(searchParams.get('page') || '1'),
      page_size: parseInt(searchParams.get('page_size') || '50'),
      sort_by: (searchParams.get('sort_by') as any) || 'created_at',
      sort_order: (searchParams.get('sort_order') as any) || 'desc',
    };

    // Build query with site and association joins
    let query = supabase
      .from('members')
      .select(`
        *,
        sites:site_id (id, site_name),
        associations:association_id (id, name)
      `, { count: 'exact' });

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

    // Search by name, member_id, or phone
    if (params.q) {
      query = query.or(`name.ilike.%${params.q}%,member_id.ilike.%${params.q}%,phone.ilike.%${params.q}%`);
    }

    // Apply sorting
    query = query.order(params.sort_by!, { ascending: params.sort_order === 'asc' });

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

    // Transform data to include site_name and association_name
    const transformedData = (data || []).map((member: any) => ({
      ...member,
      site_name: member.sites?.site_name || '',
      association_name: member.associations?.name || '',
      // Remove nested objects
      sites: undefined,
      associations: undefined,
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
