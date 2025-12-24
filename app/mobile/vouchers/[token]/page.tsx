/**
 * Mobile Voucher Batch Access Page
 * Handles token validation, batch display, and voucher downloads
 */

import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { validateVoucherToken } from '@/lib/link-generator';
import MobileVoucherBatchClient from './MobileVoucherBatchClient';
import { MobileVoucherView } from '@/components/mobile/MobileVoucherView';

interface PageProps {
  params: Promise<{
    token: string;
  }>;
}

interface BatchData {
  id: string;
  batch_name: string;
  total_count: number;
  generated_count: number;
  status: string;
  expires_at: string;
  user_id: string;
  template_id: string;
  download_count: number;
  last_accessed_at: string | null;
  voucher_templates: {
    voucher_name: string;
    voucher_type: string;
  };
  user_profiles: {
    name: string;
  };
}

interface VoucherData {
  id: string;
  serial_no: string;
  amount: number;
  association: string;
  name: string;
  member_id: string | null;
  dob: string;
  phone: string | null;
  status: string;
  issued_at: string;
  notes: string | null;
}

export default async function MobileVoucherBatchPage({ params }: PageProps) {
  const { token } = await params;

  // Log token for debugging
  console.log('Accessing mobile voucher with token:', token);
  
  // Skip token format validation for individual vouchers
  // Individual voucher tokens have different format than batch tokens

  // Create Supabase client with service role
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    // First try to fetch individual voucher by mobile_link_token
    const { data: individualVoucher, error: voucherError } = await supabase
      .from('vouchers')
      .select('*')
      .eq('mobile_link_token', token)
      .single();

    console.log('Individual voucher query result:', { 
      found: !!individualVoucher, 
      error: voucherError,
      voucherId: individualVoucher?.id 
    });

    // If found as individual voucher
    if (individualVoucher && !voucherError) {
      // Check if link is expired
      if (individualVoucher.link_expires_at) {
        const now = new Date();
        const expiresAt = new Date(individualVoucher.link_expires_at);
        if (now > expiresAt) {
          return (
            <div style={{ padding: '20px', textAlign: 'center' }}>
              <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '16px' }}>
                링크가 만료되었습니다
              </h1>
              <p style={{ color: '#6b7280' }}>이 교환권 링크는 만료되었습니다.</p>
            </div>
          );
        }
      }

      // Get template info if template_id exists
      let templateInfo = null;
      if (individualVoucher.template_id) {
        const { data: template } = await supabase
          .from('voucher_templates')
          .select('voucher_name, voucher_type')
          .eq('id', individualVoucher.template_id)
          .single();
        templateInfo = template;
      }

      // Return individual voucher view
      return (
        <MobileVoucherView 
          voucher={individualVoucher}
          template={templateInfo || undefined}
        />
      );
    }

    // If not found as individual voucher, try to fetch batch data
    const { data: batch, error: batchError } = await supabase
      .from('mobile_voucher_batches')
      .select(`
        *,
        voucher_templates(voucher_name, voucher_type),
        user_profiles(name)
      `)
      .eq('link_token', token)
      .single();

    if (batchError || !batch) {
      console.error('Voucher or Batch not found:', batchError || voucherError);
      notFound();
    }

    const batchData = batch as BatchData;

    // Check if batch is expired
    const now = new Date();
    const expiresAt = new Date(batchData.expires_at);
    if (now > expiresAt) {
      // Update status to expired if not already
      if (batchData.status !== 'expired') {
        await supabase
          .from('mobile_voucher_batches')
          .update({ 
            status: 'expired',
            updated_at: now.toISOString()
          })
          .eq('id', batchData.id);
      }
      
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full text-center">
            <div className="text-red-500 text-6xl mb-4">⏰</div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">링크가 만료되었습니다</h1>
            <p className="text-gray-600 mb-4">
              이 교환권 링크는 {expiresAt.toLocaleDateString('ko-KR')}에 만료되었습니다.
            </p>
            <p className="text-sm text-gray-500">
              새로운 링크가 필요하시면 관리자에게 문의해주세요.
            </p>
          </div>
        </div>
      );
    }

    // Check batch status
    if (batchData.status === 'failed') {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full text-center">
            <div className="text-red-500 text-6xl mb-4">❌</div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">발행 실패</h1>
            <p className="text-gray-600 mb-4">
              교환권 발행 중 오류가 발생했습니다.
            </p>
            <p className="text-sm text-gray-500">
              관리자에게 문의해주세요.
            </p>
          </div>
        </div>
      );
    }

    // If still generating, show loading state
    if (batchData.status === 'generating' || batchData.status === 'pending') {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full text-center">
            <div className="animate-spin text-blue-500 text-6xl mb-4">⏳</div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">교환권 생성 중...</h1>
            <p className="text-gray-600 mb-4">
              교환권을 생성하고 있습니다. 잠시만 기다려주세요.
            </p>
            <p className="text-sm text-gray-500">
              생성이 완료되면 자동으로 새로고침됩니다.
            </p>
            <script dangerouslySetInnerHTML={{
              __html: `
                setTimeout(() => {
                  window.location.reload();
                }, 3000);
              `
            }} />
          </div>
        </div>
      );
    }

    // Fetch vouchers for this batch
    const { data: vouchers, error: vouchersError } = await supabase
      .from('mobile_batch_vouchers')
      .select(`
        voucher_id,
        vouchers(*)
      `)
      .eq('batch_id', batchData.id);

    if (vouchersError) {
      console.error('Error fetching vouchers:', vouchersError);
      notFound();
    }

    const voucherData: VoucherData[] = vouchers?.map((bv: any) => bv.vouchers) || [];

    // Update last accessed time and download count
    await supabase
      .from('mobile_voucher_batches')
      .update({
        last_accessed_at: now.toISOString(),
        download_count: (batchData.download_count || 0) + 1
      })
      .eq('id', batchData.id);

    // Pass data to client component
    return (
      <MobileVoucherBatchClient 
        batch={batchData}
        vouchers={voucherData}
        token={token}
      />
    );

  } catch (error) {
    console.error('Error loading mobile voucher batch:', error);
    notFound();
  }
}

// Enable dynamic rendering for this page
export const dynamic = 'force-dynamic';
export const revalidate = 0;