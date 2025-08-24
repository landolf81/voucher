import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { generateMobileVoucherLink } from '@/lib/link-generator';
import { z } from 'zod';

// 신규 교환권 데이터 스키마
const newVoucherSchema = z.object({
  name: z.string().min(1, '이름을 입력해주세요.'),
  association: z.string().min(1, '영농회를 입력해주세요.'),
  member_id: z.string().optional(),
  amount: z.number().positive('금액은 양수여야 합니다.'),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '생년월일 형식이 올바르지 않습니다.'),
  phone: z.string().optional()
});

// 모바일 일괄 발행 스키마 (신규 또는 기존)
const mobileBulkIssueSchema = z.object({
  user_id: z.string().uuid('유효하지 않은 사용자 ID입니다.'),
  template_id: z.string().uuid('유효하지 않은 템플릿 ID입니다.'),
  design_template_id: z.string().uuid().optional().nullable(), // 모바일 디자인 템플릿 ID (선택사항)
  batch_name: z.string().min(1, '배치명을 입력해주세요.').max(100, '배치명은 100자 이하여야 합니다.'),
  expires_in_hours: z.number().positive().max(168).optional().default(24), // 최대 7일
  // 신규 데이터 또는 기존 ID 중 하나만 제공
  voucher_data: z.array(newVoucherSchema).min(1).max(1000).optional(),
  existing_voucher_ids: z.array(z.string().uuid()).min(1).max(1000).optional()
}).refine(
  (data) => !!(data.voucher_data || data.existing_voucher_ids),
  {
    message: '신규 교환권 데이터 또는 기존 교환권 ID 중 하나는 필수입니다.',
    path: ['voucher_data']
  }
).refine(
  (data) => !(data.voucher_data && data.existing_voucher_ids),
  {
    message: '신규 교환권 데이터와 기존 교환권 ID를 동시에 제공할 수 없습니다.',
    path: ['existing_voucher_ids']
  }
);

