#!/usr/bin/env node
/**
 * Supabase Connection Test Script
 * Run this script to verify your Supabase credentials are correct
 * Usage: node test-supabase.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY;

console.log('='.repeat(60));
console.log('SUPABASE CONNECTION TEST');
console.log('='.repeat(60));
console.log();

// Check if credentials are set
if (!url || !key) {
  console.error('❌ ERROR: Missing Supabase credentials in .env file');
  console.log();
  console.log('Please set the following in your .env file:');
  console.log('  SUPABASE_URL=https://your-project.supabase.co');
  console.log('  SUPABASE_SERVICE_KEY=eyJ...');
  console.log();
  console.log('Get your credentials from:');
  console.log('  https://supabase.com/dashboard/project/buivobulqaryifxesvqo/settings/api');
  process.exit(1);
}

console.log('✓ Credentials found in .env file');
console.log(`  URL: ${url}`);
console.log(`  Key length: ${key.length} characters`);
console.log(`  Key preview: ${key.substring(0, 30)}...`);
console.log();

// Create Supabase client
const supabase = createClient(url, key);

// Test connection by querying the correct table names
console.log('Testing connection...');

async function testConnection() {
  // Test category table
  const categoryResult = await supabase.from('category').select('*').limit(5);

  if (categoryResult.error) {
    console.error('❌ CONNECTION FAILED');
    console.error(`   Error: ${categoryResult.error.message}`);
    console.log();
    console.log('Common issues:');
    console.log('  1. Wrong service_role key (make sure you copied the service_role key, NOT the anon key)');
    console.log('  2. Key has extra spaces or line breaks');
    console.log('  3. Project URL is incorrect');
    console.log();
    console.log('Get your service_role key from:');
    console.log('  https://supabase.com/dashboard/project/buivobulqaryifxesvqo/settings/api');
    console.log('  Look for "service_role" under "Project API keys"');
    process.exit(1);
  }

  console.log('✅ CONNECTION SUCCESSFUL!');
  console.log();

  // Show categories
  console.log(`Found ${categoryResult.data.length} categories:`);
  categoryResult.data.forEach(cat => {
    console.log(`  - ${cat.name || cat.id}`);
  });

  // Test items table
  const itemResult = await supabase.from('item').select('*').limit(3);
  if (!itemResult.error) {
    console.log();
    console.log(`Found ${itemResult.data.length} items (showing first 3):`);
    itemResult.data.forEach(item => {
      console.log(`  - ${item.name || item.id}`);
    });
  }

  // Test add-ons table
  const addonResult = await supabase.from('add_on').select('*').limit(3);
  if (!addonResult.error) {
    console.log();
    console.log(`Found ${addonResult.data.length} add-ons (showing first 3):`);
    addonResult.data.forEach(addon => {
      console.log(`  - ${addon.name || addon.id}`);
    });
  }

  console.log();
  console.log('='.repeat(60));
  console.log('✅ Your Supabase configuration is correct! 🎉');
  console.log('='.repeat(60));
  console.log();
  console.log('The "Import from Supabase" feature is ready to use.');
  console.log('You can now rebuild your app with: yarn build');
}

testConnection();
