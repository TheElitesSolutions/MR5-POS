/**
 * Check Audit Logs for Menu Item Changes
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(process.env.APPDATA, 'my-nextron-app', 'mr5-pos.db');
const db = new Database(dbPath, { readonly: true });

console.log('🔍 CHECKING AUDIT LOGS FOR MENU ITEM CHANGES\n');

// Check audit_logs table structure
console.log('1️⃣ Audit Logs Table Structure:');
const columns = db.prepare(`PRAGMA table_info(audit_logs)`).all();
console.log('   Columns:', columns.map(c => c.name).join(', '));
console.log('');

// Get recent audit logs
console.log('2️⃣ Recent Audit Entries (last 50):');
const logs = db.prepare(`
  SELECT * FROM audit_logs
  ORDER BY createdAt DESC
  LIMIT 50
`).all();

if (logs.length > 0) {
  logs.forEach((log, i) => {
    console.log(`\n   [${i + 1}] ${log.createdAt || log.timestamp || 'Unknown time'}`);
    console.log(`       Action: ${log.action || log.type || 'Unknown'}`);
    console.log(`       Table: ${log.tableName || log.table || 'Unknown'}`);
    if (log.details) console.log(`       Details: ${log.details}`);
    if (log.userId) console.log(`       User: ${log.userId}`);
  });
} else {
  console.log('   ℹ️ No audit log entries found');
}

console.log('\n');
console.log('3️⃣ Menu Item Related Entries:');
const menuLogs = db.prepare(`
  SELECT * FROM audit_logs
  WHERE tableName LIKE '%menu%' OR details LIKE '%menu%' OR details LIKE '%isActive%'
  ORDER BY createdAt DESC
  LIMIT 20
`).all();

if (menuLogs.length > 0) {
  menuLogs.forEach((log, i) => {
    console.log(`\n   [${i + 1}] ${log.createdAt || log.timestamp}`);
    console.log(`       ${JSON.stringify(log, null, 2)}`);
  });
} else {
  console.log('   ℹ️ No menu-related audit entries found');
}

db.close();
console.log('\n✅ Audit log check complete');
