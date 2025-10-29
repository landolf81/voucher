import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

// GET /api/crops - 작물 목록 조회 (드롭다운용)
export async function GET() {
  try {
    const supabase = createRouteHandlerClient({ cookies });

    const { data, error } = await supabase
      .from('crops')
      .select('*')
      .eq('is_active', true)
      .order('display_order');

    if (error) {
      console.error('Failed to fetch crops:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ crops: data || [] });
  } catch (error: any) {
    console.error('Error in GET /api/crops:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
