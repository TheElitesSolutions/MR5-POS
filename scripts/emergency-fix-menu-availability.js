/**
 * EMERGENCY FIX: Restore Menu Item Availability
 *
 * CRITICAL PRODUCTION ISSUE: All menu items have isActive = 0
 * This script sets all menu items to isActive = 1 (available)
 *
 * Run with: node scripts/emergency-fix-menu-availability.js
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(process.env.APPDATA, 'my-nextron-app', 'mr5-pos.db');
const backupPath = path.join(process.env.APPDATA, 'my-nextron-app', 'mr5-pos.db.corrupted.backup');

console.log('🚨 EMERGENCY MENU AVAILABILITY FIX\n');
console.log('Database:', dbPath);
console.log('Backup will be saved to:', backupPath);
console.log('');

// Check if database exists
if (!fs.existsSync(dbPath)) {
  console.error('❌ ERROR: Database not found at', dbPath);
  process.exit(1);
}

// Step 1: Create backup of corrupted state
console.log('📦 Step 1: Creating backup of current (corrupted) state...');
try {
  fs.copyFileSync(dbPath, backupPath);
  console.log('✅ Backup created successfully');
} catch (error) {
  console.error('❌ ERROR creating backup:', error.message);
  process.exit(1);
}

// Step 2: Connect to database
console.log('🔌 Step 2: Connecting to database...');
let db;
try {
  db = new Database(dbPath);
  console.log('✅ Connected to database\n');
} catch (error) {
  console.error('❌ ERROR connecting to database:', error.message);
  process.exit(1);
}

// Step 3: Verify current state
console.log('🔍 Step 3: Verifying current state...');
try {
  const row = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN isActive = 1 THEN 1 ELSE 0 END) as active,
      SUM(CASE WHEN isActive = 0 THEN 1 ELSE 0 END) as inactive,
      SUM(CASE WHEN isActive IS NULL THEN 1 ELSE 0 END) as null_values
    FROM menu_items
  `).get();

  console.log('📊 Current State:');
  console.log(`   Total items: ${row.total}`);
  console.log(`   Active (isActive = 1): ${row.active}`);
  console.log(`   Inactive (isActive = 0): ${row.inactive}`);
  console.log(`   NULL values: ${row.null_values}`);
  console.log('');

  if (row.active === row.total) {
    console.log('✅ All items are already active. No fix needed.');
    db.close();
    process.exit(0);
  }

  if (row.inactive === 0 && row.null_values === 0) {
    console.log('✅ No inactive or NULL items found. Database is healthy.');
    db.close();
    process.exit(0);
  }

  // Step 4: Execute fix
  console.log('⚡ Step 4: Executing emergency fix...');
  console.log('   Setting all menu items to isActive = 1 (available)');

  const result = db.prepare('UPDATE menu_items SET isActive = 1 WHERE isActive != 1 OR isActive IS NULL').run();

  console.log(`✅ Updated ${result.changes} menu items to active\n`);

  // Step 5: Verify fix
  console.log('🔍 Step 5: Verifying fix...');
  const afterFix = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN isActive = 1 THEN 1 ELSE 0 END) as active,
      SUM(CASE WHEN isActive = 0 THEN 1 ELSE 0 END) as inactive
    FROM menu_items
  `).get();

  console.log('📊 After Fix:');
  console.log(`   Total items: ${afterFix.total}`);
  console.log(`   Active (isActive = 1): ${afterFix.active}`);
  console.log(`   Inactive (isActive = 0): ${afterFix.inactive}`);
  console.log('');

  if (afterFix.active === afterFix.total) {
    console.log('✅ SUCCESS! All menu items are now active.');
    console.log('');
    console.log('📋 Next Steps:');
    console.log('   1. ✅ RESTART THE APPLICATION');
    console.log('   2. Test POS menu to verify items display');
    console.log('   3. Check logs to identify what caused this issue');
    console.log('   4. Review Supabase sync operations');
    console.log('');
    console.log('📁 Corrupted database backup saved to:');
    console.log(`   ${backupPath}`);
  } else {
    console.error('⚠️ WARNING: Not all items were activated.');
    console.error(`   Expected ${afterFix.total} active, got ${afterFix.active}`);
  }

  db.close();
} catch (error) {
  console.error('❌ ERROR:', error.message);
  if (db) db.close();
  process.exit(1);
}
