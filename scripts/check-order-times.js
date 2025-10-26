const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');

const dbPath = path.join(
  os.homedir(),
  'AppData',
  'Roaming',
  'my-nextron-app',
  'database.sqlite'
);

console.log('Database path:', dbPath);
console.log('Current device time:', new Date().toLocaleString());
console.log('Current UTC time:', new Date().toISOString());
console.log('\n=== Recent Orders ===\n');

try {
  const db = new Database(dbPath, { readonly: true });

  const orders = db.prepare(`
    SELECT id, orderNumber, createdAt, type, status
    FROM orders
    ORDER BY createdAt DESC
    LIMIT 10
  `).all();

  orders.forEach(order => {
    console.log(`Order #${order.orderNumber || order.id.slice(0, 8)}`);
    console.log(`  Stored in DB: ${order.createdAt}`);
    console.log(`  Parsed as UTC: ${new Date(order.createdAt).toLocaleString()}`);
    console.log(`  Type: ${order.type}, Status: ${order.status}`);
    console.log('');
  });

  db.close();
} catch (error) {
  console.error('Error:', error.message);
}
