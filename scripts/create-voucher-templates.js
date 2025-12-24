// Supabase에서 voucher_templates 테이블을 생성하는 스크립트
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('환경변수 NEXT_PUBLIC_SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createVoucherTemplatesTable() {
  try {
    // SQL 파일 읽기
    const sqlPath = join(process.cwd(), 'supabase', 'create-voucher-templates-table.sql');
    const sql = readFileSync(sqlPath, 'utf-8');
    
    console.log('voucher_templates 테이블 생성 중...');
    
    // SQL 실행 (여러 문장으로 나누어 실행)
    const statements = sql.split(';').filter(stmt => stmt.trim().length > 0);
    
    for (const statement of statements) {
      if (statement.trim()) {
        const { error } = await supabase.rpc('exec_sql', { sql: statement.trim() + ';' });
        if (error) {
          console.error('SQL 실행 오류:', statement.substring(0, 100) + '...', error);
        } else {
          console.log('SQL 실행 성공:', statement.substring(0, 50) + '...');
        }
      }
    }
    
    console.log('voucher_templates 테이블 생성 완료');
    
  } catch (error) {
    console.error('테이블 생성 실패:', error);
  }
}

createVoucherTemplatesTable();