/**
 * Test Script: Supabase Schema Verification
 * Purpose: Query Supabase to see actual table structure
 * Date: 2026-01-04
 */

const https = require('https');

const SUPABASE_URL = 'https://buivobulqaryifxesvqo.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1aXZvYnVscWFyeWlmeGVzdnFvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDcyNDUxNSwiZXhwIjoyMDY2MzAwNTE1fQ.-G0GXB57aRlD9VldrkTeBb_l5lDlkXl385-qYpgdpoE';

function request(path) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, SUPABASE_URL);

    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Accept': 'application/json',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            resolve(data);
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function verifyTable(tableName, expectedCols, localOnlyCols) {
  console.log(`\n📋 Checking ${tableName} table...`);
  const data = await request(`/rest/v1/${tableName}?limit=1`);

  if (data && data.length > 0) {
    console.log(`\n✅ Sample ${tableName} structure:`);
    console.log(JSON.stringify(data[0], null, 2));

    console.log(`\n📊 Available columns in Supabase ${tableName} table:`);
    const availableCols = Object.keys(data[0]);
    availableCols.forEach(col => {
      console.log(`  - ${col}`);
    });

    // Check for expected columns
    const missingCols = expectedCols.filter(col => !(col in data[0]));
    const extraCols = availableCols.filter(col => !expectedCols.includes(col));

    if (missingCols.length > 0) {
      console.log(`\n⚠️  Missing expected columns in ${tableName}:`, missingCols);
    }

    if (extraCols.length > 0) {
      console.log(`\n📌 Extra columns found in ${tableName}:`, extraCols);
    }

    // Check if local-only columns exist
    const foundLocalCols = localOnlyCols.filter(col => col in data[0]);

    if (foundLocalCols.length > 0) {
      console.log(`\n❌ ERROR: Local-only columns found in Supabase ${tableName}:`);
      foundLocalCols.forEach(col => console.log(`  - ${col} (should be local-only!)`));
    } else {
      console.log(`\n✅ Confirmed: No local-only columns in Supabase ${tableName} (correct)`);
    }

    return availableCols;
  } else {
    console.log(`⚠️  No ${tableName} records found in Supabase`);
    return [];
  }
}

async function verifySchema() {
  console.log('═══════════════════════════════════════════');
  console.log('  Supabase Schema Verification (All Tables)');
  console.log('═══════════════════════════════════════════\n');

  try {
    // Check category table
    const categoryCols = await verifyTable(
      'category',
      ['id', 'name'],
      ['color', 'description', 'sortOrder', 'isActive', 'parentId']
    );

    // Check item table
    const itemCols = await verifyTable(
      'item',
      ['id', 'name', 'price', 'category_id'],
      ['description', 'imageUrl', 'isActive', 'isCustomizable', 'isPrintableInKitchen', 'isVisibleOnWebsite', 'sortOrder', 'preparationTime']
    );

    // Check add_on table
    const addonCols = await verifyTable(
      'add_on',
      ['description', 'price', 'category_id'],
      ['name', 'isActive', 'addonGroupId', 'sortOrder']
    );

    console.log('\n\n═══════════════════════════════════════════');
    console.log('  Summary: Columns to Use in Import Queries');
    console.log('═══════════════════════════════════════════\n');
    console.log(`category columns: ${categoryCols.join(', ')}`);
    console.log(`item columns: ${itemCols.join(', ')}`);
    console.log(`add_on columns: ${addonCols.join(', ')}`);

  } catch (error) {
    console.error('\n❌ Verification failed:');
    console.error('Error:', error.message);
    process.exit(1);
  }
}

verifySchema();
