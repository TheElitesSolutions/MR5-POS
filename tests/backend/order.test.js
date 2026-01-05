import { describe, it, expect, beforeEach } from '@jest/globals';
import { getTestDatabase } from '../setup/backend.setup';
import { Factory, DbHelper, Price, Performance } from '../utils/test-helpers';
describe('Order Management', () => {
    let db;
    let dbHelper;
    let testData;
    beforeEach(() => {
        db = getTestDatabase();
        dbHelper = new DbHelper(db);
        testData = dbHelper.seedTestData();
    });
    describe('Order Creation', () => {
        it('should create a new DINE_IN order with table', () => {
            const order = Factory.createOrder({
                type: 'DINE_IN',
                tableId: testData.tables.table1.id,
                userId: testData.users.cashier.id
            });
            dbHelper.insertOrder(order);
            const storedOrder = db.prepare('SELECT * FROM "Order" WHERE id = ?').get(order.id);
            expect(storedOrder).toBeDefined();
            expect(storedOrder.type).toBe('DINE_IN');
            expect(storedOrder.tableId).toBe(testData.tables.table1.id);
            expect(storedOrder.status).toBe('PENDING');
        });
        it('should create a TAKEOUT order with customer info', () => {
            const order = Factory.createOrder({
                type: 'TAKEOUT',
                customerName: 'John Doe',
                customerPhone: '+1234567890',
                userId: testData.users.cashier.id
            });
            dbHelper.insertOrder(order);
            const storedOrder = db.prepare('SELECT * FROM "Order" WHERE id = ?').get(order.id);
            expect(storedOrder.type).toBe('TAKEOUT');
            expect(storedOrder.customerName).toBe('John Doe');
            expect(storedOrder.customerPhone).toBe('+1234567890');
            expect(storedOrder.tableId).toBeNull();
        });
        it('should create a DELIVERY order with address', () => {
            const order = Factory.createOrder({
                type: 'DELIVERY',
                customerName: 'Jane Smith',
                customerPhone: '+9876543210',
                deliveryAddress: '123 Main St, City, State 12345',
                userId: testData.users.cashier.id
            });
            dbHelper.insertOrder(order);
            const storedOrder = db.prepare('SELECT * FROM "Order" WHERE id = ?').get(order.id);
            expect(storedOrder.type).toBe('DELIVERY');
            expect(storedOrder.deliveryAddress).toBe('123 Main St, City, State 12345');
        });
        it('should generate unique order numbers', () => {
            const orders = [];
            for (let i = 0; i < 10; i++) {
                const order = Factory.createOrder();
                orders.push(order);
                dbHelper.insertOrder(order);
            }
            const orderNumbers = new Set(orders.map(o => o.orderNumber));
            expect(orderNumbers.size).toBe(10);
        });
        it('should validate required fields', () => {
            const invalidOrder = {
                id: 'test-id',
                // Missing required fields
            };
            expect(() => {
                db.prepare('INSERT INTO "Order" (id) VALUES (?)').run(invalidOrder.id);
            }).toThrow();
        });
    });
    describe('Order Items Management', () => {
        let order;
        beforeEach(() => {
            order = Factory.createOrder({ userId: testData.users.cashier.id });
            dbHelper.insertOrder(order);
        });
        it('should add items to order', () => {
            const orderItem = Factory.createOrderItem(order.id, testData.menuItems.burger.id, { quantity: 2, price: testData.menuItems.burger.price });
            const stmt = db.prepare(`
        INSERT INTO OrderItem (id, orderId, menuItemId, quantity, price, status, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
            stmt.run(orderItem.id, orderItem.orderId, orderItem.menuItemId, orderItem.quantity, orderItem.price, orderItem.status, orderItem.createdAt.toISOString(), orderItem.updatedAt.toISOString());
            const storedItem = db.prepare('SELECT * FROM OrderItem WHERE id = ?').get(orderItem.id);
            expect(storedItem).toBeDefined();
            expect(storedItem.quantity).toBe(2);
            expect(storedItem.menuItemId).toBe(testData.menuItems.burger.id);
        });
        it('should update item quantities', () => {
            const orderItem = Factory.createOrderItem(order.id, testData.menuItems.burger.id, { quantity: 1 });
            // Insert item
            const insertStmt = db.prepare(`
        INSERT INTO OrderItem (id, orderId, menuItemId, quantity, price, status, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
            insertStmt.run(orderItem.id, orderItem.orderId, orderItem.menuItemId, orderItem.quantity, orderItem.price, orderItem.status, orderItem.createdAt.toISOString(), orderItem.updatedAt.toISOString());
            // Update quantity
            db.prepare('UPDATE OrderItem SET quantity = ? WHERE id = ?').run(3, orderItem.id);
            const updatedItem = db.prepare('SELECT * FROM OrderItem WHERE id = ?').get(orderItem.id);
            expect(updatedItem.quantity).toBe(3);
        });
        it('should remove items from order', () => {
            const orderItem = Factory.createOrderItem(order.id, testData.menuItems.burger.id);
            // Insert item
            const insertStmt = db.prepare(`
        INSERT INTO OrderItem (id, orderId, menuItemId, quantity, price, status, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
            insertStmt.run(orderItem.id, orderItem.orderId, orderItem.menuItemId, orderItem.quantity, orderItem.price, orderItem.status, orderItem.createdAt.toISOString(), orderItem.updatedAt.toISOString());
            // Remove item
            db.prepare('DELETE FROM OrderItem WHERE id = ?').run(orderItem.id);
            const deletedItem = db.prepare('SELECT * FROM OrderItem WHERE id = ?').get(orderItem.id);
            expect(deletedItem).toBeUndefined();
        });
        it('should add items with notes', () => {
            const orderItem = Factory.createOrderItem(order.id, testData.menuItems.burger.id, { notes: 'No onions, extra cheese' });
            const stmt = db.prepare(`
        INSERT INTO OrderItem (id, orderId, menuItemId, quantity, price, notes, status, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
            stmt.run(orderItem.id, orderItem.orderId, orderItem.menuItemId, orderItem.quantity, orderItem.price, orderItem.notes, orderItem.status, orderItem.createdAt.toISOString(), orderItem.updatedAt.toISOString());
            const storedItem = db.prepare('SELECT * FROM OrderItem WHERE id = ?').get(orderItem.id);
            expect(storedItem.notes).toBe('No onions, extra cheese');
        });
        it('should handle multiple items in single order', () => {
            const items = [
                Factory.createOrderItem(order.id, testData.menuItems.burger.id, { quantity: 2 }),
                Factory.createOrderItem(order.id, testData.menuItems.pizza.id, { quantity: 1 }),
                Factory.createOrderItem(order.id, testData.menuItems.cola.id, { quantity: 3 })
            ];
            items.forEach(item => {
                const stmt = db.prepare(`
          INSERT INTO OrderItem (id, orderId, menuItemId, quantity, price, status, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
                stmt.run(item.id, item.orderId, item.menuItemId, item.quantity, item.price, item.status, item.createdAt.toISOString(), item.updatedAt.toISOString());
            });
            const orderItems = db.prepare('SELECT * FROM OrderItem WHERE orderId = ?').all(order.id);
            expect(orderItems.length).toBe(3);
        });
    });
    describe('Order Status Transitions', () => {
        let order;
        beforeEach(() => {
            order = Factory.createOrder({ userId: testData.users.cashier.id });
            dbHelper.insertOrder(order);
        });
        const validTransitions = [
            { from: 'DRAFT', to: 'PENDING' },
            { from: 'PENDING', to: 'CONFIRMED' },
            { from: 'CONFIRMED', to: 'PREPARING' },
            { from: 'PREPARING', to: 'READY' },
            { from: 'READY', to: 'SERVED' },
            { from: 'SERVED', to: 'COMPLETED' }
        ];
        validTransitions.forEach(({ from, to }) => {
            it(`should allow transition from ${from} to ${to}`, () => {
                db.prepare('UPDATE "Order" SET status = ? WHERE id = ?').run(from, order.id);
                const canTransition = isValidStatusTransition(from, to);
                expect(canTransition).toBe(true);
                db.prepare('UPDATE "Order" SET status = ? WHERE id = ?').run(to, order.id);
                const updatedOrder = db.prepare('SELECT * FROM "Order" WHERE id = ?').get(order.id);
                expect(updatedOrder.status).toBe(to);
            });
        });
        it('should allow cancellation from various states', () => {
            const cancellableStates = ['DRAFT', 'PENDING', 'CONFIRMED'];
            cancellableStates.forEach(state => {
                db.prepare('UPDATE "Order" SET status = ? WHERE id = ?').run(state, order.id);
                const canCancel = isValidStatusTransition(state, 'CANCELLED');
                expect(canCancel).toBe(true);
            });
        });
        it('should not allow invalid status transitions', () => {
            const invalidTransitions = [
                { from: 'COMPLETED', to: 'PENDING' },
                { from: 'CANCELLED', to: 'PREPARING' },
                { from: 'SERVED', to: 'DRAFT' }
            ];
            invalidTransitions.forEach(({ from, to }) => {
                const canTransition = isValidStatusTransition(from, to);
                expect(canTransition).toBe(false);
            });
        });
    });
    describe('Order Calculations', () => {
        let order;
        beforeEach(() => {
            order = Factory.createOrder({ userId: testData.users.cashier.id });
            dbHelper.insertOrder(order);
        });
        it('should calculate order subtotal correctly', () => {
            const items = [
                { price: 12.99, quantity: 2 }, // $25.98
                { price: 15.99, quantity: 1 }, // $15.99
                { price: 2.99, quantity: 3 } // $8.97
            ];
            const { subtotal } = Price.calculateOrderTotal(items, 0, 0);
            expect(subtotal).toBeCloseTo(50.94, 2);
        });
        it('should apply percentage discount correctly', () => {
            const items = [{ price: 100, quantity: 1 }];
            const { subtotal, discount, total } = Price.calculateOrderTotal(items, 0, 10);
            expect(subtotal).toBe(100);
            expect(discount).toBe(10);
            expect(total).toBe(90);
        });
        it('should calculate tax correctly', () => {
            const items = [{ price: 100, quantity: 1 }];
            const taxRate = 0.1; // 10% tax
            const { subtotal, tax, total } = Price.calculateOrderTotal(items, taxRate, 0);
            expect(subtotal).toBe(100);
            expect(tax).toBe(10);
            expect(total).toBe(110);
        });
        it('should handle complex calculations with discount and tax', () => {
            const items = [
                { price: 50, quantity: 2 }, // $100
                { price: 25, quantity: 1 } // $25
            ]; // Subtotal: $125
            const taxRate = 0.08; // 8% tax
            const discountAmount = 12.50; // $12.50 discount
            const { subtotal, tax, discount, total } = Price.calculateOrderTotal(items, taxRate, discountAmount);
            expect(subtotal).toBe(125);
            expect(discount).toBe(12.50);
            expect(tax).toBeCloseTo(9, 2); // (125 - 12.50) * 0.08 = 9
            expect(total).toBeCloseTo(121.5, 2); // 125 - 12.50 + 9 = 121.50
        });
        it('should use Decimal.js for precision', () => {
            const items = [
                { price: 0.1, quantity: 1 },
                { price: 0.2, quantity: 1 }
            ];
            const { subtotal } = Price.calculateOrderTotal(items, 0, 0);
            // Without Decimal.js, 0.1 + 0.2 might equal 0.30000000000000004
            expect(subtotal).toBe(0.3);
        });
        it('should update order totals in database', () => {
            const items = [
                { price: 25.99, quantity: 2 },
                { price: 12.50, quantity: 1 }
            ];
            const { subtotal, tax, discount, total } = Price.calculateOrderTotal(items, 0.1, 5);
            db.prepare(`
        UPDATE "Order"
        SET subtotal = ?, tax = ?, discount = ?, total = ?
        WHERE id = ?
      `).run(subtotal, tax, discount, total, order.id);
            const updatedOrder = db.prepare('SELECT * FROM "Order" WHERE id = ?').get(order.id);
            expect(updatedOrder.subtotal).toBeCloseTo(64.48, 2);
            expect(updatedOrder.discount).toBe(5);
            expect(updatedOrder.tax).toBeCloseTo(5.948, 2);
            expect(updatedOrder.total).toBeCloseTo(65.428, 2);
        });
    });
    describe('Order Filtering and Search', () => {
        beforeEach(() => {
            // Create multiple orders with different attributes
            const orders = [
                Factory.createOrder({
                    status: 'PENDING',
                    type: 'DINE_IN',
                    tableId: testData.tables.table1.id,
                    userId: testData.users.cashier.id,
                    createdAt: new Date('2024-01-01')
                }),
                Factory.createOrder({
                    status: 'COMPLETED',
                    type: 'TAKEOUT',
                    customerName: 'John Doe',
                    userId: testData.users.manager.id,
                    createdAt: new Date('2024-01-02')
                }),
                Factory.createOrder({
                    status: 'PREPARING',
                    type: 'DELIVERY',
                    customerName: 'Jane Smith',
                    userId: testData.users.cashier.id,
                    createdAt: new Date('2024-01-03')
                })
            ];
            orders.forEach(order => dbHelper.insertOrder(order));
        });
        it('should filter orders by status', () => {
            const pendingOrders = db.prepare('SELECT * FROM "Order" WHERE status = ?').all('PENDING');
            const completedOrders = db.prepare('SELECT * FROM "Order" WHERE status = ?').all('COMPLETED');
            expect(pendingOrders.length).toBe(1);
            expect(completedOrders.length).toBe(1);
        });
        it('should filter orders by type', () => {
            const dineInOrders = db.prepare('SELECT * FROM "Order" WHERE type = ?').all('DINE_IN');
            const takeoutOrders = db.prepare('SELECT * FROM "Order" WHERE type = ?').all('TAKEOUT');
            const deliveryOrders = db.prepare('SELECT * FROM "Order" WHERE type = ?').all('DELIVERY');
            expect(dineInOrders.length).toBe(1);
            expect(takeoutOrders.length).toBe(1);
            expect(deliveryOrders.length).toBe(1);
        });
        it('should filter orders by table', () => {
            const tableOrders = db.prepare('SELECT * FROM "Order" WHERE tableId = ?')
                .all(testData.tables.table1.id);
            expect(tableOrders.length).toBe(1);
            expect(tableOrders[0].type).toBe('DINE_IN');
        });
        it('should filter orders by user', () => {
            const cashierOrders = db.prepare('SELECT * FROM "Order" WHERE userId = ?')
                .all(testData.users.cashier.id);
            const managerOrders = db.prepare('SELECT * FROM "Order" WHERE userId = ?')
                .all(testData.users.manager.id);
            expect(cashierOrders.length).toBe(2);
            expect(managerOrders.length).toBe(1);
        });
        it('should filter orders by date range', () => {
            const startDate = '2024-01-01';
            const endDate = '2024-01-02';
            const ordersInRange = db.prepare(`
        SELECT * FROM "Order"
        WHERE DATE(createdAt) >= DATE(?) AND DATE(createdAt) <= DATE(?)
      `).all(startDate, endDate);
            expect(ordersInRange.length).toBe(2);
        });
        it('should search orders by customer name', () => {
            const orders = db.prepare(`
        SELECT * FROM "Order"
        WHERE customerName LIKE ?
      `).all('%John%');
            expect(orders.length).toBe(1);
            expect(orders[0].customerName).toBe('John Doe');
        });
    });
    describe('Concurrent Order Modifications', () => {
        it('should handle concurrent order updates safely', async () => {
            const order = Factory.createOrder({ userId: testData.users.cashier.id });
            dbHelper.insertOrder(order);
            // Simulate concurrent updates
            const updates = [
                () => db.prepare('UPDATE "Order" SET status = ? WHERE id = ?').run('CONFIRMED', order.id),
                () => db.prepare('UPDATE "Order" SET notes = ? WHERE id = ?').run('Updated note', order.id),
                () => db.prepare('UPDATE "Order" SET discount = ? WHERE id = ?').run(5, order.id)
            ];
            // Run updates concurrently
            await Promise.all(updates.map(update => Promise.resolve(update())));
            const finalOrder = db.prepare('SELECT * FROM "Order" WHERE id = ?').get(order.id);
            expect(finalOrder.status).toBe('CONFIRMED');
            expect(finalOrder.notes).toBe('Updated note');
            expect(finalOrder.discount).toBe(5);
        });
        it('should handle concurrent item additions', async () => {
            const order = Factory.createOrder({ userId: testData.users.cashier.id });
            dbHelper.insertOrder(order);
            const items = [
                Factory.createOrderItem(order.id, testData.menuItems.burger.id),
                Factory.createOrderItem(order.id, testData.menuItems.pizza.id),
                Factory.createOrderItem(order.id, testData.menuItems.cola.id)
            ];
            // Add items concurrently
            await Promise.all(items.map(item => {
                return Promise.resolve(db.prepare(`
            INSERT INTO OrderItem (id, orderId, menuItemId, quantity, price, status, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).run(item.id, item.orderId, item.menuItemId, item.quantity, item.price, item.status, item.createdAt.toISOString(), item.updatedAt.toISOString()));
            }));
            const orderItems = db.prepare('SELECT * FROM OrderItem WHERE orderId = ?').all(order.id);
            expect(orderItems.length).toBe(3);
        });
    });
    describe('Performance Testing', () => {
        it('should handle bulk order creation efficiently', () => {
            const perf = new Performance();
            const orderCount = 100;
            perf.start();
            for (let i = 0; i < orderCount; i++) {
                const order = Factory.createOrder({ userId: testData.users.cashier.id });
                dbHelper.insertOrder(order);
            }
            const duration = perf.end();
            const orders = db.prepare('SELECT COUNT(*) as count FROM "Order"').get();
            expect(orders.count).toBeGreaterThanOrEqual(orderCount);
            // Should complete within 10 seconds for 100 orders (more realistic for CI)
            expect(duration).toBeLessThan(10000);
        });
        it('should retrieve large order lists efficiently', () => {
            // Create 100 orders (reduced for faster test execution)
            for (let i = 0; i < 100; i++) {
                const order = Factory.createOrder({ userId: testData.users.cashier.id });
                dbHelper.insertOrder(order);
            }
            const perf = new Performance();
            perf.start();
            const result = db.prepare('SELECT * FROM "Order" ORDER BY createdAt DESC LIMIT 50').all();
            const duration = perf.end();
            expect(result.length).toBe(50);
            // Should complete within 500ms (more realistic)
            expect(duration).toBeLessThan(500);
        });
    });
});
// Helper function to validate status transitions
function isValidStatusTransition(from, to) {
    const transitions = {
        'DRAFT': ['PENDING', 'CANCELLED'],
        'PENDING': ['CONFIRMED', 'CANCELLED'],
        'CONFIRMED': ['PREPARING', 'CANCELLED'],
        'PREPARING': ['READY', 'CANCELLED'],
        'READY': ['SERVED', 'CANCELLED'],
        'SERVED': ['COMPLETED'],
        'COMPLETED': [],
        'CANCELLED': []
    };
    return transitions[from]?.includes(to) || false;
}
