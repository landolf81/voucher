/**
 * Mobile Batch Vouchers API
 * 배치별 개별 교환권 상세 정보 조회
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { getBaseUrl } from '@/lib/url-utils';

interface PageProps {
  params: { batchId: string }
}

/**
 * GET /api/vouchers/mobile-batch/[batchId]/vouchers
 * 특정 모바일 배치의 모든 교환권과 개별 링크 조회
 */
export async function GET(
  request: NextRequest,
  { params }: PageProps
) {
  try {
    const { batchId } = await params;
    
    console.log('모바일 배치 교환권 조회 시작:', { batchId });

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 배치 정보 확인
    const { data: batch, error: batchError } = await supabase
      .from('mobile_voucher_batches')
      .select(`
        id,
        batch_name,
        user_id,
        template_id,
        design_template_id,
        total_count,
        generated_count,
        status,
        expires_at,
        created_at,
        user_profiles(name),
        voucher_templates(voucher_name, voucher_type)
      `)
      .eq('id', batchId)
      .single();

    if (batchError || !batch) {
      console.error('배치 조회 오류:', batchError);
      return NextResponse.json(
        { error: 'Batch not found' },
        { status: 404 }
      );
    }

    // 배치에 포함된 모든 교환권 조회
    const { data: batchVouchers, error: vouchersError } = await supabase
      .from('mobile_batch_vouchers')
      .select('voucher_id')
      .eq('batch_id', batchId);

    if (vouchersError) {
      console.error('배치 교환권 조회 오류:', vouchersError);
      return NextResponse.json(
        { error: 'Failed to fetch batch vouchers' },
        { status: 500 }
      );
    }

    const voucherIds = batchVouchers.map(bv => bv.voucher_id);

    if (voucherIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          batch: batch,
          vouchers: []
        }
      });
    }

    // 개별 교환권 상세 정보 조회
    const { data: vouchers, error: detailError } = await supabase
      .from('vouchers')
      .select(`
        id,
        serial_no,
        amount,
        association,
        member_id,
        name,
        dob,
        phone,
        status,
        issuance_type,
        mobile_link_token,
        link_expires_at,
        issued_at,
        used_at,
        notes
      `)
      .in('id', voucherIds)
      .order('issued_at', { ascending: false });

    if (detailError) {
      console.error('교환권 상세 조회 오류:', detailError);
      return NextResponse.json(
        { error: 'Failed to fetch voucher details' },
        { status: 500 }
      );
    }

    // 개별 교환권 링크 생성
    const vouchersWithLinks = vouchers.map(voucher => ({
      ...voucher,
      mobile_access_url: voucher.mobile_link_token 
        ? `${getBaseUrl()}/mobile/vouchers/${voucher.mobile_link_token}`
        : null
    }));

    return NextResponse.json({
      success: true,
      data: {
        batch: batch,
        vouchers: vouchersWithLinks
      }
    });

  } catch (error) {
    console.error('모바일 배치 교환권 조회 오류:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}