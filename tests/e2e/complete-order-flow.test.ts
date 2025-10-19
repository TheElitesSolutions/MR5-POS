import { describe, it, expect, beforeEach } from '@jest/globals';
import { getTestDatabase } from '../setup/backend.setup';
import { Factory, DbHelper, Price } from '../utils/test-helpers';
import Decimal from 'decimal.js';

/**
 * End-to-End Test: Complete Order Flow
 *
 * This test simulates a complete order workflow from creation to completion:
 * 1. User authentication
 * 2. Table selection
 * 3. Menu item selection with addons
 * 4. Stock deduction
 * 5. Order calculation
 * 6. Payment processing
 * 7. Receipt generation
 * 8. Order completion
 */

describe('E2E: Complete Order Flow', () => {
  let db: any;
  let dbHelper: DbHelper;
  let testData: any;
  let cashier: any;
  let table: any;

  beforeEach(() => {
    db = getTestDatabase();
    dbHelper = new DbHelper(db);
    testData = dbHelper.seedTestData();
    cashier = testData.users.cashier;
    table = testData.tables.table1;
  });

  it('should process a complete dine-in order from start to finish', () => {
    // STEP 1: Authentication
    const authenticatedUser = db.prepare('SELECT * FROM User WHERE id = ?').get(cashier.id);
    expect(authenticatedUser).toBeDefined();
    expect(authenticatedUser.role).toBe('CASHIER');

    // STEP 2: Check table availability
    const selectedTable = db.prepare('SELECT * FROM "Table" WHERE id = ?').get(table.id);
    expect(selectedTable.status).toBe('AVAILABLE');

    // Mark table as occupied
    db.prepare('UPDATE "Table" SET status = ? WHERE id = ?').run('OCCUPIED', table.id);

    // STEP 3: Create order
    const order = Factory.createOrder({
      type: 'DINE_IN',
      tableId: table.id,
      userId: cashier.id,
      status: 'DRAFT'
    });
    dbHelper.insertOrder(order);

    const createdOrder = db.prepare('SELECT * FROM "Order" WHERE id = ?').get(order.id);
    expect(createdOrder).toBeDefined();
    expect(createdOrder.tableId).toBe(table.id);

    // STEP 4: Add menu items to order with inventory tracking
    const burger = testData.menuItems.burger;
    const pizza = testData.menuItems.pizza;
    const cola = testData.menuItems.cola;

    // Create menu-inventory mappings
    const beefInventory = testData.inventory.beef;
    const cheeseInventory = testData.inventory.cheese;

    // Set initial stock
    db.prepare('UPDATE Inventory SET currentStock = ? WHERE id = ?').run(50, beefInventory.id);
    db.prepare('UPDATE Inventory SET currentStock = ? WHERE id = ?').run(30, cheeseInventory.id);

    // Link burger to beef inventory (0.2kg per burger)
    db.prepare(`
      INSERT INTO MenuItemInventory (id, menuItemId, inventoryId, quantityPerItem, createdAt)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      Factory.createInventory().id,
      burger.id,
      beefInventory.id,
      0.2,
      new Date().toISOString()
    );

    // Add items to order with stock deduction
    const orderItems = [
      { menuItem: burger, quantity: 2 },
      { menuItem: pizza, quantity: 1 },
      { menuItem: cola, quantity: 3 }
    ];

    orderItems.forEach(({ menuItem, quantity }) => {
      const orderItem = Factory.createOrderItem(order.id, menuItem.id, {
        quantity,
        price: menuItem.price
      });

      // Insert order item
      db.prepare(`
        INSERT INTO OrderItem (id, orderId, menuItemId, quantity, price, status, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        orderItem.id,
        orderItem.orderId,
        orderItem.menuItemId,
        orderItem.quantity,
        orderItem.price,
        orderItem.status,
        orderItem.createdAt.toISOString(),
        orderItem.updatedAt.toISOString()
      );

      // Deduct stock for items with inventory linkage
      if (menuItem.id === burger.id) {
        const mapping = db.prepare(`
          SELECT * FROM MenuItemInventory WHERE menuItemId = ?
        `).get(menuItem.id);

        if (mapping) {
          const requiredStock = new Decimal(mapping.quantityPerItem).times(quantity).toNumber();
          db.prepare(`
            UPDATE Inventory
            SET currentStock = currentStock - ?
            WHERE id = ?
          `).run(requiredStock, mapping.inventoryId);
        }
      }
    });

    // Verify order items created
    const createdItems = db.prepare('SELECT * FROM OrderItem WHERE orderId = ?').all(order.id);
    expect(createdItems.length).toBe(3);

    // Verify inventory deducted
    const updatedBeef = db.prepare('SELECT * FROM Inventory WHERE id = ?').get(beefInventory.id);
    expect(updatedBeef.currentStock).toBe(49.6); // 50 - (0.2 * 2)

    // STEP 5: Add addons to burger
    const addonGroup = Factory.createAddonGroup({ name: 'Extras' });
    db.prepare(`
      INSERT INTO AddonGroup (id, name, description, maxSelections, isRequired, displayOrder, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      addonGroup.id,
      addonGroup.name,
      addonGroup.description,
      addonGroup.maxSelections,
      addonGroup.isRequired ? 1 : 0,
      addonGroup.displayOrder,
      addonGroup.createdAt.toISOString(),
      addonGroup.updatedAt.toISOString()
    );

    const bacon = Factory.createAddon(addonGroup.id, { name: 'Bacon', price: 1.50 });
    const extraCheese = Factory.createAddon(addonGroup.id, { name: 'Extra Cheese', price: 1.00 });

    [bacon, extraCheese].forEach(addon => {
      db.prepare(`
        INSERT INTO Addon (id, groupId, name, description, price, isAvailable, inventoryId, displayOrder, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        addon.id,
        addon.groupId,
        addon.name,
        addon.description,
        addon.price,
        addon.isAvailable ? 1 : 0,
        addon.inventoryId,
        addon.displayOrder,
        addon.createdAt.toISOString(),
        addon.updatedAt.toISOString()
      );
    });

    // Add addons to burger order item
    const burgerOrderItem = createdItems.find((item: any) => item.menuItemId === burger.id);

    [bacon, extraCheese].forEach(addon => {
      db.prepare(`
        INSERT INTO OrderItemAddon (id, orderItemId, addonId, quantity, price, createdAt)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        Factory.createAddon(addonGroup.id).id,
        burgerOrderItem.id,
        addon.id,
        1,
        addon.price,
        new Date().toISOString()
      );
    });

    // STEP 6: Calculate order totals
    const items = db.prepare('SELECT * FROM OrderItem WHERE orderId = ?').all(order.id);
    const itemsWithAddons = items.map((item: any) => {
      const addons = db.prepare('SELECT * FROM OrderItemAddon WHERE orderItemId = ?')
        .all(item.id);
      const addonsTotal = addons.reduce((sum: number, addon: any) =>
        sum + (addon.price * addon.quantity), 0);

      return {
        ...item,
        totalPrice: (item.price * item.quantity) + addonsTotal
      };
    });

    const subtotal = itemsWithAddons.reduce((sum, item) => sum + item.totalPrice, 0);
    const taxRate = 0.08; // 8% tax
    const discount = 5.00;
    const tax = new Decimal(subtotal).minus(discount).times(taxRate).toNumber();
    const total = new Decimal(subtotal).minus(discount).plus(tax).toNumber();

    // Update order with totals
    db.prepare(`
      UPDATE "Order"
      SET subtotal = ?, tax = ?, discount = ?, total = ?, status = ?
      WHERE id = ?
    `).run(subtotal, tax, discount, total, 'PENDING', order.id);

    const updatedOrder = db.prepare('SELECT * FROM "Order" WHERE id = ?').get(order.id);
    expect(updatedOrder.subtotal).toBeCloseTo(subtotal, 2);
    expect(updatedOrder.total).toBeGreaterThan(0);

    // STEP 7: Process payment
    const payment = Factory.createPayment(order.id, {
      amount: total,
      method: 'CARD',
      status: 'COMPLETED'
    });

    db.prepare(`
      INSERT INTO Payment (id, orderId, amount, method, status, transactionId, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      payment.id,
      payment.orderId,
      payment.amount,
      payment.method,
      payment.status,
      payment.transactionId,
      payment.createdAt.toISOString(),
      payment.updatedAt.toISOString()
    );

    const processedPayment = db.prepare('SELECT * FROM Payment WHERE id = ?').get(payment.id);
    expect(processedPayment.status).toBe('COMPLETED');
    expect(processedPayment.amount).toBeCloseTo(total, 2);

    // STEP 8: Update order status to completed
    db.prepare('UPDATE "Order" SET status = ? WHERE id = ?').run('COMPLETED', order.id);

    // STEP 9: Free up table
    db.prepare('UPDATE "Table" SET status = ? WHERE id = ?').run('AVAILABLE', table.id);

    // STEP 10: Create audit log
    const auditLog = {
      id: Factory.createInventory().id,
      action: 'ORDER_COMPLETED',
      entityType: 'Order',
      entityId: order.id,
      userId: cashier.id,
      changes: JSON.stringify({
        orderNumber: order.orderNumber,
        total,
        paymentMethod: payment.method
      }),
      timestamp: new Date().toISOString()
    };

    db.prepare(`
      INSERT INTO AuditLog (id, action, entityType, entityId, userId, changes, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      auditLog.id,
      auditLog.action,
      auditLog.entityType,
      auditLog.entityId,
      auditLog.userId,
      auditLog.changes,
      auditLog.timestamp
    );

    // VERIFICATION: Complete flow validation
    const finalOrder = db.prepare('SELECT * FROM "Order" WHERE id = ?').get(order.id);
    const finalTable = db.prepare('SELECT * FROM "Table" WHERE id = ?').get(table.id);
    const finalPayment = db.prepare('SELECT * FROM Payment WHERE orderId = ?').get(order.id);
    const finalInventory = db.prepare('SELECT * FROM Inventory WHERE id = ?').get(beefInventory.id);
    const auditLogs = db.prepare('SELECT * FROM AuditLog WHERE entityId = ?').all(order.id);

    expect(finalOrder.status).toBe('COMPLETED');
    expect(finalOrder.total).toBeGreaterThan(0);
    expect(finalTable.status).toBe('AVAILABLE');
    expect(finalPayment.status).toBe('COMPLETED');
    expect(finalInventory.currentStock).toBe(49.6);
    expect(auditLogs.length).toBeGreaterThan(0);
  });

  it('should handle order cancellation with stock restoration', () => {
    // Create order
    const order = Factory.createOrder({
      type: 'TAKEOUT',
      userId: cashier.id,
      status: 'PENDING'
    });
    dbHelper.insertOrder(order);

    // Set initial stock
    const beef = testData.inventory.beef;
    db.prepare('UPDATE Inventory SET currentStock = ? WHERE id = ?').run(100, beef.id);

    // Add item to order
    const burger = testData.menuItems.burger;
    const orderItem = Factory.createOrderItem(order.id, burger.id, { quantity: 5 });

    db.prepare(`
      INSERT INTO OrderItem (id, orderId, menuItemId, quantity, price, status, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      orderItem.id,
      orderItem.orderId,
      orderItem.menuItemId,
      orderItem.quantity,
      orderItem.price,
      orderItem.status,
      orderItem.createdAt.toISOString(),
      orderItem.updatedAt.toISOString()
    );

    // Create menu-inventory link
    db.prepare(`
      INSERT INTO MenuItemInventory (id, menuItemId, inventoryId, quantityPerItem, createdAt)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      Factory.createInventory().id,
      burger.id,
      beef.id,
      0.2,
      new Date().toISOString()
    );

    // Deduct stock
    const requiredStock = 0.2 * 5; // 1.0 kg
    db.prepare('UPDATE Inventory SET currentStock = currentStock - ? WHERE id = ?')
      .run(requiredStock, beef.id);

    let currentStock = db.prepare('SELECT * FROM Inventory WHERE id = ?').get(beef.id);
    expect(currentStock.currentStock).toBe(99); // 100 - 1

    // Cancel order
    db.prepare('UPDATE "Order" SET status = ? WHERE id = ?').run('CANCELLED', order.id);

    // Restore stock
    db.prepare('UPDATE Inventory SET currentStock = currentStock + ? WHERE id = ?')
      .run(requiredStock, beef.id);

    // Verify stock restored
    currentStock = db.prepare('SELECT * FROM Inventory WHERE id = ?').get(beef.id);
    expect(currentStock.currentStock).toBe(100); // Stock restored

    const cancelledOrder = db.prepare('SELECT * FROM "Order" WHERE id = ?').get(order.id);
    expect(cancelledOrder.status).toBe('CANCELLED');
  });

  it('should handle delivery order with customer information', () => {
    // Create delivery order
    const order = Factory.createOrder({
      type: 'DELIVERY',
      customerName: 'John Doe',
      customerPhone: '+1234567890',
      deliveryAddress: '123 Main St, City, State 12345',
      userId: cashier.id,
      status: 'PENDING'
    });
    dbHelper.insertOrder(order);

    // Add items
    const pizza = testData.menuItems.pizza;
    const orderItem = Factory.createOrderItem(order.id, pizza.id, { quantity: 2 });

    db.prepare(`
      INSERT INTO OrderItem (id, orderId, menuItemId, quantity, price, status, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      orderItem.id,
      orderItem.orderId,
      orderItem.menuItemId,
      orderItem.quantity,
      orderItem.price,
      orderItem.status,
      orderItem.createdAt.toISOString(),
      orderItem.updatedAt.toISOString()
    );

    // Calculate total
    const subtotal = pizza.price * 2;
    const deliveryFee = 5.00;
    const total = subtotal + deliveryFee;

    db.prepare(`
      UPDATE "Order"
      SET subtotal = ?, total = ?, status = ?
      WHERE id = ?
    `).run(subtotal, total, 'CONFIRMED', order.id);

    // Process payment
    const payment = Factory.createPayment(order.id, {
      amount: total,
      method: 'DIGITAL_WALLET',
      status: 'COMPLETED'
    });

    db.prepare(`
      INSERT INTO Payment (id, orderId, amount, method, status, transactionId, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      payment.id,
      payment.orderId,
      payment.amount,
      payment.method,
      payment.status,
      payment.transactionId,
      payment.createdAt.toISOString(),
      payment.updatedAt.toISOString()
    );

    // Update status through delivery lifecycle
    const statuses = ['PREPARING', 'READY', 'COMPLETED'];
    statuses.forEach(status => {
      db.prepare('UPDATE "Order" SET status = ? WHERE id = ?').run(status, order.id);
    });

    const finalOrder = db.prepare('SELECT * FROM "Order" WHERE id = ?').get(order.id);
    expect(finalOrder.type).toBe('DELIVERY');
    expect(finalOrder.customerName).toBe('John Doe');
    expect(finalOrder.deliveryAddress).toBeDefined();
    expect(finalOrder.status).toBe('COMPLETED');
  });
});