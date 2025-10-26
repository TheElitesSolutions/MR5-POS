/**
 * Diagnostic script to check tableName in orders
 * Checks if orders are being created with tableName field populated
 */

const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');

// Get database path
const dbPath = path.join(
  os.homedir(),
  'AppData',
  'Roaming',
  'my-nextron-app',
  'database.db'
);

console.log('Database path:', dbPath);
console.log('');

try {
  const db = new Database(dbPath, { readonly: true });

  // Check if tableName column exists
  console.log('=== CHECKING SCHEMA ===');
  const tableInfo = db.prepare('PRAGMA table_info(orders)').all();
  const hasTableName = tableInfo.some(col => col.name === 'tableName');
  console.log('tableName column exists:', hasTableName);

  if (!hasTableName) {
    console.error('❌ ERROR: tableName column does not exist in orders table!');
    console.log('\nRun migration script: scripts/add-tablename-migration.sql');
    process.exit(1);
  }

  console.log('\n=== RECENT ORDERS (Last 10) ===');
  const recentOrders = db.prepare(`
    SELECT
      id,
      orderNumber,
      tableId,
      tableName,
      type,
      status,
      datetime(createdAt) as createdAt
    FROM orders
    ORDER BY createdAt DESC
    LIMIT 10
  `).all();

  console.log('Total recent orders:', recentOrders.length);
  console.log('');

  recentOrders.forEach(order => {
    const tableInfo = order.tableId
      ? `tableId: ${order.tableId.slice(0, 8)}...`
      : 'tableId: NULL';
    const tableName = order.tableName || 'NULL';
    const status = order.tableName ? '✅' : '❌';

    console.log(`${status} ${order.orderNumber}`);
    console.log(`   ${tableInfo} | tableName: ${tableName}`);
    console.log(`   Type: ${order.type} | Status: ${order.status}`);
    console.log(`   Created: ${order.createdAt}`);
    console.log('');
  });

  // Check DINE_IN orders specifically
  console.log('\n=== DINE_IN ORDERS ANALYSIS ===');
  const dineInStats = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN tableName IS NOT NULL THEN 1 ELSE 0 END) as withTableName,
      SUM(CASE WHEN tableName IS NULL AND tableId IS NOT NULL THEN 1 ELSE 0 END) as missingTableName
    FROM orders
    WHERE type = 'DINE_IN'
  `).get();

  console.log('Total DINE_IN orders:', dineInStats.total);
  console.log('✅ With tableName:', dineInStats.withTableName);
  console.log('❌ Missing tableName (has tableId but no tableName):', dineInStats.missingTableName);

  // Show tables with their names
  console.log('\n=== AVAILABLE TABLES ===');
  const tables = db.prepare(`
    SELECT id, name, capacity
    FROM tables
    ORDER BY name
  `).all();

  console.log('Total tables:', tables.length);
  tables.forEach(table => {
    console.log(`  - ${table.name} (${table.capacity} seats) [ID: ${table.id.slice(0, 8)}...]`);
  });

  db.close();

  console.log('\n=== SUMMARY ===');
  if (dineInStats.missingTableName > 0) {
    console.log('⚠️  Some DINE_IN orders are missing tableName');
    console.log('   This indicates the bug is still present or orders were created before the fix');
    console.log('\n   NEXT STEPS:');
    console.log('   1. Ensure latest build is installed');
    console.log('   2. Create a NEW test order with a table');
    console.log('   3. Run this script again to verify tableName is saved');
  } else if (dineInStats.total === 0) {
    console.log('ℹ️  No DINE_IN orders found');
    console.log('   Create a test order to verify the fix');
  } else {
    console.log('✅ All DINE_IN orders have tableName field populated!');
  }

} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
}
