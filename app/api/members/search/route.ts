import { createClient } from '@/lib/supabase';
import { NextResponse } from 'next/server';

// GET /api/members/search - 조합원 간단 검색 (모바일용)
export async function GET(request: Request) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q');

    if (!q || q.length < 2) {
      return NextResponse.json(
        { error: '검색어는 최소 2자 이상이어야 합니다.' },
        { status: 400 }
      );
    }

    // Search by name, member_id, or phone
    const { data, error } = await supabase
      .from('members')
      .select(`
        id,
        name,
        member_id,
        phone,
        site_id,
        sites(site_name),
        main_crop_name,
        date_of_birth
      `)
      .eq('is_active', true)
      .or(`name.ilike.%${q}%,member_id.ilike.%${q}%,phone.ilike.%${q}%`)
      .order('name')
      .limit(20);

    if (error) {
      console.error('Failed to search members:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ members: data || [] });
  } catch (error: any) {
    console.error('Error in GET /api/members/search:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
