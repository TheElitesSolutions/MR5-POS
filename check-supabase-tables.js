#!/usr/bin/env node
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

console.log('Checking Supabase database tables...\n');

// Try different common table names that might exist
const tablesToCheck = [
  'categories',
  'Categories',
  'menu_items',
  'MenuItems',
  'items',
  'Item',
  'addons',
  'Addons',
  'addon_groups',
  'AddonGroups'
];

async function checkTables() {
  console.log('Testing table access:\n');

  for (const table of tablesToCheck) {
    const result = await supabase.from(table).select('*').limit(1);
    if (!result.error) {
      console.log(`✅ Found table: ${table}`);
      console.log(`   Columns: ${Object.keys(result.data[0] || {}).join(', ') || 'empty table'}`);
    }
  }

  console.log('\n---\n');
  console.log('If no tables were found, your Supabase database may be empty.');
  console.log('The "Import from Supabase" feature requires these tables to exist:');
  console.log('  - categories');
  console.log('  - menu_items (or items)');
  console.log('  - addons');
  console.log('  - addon_groups');
}

checkTables();
