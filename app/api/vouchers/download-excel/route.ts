import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import * as XLSX from 'xlsx';

/**
 * GET /api/vouchers/download-excel
 * 교환권 전체 목록을 Excel 파일로 다운로드
 *
 * Query Parameters:
 * - template_id: 템플릿 ID 필터 (선택)
 * - status: 상태 필터 (registered, issued, used, cancelled, 선택)
 * - start_date: 시작일 필터 (선택, YYYY-MM-DD)
 * - end_date: 종료일 필터 (선택, YYYY-MM-DD)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { searchParams } = new URL(request.url);

    // 필터 파라미터
    const templateId = searchParams.get('template_id');
    const status = searchParams.get('status');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    // 전체 데이터 개수 먼저 조회
    let countQuery = supabase
      .from('vouchers')
      .select('*', { count: 'exact', head: true });

    // 필터 적용
    if (templateId) {
      countQuery = countQuery.eq('template_id', templateId);
    }

    if (status) {
      countQuery = countQuery.eq('status', status);
    }

    if (startDate) {
      countQuery = countQuery.gte('issued_at', `${startDate}T00:00:00`);
    }

    if (endDate) {
      countQuery = countQuery.lte('issued_at', `${endDate}T23:59:59`);
    }

    const { count, error: countError } = await countQuery;

    if (countError) {
      console.error('교환권 개수 조회 오류:', countError);
      return NextResponse.json(
        {
          success: false,
          message: '교환권 데이터 조회에 실패했습니다.',
        },
        { status: 500 }
      );
    }

    if (!count || count === 0) {
      return NextResponse.json(
        {
          success: false,
          message: '다운로드할 교환권 데이터가 없습니다.',
        },
        { status: 404 }
      );
    }

    // 대용량 데이터 처리: 1000개씩 페이징하여 전체 조회
    const pageSize = 1000;
    const totalPages = Math.ceil(count / pageSize);
    let allVouchers: any[] = [];

    console.log(`전체 ${count}개 교환권 다운로드 시작 (${totalPages} 페이지)`);

    for (let page = 0; page < totalPages; page++) {
      const start = page * pageSize;
      const end = start + pageSize - 1;

      let query = supabase
        .from('vouchers')
        .select('*')
        .order('issued_at', { ascending: false, nullsFirst: false })
        .range(start, end);

      // 필터 적용
      if (templateId) {
        query = query.eq('template_id', templateId);
      }

      if (status) {
        query = query.eq('status', status);
      }

      if (startDate) {
        query = query.gte('issued_at', `${startDate}T00:00:00`);
      }

      if (endDate) {
        query = query.lte('issued_at', `${endDate}T23:59:59`);
      }

      const { data, error } = await query;

      if (error) {
        console.error(`페이지 ${page + 1} 조회 오류:`, error);
        return NextResponse.json(
          {
            success: false,
            message: `교환권 데이터 조회에 실패했습니다. (페이지 ${page + 1}/${totalPages})`,
          },
          { status: 500 }
        );
      }

      if (data && data.length > 0) {
        allVouchers = allVouchers.concat(data);
        console.log(`페이지 ${page + 1}/${totalPages} 완료 (누적: ${allVouchers.length}개)`);
      }
    }

    const vouchers = allVouchers;

    if (!vouchers || vouchers.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: '다운로드할 교환권 데이터가 없습니다.',
        },
        { status: 404 }
      );
    }

    console.log(`총 ${vouchers.length}개 교환권 데이터 조회 완료`);

    // 관련 데이터 별도 조회 (템플릿, 사업장, 발행자)
    const templateIds = [...new Set(vouchers.map(v => v.template_id).filter(id => id))];
    const siteIds = [...new Set(vouchers.map(v => v.site_id).filter(id => id))];
    const issuerIds = [...new Set(vouchers.map(v => v.issued_by).filter(id => id))];

    const [templatesResult, sitesResult, issuersResult] = await Promise.all([
      templateIds.length > 0
        ? supabase.from('voucher_templates').select('id, voucher_name, voucher_type').in('id', templateIds)
        : Promise.resolve({ data: [], error: null }),
      siteIds.length > 0
        ? supabase.from('sites').select('id, site_name').in('id', siteIds)
        : Promise.resolve({ data: [], error: null }),
      issuerIds.length > 0
        ? supabase.from('user_profiles').select('id, name').in('id', issuerIds)
        : Promise.resolve({ data: [], error: null })
    ]);

    // Map으로 변환하여 빠른 조회
    const templateMap = new Map(templatesResult.data?.map(t => [t.id, t]) || []);
    const siteMap = new Map(sitesResult.data?.map(s => [s.id, s]) || []);
    const issuerMap = new Map(issuersResult.data?.map(u => [u.id, u]) || []);

    // Excel 데이터 변환
    const excelData = vouchers.map((voucher: any) => {
      const template = templateMap.get(voucher.template_id);
      const site = siteMap.get(voucher.site_id);
      const issuer = issuerMap.get(voucher.issued_by);

      return {
        '일련번호': voucher.serial_no || '',
        '교환권명': template?.voucher_name || '',
        '교환권종류': template?.voucher_type || '',
        '성명': voucher.name || '',
        '영농회': voucher.association || '',
        '회원번호': voucher.member_id || '',
        '금액': voucher.amount || 0,
        '생년월일': voucher.dob || '',
        '휴대폰': voucher.phone || '',
        '상태': getStatusText(voucher.status),
        '발행일': voucher.issued_at ? formatDateTime(voucher.issued_at) : '',
        '사용일': voucher.used_at ? formatDateTime(voucher.used_at) : '',
        '유효시작일': voucher.valid_from ? formatDate(voucher.valid_from) : '',
        '유효종료일': voucher.valid_until ? formatDate(voucher.valid_until) : '',
        '사업장': site?.site_name || '',
        '발행자': issuer?.name || '',
        '메모': voucher.notes || '',
      };
    });

    // Excel 워크북 생성
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '교환권목록');

    // 컬럼 너비 자동 조정
    const columnWidths = [
      { wch: 18 }, // 일련번호
      { wch: 20 }, // 교환권명
      { wch: 12 }, // 교환권종류
      { wch: 10 }, // 성명
      { wch: 15 }, // 영농회
      { wch: 12 }, // 회원번호
      { wch: 12 }, // 금액
      { wch: 12 }, // 생년월일
      { wch: 15 }, // 휴대폰
      { wch: 10 }, // 상태
      { wch: 18 }, // 발행일
      { wch: 18 }, // 사용일
      { wch: 12 }, // 유효시작일
      { wch: 12 }, // 유효종료일
      { wch: 15 }, // 사업장
      { wch: 10 }, // 발행자
      { wch: 20 }, // 메모
    ];
    worksheet['!cols'] = columnWidths;

    // Excel 파일 버퍼 생성
    const excelBuffer = XLSX.write(workbook, {
      type: 'buffer',
      bookType: 'xlsx',
    });

    // 파일명 생성 (현재 날짜 포함)
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const filename = `교환권목록_${today}.xlsx`;

    // 응답 반환
    return new NextResponse(excelBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
        'Cache-Control': 'no-cache',
      },
    });

  } catch (error) {
    console.error('Excel 다운로드 오류:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Excel 파일 생성 중 오류가 발생했습니다.',
      },
      { status: 500 }
    );
  }
}

// 상태 텍스트 변환
function getStatusText(status: string): string {
  const statusMap: Record<string, string> = {
    registered: '등록됨',
    issued: '발행됨',
    used: '사용됨',
    cancelled: '취소됨',
    recalled: '회수됨',
  };
  return statusMap[status] || status;
}

// 날짜 포맷팅 (YYYY-MM-DD)
function formatDate(dateString: string): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toISOString().split('T')[0];
}

// 날짜시간 포맷팅 (YYYY-MM-DD HH:mm:ss)
function formatDateTime(dateString: string): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toISOString().replace('T', ' ').split('.')[0];
}
