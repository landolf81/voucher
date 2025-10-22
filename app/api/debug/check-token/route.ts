import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const searchParams = request.searchParams;
  const partialToken = searchParams.get('token');

  if (!partialToken) {
    return NextResponse.json({ error: 'Token parameter required' }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Search for tokens that start with the partial token
  const { data: vouchers, error } = await supabase
    .from('vouchers')
    .select('id, serial_no, name, mobile_link_token, link_expires_at, status, issuance_type')
    .ilike('mobile_link_token', `${partialToken}%`)
    .limit(10);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    searchToken: partialToken,
    found: vouchers?.length || 0,
    vouchers: vouchers?.map(v => ({
      id: v.id,
      serial_no: v.serial_no,
      name: v.name,
      token: v.mobile_link_token,
      tokenLength: v.mobile_link_token?.length || 0,
      expires: v.link_expires_at,
      status: v.status,
      issuanceType: v.issuance_type
    }))
  });
}
