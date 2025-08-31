import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

/**
 * Short URLs 테이블 생성을 위한 임시 설정 API
 * 개발 환경에서만 사용 (한 번만 실행)
 */

export async function POST(request: NextRequest) {
  try {
    console.log('Short URLs 테이블 생성 시작...');

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 테이블 생성 SQL
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS short_urls (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          short_code VARCHAR(10) UNIQUE NOT NULL,
          original_url TEXT NOT NULL,
          created_by_user_id UUID,
          expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
          click_count INTEGER DEFAULT 0 NOT NULL,
          last_clicked_at TIMESTAMP WITH TIME ZONE,
          metadata JSONB DEFAULT '{}' NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
      );
    `;

    // 인덱스 생성 SQL
    const createIndexesSQL = `
      CREATE INDEX IF NOT EXISTS idx_short_urls_short_code ON short_urls(short_code);
      CREATE INDEX IF NOT EXISTS idx_short_urls_expires_at ON short_urls(expires_at);
      CREATE INDEX IF NOT EXISTS idx_short_urls_created_by ON short_urls(created_by_user_id);
      CREATE INDEX IF NOT EXISTS idx_short_urls_created_at ON short_urls(created_at DESC);
    `;

    // updated_at 트리거 함수
    const createTriggerSQL = `
      CREATE OR REPLACE FUNCTION update_short_urls_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS short_urls_updated_at_trigger ON short_urls;
      CREATE TRIGGER short_urls_updated_at_trigger
          BEFORE UPDATE ON short_urls
          FOR EACH ROW
          EXECUTE FUNCTION update_short_urls_updated_at();
    `;

    // RLS 정책 설정
    const setupRLSSQL = `
      ALTER TABLE short_urls ENABLE ROW LEVEL SECURITY;

      DROP POLICY IF EXISTS "Allow service role all access" ON short_urls;
      CREATE POLICY "Allow service role all access" ON short_urls
          FOR ALL USING (true);
    `;

    console.log('1. 테이블 생성 중...');
    const { error: tableError } = await supabase.rpc('exec', { sql: createTableSQL });
    if (tableError) {
      console.error('테이블 생성 오류:', tableError);
      // 테이블이 이미 존재하는 경우는 무시
    }

    console.log('2. 인덱스 생성 중...');
    const { error: indexError } = await supabase.rpc('exec', { sql: createIndexesSQL });
    if (indexError) {
      console.error('인덱스 생성 오류:', indexError);
    }

    console.log('3. 트리거 생성 중...');
    const { error: triggerError } = await supabase.rpc('exec', { sql: createTriggerSQL });
    if (triggerError) {
      console.error('트리거 생성 오류:', triggerError);
    }

    console.log('4. RLS 설정 중...');
    const { error: rlsError } = await supabase.rpc('exec', { sql: setupRLSSQL });
    if (rlsError) {
      console.error('RLS 설정 오류:', rlsError);
    }

    // 테이블 존재 확인
    const { data: tableCheck, error: checkError } = await supabase
      .from('short_urls')
      .select('*')
      .limit(1);

    if (checkError) {
      console.error('테이블 확인 오류:', checkError);
      return NextResponse.json(
        {
          success: false,
          message: '테이블 생성 실패',
          error: checkError.message
        },
        { status: 500 }
      );
    }

    console.log('Short URLs 테이블 생성 완료!');

    return NextResponse.json({
      success: true,
      message: 'Short URLs 테이블이 성공적으로 생성되었습니다.',
      data: {
        table_exists: true,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Setup 오류:', error);
    return NextResponse.json(
      {
        success: false,
        message: '설정 중 오류가 발생했습니다.',
        error: error instanceof Error ? error.message : '알 수 없는 오류'
      },
      { status: 500 }
    );
  }
}