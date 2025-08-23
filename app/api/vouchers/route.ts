import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { encryptVoucherData, decryptVoucherData } from '@/lib/encryption';
import { withJWTVerification } from '@/lib/jwt';
import { z } from 'zod';

// 교환권 등록 스키마 (vouchers 테이블 기준)
const voucherCreateSchema = z.object({
  template_id: z.string().optional(),
  serial_no: z.string().optional(),
  amount: z.number().positive().int(),
  association: z.string().min(1).max(100),
  member_id: z.string().min(1).max(50),
  name: z.string().min(1).max(50),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '생년월일 형식이 올바르지 않습니다.'),
  phone: z.string().optional(),
  notes: z.string().optional().default('')
});

// 교환권 조회 스키마
const voucherSearchSchema = z.object({
  serial_no: z.string().optional(),
  association: z.string().optional(),
  member_id: z.string().optional(),
  name: z.string().optional(),
  status: z.enum(['registered', 'issued', 'used', 'recalled', 'disposed']).optional(),
  page: z.number().int().positive().optional().default(1),
  limit: z.number().int().positive().max(100).optional().default(20)
});

// 일련번호 자동 생성 함수
function generateSerialNumber() {
  const today = new Date();
  const dateStr = today.toISOString().slice(2,10).replace(/-/g,''); // YYMMDD
  const randomNum = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
  const checkDigit = Math.floor(Math.random() * 10);
  return `${dateStr}${randomNum}${checkDigit}`;
}

// 교환권 등록 API
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('교환권 등록 API 호출:', body);

    // 입력 검증
    const validation = voucherCreateSchema.safeParse({
      ...body,
      amount: typeof body.amount === 'string' ? parseInt(body.amount, 10) : body.amount
    });
    
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          message: '입력 정보가 올바르지 않습니다.',
          errors: validation.error.errors
        },
        { status: 400 }
      );
    }

    const { template_id, serial_no, amount, association, member_id, name, dob, phone, notes } = validation.data;
    
    // 일련번호가 없으면 자동 생성
    const finalSerialNo = serial_no || generateSerialNumber();

    // Supabase 사용
    console.log('Supabase 사용 - 교환권 등록');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 일련번호 중복 확인
    const { data: existingVoucher } = await supabase
      .from('vouchers')
      .select('id')
      .eq('serial_no', finalSerialNo)
      .maybeSingle();

    if (existingVoucher) {
      return NextResponse.json(
        {
          success: false,
          message: '이미 등록된 일련번호입니다.'
        },
        { status: 409 }
      );
    }

    // vouchers 테이블에 삽입할 데이터
    const voucherData = {
      serial_no: finalSerialNo,
      amount,
      association,
      member_id,
      name,
      dob,
      phone: phone || null,
      status: 'registered', // 새로운 상태 체계: 등록부터 시작
      notes: notes || null
    };

    const { data: newVoucher, error } = await supabase
      .from('vouchers')
      .insert([voucherData])
      .select()
      .single();

    if (error) {
      console.error('Supabase 교환권 등록 오류:', error);
      return NextResponse.json(
        {
          success: false,
          message: '교환권 등록에 실패했습니다.'
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '교환권이 성공적으로 등록되었습니다.',
      data: newVoucher
    });
  } catch (error) {
    console.error('교환권 등록 API 오류:', error);
    return NextResponse.json(
      {
        success: false,
        message: '서버 오류가 발생했습니다.'
      },
      { status: 500 }
    );
  }
}

