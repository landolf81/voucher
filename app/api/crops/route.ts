import { createClient } from '@/lib/supabase';
import { NextResponse } from 'next/server';

// GET /api/crops - 작물 목록 조회 (드롭다운용)
export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data, error } = await supabase
      .from('crops')
      .select('*')
      .eq('is_active', true)
      .order('display_order');

    if (error) {
      // crops 테이블이 없는 경우 빈 배열 반환
      if (error.message.includes('does not exist') || error.message.includes('schema cache')) {
        console.warn('crops 테이블이 존재하지 않습니다. 빈 배열을 반환합니다.');
        return NextResponse.json({ crops: [] });
      }
      console.error('Failed to fetch crops:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ crops: data || [] });
  } catch (error: any) {
    console.error('Error in GET /api/crops:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
