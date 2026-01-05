/**
 * Migration script to fix orders with $0.00 totals
 * Recalculates totals from order items using Decimal.js for precision
 */

const Database = require('better-sqlite3');
const Decimal = require('decimal.js');
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

function fixZeroTotalOrders() {
  console.log('🔍 Finding orders with incorrect totals...');

  const db = new Database(dbPath);

  try {
    // Find all orders with 0 total OR where total doesn't include delivery fee
    const brokenOrders = db.prepare(`
      SELECT o.id, o.orderNumber, o.total, o.subtotal, o.deliveryFee
      FROM orders o
      WHERE (o.total = 0 OR o.total != COALESCE(o.subtotal, 0) + COALESCE(o.deliveryFee, 0))
        AND EXISTS (
          SELECT 1 FROM order_items oi
          WHERE oi.orderId = o.id
        )
    `).all();

    console.log(`Found ${brokenOrders.length} orders with incorrect totals`);

    if (brokenOrders.length === 0) {
      console.log('✅ No orders need fixing!');
      db.close();
      return;
    }

    let fixed = 0;
    let failed = 0;

    // Prepare statements for efficiency
    const getItemsStmt = db.prepare('SELECT totalPrice FROM order_items WHERE orderId = ?');
    const getOrderStmt = db.prepare('SELECT deliveryFee FROM orders WHERE id = ?');
    const updateOrderStmt = db.prepare('UPDATE orders SET subtotal = ?, total = ? WHERE id = ?');

    for (const order of brokenOrders) {
      try {
        // Get order to access delivery fee
        const orderData = getOrderStmt.get(order.id);
        const deliveryFee = new Decimal(orderData?.deliveryFee || 0);

        // Get all items for this order
        const items = getItemsStmt.all(order.id);

        // Recalculate subtotal from items using Decimal.js
        let subtotal = new Decimal(0);
        for (const item of items) {
          subtotal = subtotal.add(item.totalPrice || 0);
        }

        // CRITICAL FIX: Include delivery fee in total
        const total = subtotal.add(deliveryFee).toNumber();

        // Update order
        updateOrderStmt.run(subtotal.toNumber(), total, order.id);

        console.log(`✅ Fixed order ${order.orderNumber}: $0.00 → $${total.toFixed(2)} (items: $${subtotal.toFixed(2)}, delivery: $${deliveryFee.toFixed(2)})`);
        fixed++;
      } catch (error) {
        console.error(`❌ Failed to fix order ${order.orderNumber}:`, error.message);
        failed++;
      }
    }

    console.log(`\n✅ Migration complete: ${fixed} fixed, ${failed} failed`);
    db.close();
  } catch (error) {
    console.error('❌ Migration failed:', error);
    db.close();
    process.exit(1);
  }
}

fixZeroTotalOrders();