// 교환권 조회 API
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const templateId = searchParams.get('template_id');
    const serialNo = searchParams.get('serial_no');
    const name = searchParams.get('name');
    const association = searchParams.get('association');
    const memberId = searchParams.get('member_id');
    const status = searchParams.get('status');
    const issuedDateFrom = searchParams.get('issued_date_from');
    const issuedDateTo = searchParams.get('issued_date_to');
    const usedDateFrom = searchParams.get('used_date_from');
    const usedDateTo = searchParams.get('used_date_to');
    const usageLocation = searchParams.get('usage_location');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    console.log('교환권 조회 API 호출:', { 
      templateId, serialNo, name, association, memberId, status, 
      issuedDateFrom, issuedDateTo, usedDateFrom, usedDateTo, usageLocation,
      page, limit 
    });

    // Supabase 사용
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 총 개수 조회를 위한 쿼리
    let countQuery = supabase
      .from('vouchers')
      .select('*', { count: 'exact', head: true });

    // 데이터 조회를 위한 쿼리 (보고서용 정렬: 사용처 → 사용일 → 성명)
    let dataQuery = supabase
      .from('vouchers')
      .select(`
        *,
        usage_site:used_at_site_id (
          site_name
        )
      `);

    // 필터 적용 (양쪽 쿼리에 동일하게)
    if (templateId) {
      countQuery = countQuery.eq('template_id', templateId);
      dataQuery = dataQuery.eq('template_id', templateId);
    }
    if (serialNo) {
      countQuery = countQuery.ilike('serial_no', `%${serialNo}%`);
      dataQuery = dataQuery.ilike('serial_no', `%${serialNo}%`);
    }
    if (name) {
      countQuery = countQuery.ilike('name', `%${name}%`);
      dataQuery = dataQuery.ilike('name', `%${name}%`);
    }
    if (association) {
      countQuery = countQuery.ilike('association', `%${association}%`);
      dataQuery = dataQuery.ilike('association', `%${association}%`);
    }
    if (memberId) {
      countQuery = countQuery.ilike('member_id', `%${memberId}%`);
      dataQuery = dataQuery.ilike('member_id', `%${memberId}%`);
    }
    if (status) {
      // 'issuable' 특별 처리 - registered 또는 issued 상태
      if (status === 'issuable') {
        countQuery = countQuery.in('status', ['registered', 'issued']);
        dataQuery = dataQuery.in('status', ['registered', 'issued']);
      } else {
        countQuery = countQuery.eq('status', status);
        dataQuery = dataQuery.eq('status', status);
      }
    }
    
    // 날짜 필터 적용
    if (issuedDateFrom) {
      countQuery = countQuery.gte('issued_at', `${issuedDateFrom}T00:00:00Z`);
      dataQuery = dataQuery.gte('issued_at', `${issuedDateFrom}T00:00:00Z`);
    }
    if (issuedDateTo) {
      countQuery = countQuery.lte('issued_at', `${issuedDateTo}T23:59:59Z`);
      dataQuery = dataQuery.lte('issued_at', `${issuedDateTo}T23:59:59Z`);
    }
    if (usedDateFrom) {
      countQuery = countQuery.gte('used_at', `${usedDateFrom}T00:00:00Z`);
      dataQuery = dataQuery.gte('used_at', `${usedDateFrom}T00:00:00Z`);
    }
    if (usedDateTo) {
      countQuery = countQuery.lte('used_at', `${usedDateTo}T23:59:59Z`);
      dataQuery = dataQuery.lte('used_at', `${usedDateTo}T23:59:59Z`);
    }
    
    // 사용처 필터 적용 (sites 테이블과 조인하여 site_name으로 필터링)
    if (usageLocation) {
      // 먼저 해당 site_name을 가진 site의 ID를 조회해야 함
      const { data: siteData } = await supabase
        .from('sites')
        .select('id')
        .eq('site_name', usageLocation)
        .single();
      
      if (siteData) {
        countQuery = countQuery.eq('used_at_site_id', siteData.id);
        dataQuery = dataQuery.eq('used_at_site_id', siteData.id);
      }
    }

    // 페이징 적용
    const offset = (page - 1) * limit;
    const maxLimit = Math.min(limit, 50000); // 보고서용 대용량 한도
    dataQuery = dataQuery.range(offset, offset + maxLimit - 1);

    // 병렬로 실행
    const [{ count }, { data: vouchers, error }] = await Promise.all([
      countQuery,
      dataQuery
    ]);

    if (error) {
      console.error('Supabase 교환권 조회 오류:', error);
      return NextResponse.json(
        {
          success: false,
          message: '교환권 조회에 실패했습니다.'
        },
        { status: 500 }
      );
    }

    // 템플릿 정보 조회 및 사용처 정보 조회하여 vouchers와 합치기
    let vouchersWithTemplates = vouchers || [];
    
    if (vouchersWithTemplates.length > 0) {
      // 템플릿 ID들 추출 (중복 제거)
      const templateIds = [...new Set(
        vouchersWithTemplates
          .map(v => v.template_id)
          .filter(id => id != null)
      )];

      // 사용처 site ID들 추출 (중복 제거)
      const siteIds = [...new Set(
        vouchersWithTemplates
          .map(v => v.used_at_site_id)
          .filter(id => id != null)
      )];

      // 템플릿 정보와 사용처 정보를 병렬로 조회
      const [templatesResult, sitesResult] = await Promise.all([
        templateIds.length > 0 ? supabase
          .from('voucher_templates')
          .select('id, voucher_name, voucher_type')
          .in('id', templateIds) : Promise.resolve({ data: [], error: null }),
        siteIds.length > 0 ? supabase
          .from('sites')
          .select('id, site_name')
          .in('id', siteIds) : Promise.resolve({ data: [], error: null })
      ]);

      const { data: templates, error: templatesError } = templatesResult;
      const { data: sites, error: sitesError } = sitesResult;

      if (!templatesError && !sitesError) {
        // templates와 sites를 Map으로 변환하여 빠른 조회 가능하도록
        const templateMap = new Map(templates?.map(t => [t.id, t]) || []);
        const siteMap = new Map(sites?.map(s => [s.id, s.site_name]) || []);
        
        // vouchers에 템플릿 정보와 사용처 정보 추가
        vouchersWithTemplates = vouchersWithTemplates.map(voucher => ({
          ...voucher,
          voucher_templates: voucher.template_id ? templateMap.get(voucher.template_id) || null : null,
          usage_location: voucher.used_at_site_id ? siteMap.get(voucher.used_at_site_id) || null : null
        }));

        // 정렬: 사용처 → 사용일(날짜만) → 성명 순
        vouchersWithTemplates.sort((a, b) => {
          // 1. 사용처 기준 정렬 (nulls last)
          const aUsageSite = a.usage_site?.site_name || '';
          const bUsageSite = b.usage_site?.site_name || '';
          if (aUsageSite !== bUsageSite) {
            if (!aUsageSite) return 1; // null을 마지막으로
            if (!bUsageSite) return -1;
            return aUsageSite.localeCompare(bUsageSite);
          }

          // 2. 사용일 기준 정렬 (날짜만, nulls last)
          const aUsedDate = a.used_at ? new Date(a.used_at) : null;
          const bUsedDate = b.used_at ? new Date(b.used_at) : null;
          if ((aUsedDate === null) !== (bUsedDate === null)) {
            if (!aUsedDate) return 1; // null을 마지막으로
            if (!bUsedDate) return -1;
          }
          if (aUsedDate && bUsedDate) {
            // 날짜만 비교 (시간 제외)
            const aDateOnly = new Date(aUsedDate.getFullYear(), aUsedDate.getMonth(), aUsedDate.getDate());
            const bDateOnly = new Date(bUsedDate.getFullYear(), bUsedDate.getMonth(), bUsedDate.getDate());
            const dateDiff = aDateOnly.getTime() - bDateOnly.getTime();
            if (dateDiff !== 0) return dateDiff;
          }

          // 3. 성명 기준 정렬
          return a.name.localeCompare(b.name);
        });
      }
    }

    const totalPages = Math.ceil((count || 0) / limit);

    return NextResponse.json({
      success: true,
      data: vouchersWithTemplates,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('교환권 조회 API 오류:', error);
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
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}