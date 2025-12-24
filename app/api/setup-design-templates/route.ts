import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    console.log('Setting up design templates table...');

    // Create the table
    const { error: tableError } = await supabase.rpc('exec_sql', {
      sql: `
        -- 교환권 디자인 템플릿 테이블 생성
        CREATE TABLE IF NOT EXISTS voucher_design_templates (
          id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
          name text NOT NULL,
          description text,
          
          -- A4 이미지 (PDF 프린트용)
          a4_image_url text NOT NULL,
          a4_image_width numeric DEFAULT 210,
          a4_image_height numeric DEFAULT 297,
          
          -- 모바일 정사각형 이미지
          mobile_image_url text NOT NULL,
          mobile_image_size numeric DEFAULT 400,
          
          -- 필드 배치 설정 (JSON)
          a4_field_positions jsonb NOT NULL DEFAULT '{}',
          mobile_field_positions jsonb NOT NULL DEFAULT '{}',
          
          -- 기본 스타일 설정
          default_font_family text DEFAULT 'Pretendard',
          default_font_size numeric DEFAULT 12,
          default_text_color text DEFAULT '#000000',
          
          -- 메타데이터
          is_active boolean DEFAULT true,
          created_at timestamptz DEFAULT now(),
          updated_at timestamptz DEFAULT now(),
          created_by uuid,
          updated_by uuid
        );
      `
    });

    if (tableError) {
      console.error('Table creation error:', tableError);
      // Try using direct SQL execution instead
      const { error: directError } = await supabase
        .from('voucher_design_templates')
        .select('id')
        .limit(1);
      
      if (directError && directError.code !== 'PGRST116') {
        console.log('Creating table with direct SQL...');
        
        // Let's try using a different approach - raw SQL execution
        const createTableSQL = `
          CREATE TABLE IF NOT EXISTS voucher_design_templates (
            id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
            name text NOT NULL,
            description text,
            a4_image_url text NOT NULL,
            a4_image_width numeric DEFAULT 210,
            a4_image_height numeric DEFAULT 297,
            mobile_image_url text NOT NULL,
            mobile_image_size numeric DEFAULT 400,
            a4_field_positions jsonb NOT NULL DEFAULT '{}',
            mobile_field_positions jsonb NOT NULL DEFAULT '{}',
            default_font_family text DEFAULT 'Pretendard',
            default_font_size numeric DEFAULT 12,
            default_text_color text DEFAULT '#000000',
            is_active boolean DEFAULT true,
            created_at timestamptz DEFAULT now(),
            updated_at timestamptz DEFAULT now(),
            created_by uuid,
            updated_by uuid
          );
        `;
        
        return NextResponse.json({
          success: false,
          message: 'Table creation failed. Please run this SQL manually in Supabase dashboard:',
          sql: createTableSQL,
          error: tableError
        }, { status: 500 });
      }
    }

    // Create indexes
    try {
      await supabase.rpc('exec_sql', {
        sql: `
          CREATE INDEX IF NOT EXISTS idx_voucher_design_templates_active ON voucher_design_templates(is_active);
          CREATE INDEX IF NOT EXISTS idx_voucher_design_templates_created_at ON voucher_design_templates(created_at);
        `
      });
    } catch (indexError) {
      console.log('Index creation may have failed, but continuing...', indexError);
    }

    // Enable RLS and create policies
    try {
      await supabase.rpc('exec_sql', {
        sql: `
          ALTER TABLE voucher_design_templates ENABLE ROW LEVEL SECURITY;
          
          DROP POLICY IF EXISTS "voucher_design_templates_read_policy" ON voucher_design_templates;
          CREATE POLICY "voucher_design_templates_read_policy" ON voucher_design_templates
            FOR SELECT USING (true);
          
          DROP POLICY IF EXISTS "voucher_design_templates_write_policy" ON voucher_design_templates;
          CREATE POLICY "voucher_design_templates_write_policy" ON voucher_design_templates
            FOR ALL USING (true);
        `
      });
    } catch (policyError) {
      console.log('Policy creation may have failed, but continuing...', policyError);
    }

    // Test table access
    const { data: testData, error: testError } = await supabase
      .from('voucher_design_templates')
      .select('id')
      .limit(1);

    if (testError) {
      console.error('Table test failed:', testError);
      return NextResponse.json({
        success: false,
        message: 'Table setup completed but access test failed',
        error: testError
      }, { status: 500 });
    }

    console.log('Design templates table setup completed successfully');

    return NextResponse.json({
      success: true,
      message: 'Design templates table setup completed successfully',
      data: { testResult: testData }
    });

  } catch (error) {
    console.error('Setup error:', error);
    return NextResponse.json({
      success: false,
      message: 'Setup failed',
      error: error
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  // Check if table exists
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data, error } = await supabase
      .from('voucher_design_templates')
      .select('id')
      .limit(1);

    if (error) {
      return NextResponse.json({
        success: false,
        tableExists: false,
        message: 'Table does not exist or is not accessible',
        error: error
      });
    }

    return NextResponse.json({
      success: true,
      tableExists: true,
      message: 'Table exists and is accessible'
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      tableExists: false,
      message: 'Error checking table',
      error: error
    }, { status: 500 });
  }
}