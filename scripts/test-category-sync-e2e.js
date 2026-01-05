/**
 * Test Script: End-to-End Category Sync Test
 * Purpose: Test the full sync flow from local DB to Supabase
 * Date: 2026-01-04
 */

const path = require('path');
const Database = require('better-sqlite3');

const dbPath = path.join(process.env.APPDATA || process.env.HOME, 'my-nextron-app', 'mr5-pos.db');

console.log('═══════════════════════════════════════════');
console.log('  End-to-End Category Sync Test');
console.log('═══════════════════════════════════════════\n');

console.log(`📂 Database: ${dbPath}`);

const db = new Database(dbPath);

try {
  // Create test category in local DB
  console.log('\n📋 Step 1: Create test category in local database');
  const testCategoryName = `E2E Test ${Date.now()}`;
  const categoryId = `test-${Date.now()}`;

  db.prepare(`
    INSERT INTO categories (id, name, description, color, isActive, sortOrder, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    categoryId,
    testCategoryName,
    'Test category for sync verification',
    '#FF5733',  // Local-only color field
    1,  // isActive
    0,  // sortOrder
    new Date().toISOString(),
    new Date().toISOString()
  );

  console.log(`✅ Created category: ${testCategoryName}`);
  console.log(`   ID: ${categoryId}`);
  console.log(`   Color: #FF5733 (local-only field)`);

  console.log('\n📋 Step 2: Verify category in local database');
  const localCategory = db.prepare('SELECT * FROM categories WHERE id = ?').get(categoryId);
  console.log('Local category:', JSON.stringify(localCategory, null, 2));

  console.log('\n📋 Step 3: Trigger sync (manual)');
  console.log('⚠️  This requires running the Electron app with IPC enabled');
  console.log('    Run this test from within the app using DevTools console');

  // Cleanup
  console.log('\n🧹 Cleanup: Removing test category from local DB');
  db.prepare('DELETE FROM categories WHERE id = ?').run(categoryId);
  console.log('✅ Test category removed');

} catch (error) {
  console.error('\n❌ Test failed:', error.message);
  console.error(error);
  process.exit(1);
} finally {
  db.close();
}