// 일련번호 자동 생성 함수
function generateSerialNumber() {
  const today = new Date();
  const dateStr = today.toISOString().slice(2,10).replace(/-/g,''); // YYMMDD
  const randomNum = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
  const checkDigit = Math.floor(Math.random() * 10);
  return `${dateStr}${randomNum}${checkDigit}`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('모바일 일괄 발행 API 호출:', {
      user_id: body.user_id,
      template_id: body.template_id,
      batch_name: body.batch_name,
      voucher_count: body.voucher_data?.length,
      expires_in_hours: body.expires_in_hours
    });

    // 입력 검증
    const validation = mobileBulkIssueSchema.safeParse(body);
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

    const { user_id, template_id, design_template_id, batch_name, voucher_data, existing_voucher_ids, expires_in_hours } = validation.data;

    // Supabase 클라이언트 생성
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 사용자 권한 확인
    const { data: userProfile, error: userError } = await supabase
      .from('user_profiles')
      .select('id, role, name')
      .eq('id', user_id)
      .single();

    if (userError || !userProfile) {
      console.error('사용자 조회 오류:', userError);
      return NextResponse.json(
        {
          success: false,
          message: '사용자를 찾을 수 없습니다.'
        },
        { status: 404 }
      );
    }

    // 템플릿 확인
    const { data: template, error: templateError } = await supabase
      .from('voucher_templates')
      .select('id, voucher_name, status')
      .eq('id', template_id)
      .single();

    if (templateError || !template) {
      console.error('템플릿 조회 오류:', templateError);
      return NextResponse.json(
        {
          success: false,
          message: '템플릿을 찾을 수 없습니다.'
        },
        { status: 404 }
      );
    }

    if (template.status !== 'active') {
      return NextResponse.json(
        {
          success: false,
          message: '비활성화된 템플릿입니다.'
        },
        { status: 400 }
      );
    }

    // 보안 링크 생성
    const linkData = generateMobileVoucherLink(
      'temp_batch_id', // 실제 batch_id는 아래에서 생성
      user_id,
      { expiresInHours: expires_in_hours }
    );

    // 총 교환권 개수 계산
    const totalCount = voucher_data ? voucher_data.length : existing_voucher_ids!.length;

    // 디자인 템플릿 확인 (선택사항)
    let designTemplate = null;
    if (design_template_id) {
      const { data: designTemplateData, error: designTemplateError } = await supabase
        .from('mobile_design_templates')
        .select('id, name, template_id, status')
        .eq('id', design_template_id)
        .single();

      if (designTemplateError || !designTemplateData) {
        console.warn('디자인 템플릿을 찾을 수 없음, 기본 디자인 사용:', design_template_id);
      } else if (designTemplateData.template_id !== template_id) {
        console.warn('디자인 템플릿이 교환권 템플릿과 연결되지 않음, 기본 디자인 사용');
      } else if (designTemplateData.status !== 'active') {
        console.warn('비활성화된 디자인 템플릿, 기본 디자인 사용');
      } else {
        designTemplate = designTemplateData;
        console.log('디자인 템플릿 적용:', designTemplate.name);
      }
    }

    // 배치 생성
    const { data: batch, error: batchError } = await supabase
      .from('mobile_voucher_batches')
      .insert({
        user_id,
        template_id,
        design_template_id: designTemplate?.id || null, // 검증된 디자인 템플릿 ID만 저장
        batch_name,
        total_count: totalCount,
        link_token: linkData.token,
        expires_at: linkData.expiresAt.toISOString(),
        status: 'generating'
      })
      .select()
      .single();

    if (batchError || !batch) {
      console.error('배치 생성 오류:', batchError);
      return NextResponse.json(
        {
          success: false,
          message: '배치 생성에 실패했습니다.'
        },
        { status: 500 }
      );
    }

    let processedVouchers: any[] = [];
    let voucherSerials: string[] = [];

    if (voucher_data) {
      // 신규 교환권 생성
      const vouchersToInsert = voucher_data.map(voucher => {
        // 각 교환권마다 고유한 링크 토큰 생성
        const voucherLinkData = generateMobileVoucherLink(
          'temp_voucher_id',
          user_id,
          { expiresInHours: expires_in_hours }
        );
        
        return {
          serial_no: generateSerialNumber(),
          amount: voucher.amount,
          association: voucher.association,
          member_id: voucher.member_id || '',
          name: voucher.name,
          dob: voucher.dob,
          phone: voucher.phone || null,
          status: 'issued',
          template_id: template_id,
          issuance_type: 'mobile',
          mobile_link_token: voucherLinkData.token, // 각 교환권마다 고유한 토큰
          link_expires_at: voucherLinkData.expiresAt.toISOString(),
          notes: `모바일 일괄 발행 - ${batch_name}`
        };
      });

      const { data: createdVouchers, error: vouchersError } = await supabase
        .from('vouchers')
        .insert(vouchersToInsert)
        .select('id, serial_no');

      if (vouchersError || !createdVouchers) {
        console.error('교환권 생성 오류:', vouchersError);
        
        // 배치 상태를 실패로 업데이트
        await supabase
          .from('mobile_voucher_batches')
          .update({ 
            status: 'failed', 
            error_message: vouchersError?.message || '교환권 생성 실패',
            updated_at: new Date().toISOString()
          })
          .eq('id', batch.id);

        return NextResponse.json(
          {
            success: false,
            message: '교환권 생성에 실패했습니다.'
          },
          { status: 500 }
        );
      }

      processedVouchers = createdVouchers;
      voucherSerials = createdVouchers.map(v => v.serial_no);

    } else if (existing_voucher_ids) {
      // 기존 교환권 업데이트 (등록된 교환권과 발행된 교환권 모두 포함 - 재발행 허용)
      const { data: existingVouchers, error: fetchError } = await supabase
        .from('vouchers')
        .select('id, serial_no, status')
        .in('id', existing_voucher_ids)
        .eq('template_id', template_id)
        .in('status', ['registered', 'issued']);

      if (fetchError || !existingVouchers) {
        console.error('기존 교환권 조회 오류:', fetchError);
        
        // 배치 상태를 실패로 업데이트
        await supabase
          .from('mobile_voucher_batches')
          .update({ 
            status: 'failed', 
            error_message: fetchError?.message || '기존 교환권 조회 실패',
            updated_at: new Date().toISOString()
          })
          .eq('id', batch.id);

        return NextResponse.json(
          {
            success: false,
            message: '기존 교환권 조회에 실패했습니다.'
          },
          { status: 500 }
        );
      }

      if (existingVouchers.length !== existing_voucher_ids.length) {
        console.error('일부 교환권을 찾을 수 없거나 이미 발행된 상태입니다.');
        
        // 배치 상태를 실패로 업데이트
        await supabase
          .from('mobile_voucher_batches')
          .update({ 
            status: 'failed', 
            error_message: '일부 교환권을 찾을 수 없거나 이미 발행된 상태입니다.',
            updated_at: new Date().toISOString()
          })
          .eq('id', batch.id);

        return NextResponse.json(
          {
            success: false,
            message: '일부 교환권을 찾을 수 없거나 이미 발행된 상태입니다.'
          },
          { status: 400 }
        );
      }

      // 기존 교환권 업데이트 (각각 개별적으로)
      const updatedVouchers = [];
      for (const voucherId of existing_voucher_ids) {
        // 각 교환권마다 고유한 링크 토큰 생성
        const voucherLinkData = generateMobileVoucherLink(
          voucherId,
          user_id,
          { expiresInHours: expires_in_hours }
        );

        // 기존 교환권의 상태를 확인해서 적절히 업데이트
        const currentVoucher = existingVouchers.find(v => v.id === voucherId);
        const updateData: any = {
          issuance_type: 'mobile',
          mobile_link_token: voucherLinkData.token, // 고유한 토큰
          link_expires_at: voucherLinkData.expiresAt.toISOString(),
          notes: `모바일 일괄 발행 - ${batch_name}`
        };

        // 아직 등록상태인 교환권만 발행상태로 변경하고 발행일자 설정
        if (currentVoucher?.status === 'registered') {
          updateData.status = 'issued';
          updateData.issued_at = new Date().toISOString();
        }
        // 이미 발행된 교환권은 모바일 링크 정보만 갱신 (재발행)

        const { data: updatedVoucher, error: updateError } = await supabase
          .from('vouchers')
          .update(updateData)
          .eq('id', voucherId)
          .select('id, serial_no')
          .single();

        if (updateError || !updatedVoucher) {
          console.error('기존 교환권 업데이트 오류:', updateError);
          
          // 배치 상태를 실패로 업데이트
          await supabase
            .from('mobile_voucher_batches')
            .update({ 
              status: 'failed', 
              error_message: updateError?.message || '교환권 업데이트 실패',
              updated_at: new Date().toISOString()
            })
            .eq('id', batch.id);

          return NextResponse.json(
            {
              success: false,
              message: '기존 교환권 업데이트에 실패했습니다.'
            },
            { status: 500 }
          );
        }

        updatedVouchers.push(updatedVoucher);
      }

      processedVouchers = updatedVouchers;
      voucherSerials = updatedVouchers.map(v => v.serial_no);
    }

    // 배치-교환권 관계 생성
    const batchVoucherRelations = processedVouchers.map(voucher => ({
      batch_id: batch.id,
      voucher_id: voucher.id
    }));

    const { error: relationError } = await supabase
      .from('mobile_batch_vouchers')
      .insert(batchVoucherRelations);

    if (relationError) {
      console.error('배치-교환권 관계 생성 오류:', relationError);
      // 관계 생성 실패는 경고만 하고 진행
    }

    // 배치 상태를 완료로 업데이트
    const { error: updateError } = await supabase
      .from('mobile_voucher_batches')
      .update({ 
        status: 'completed',
        generated_count: processedVouchers.length,
        updated_at: new Date().toISOString()
      })
      .eq('id', batch.id);

    if (updateError) {
      console.error('배치 상태 업데이트 오류:', updateError);
      // 상태 업데이트 실패는 경고만 하고 진행
    }

    // 감사 로그 생성
    const auditAction = voucher_data ? 'mobile_bulk_issue_new' : 'mobile_bulk_issue_existing';
    await supabase
      .from('audit_logs')
      .insert({
        action: auditAction,
        actor_user_id: user_id,
        details: {
          batch_id: batch.id,
          batch_name,
          template_id,
          template_name: template.voucher_name,
          voucher_count: processedVouchers.length,
          link_token: linkData.token,
          expires_at: linkData.expiresAt.toISOString(),
          source_type: voucher_data ? 'new_data' : 'existing_vouchers',
          existing_voucher_ids: existing_voucher_ids || undefined
        }
      });

    // 성공 응답
    const successMessage = voucher_data 
      ? `${processedVouchers.length}개의 모바일 교환권이 발행되었습니다.`
      : `기존 ${processedVouchers.length}개의 교환권이 모바일로 발행/재발행되었습니다.`;

    return NextResponse.json({
      success: true,
      message: successMessage,
      data: {
        batch_id: batch.id,
        link_token: linkData.token,
        access_url: linkData.url,
        total_count: processedVouchers.length,
        expires_at: linkData.expiresAt.toISOString(),
        voucher_serials: voucherSerials,
        source_type: voucher_data ? 'new_data' : 'existing_vouchers'
      }
    });

  } catch (error) {
    console.error('모바일 일괄 발행 API 오류:', error);
    return NextResponse.json(
      {
        success: false,
        message: '서버 오류가 발생했습니다.'
      },
      { status: 500 }
    );
  }
}

// GET: 배치 상태 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');
    const batchId = searchParams.get('batch_id');

    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          message: '사용자 ID가 필요합니다.'
        },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    let query = supabase
      .from('mobile_voucher_batches')
      .select(`
        *,
        voucher_templates(voucher_name, voucher_type),
        user_profiles(name)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (batchId) {
      query = query.eq('id', batchId);
    }

    const { data: batches, error } = await query;

    if (error) {
      console.error('배치 조회 오류:', error);
      return NextResponse.json(
        {
          success: false,
          message: '배치 조회에 실패했습니다.'
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: batches || []
    });

  } catch (error) {
    console.error('배치 조회 API 오류:', error);
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