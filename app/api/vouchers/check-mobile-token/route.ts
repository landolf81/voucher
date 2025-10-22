import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json({
        success: false,
        error: 'Token parameter required'
      }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. 정확히 일치하는 토큰 찾기
    const { data: exactMatch, error: exactError } = await supabase
      .from('vouchers')
      .select('id, serial_no, name, mobile_link_token, link_expires_at, status, issuance_type')
      .eq('mobile_link_token', token)
      .maybeSingle();

    // 2. 부분 일치하는 토큰들 찾기 (LIKE 검색)
    const { data: partialMatches, error: partialError } = await supabase
      .from('vouchers')
      .select('id, serial_no, name, mobile_link_token, link_expires_at, status, issuance_type')
      .ilike('mobile_link_token', `${token}%`)
      .limit(10);

    // 3. 최근 생성된 모바일 교환권들
    const { data: recentMobile, error: recentError } = await supabase
      .from('vouchers')
      .select('id, serial_no, name, mobile_link_token, link_expires_at, status, issuance_type, created_at')
      .eq('issuance_type', 'mobile')
      .not('mobile_link_token', 'is', null)
      .order('created_at', { ascending: false })
      .limit(5);

    // 4. 모바일 배치 확인
    const { data: batches } = await supabase
      .from('mobile_voucher_batches')
      .select('id, batch_name, link_token, status, expires_at, created_at')
      .order('created_at', { ascending: false })
      .limit(5);

    return NextResponse.json({
      success: true,
      searchToken: token,
      tokenLength: token.length,
      results: {
        exactMatch: exactMatch ? {
          id: exactMatch.id,
          serial_no: exactMatch.serial_no,
          name: exactMatch.name,
          token: exactMatch.mobile_link_token,
          tokenLength: exactMatch.mobile_link_token?.length || 0,
          expires: exactMatch.link_expires_at,
          expired: exactMatch.link_expires_at ? new Date(exactMatch.link_expires_at) < new Date() : false,
          status: exactMatch.status,
          issuanceType: exactMatch.issuance_type
        } : null,
        partialMatches: partialMatches?.map(v => ({
          id: v.id,
          serial_no: v.serial_no,
          name: v.name,
          token: v.mobile_link_token,
          tokenLength: v.mobile_link_token?.length || 0,
          tokenMatch: v.mobile_link_token?.startsWith(token),
          expires: v.link_expires_at,
          status: v.status
        })) || [],
        recentMobileVouchers: recentMobile?.map(v => ({
          id: v.id,
          serial_no: v.serial_no,
          name: v.name,
          token: v.mobile_link_token,
          tokenLength: v.mobile_link_token?.length || 0,
          created: v.created_at,
          status: v.status
        })) || [],
        recentBatches: batches?.map(b => ({
          id: b.id,
          name: b.batch_name,
          token: b.link_token,
          tokenLength: b.link_token?.length || 0,
          status: b.status,
          expires: b.expires_at,
          created: b.created_at
        })) || []
      }
    });

  } catch (error) {
    console.error('Token check error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
