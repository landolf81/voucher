import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
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
    const supabase = createRouteHandlerClient({ cookies });
    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const params: MemberSearchParams = {
      q: searchParams.get('q') || undefined,
      site_id: searchParams.get('site_id') || undefined,
      crop_id: searchParams.get('crop_id') || undefined,
      is_active: searchParams.get('is_active') === 'false' ? false : true,
      page: parseInt(searchParams.get('page') || '1'),
      page_size: parseInt(searchParams.get('page_size') || '50'),
      sort_by: (searchParams.get('sort_by') as any) || 'created_at',
      sort_order: (searchParams.get('sort_order') as any) || 'desc',
    };

    // Build query
    let query = supabase
      .from('member_overview')
      .select('*', { count: 'exact' });

    // Apply filters
    if (params.is_active !== undefined) {
      query = query.eq('is_active', params.is_active);
    }

    if (params.site_id) {
      query = query.eq('site_id', params.site_id);
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
      console.error('Failed to fetch members:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const response: MemberListResponse = {
      members: data || [],
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
    const supabase = createRouteHandlerClient({ cookies });
    const body: CreateMemberRequest = await request.json();

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if member_id already exists for this site
    const { data: existing } = await supabase
      .from('members')
      .select('id')
      .eq('site_id', body.member.site_id)
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
        created_by: user.id,
        updated_by: user.id,
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
          created_by: user.id,
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
