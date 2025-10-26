/**
 * Debug script to trace the complete order data flow
 */

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

console.log('=== DATETIME FLOW DEBUG ===\n');
console.log('Current System Time:', new Date().toLocaleString());
console.log('Current System Time (UTC):', new Date().toISOString());
console.log('Timezone Offset:', -new Date().getTimezoneOffset() / 60, 'hours\n');

try {
  const db = new Database(dbPath, { readonly: false });

  // Get the most recent order
  const order = db.prepare(`
    SELECT id, orderNumber, createdAt, updatedAt, status
    FROM orders
    ORDER BY ROWID DESC
    LIMIT 1
  `).get();

  if (order) {
    console.log('=== MOST RECENT ORDER ===');
    console.log('Order Number:', order.orderNumber);
    console.log('Status:', order.status);
    console.log('\n--- RAW DATABASE VALUE ---');
    console.log('createdAt (raw):', order.createdAt);
    console.log('Type:', typeof order.createdAt);

    console.log('\n--- JAVASCRIPT PARSING ---');
    const jsDate = new Date(order.createdAt);
    console.log('new Date(createdAt):', jsDate);
    console.log('toLocaleString():', jsDate.toLocaleString());
    console.log('toISOString():', jsDate.toISOString());
    console.log('toLocaleTimeString():', jsDate.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    }));

    console.log('\n--- MANUAL PARSING (as local) ---');
    const [datePart, timePart] = order.createdAt.split(' ');
    const [year, month, day] = datePart.split('-').map(Number);
    const [hours, minutes, seconds] = timePart.split(':').map(Number);
    const localDate = new Date(year, month - 1, day, hours, minutes, seconds);
    console.log('Manually parsed:', localDate);
    console.log('toLocaleTimeString():', localDate.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    }));

    console.log('\n--- DIAGNOSIS ---');
    const dbTime = order.createdAt.split(' ')[1].substring(0, 5);
    const jsTime = jsDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const manualTime = localDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    console.log('DB shows:', dbTime);
    console.log('JavaScript parses as:', jsTime);
    console.log('Manual parse shows:', manualTime);

    if (dbTime === manualTime) {
      console.log('\n✅ Manual parsing WORKS - use parseLocalDateTime()');
    } else {
      console.log('\n❌ Even manual parsing is wrong - check database storage');
    }

    if (dbTime !== jsTime) {
      console.log('⚠️  JavaScript auto-parsing is WRONG - converting to UTC');
    }

  } else {
    console.log('No orders found in database');
  }

  db.close();
} catch (error) {
  console.error('Error:', error.message);
}
