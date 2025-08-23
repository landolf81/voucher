import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { z } from 'zod';

// 일괄 사용 정보 수정 스키마
const bulkUpdateUsageSchema = z.object({
  voucher_ids: z.array(z.string()).min(1, '최소 1개의 교환권을 선택해주세요.'),
  usage_location: z.string().nullable().optional(),
  used_at: z.string().nullable().optional(),
  user_id: z.string().optional()
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('일괄 사용 정보 수정 API 호출:', {
      voucher_count: body.voucher_ids?.length,
      usage_location: body.usage_location,
      used_at: body.used_at,
      user_id: body.user_id
    });

    // 입력 검증
    const validation = bulkUpdateUsageSchema.safeParse(body);
    if (!validation.success) {
      console.error('입력 검증 실패:', validation.error.errors);
      return NextResponse.json(
        {
          success: false,
          message: '입력 정보가 올바르지 않습니다.',
          errors: validation.error.errors
        },
        { status: 400 }
      );
    }

    const { voucher_ids, usage_location, used_at, user_id } = validation.data;

    // 최소 하나의 변경사항이 있는지 확인
    if (!usage_location && !used_at) {
      return NextResponse.json(
        {
          success: false,
          message: '변경할 정보를 입력해주세요.'
        },
        { status: 400 }
      );
    }

    // Supabase 클라이언트 생성
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 권한 확인 - user_id로 관리자 권한 확인
    if (user_id) {
      const { data: userProfile, error: userError } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user_id)
        .single();

      if (userError || !userProfile || userProfile.role !== 'admin') {
        console.error('권한 확인 실패:', userError);
        return NextResponse.json(
          {
            success: false,
            message: '관리자 권한이 필요합니다.'
          },
          { status: 403 }
        );
      }
    }

    // 기존 데이터 조회 (변경 전 값 기록용)
    const { data: existingVouchers, error: fetchError } = await supabase
      .from('vouchers')
      .select('id, serial_no, used_at, used_at_site_id, usage_site:used_at_site_id(site_name)')
      .in('id', voucher_ids);

    if (fetchError) {
      console.error('기존 데이터 조회 오류:', fetchError);
      return NextResponse.json(
        {
          success: false,
          message: '데이터 조회 중 오류가 발생했습니다.'
        },
        { status: 500 }
      );
    }

    // 사용처 이름으로 site_id 찾기
    let site_id = null;
    if (usage_location) {
      const { data: site, error: siteError } = await supabase
        .from('sites')
        .select('id')
        .eq('site_name', usage_location)
        .single();

      if (siteError || !site) {
        console.error('사용처 조회 오류:', siteError);
        return NextResponse.json(
          {
            success: false,
            message: '사용처를 찾을 수 없습니다.'
          },
          { status: 400 }
        );
      }
      site_id = site.id;
    }

    // 업데이트할 데이터 준비
    const updateData: any = {};
    if (site_id) {
      updateData.used_at_site_id = site_id;
    }
    if (used_at) {
      updateData.used_at = new Date(used_at).toISOString();
      // 사용일이 설정되면 상태를 'used'로 변경
      updateData.status = 'used';
    }

    // 트랜잭션으로 일괄 업데이트
    const updatePromises = [];
    const auditLogPromises = [];

    for (const voucherId of voucher_ids) {
      // 교환권 업데이트
      updatePromises.push(
        supabase
          .from('vouchers')
          .update(updateData)
          .eq('id', voucherId)
      );

      // 감사 로그 생성
      const existingVoucher = existingVouchers?.find(v => v.id === voucherId);
      const changes: any = {};
      
      if (site_id && existingVoucher?.used_at_site_id !== site_id) {
        changes.old_site_id = existingVoucher?.used_at_site_id;
        changes.new_site_id = site_id;
        changes.old_site_name = (existingVoucher?.usage_site as any)?.site_name || null;
        changes.new_site_name = usage_location;
      }
      
      if (used_at && existingVoucher?.used_at !== used_at) {
        changes.old_used_at = existingVoucher?.used_at;
        changes.new_used_at = used_at;
      }

      auditLogPromises.push(
        supabase
          .from('audit_logs')
          .insert({
            voucher_id: voucherId,
            action: 'bulk_usage_update',
            actor_user_id: user_id || null,
            site_id: site_id || existingVoucher?.used_at_site_id,
            details: {
              changes,
              serial_no: existingVoucher?.serial_no,
              bulk_update: true,
              total_updated: voucher_ids.length
            }
          })
      );
    }

    // 모든 업데이트 실행
    const updateResults = await Promise.all(updatePromises);
    const updateErrors = updateResults.filter(r => r.error);

    if (updateErrors.length > 0) {
      console.error('업데이트 오류:', updateErrors);
      return NextResponse.json(
        {
          success: false,
          message: '일부 교환권 업데이트에 실패했습니다.',
          failed_count: updateErrors.length
        },
        { status: 500 }
      );
    }

    // 감사 로그 저장
    const auditResults = await Promise.all(auditLogPromises);
    const auditErrors = auditResults.filter(r => r.error);

    if (auditErrors.length > 0) {
      console.error('감사 로그 오류:', auditErrors);
      // 감사 로그 실패는 경고만 하고 진행
    }

    const successCount = voucher_ids.length - updateErrors.length;

    return NextResponse.json({
      success: true,
      message: `${successCount}개의 교환권이 수정되었습니다.`,
      updated_count: successCount,
      details: {
        total: voucher_ids.length,
        success: successCount,
        failed: updateErrors.length
      }
    });

  } catch (error) {
    console.error('일괄 사용 정보 수정 API 오류:', error);
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
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}