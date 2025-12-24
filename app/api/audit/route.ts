import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { z } from 'zod';

// 감사 로그 생성 스키마
const createAuditLogSchema = z.object({
  action: z.string().min(1, '작업 내용이 필요합니다.'),
  table_name: z.string().optional(),
  record_id: z.string().optional(),
  actor_user_id: z.string().optional(),
  site_id: z.string().optional(),
  details: z.any().optional(),
  ip_address: z.string().optional(),
  user_agent: z.string().optional()
});

// POST: 감사 로그 생성
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('감사 로그 생성 API 호출:', body.action);

    // 입력 검증
    const validation = createAuditLogSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          message: '입력 데이터가 올바르지 않습니다.',
          errors: validation.error.errors
        },
        { status: 400 }
      );
    }

    const { action, table_name, record_id, actor_user_id, site_id, details, ip_address, user_agent } = validation.data;
    const now = new Date().toISOString();

    // IP 주소와 User Agent 추출
    const clientIp = ip_address || 
      request.headers.get('x-forwarded-for') || 
      request.headers.get('x-real-ip') || 
      'unknown';
    
    const clientUserAgent = user_agent || 
      request.headers.get('user-agent') || 
      'unknown';

    // Supabase 사용
    console.log('감사 로그 생성');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .insert([
          {
            action,
            table_name: table_name || null,
            record_id: record_id || null,
            actor_user_id: actor_user_id || null,
            site_id: site_id || null,
            created_at: now,
            details: details || {},
            ip_address: clientIp,
            user_agent: clientUserAgent
          }
        ])
        .select()
        .single();

      if (error) {
        console.error('감사 로그 생성 오류:', error);
        return NextResponse.json(
          {
            success: false,
            message: '감사 로그 생성에 실패했습니다.'
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: '감사 로그가 성공적으로 기록되었습니다.',
        data
      });
    } catch (error) {
      console.error('감사 로그 생성 처리 오류:', error);
      return NextResponse.json(
        {
          success: false,
          message: '서버 오류가 발생했습니다.'
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('감사 로그 생성 API 오류:', error);
    
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : '서버 오류가 발생했습니다.'
      },
      { status: 500 }
    );
  }
}

// GET: 감사 로그 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const action = searchParams.get('action');
    const table_name = searchParams.get('table_name');
    const actor_user_id = searchParams.get('actor_user_id');

    console.log('감사 로그 조회 API 호출');

    console.log('감사 로그 조회');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    try {
      let query = supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      // 필터 적용
      if (action) {
        query = query.ilike('action', `%${action}%`);
      }
      if (table_name) {
        query = query.eq('table_name', table_name);
      }
      if (actor_user_id) {
        query = query.eq('actor_user_id', actor_user_id);
      }

      const { data, error, count } = await query;

      if (error) {
        console.error('감사 로그 조회 오류:', error);
        return NextResponse.json(
          {
            success: false,
            message: '감사 로그 조회에 실패했습니다.'
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        data: data || [],
        total: count || 0
      });
    } catch (error) {
      console.error('감사 로그 조회 처리 오류:', error);
      return NextResponse.json(
        {
          success: false,
          message: '서버 오류가 발생했습니다.'
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('감사 로그 조회 API 오류:', error);
    
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : '서버 오류가 발생했습니다.'
      },
      { status: 500 }
    );
  }
}

// OPTIONS 요청 처리 (CORS)
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}