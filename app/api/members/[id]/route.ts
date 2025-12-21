import { createClient } from '@/lib/supabase';
import { NextResponse } from 'next/server';
import type { UpdateMemberRequest } from '@/types/member';

// GET /api/members/[id] - 조합원 상세 조회
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { id } = await context.params;

    // Get member details
    const { data: member, error } = await supabase
      .from('members')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      // members 테이블이 없는 경우
      if (error.message.includes('does not exist') || error.message.includes('schema cache')) {
        return NextResponse.json({ error: 'Member feature not available' }, { status: 404 });
      }
      console.error('Failed to fetch member:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    // Get all grafting schedules for this member
    const { data: graftingSchedules } = await supabase
      .from('grafting_schedules')
      .select('*')
      .eq('member_id', id)
      .order('year', { ascending: false });

    return NextResponse.json({
      member,
      grafting_schedules: graftingSchedules || [],
    });
  } catch (error: any) {
    console.error('Error in GET /api/members/[id]:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT /api/members/[id] - 조합원 정보 수정
export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { id } = await context.params;
    const body: UpdateMemberRequest = await request.json();

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if member exists
    const { data: existing } = await supabase
      .from('members')
      .select('id, member_id, site_id')
      .eq('id', id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    // If changing member_id or site_id, check for duplicates
    if (
      (body.member.member_id && body.member.member_id !== existing.member_id) ||
      (body.member.site_id && body.member.site_id !== existing.site_id)
    ) {
      const checkMemberId = body.member.member_id || existing.member_id;
      const checkSiteId = body.member.site_id || existing.site_id;

      const { data: duplicate } = await supabase
        .from('members')
        .select('id')
        .eq('site_id', checkSiteId)
        .eq('member_id', checkMemberId)
        .neq('id', id)
        .single();

      if (duplicate) {
        return NextResponse.json(
          { error: '이미 존재하는 조합원 ID입니다.' },
          { status: 400 }
        );
      }
    }

    // Update crop names if crop IDs changed
    const updateData: any = { ...body.member, updated_by: user.id };

    if (body.member.main_crop_id) {
      const { data: mainCrop } = await supabase
        .from('crops')
        .select('crop_name')
        .eq('id', body.member.main_crop_id)
        .single();
      updateData.main_crop_name = mainCrop?.crop_name;
    }

    if (body.member.sub_crop_id) {
      const { data: subCrop } = await supabase
        .from('crops')
        .select('crop_name')
        .eq('id', body.member.sub_crop_id)
        .single();
      updateData.sub_crop_name = subCrop?.crop_name;
    }

    // Update member
    const { data: member, error: memberError } = await supabase
      .from('members')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (memberError) {
      console.error('Failed to update member:', memberError);
      return NextResponse.json({ error: memberError.message }, { status: 500 });
    }

    // Update or insert grafting schedule if provided
    if (body.grafting_schedule) {
      const { data: existingSchedule } = await supabase
        .from('grafting_schedules')
        .select('id')
        .eq('member_id', id)
        .eq('year', body.grafting_schedule.year)
        .single();

      if (existingSchedule) {
        // Update existing schedule
        await supabase
          .from('grafting_schedules')
          .update(body.grafting_schedule)
          .eq('id', existingSchedule.id);
      } else {
        // Insert new schedule
        await supabase
          .from('grafting_schedules')
          .insert({
            ...body.grafting_schedule,
            member_id: id,
            created_by: user.id,
          });
      }
    }

    return NextResponse.json({ member });
  } catch (error: any) {
    console.error('Error in PUT /api/members/[id]:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/members/[id] - 조합원 삭제 (soft delete)
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { id } = await context.params;

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Soft delete by setting is_active to false
    const { error } = await supabase
      .from('members')
      .update({
        is_active: false,
        updated_by: user.id,
      })
      .eq('id', id);

    if (error) {
      console.error('Failed to delete member:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error in DELETE /api/members/[id]:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
