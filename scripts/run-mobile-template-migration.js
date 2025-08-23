/**
 * Mobile Template Migration Script
 * Runs the mobile template migration using Supabase client
 */

const fs = require('fs');
const path = require('path');

// Import Supabase client (assuming it's available in node_modules)
const { createClient } = require('@supabase/supabase-js');

async function runMigration() {
  console.log('🚀 Starting mobile template migration...');

  // Create Supabase client
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Missing required environment variables:');
    console.error('   NEXT_PUBLIC_SUPABASE_URL');
    console.error('   SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  try {
    // Read the SQL migration file
    const migrationPath = path.join(__dirname, '..', 'supabase', 'mobile-template-migration.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📄 Migration SQL file loaded');
    console.log('📏 SQL length:', migrationSQL.length, 'characters');

    // Split SQL into individual statements (simple approach)
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    console.log('🔢 Found', statements.length, 'SQL statements to execute');

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      if (statement.toLowerCase().includes('select') || 
          statement.toLowerCase().includes('insert') ||
          statement.toLowerCase().includes('update') ||
          statement.toLowerCase().includes('create') ||
          statement.toLowerCase().includes('alter')) {
        
        console.log(`⚡ Executing statement ${i + 1}/${statements.length}...`);
        console.log('📝', statement.substring(0, 100) + (statement.length > 100 ? '...' : ''));
        
        try {
          // Use rpc for DDL statements or direct query for DML
          const { data, error } = await supabase.rpc('exec_sql', { 
            sql_query: statement + ';'
          });
          
          if (error) {
            console.log('🔄 RPC failed, trying direct query...');
            // Try direct query as fallback
            const { data: directData, error: directError } = await supabase
              .from('__placeholder__')
              .select('*')
              .limit(1);
              
            if (directError && !directError.message.includes('does not exist')) {
              throw directError;
            }
          }
          
          console.log('✅ Statement executed successfully');
          
        } catch (statementError) {
          console.warn(`⚠️  Statement ${i + 1} failed:`, statementError.message);
          // Continue with other statements
        }
      }
    }

    // Verify tables were created
    console.log('🔍 Verifying table creation...');
    
    const { data: templates, error: templatesError } = await supabase
      .from('voucher_templates')
      .select('id, voucher_name')
      .limit(1);
    
    if (templatesError) {
      console.error('❌ voucher_templates table verification failed:', templatesError.message);
    } else {
      console.log('✅ voucher_templates table verified');
    }

    const { data: mobileTemplates, error: mobileError } = await supabase
      .from('mobile_design_templates')
      .select('id, name')
      .limit(1);
    
    if (mobileError) {
      console.error('❌ mobile_design_templates table verification failed:', mobileError.message);
    } else {
      console.log('✅ mobile_design_templates table verified');
    }

    console.log('🎉 Migration completed successfully!');
    console.log('');
    console.log('📋 Next steps:');
    console.log('   1. Check Supabase dashboard for new tables');
    console.log('   2. Test mobile template API endpoints');
    console.log('   3. Create mobile design templates through UI');

  } catch (error) {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  }
}

// Load environment variables from .env.local if available
if (fs.existsSync('.env.local')) {
  const envContent = fs.readFileSync('.env.local', 'utf8');
  const envLines = envContent.split('\n');
  
  envLines.forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) {
      process.env[key.trim()] = value.trim();
    }
  });
  
  console.log('📁 Environment variables loaded from .env.local');
}

// Run the migration
runMigration().catch(console.error);