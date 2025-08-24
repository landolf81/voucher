import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    // Create Supabase client with service role
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get all user profiles with site information
    const { data: accounts, error } = await supabase
      .from('user_profiles')
      .select(`
        id,
        name,
        email,
        phone,
        role,
        oauth_provider,
        oauth_provider_id,
        oauth_linked_at,
        is_active,
        created_at,
        sites (
          id,
          site_name
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('OAuth 계정 조회 오류:', error);
      return NextResponse.json(
        { success: false, message: 'OAuth 계정 정보를 불러오는데 실패했습니다.' },
        { status: 500 }
      );
    }

    // Transform data for frontend
    const transformedAccounts = accounts?.map(account => ({
      id: account.id,
      name: account.name,
      email: account.email,
      phone: account.phone,
      role: account.role,
      oauth_provider: account.oauth_provider,
      oauth_provider_id: account.oauth_provider_id,
      oauth_linked_at: account.oauth_linked_at,
      is_active: account.is_active,
      site_name: account.sites?.site_name,
      created_at: account.created_at
    })) || [];

    return NextResponse.json({
      success: true,
      accounts: transformedAccounts,
      total: transformedAccounts.length,
      oauth_count: transformedAccounts.filter(acc => acc.oauth_provider).length
    });

  } catch (error) {
    console.error('OAuth 계정 API 오류:', error);
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}