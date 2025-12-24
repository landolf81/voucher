import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { decryptVoucherData } from '@/lib/encryption';
import { z } from 'zod';

// 새로운 교환권 검색 스키마 (템플릿 기반)
const searchVouchersSchema = z.object({
  template_id: z.string().optional(),
  serial_no: z.string().optional(),
  status: z.enum(['issued', 'printed', 'delivered', 'used', 'expired', 'recalled']).optional(),
  member_id: z.string().optional(),
  farming_association: z.string().optional(),
  date_from: z.string().optional(), // 발행일 시작
  date_to: z.string().optional(),   // 발행일 종료
  limit: z.number().min(1).max(1000).default(50),
  offset: z.number().min(0).default(0)
});

// POST용 검색 스키마 (성명, ID 통합 검색)
const postSearchSchema = z.object({
  search_term: z.string().min(1, '검색어를 입력해주세요.'),
  search_type: z.enum(['name_or_id', 'serial_no', 'member_id', 'name']).default('name_or_id'),
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0)
});

// GET: 새로운 교환권 검색 (템플릿 기반)
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const params = {
      template_id: url.searchParams.get('template_id') || undefined,
      serial_no: url.searchParams.get('serial_no') || undefined,
      status: url.searchParams.get('status') || undefined,
      member_id: url.searchParams.get('member_id') || undefined,
      farming_association: url.searchParams.get('farming_association') || undefined,
      date_from: url.searchParams.get('date_from') || undefined,
      date_to: url.searchParams.get('date_to') || undefined,
      limit: parseInt(url.searchParams.get('limit') || '50', 10),
      offset: parseInt(url.searchParams.get('offset') || '0', 10)
    };

    console.log('새로운 교환권 검색 API 호출:', params);

    // 입력 검증
    const validation = searchVouchersSchema.safeParse(params);
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          message: '검색 조건이 올바르지 않습니다.',
          errors: validation.error.errors
        },
        { status: 400 }
      );
    }

    const searchParams = validation.data;

    // Supabase 사용
    console.log('Supabase 사용 - 새로운 교환권 검색');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    let query = supabase
      .from('vouchers')
      .select(`
        *,
        template:voucher_templates(*),
        recipient:voucher_recipients(*)
      `);

    // 검색 조건 적용
    if (searchParams.template_id) {
      query = query.eq('template_id', searchParams.template_id);
    }
    if (searchParams.serial_no) {
      query = query.ilike('serial_no', `%${searchParams.serial_no}%`);
    }
    if (searchParams.status) {
      query = query.eq('status', searchParams.status);
    }
    if (searchParams.date_from) {
      query = query.gte('issued_at', searchParams.date_from);
    }
    if (searchParams.date_to) {
      query = query.lte('issued_at', searchParams.date_to);
    }

    // 페이징과 정렬
    query = query
      .order('issued_at', { ascending: false })
      .range(searchParams.offset, searchParams.offset + searchParams.limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('Supabase 교환권 검색 오류:', error);
      return NextResponse.json(
        {
          success: false,
          message: '교환권 검색에 실패했습니다.'
        },
        { status: 500 }
      );
    }

    // 수혜자 개인정보 복호화
    const result = data?.map(voucher => {
      let decryptedRecipient = null;
      if (voucher.recipient) {
        try {
          decryptedRecipient = decryptVoucherData({
            encrypted_name: voucher.recipient.encrypted_name,
            encrypted_dob: voucher.recipient.encrypted_dob,
            encrypted_phone: voucher.recipient.encrypted_phone
          });
        } catch (error) {
          console.error('개인정보 복호화 실패:', error);
        }
      }

      return {
        ...voucher,
        recipient: voucher.recipient && decryptedRecipient ? {
          member_id: voucher.recipient.member_id,
          farming_association: voucher.recipient.farming_association,
          name: decryptedRecipient.name,
          dob: decryptedRecipient.dob,
          phone: decryptedRecipient.phone,
          status: voucher.recipient.status
        } : null
      };
    }) || [];

    return NextResponse.json({
      success: true,
      data: result,
      pagination: {
        total: count || 0,
        limit: searchParams.limit,
        offset: searchParams.offset,
        hasMore: searchParams.offset + searchParams.limit < (count || 0)
      }
    });
  } catch (error) {
    console.error('새로운 교환권 검색 오류:', error);
    return NextResponse.json(
      {
        success: false,
        message: '서버 오류가 발생했습니다.'
      },
      { status: 500 }
    );
  }
}

// POST: 성명, ID 통합 검색
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('성명/ID 통합 검색 API 호출:', body);

    // 입력 검증
    const validation = postSearchSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          message: '검색 조건이 올바르지 않습니다.',
          errors: validation.error.errors
        },
        { status: 400 }
      );
    }

    const { search_term, search_type, limit, offset } = validation.data;

    // Supabase 사용
    console.log('Supabase 사용 - 성명/ID 검색');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    let query = supabase
      .from('vouchers')
      .select(`
        *,
        template:voucher_templates(*),
        recipient:voucher_recipients(*)
      `);

    // 검색 조건에 따른 필터링
    if (search_type === 'serial_no') {
      query = query.ilike('serial_no', `%${search_term}%`);
    } else if (search_type === 'member_id' || search_type === 'name_or_id') {
      // 수혜자 테이블에서 회원 ID로 검색
      query = query.filter('recipient.member_id', 'ilike', `%${search_term}%`);
    }
    // 참고: 성명 검색은 암호화된 데이터 때문에 Supabase에서 직접 검색이 어려움
    // 실제 환경에서는 별도의 검색 인덱스나 전체 데이터를 가져와서 클라이언트에서 필터링 필요

    // 페이징과 정렬
    query = query
      .order('issued_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('Supabase 성명/ID 검색 오류:', error);
      return NextResponse.json(
        {
          success: false,
          message: '검색에 실패했습니다.'
        },
        { status: 500 }
      );
    }

    // 수혜자 개인정보 복호화
    const result = data?.map(voucher => {
      let decryptedRecipient = null;
      if (voucher.recipient) {
        try {
          decryptedRecipient = decryptVoucherData({
            encrypted_name: voucher.recipient.encrypted_name,
            encrypted_dob: voucher.recipient.encrypted_dob,
            encrypted_phone: voucher.recipient.encrypted_phone
          });
        } catch (error) {
          console.error('개인정보 복호화 실패:', error);
        }
      }

      return {
        ...voucher,
        recipient: voucher.recipient && decryptedRecipient ? {
          member_id: voucher.recipient.member_id,
          farming_association: voucher.recipient.farming_association,
          name: decryptedRecipient.name,
          dob: decryptedRecipient.dob,
          phone: decryptedRecipient.phone,
          status: voucher.recipient.status
        } : null
      };
    }) || [];

    return NextResponse.json({
      success: true,
      data: result,
      pagination: {
        total: count || 0,
        limit,
        offset,
        hasMore: offset + limit < (count || 0)
      }
    });
  } catch (error) {
    console.error('성명/ID 검색 오류:', error);
    return NextResponse.json(
      {
        success: false,
        message: '서버 오류가 발생했습니다.'
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