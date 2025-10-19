/**
 * Test Supabase Connection
 * Verifies credentials and checks database schema
 */

// Set environment variables for testing
process.env.SUPABASE_URL = 'https://buivobulqaryifxesvqo.supabase.co';
process.env.SUPABASE_SERVICE_KEY = 'sb_secret_0FRubakseT0LQp0iWgWzfw_mZQjFdyZ';

async function testSupabaseConnection() {
  console.log('🔍 Testing Supabase Connection...\n');
  
  try {
    // Import Supabase client
    const { createClient } = require('@supabase/supabase-js');
    
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
    
    console.log('📍 Supabase URL:', supabaseUrl);
    console.log('🔑 Service Key:', supabaseKey.substring(0, 20) + '...\n');
    
    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey);
    console.log('✅ Supabase client created\n');
    
    // Test 1: Check if category table exists
    console.log('Test 1: Checking category table...');
    const { data: categories, error: catError } = await supabase
      .from('category')
      .select('*')
      .limit(5);
    
    if (catError) {
      console.log('❌ Category table error:', catError.message);
      console.log('   Hint: Table might not exist or service key lacks permissions\n');
    } else {
      console.log('✅ Category table accessible');
      console.log(`   Found ${categories.length} categories`);
      if (categories.length > 0) {
        console.log('   Sample:', categories[0]);
      }
      console.log();
    }
    
    // Test 2: Check if item table exists
    console.log('Test 2: Checking item table...');
    const { data: items, error: itemError } = await supabase
      .from('item')
      .select('*')
      .limit(5);
    
    if (itemError) {
      console.log('❌ Item table error:', itemError.message);
      console.log('   Hint: Table might not exist or service key lacks permissions\n');
    } else {
      console.log('✅ Item table accessible');
      console.log(`   Found ${items.length} items`);
      if (items.length > 0) {
        console.log('   Sample:', items[0]);
      }
      console.log();
    }
    
    // Test 3: Check if add_on table exists
    console.log('Test 3: Checking add_on table...');
    const { data: addons, error: addonError } = await supabase
      .from('add_on')
      .select('*')
      .limit(5);
    
    if (addonError) {
      console.log('❌ Add_on table error:', addonError.message);
      console.log('   Hint: Table might not exist or service key lacks permissions\n');
    } else {
      console.log('✅ Add_on table accessible');
      console.log(`   Found ${addons.length} add-ons`);
      if (addons.length > 0) {
        console.log('   Sample:', addons[0]);
      }
      console.log();
    }
    
    // Summary
    console.log('═══════════════════════════════════════');
    console.log('📊 SUMMARY');
    console.log('═══════════════════════════════════════');
    
    const hasErrors = catError || itemError || addonError;
    
    if (!hasErrors) {
      console.log('✅ All credentials and tables are working correctly!');
      console.log('✅ Your Supabase sync is ready to use.');
    } else {
      console.log('⚠️  Some issues detected:');
      if (catError) console.log('   - category table:', catError.message);
      if (itemError) console.log('   - item table:', itemError.message);
      if (addonError) console.log('   - add_on table:', addonError.message);
      console.log('\n💡 Next steps:');
      console.log('   1. Create missing tables in Supabase');
      console.log('   2. Check service key permissions');
      console.log('   3. See SUPABASE_SYNC_ACTIVATION_COMPLETE.md for table schemas');
    }
    
  } catch (error) {
    console.error('❌ Fatal Error:', error.message);
    console.error('\n🔧 Troubleshooting:');
    console.error('   - Check if @supabase/supabase-js is installed');
    console.error('   - Verify credentials are correct');
    console.error('   - Check internet connection');
  }
}

// Run the test
testSupabaseConnection();

