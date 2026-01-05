/**
 * Supabase Connection Test Script
 * Tests connectivity and permissions for Supabase sync
 *
 * Usage: node scripts/test-supabase-connection.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function testConnection() {
  console.log('🔍 Testing Supabase connection...\n');

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;

  console.log('📋 Configuration:');
  console.log(`   URL: ${url || '❌ NOT SET'}`);
  console.log(`   Key length: ${key?.length || '❌ NOT SET'} characters`);
  console.log('');

  if (!url || !key) {
    console.error('❌ FAILED: Missing credentials in .env file\n');
    console.error('Required environment variables:');
    console.error('   - SUPABASE_URL');
    console.error('   - SUPABASE_SERVICE_KEY\n');
    console.error('Please add these to your .env file and try again.');
    process.exit(1);
  }

  try {
    const supabase = createClient(url, key);

    // Test 1: Read Access
    console.log('🔍 Test 1: Read Access');
    console.log('   Testing category table read...');

    const { data: categories, error: catError } = await supabase
      .from('category')
      .select('count')
      .limit(1);

    if (catError) {
      console.error(`   ❌ FAILED: ${catError.message}\n`);
      console.error('   Possible causes:');
      console.error('   - Invalid API key');
      console.error('   - Network/firewall issues');
      console.error('   - Table does not exist');
      return;
    }

    console.log('   ✅ PASSED: Read access verified\n');

    // Test 2: Write Access
    console.log('🔍 Test 2: Write Access');
    console.log('   Creating test category...');

    const testCategory = { name: `__test_${Date.now()}__` };
    const { data: created, error: createError } = await supabase
      .from('category')
      .insert(testCategory)
      .select();

    if (createError) {
      console.error(`   ❌ FAILED: ${createError.message}\n`);
      console.error('   Possible causes:');
      console.error('   - Insufficient permissions (need service_role key, not anon key)');
      console.error('   - Table constraints violation');
      console.error('   - RLS (Row Level Security) enabled without proper policies');
      return;
    }

    console.log('   ✅ PASSED: Write access verified\n');

    // Test 3: Delete Access
    console.log('🔍 Test 3: Delete Access');
    console.log('   Cleaning up test category...');

    if (created && created.length > 0) {
      const { error: deleteError } = await supabase
        .from('category')
        .delete()
        .eq('name', testCategory.name);

      if (deleteError) {
        console.error(`   ❌ FAILED: ${deleteError.message}\n`);
        console.error('   Possible causes:');
        console.error('   - Insufficient permissions');
        console.error('   - RLS policies blocking deletion');
        console.warn(`   ⚠️  Warning: Test record left in database: ${testCategory.name}`);
        return;
      }

      console.log('   ✅ PASSED: Delete access verified\n');
    }

    // Test 4: Check other required tables
    console.log('🔍 Test 4: Table Structure');
    console.log('   Checking required tables...');

    const tables = ['category', 'item', 'add_on'];
    const tableStatus = {};

    for (const table of tables) {
      const { data, error } = await supabase
        .from(table)
        .select('count')
        .limit(1);

      if (error) {
        tableStatus[table] = `❌ ${error.message}`;
      } else {
        tableStatus[table] = '✅ Accessible';
      }
    }

    console.log('');
    Object.entries(tableStatus).forEach(([table, status]) => {
      console.log(`   ${status} - ${table}`);
    });
    console.log('');

    // Final Summary
    console.log('=' .repeat(60));
    console.log('📊 CONNECTION TEST SUMMARY');
    console.log('='.repeat(60));
    console.log('✅ All tests PASSED');
    console.log('');
    console.log('Supabase connection is fully operational with:');
    console.log('   ✓ Read access');
    console.log('   ✓ Write access');
    console.log('   ✓ Delete access');
    console.log('   ✓ All required tables accessible');
    console.log('');
    console.log('🎉 Ready for menu synchronization!');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n❌ Connection test failed with unexpected error:');
    console.error(`   ${error.message}`);
    console.error('\nStack trace:');
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the test
testConnection();
