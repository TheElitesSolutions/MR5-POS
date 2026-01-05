/**
 * Debug script to check specific order data
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Get the database path
const userDataPath = process.env.APPDATA ||
  (process.platform === 'darwin' ? process.env.HOME + '/Library/Application Support' : process.env.HOME + '/.config');
const dbPath = path.join(userDataPath, 'my-nextron-app', 'mr5-pos.db');

console.log('Database path:', dbPath);

// Check if database exists
if (!fs.existsSync(dbPath)) {
  console.error('❌ Database not found at:', dbPath);
  process.exit(1);
}

try {
  const db = new Database(dbPath);

  // Find the specific order
  const order = db.prepare(`
    SELECT
      id,
      orderNumber,
      type,
      subtotal,
      deliveryFee,
      total,
      createdAt
    FROM orders
    WHERE orderNumber = ?
  `).get('ORD-1767548275474');

  if (!order) {
    console.log('❌ Order ORD-1767548275474 not found');
    db.close();
    process.exit(0);
  }

  console.log('\n📋 Order Details:');
  console.log(JSON.stringify(order, null, 2));

  // Get order items
  const items = db.prepare(`
    SELECT id, name, quantity, unitPrice, totalPrice
    FROM order_items
    WHERE orderId = ?
  `).all(order.id);

  console.log('\n📦 Order Items:');
  console.table(items);

  // Calculate what the total SHOULD be
  let itemsTotal = 0;
  items.forEach(item => {
    itemsTotal += item.totalPrice;
  });

  console.log('\n🔍 Analysis:');
  console.log(`Items Total (calculated from items): $${itemsTotal.toFixed(2)}`);
  console.log(`Subtotal (from database): $${order.subtotal}`);
  console.log(`Delivery Fee (from database): $${order.deliveryFee}`);
  console.log(`Total (from database): $${order.total}`);
  console.log(`Expected Total: $${(itemsTotal + order.deliveryFee).toFixed(2)}`);
  console.log(`\n❓ Mismatch: ${order.total !== (itemsTotal + order.deliveryFee) ? 'YES' : 'NO'}`);

  db.close();
} catch (error) {
  console.error('❌ Error:', error);
  process.exit(1);
}
