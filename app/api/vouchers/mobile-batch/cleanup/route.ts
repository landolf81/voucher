import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

/**
 * Mobile Voucher Batch Cleanup API
 * 만료된 모바일 교환권 배치를 정리하는 API
 */

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dryRun = searchParams.get('dry_run') === 'true';
    const daysBefore = Number(searchParams.get('days_before')) || 30; // 기본 30일 전 만료된 배치

    // Supabase 클라이언트 생성
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 정리 대상 날짜 계산
    const cleanupDate = new Date();
    cleanupDate.setDate(cleanupDate.getDate() - daysBefore);

    console.log(`만료된 배치 정리 시작 - ${cleanupDate.toISOString()} 이전에 만료된 배치 정리`);

    // 만료된 배치 조회
    const { data: expiredBatches, error: queryError } = await supabase
      .from('mobile_voucher_batches')
      .select(`
        id,
        batch_name,
        status,
        expires_at,
        created_at,
        total_count,
        user_profiles(name)
      `)
      .lte('expires_at', cleanupDate.toISOString())
      .neq('status', 'cleaned'); // 이미 정리된 것은 제외

    if (queryError) {
      console.error('만료된 배치 조회 오류:', queryError);
      return NextResponse.json(
        {
          success: false,
          message: '만료된 배치 조회에 실패했습니다.'
        },
        { status: 500 }
      );
    }

    if (!expiredBatches || expiredBatches.length === 0) {
      return NextResponse.json({
        success: true,
        message: '정리할 만료된 배치가 없습니다.',
        data: {
          cleaned_batches: 0,
          cleaned_vouchers: 0,
          batches: []
        }
      });
    }

    console.log(`정리 대상 배치 수: ${expiredBatches.length}개`);

    let cleanedBatches = 0;
    let cleanedVouchers = 0;
    const cleanupResults = [];

    if (dryRun) {
      // Dry run: 실제 삭제하지 않고 정보만 반환
      for (const batch of expiredBatches) {
        // 관련 교환권 수 조회
        const { count: voucherCount } = await supabase
          .from('mobile_batch_vouchers')
          .select('*', { count: 'exact', head: true })
          .eq('batch_id', batch.id);

        cleanupResults.push({
          batch_id: batch.id,
          batch_name: batch.batch_name,
          expires_at: batch.expires_at,
          status: batch.status,
          total_count: batch.total_count,
          voucher_count: voucherCount || 0,
          user_name: batch.user_profiles?.name || 'Unknown',
          action: 'would_be_cleaned'
        });

        cleanedBatches++;
        cleanedVouchers += voucherCount || 0;
      }

      return NextResponse.json({
        success: true,
        message: `DRY RUN: ${cleanedBatches}개 배치, ${cleanedVouchers}개 교환권이 정리 예정입니다.`,
        data: {
          dry_run: true,
          cleaned_batches: cleanedBatches,
          cleaned_vouchers: cleanedVouchers,
          batches: cleanupResults
        }
      });
    }

    // 실제 정리 작업
    for (const batch of expiredBatches) {
      try {
        // 관련 교환권들의 모바일 링크 토큰 정리
        const { data: batchVouchers, error: voucherQueryError } = await supabase
          .from('mobile_batch_vouchers')
          .select('voucher_id')
          .eq('batch_id', batch.id);

        if (voucherQueryError) {
          console.error(`배치 ${batch.id} 교환권 조회 오류:`, voucherQueryError);
          continue;
        }

        let voucherCount = 0;
        if (batchVouchers && batchVouchers.length > 0) {
          const voucherIds = batchVouchers.map(bv => bv.voucher_id);
          
          // 교환권의 모바일 링크 토큰 제거
          const { error: voucherUpdateError } = await supabase
            .from('vouchers')
            .update({
              mobile_link_token: null,
              link_expires_at: null,
              updated_at: new Date().toISOString()
            })
            .in('id', voucherIds);

          if (voucherUpdateError) {
            console.error(`배치 ${batch.id} 교환권 업데이트 오류:`, voucherUpdateError);
          } else {
            voucherCount = voucherIds.length;
          }

          // 배치-교환권 관계 삭제
          const { error: relationDeleteError } = await supabase
            .from('mobile_batch_vouchers')
            .delete()
            .eq('batch_id', batch.id);

          if (relationDeleteError) {
            console.error(`배치 ${batch.id} 관계 삭제 오류:`, relationDeleteError);
          }
        }

        // 배치 상태를 'cleaned'로 변경 (삭제하지 않고 보관)
        const { error: batchUpdateError } = await supabase
          .from('mobile_voucher_batches')
          .update({
            status: 'cleaned',
            updated_at: new Date().toISOString()
          })
          .eq('id', batch.id);

        if (batchUpdateError) {
          console.error(`배치 ${batch.id} 상태 업데이트 오류:`, batchUpdateError);
          continue;
        }

        cleanupResults.push({
          batch_id: batch.id,
          batch_name: batch.batch_name,
          expires_at: batch.expires_at,
          status: batch.status,
          total_count: batch.total_count,
          voucher_count: voucherCount,
          user_name: batch.user_profiles?.name || 'Unknown',
          action: 'cleaned'
        });

        cleanedBatches++;
        cleanedVouchers += voucherCount;

        console.log(`배치 정리 완료: ${batch.batch_name} (${voucherCount}개 교환권)`);

      } catch (error) {
        console.error(`배치 ${batch.id} 정리 중 오류:`, error);
        cleanupResults.push({
          batch_id: batch.id,
          batch_name: batch.batch_name,
          expires_at: batch.expires_at,
          status: batch.status,
          total_count: batch.total_count,
          voucher_count: 0,
          user_name: batch.user_profiles?.name || 'Unknown',
          action: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // 감사 로그 생성
    await supabase
      .from('audit_logs')
      .insert({
        action: 'mobile_batch_cleanup',
        actor_user_id: null, // 시스템 작업
        details: {
          cleanup_date: cleanupDate.toISOString(),
          days_before: daysBefore,
          cleaned_batches: cleanedBatches,
          cleaned_vouchers: cleanedVouchers,
          results: cleanupResults
        }
      });

    return NextResponse.json({
      success: true,
      message: `${cleanedBatches}개 배치가 정리되었습니다. (${cleanedVouchers}개 교환권 링크 정리)`,
      data: {
        dry_run: false,
        cleanup_date: cleanupDate.toISOString(),
        days_before: daysBefore,
        cleaned_batches: cleanedBatches,
        cleaned_vouchers: cleanedVouchers,
        batches: cleanupResults
      }
    });

  } catch (error) {
    console.error('배치 정리 API 오류:', error);
    return NextResponse.json(
      {
        success: false,
        message: '서버 오류가 발생했습니다.'
      },
      { status: 500 }
    );
  }
}

// GET: 정리 대상 배치 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const daysBefore = Number(searchParams.get('days_before')) || 30;

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const cleanupDate = new Date();
    cleanupDate.setDate(cleanupDate.getDate() - daysBefore);

    // 만료된 배치 통계 조회
    const { data: stats, error: statsError } = await supabase
      .from('mobile_voucher_batches')
      .select(`
        id,
        batch_name,
        status,
        expires_at,
        created_at,
        total_count,
        download_count,
        user_profiles(name)
      `)
      .lte('expires_at', cleanupDate.toISOString())
      .neq('status', 'cleaned')
      .order('expires_at', { ascending: true });

    if (statsError) {
      console.error('만료된 배치 조회 오류:', statsError);
      return NextResponse.json(
        {
          success: false,
          message: '만료된 배치 조회에 실패했습니다.'
        },
        { status: 500 }
      );
    }

    // 각 배치의 교환권 수 조회
    const batchesWithCounts = [];
    for (const batch of stats || []) {
      const { count: voucherCount } = await supabase
        .from('mobile_batch_vouchers')
        .select('*', { count: 'exact', head: true })
        .eq('batch_id', batch.id);

      batchesWithCounts.push({
        ...batch,
        voucher_count: voucherCount || 0
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        cleanup_date: cleanupDate.toISOString(),
        days_before: daysBefore,
        total_batches: batchesWithCounts.length,
        total_vouchers: batchesWithCounts.reduce((sum, batch) => sum + batch.voucher_count, 0),
        batches: batchesWithCounts
      }
    });

  } catch (error) {
    console.error('정리 대상 조회 API 오류:', error);
    return NextResponse.json(
      {
        success: false,
        message: '서버 오류가 발생했습니다.'
      },
      { status: 500 }
    );
  }
}