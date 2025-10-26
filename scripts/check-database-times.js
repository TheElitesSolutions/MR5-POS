/**
 * Script to check what times are actually stored in the database
 */

const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');

// Get database path (same as app uses)
const userDataPath = path.join(os.homedir(), 'AppData', 'Roaming', 'my-nextron-app');
const dbPath = path.join(userDataPath, 'mr5-pos.db');

console.log('📊 Checking database timestamps...\n');
console.log('Database path:', dbPath);
console.log('Current system time:', new Date().toString());
console.log('Current system time (UTC):', new Date().toISOString());
console.log('\n' + '='.repeat(80) + '\n');

try {
  const db = new Database(dbPath, { readonly: true });

  // Check recent orders
  console.log('📋 Recent Orders:');
  const orders = db.prepare(`
    SELECT
      id,
      orderNumber,
      createdAt,
      updatedAt,
      completedAt
    FROM orders
    ORDER BY createdAt DESC
    LIMIT 5
  `).all();

  if (orders.length === 0) {
    console.log('  No orders found');
  } else {
    orders.forEach((order, index) => {
      console.log(`\n  Order #${index + 1} (${order.orderNumber}):`);
      console.log(`    Database createdAt: ${order.createdAt}`);
      console.log(`    Database updatedAt: ${order.updatedAt}`);
      if (order.completedAt) {
        console.log(`    Database completedAt: ${order.completedAt}`);
      }
    });
  }

  // Check recent tables
  console.log('\n\n🪑 Recent Tables:');
  const tables = db.prepare(`
    SELECT
      id,
      name,
      createdAt,
      updatedAt,
      lastStatusChange
    FROM tables
    ORDER BY createdAt DESC
    LIMIT 3
  `).all();

  if (tables.length === 0) {
    console.log('  No tables found');
  } else {
    tables.forEach((table, index) => {
      console.log(`\n  Table #${index + 1} (${table.name}):`);
      console.log(`    Database createdAt: ${table.createdAt}`);
      console.log(`    Database updatedAt: ${table.updatedAt}`);
      if (table.lastStatusChange) {
        console.log(`    Database lastStatusChange: ${table.lastStatusChange}`);
      }
    });
  }

  // Check users
  console.log('\n\n👥 Recent Users:');
  const users = db.prepare(`
    SELECT
      id,
      username,
      createdAt,
      lastLogin
    FROM users
    ORDER BY createdAt DESC
    LIMIT 3
  `).all();

  if (users.length === 0) {
    console.log('  No users found');
  } else {
    users.forEach((user, index) => {
      console.log(`\n  User #${index + 1} (${user.username}):`);
      console.log(`    Database createdAt: ${user.createdAt}`);
      if (user.lastLogin) {
        console.log(`    Database lastLogin: ${user.lastLogin}`);
      }
    });
  }

  // Check what timezone format is used
  console.log('\n\n' + '='.repeat(80));
  console.log('\n🔍 Timezone Analysis:');

  if (orders.length > 0) {
    const sampleTime = orders[0].createdAt;
    console.log(`\nSample timestamp from DB: "${sampleTime}"`);

    // Parse it as if it's local time
    const asLocal = new Date(sampleTime);
    console.log(`Parsed as local time: ${asLocal.toString()}`);

    // Check if it has a 'Z' or timezone offset
    if (sampleTime.includes('Z')) {
      console.log('⚠️  ISSUE: Timestamp contains "Z" - this is UTC time!');
    } else if (sampleTime.match(/[+-]\d{2}:\d{2}$/)) {
      console.log('ℹ️  Timestamp has timezone offset');
    } else {
      console.log('✅ Timestamp appears to be in SQLite local format (no timezone info)');
    }
  }

  db.close();

  console.log('\n\n' + '='.repeat(80));
  console.log('\n💡 Diagnosis:');
  console.log('  If timestamps show times different from your local time,');
  console.log('  the issue is either:');
  console.log('  1. Old UTC timestamps in database (from before fix)');
  console.log('  2. Application not rebuilt after code changes');
  console.log('  3. Code still using old Date() methods somewhere');
  console.log('\n  Rebuild the app with: yarn build');
  console.log('='.repeat(80) + '\n');

} catch (error) {
  console.error('❌ Error:', error.message);
  console.error('\nMake sure:');
  console.error('1. The database file exists');
  console.error('2. The application has created some data');
  console.error('3. The path is correct');
}
