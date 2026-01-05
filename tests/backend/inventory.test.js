import { describe, it, expect, beforeEach } from '@jest/globals';
import { getTestDatabase } from '../setup/backend.setup';
import { Factory, DbHelper, DateUtil } from '../utils/test-helpers';
import Decimal from 'decimal.js';
describe('Inventory Management', () => {
    let db;
    let dbHelper;
    let testData;
    beforeEach(() => {
        db = getTestDatabase();
        dbHelper = new DbHelper(db);
        testData = dbHelper.seedTestData();
    });
    describe('Inventory CRUD Operations', () => {
        it('should create new inventory item', () => {
            const inventory = Factory.createInventory({
                name: 'Tomatoes',
                currentStock: 50,
                minimumStock: 10,
                unit: 'kg'
            });
            dbHelper.insertInventory(inventory);
            const stored = db.prepare('SELECT * FROM Inventory WHERE id = ?').get(inventory.id);
            expect(stored).toBeDefined();
            expect(stored.name).toBe('Tomatoes');
            expect(stored.currentStock).toBe(50);
            expect(stored.minimumStock).toBe(10);
            expect(stored.unit).toBe('kg');
        });
        it('should update inventory details', () => {
            const inventory = Factory.createInventory();
            dbHelper.insertInventory(inventory);
            // Update inventory
            db.prepare(`
        UPDATE Inventory
        SET currentStock = ?, minimumStock = ?, costPerUnit = ?
        WHERE id = ?
      `).run(75, 15, 7.50, inventory.id);
            const updated = db.prepare('SELECT * FROM Inventory WHERE id = ?').get(inventory.id);
            expect(updated.currentStock).toBe(75);
            expect(updated.minimumStock).toBe(15);
            expect(updated.costPerUnit).toBe(7.50);
        });
        it('should delete inventory item', () => {
            const inventory = Factory.createInventory();
            dbHelper.insertInventory(inventory);
            db.prepare('DELETE FROM Inventory WHERE id = ?').run(inventory.id);
            const deleted = db.prepare('SELECT * FROM Inventory WHERE id = ?').get(inventory.id);
            expect(deleted).toBeUndefined();
        });
        it('should handle inventory categories', () => {
            const categories = ['Vegetables', 'Meat', 'Dairy', 'Beverages', 'Condiments'];
            categories.forEach(category => {
                const inventory = Factory.createInventory({ category });
                dbHelper.insertInventory(inventory);
            });
            const meatItems = db.prepare('SELECT * FROM Inventory WHERE category = ?').all('Meat');
            expect(meatItems.length).toBeGreaterThan(0);
            expect(meatItems[0].category).toBe('Meat');
        });
        it('should track supplier information', () => {
            const inventory = Factory.createInventory({
                supplier: 'Fresh Farms Co.',
                costPerUnit: 5.99
            });
            dbHelper.insertInventory(inventory);
            const stored = db.prepare('SELECT * FROM Inventory WHERE id = ?').get(inventory.id);
            expect(stored.supplier).toBe('Fresh Farms Co.');
            expect(stored.costPerUnit).toBe(5.99);
        });
    });
    describe('Stock Management', () => {
        let inventory;
        beforeEach(() => {
            inventory = Factory.createInventory({
                name: 'Flour',
                currentStock: 100,
                minimumStock: 20
            });
            dbHelper.insertInventory(inventory);
        });
        it('should deduct stock when adding items to order', () => {
            const deductAmount = 10;
            const initialStock = inventory.currentStock;
            // Simulate stock deduction
            db.prepare(`
        UPDATE Inventory
        SET currentStock = currentStock - ?
        WHERE id = ? AND currentStock >= ?
      `).run(deductAmount, inventory.id, deductAmount);
            const updated = db.prepare('SELECT * FROM Inventory WHERE id = ?').get(inventory.id);
            expect(updated.currentStock).toBe(initialStock - deductAmount);
        });
        it('should restore stock when removing items from order', () => {
            // First deduct stock
            db.prepare('UPDATE Inventory SET currentStock = ? WHERE id = ?')
                .run(50, inventory.id);
            // Then restore stock
            const restoreAmount = 10;
            db.prepare(`
        UPDATE Inventory
        SET currentStock = currentStock + ?
        WHERE id = ?
      `).run(restoreAmount, inventory.id);
            const updated = db.prepare('SELECT * FROM Inventory WHERE id = ?').get(inventory.id);
            expect(updated.currentStock).toBe(60);
        });
        it('should prevent negative stock', () => {
            const deductAmount = 150; // More than current stock
            const result = db.prepare(`
        UPDATE Inventory
        SET currentStock = currentStock - ?
        WHERE id = ? AND currentStock >= ?
      `).run(deductAmount, inventory.id, deductAmount);
            expect(result.changes).toBe(0); // No rows updated
            const unchanged = db.prepare('SELECT * FROM Inventory WHERE id = ?').get(inventory.id);
            expect(unchanged.currentStock).toBe(100); // Stock unchanged
        });
        it('should handle concurrent stock updates safely', async () => {
            // Simulate concurrent stock deductions
            const updates = [
                () => db.prepare('UPDATE Inventory SET currentStock = currentStock - ? WHERE id = ? AND currentStock >= ?')
                    .run(5, inventory.id, 5),
                () => db.prepare('UPDATE Inventory SET currentStock = currentStock - ? WHERE id = ? AND currentStock >= ?')
                    .run(3, inventory.id, 3),
                () => db.prepare('UPDATE Inventory SET currentStock = currentStock - ? WHERE id = ? AND currentStock >= ?')
                    .run(7, inventory.id, 7)
            ];
            await Promise.all(updates.map(update => Promise.resolve(update())));
            const final = db.prepare('SELECT * FROM Inventory WHERE id = ?').get(inventory.id);
            expect(final.currentStock).toBe(85); // 100 - 5 - 3 - 7
        });
        it('should track stock history in audit log', () => {
            const userId = testData.users.manager.id;
            const oldStock = inventory.currentStock;
            const newStock = 80;
            // Update stock
            db.prepare('UPDATE Inventory SET currentStock = ? WHERE id = ?')
                .run(newStock, inventory.id);
            // Create audit log
            const auditLog = {
                id: Factory.createInventory().id, // Using factory for unique ID
                action: 'UPDATE_STOCK',
                entityType: 'Inventory',
                entityId: inventory.id,
                userId: userId,
                changes: JSON.stringify({
                    field: 'currentStock',
                    oldValue: oldStock,
                    newValue: newStock
                }),
                timestamp: new Date().toISOString()
            };
            db.prepare(`
        INSERT INTO AuditLog (id, action, entityType, entityId, userId, changes, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(auditLog.id, auditLog.action, auditLog.entityType, auditLog.entityId, auditLog.userId, auditLog.changes, auditLog.timestamp);
            const logs = db.prepare('SELECT * FROM AuditLog WHERE entityId = ?').all(inventory.id);
            expect(logs.length).toBeGreaterThan(0);
            const log = logs[0];
            const changes = JSON.parse(log.changes);
            expect(changes.oldValue).toBe(oldStock);
            expect(changes.newValue).toBe(newStock);
        });
    });
    describe('Low Stock Alerts', () => {
        it('should identify items below minimum stock', () => {
            // Create items with various stock levels
            const items = [
                Factory.createInventory({ name: 'Low Item 1', currentStock: 5, minimumStock: 10 }),
                Factory.createInventory({ name: 'Low Item 2', currentStock: 8, minimumStock: 20 }),
                Factory.createInventory({ name: 'OK Item', currentStock: 50, minimumStock: 10 })
            ];
            items.forEach(item => dbHelper.insertInventory(item));
            // Query for low stock items
            const lowStockItems = db.prepare(`
        SELECT * FROM Inventory
        WHERE currentStock < minimumStock
      `).all();
            expect(lowStockItems.length).toBe(2);
            expect(lowStockItems.every((item) => item.currentStock < item.minimumStock)).toBe(true);
        });
        it('should calculate reorder quantity', () => {
            const inventory = Factory.createInventory({
                currentStock: 5,
                minimumStock: 20
            });
            dbHelper.insertInventory(inventory);
            // Calculate reorder quantity (typically 2x minimum stock)
            const reorderMultiplier = 2;
            const item = db.prepare('SELECT * FROM Inventory WHERE id = ?').get(inventory.id);
            const reorderQuantity = (item.minimumStock * reorderMultiplier) - item.currentStock;
            expect(reorderQuantity).toBe(35); // (20 * 2) - 5
        });
        it('should prioritize critical stock items', () => {
            const items = [
                Factory.createInventory({ name: 'Critical', currentStock: 2, minimumStock: 50 }),
                Factory.createInventory({ name: 'Low', currentStock: 15, minimumStock: 20 }),
                Factory.createInventory({ name: 'Very Low', currentStock: 5, minimumStock: 30 })
            ];
            items.forEach(item => dbHelper.insertInventory(item));
            // Get items sorted by stock criticality
            const criticalItems = db.prepare(`
        SELECT *,
          CAST((minimumStock - currentStock) AS REAL) / minimumStock as criticality
        FROM Inventory
        WHERE currentStock < minimumStock
        ORDER BY criticality DESC
      `).all();
            expect(criticalItems[0].name).toBe('Critical'); // Most critical item first
        });
    });
    describe('Menu Item - Inventory Mapping', () => {
        it('should link menu items to inventory items', () => {
            const burger = testData.menuItems.burger;
            const beef = testData.inventory.beef;
            const cheese = testData.inventory.cheese;
            // Create mappings
            const mappings = [
                {
                    id: Factory.createInventory().id,
                    menuItemId: burger.id,
                    inventoryId: beef.id,
                    quantityPerItem: 0.2 // 200g beef per burger
                },
                {
                    id: Factory.createInventory().id,
                    menuItemId: burger.id,
                    inventoryId: cheese.id,
                    quantityPerItem: 0.05 // 50g cheese per burger
                }
            ];
            mappings.forEach(mapping => {
                db.prepare(`
          INSERT INTO MenuItemInventory (id, menuItemId, inventoryId, quantityPerItem, createdAt)
          VALUES (?, ?, ?, ?, ?)
        `).run(mapping.id, mapping.menuItemId, mapping.inventoryId, mapping.quantityPerItem, new Date().toISOString());
            });
            const burgerInventory = db.prepare(`
        SELECT * FROM MenuItemInventory WHERE menuItemId = ?
      `).all(burger.id);
            expect(burgerInventory.length).toBe(2);
        });
        it('should calculate inventory requirements for order', () => {
            const burger = testData.menuItems.burger;
            const beef = testData.inventory.beef;
            // Create mapping
            db.prepare(`
        INSERT INTO MenuItemInventory (id, menuItemId, inventoryId, quantityPerItem, createdAt)
        VALUES (?, ?, ?, ?, ?)
      `).run(Factory.createInventory().id, burger.id, beef.id, 0.2, // 200g per burger
            new Date().toISOString());
            // Calculate for 5 burgers
            const orderQuantity = 5;
            const mapping = db.prepare(`
        SELECT * FROM MenuItemInventory WHERE menuItemId = ? AND inventoryId = ?
      `).get(burger.id, beef.id);
            const requiredInventory = new Decimal(mapping.quantityPerItem)
                .times(orderQuantity)
                .toNumber();
            expect(requiredInventory).toBe(1); // 0.2 * 5 = 1kg
        });
        it('should handle multiple inventory items per menu item', () => {
            const pizza = testData.menuItems.pizza;
            // Pizza requires multiple ingredients
            const ingredients = [
                { name: 'Pizza Dough', quantity: 0.3 },
                { name: 'Tomato Sauce', quantity: 0.1 },
                { name: 'Mozzarella', quantity: 0.15 },
                { name: 'Toppings', quantity: 0.2 }
            ];
            ingredients.forEach(ingredient => {
                const inv = Factory.createInventory({ name: ingredient.name });
                dbHelper.insertInventory(inv);
                db.prepare(`
          INSERT INTO MenuItemInventory (id, menuItemId, inventoryId, quantityPerItem, createdAt)
          VALUES (?, ?, ?, ?, ?)
        `).run(Factory.createInventory().id, pizza.id, inv.id, ingredient.quantity, new Date().toISOString());
            });
            const pizzaIngredients = db.prepare(`
        SELECT i.name, mii.quantityPerItem
        FROM MenuItemInventory mii
        JOIN Inventory i ON mii.inventoryId = i.id
        WHERE mii.menuItemId = ?
      `).all(pizza.id);
            expect(pizzaIngredients.length).toBe(4);
            const totalWeight = pizzaIngredients.reduce((sum, ing) => {
                return sum + ing.quantityPerItem;
            }, 0);
            expect(totalWeight).toBeCloseTo(0.75, 2); // Total ingredients per pizza
        });
    });
    describe('Expiry Date Management', () => {
        it('should track expiry dates', () => {
            const inventory = Factory.createInventory({
                name: 'Milk',
                expiryDate: DateUtil.addDays(new Date(), 7) // Expires in 7 days
            });
            dbHelper.insertInventory(inventory);
            const stored = db.prepare('SELECT * FROM Inventory WHERE id = ?').get(inventory.id);
            expect(stored.expiryDate).toBeDefined();
            const expiryDate = new Date(stored.expiryDate);
            const daysUntilExpiry = Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
            // Allow 6-8 days due to timing and rounding
            expect(daysUntilExpiry).toBeGreaterThanOrEqual(6);
            expect(daysUntilExpiry).toBeLessThanOrEqual(8);
        });
        it('should identify expired items', () => {
            const items = [
                Factory.createInventory({
                    name: 'Expired Item',
                    expiryDate: DateUtil.addDays(new Date(), -5) // Expired 5 days ago
                }),
                Factory.createInventory({
                    name: 'Fresh Item',
                    expiryDate: DateUtil.addDays(new Date(), 10) // Expires in 10 days
                })
            ];
            items.forEach(item => dbHelper.insertInventory(item));
            const expiredItems = db.prepare(`
        SELECT * FROM Inventory
        WHERE expiryDate < datetime('now')
      `).all();
            expect(expiredItems.length).toBe(1);
            expect(expiredItems[0].name).toBe('Expired Item');
        });
        it('should identify items expiring soon', () => {
            const warningDays = 3; // Warn if expiring within 3 days
            const items = [
                Factory.createInventory({
                    name: 'Expiring Soon',
                    expiryDate: DateUtil.addDays(new Date(), 2)
                }),
                Factory.createInventory({
                    name: 'Still Fresh',
                    expiryDate: DateUtil.addDays(new Date(), 10)
                })
            ];
            items.forEach(item => dbHelper.insertInventory(item));
            const expiringSoon = db.prepare(`
        SELECT * FROM Inventory
        WHERE expiryDate <= datetime('now', '+${warningDays} days')
        AND expiryDate > datetime('now')
      `).all();
            expect(expiringSoon.length).toBe(1);
            expect(expiringSoon[0].name).toBe('Expiring Soon');
        });
    });
    describe('Inventory Reports', () => {
        beforeEach(() => {
            // Create diverse inventory data
            const items = [
                Factory.createInventory({
                    name: 'High Value Item',
                    currentStock: 50,
                    costPerUnit: 100,
                    category: 'Premium'
                }),
                Factory.createInventory({
                    name: 'Low Stock Item',
                    currentStock: 5,
                    minimumStock: 20,
                    costPerUnit: 10,
                    category: 'Essential'
                }),
                Factory.createInventory({
                    name: 'Bulk Item',
                    currentStock: 500,
                    costPerUnit: 2,
                    category: 'Bulk'
                })
            ];
            items.forEach(item => dbHelper.insertInventory(item));
        });
        it('should calculate total inventory value', () => {
            const inventoryValue = db.prepare(`
        SELECT SUM(currentStock * costPerUnit) as totalValue
        FROM Inventory
        WHERE costPerUnit IS NOT NULL
      `).get();
            expect(inventoryValue.totalValue).toBeGreaterThan(0);
        });
        it('should generate inventory by category report', () => {
            const categoryReport = db.prepare(`
        SELECT
          category,
          COUNT(*) as itemCount,
          SUM(currentStock * costPerUnit) as categoryValue
        FROM Inventory
        WHERE category IS NOT NULL
        GROUP BY category
        ORDER BY categoryValue DESC
      `).all();
            expect(categoryReport.length).toBeGreaterThan(0);
            expect(categoryReport[0].category).toBe('Premium'); // Highest value category
        });
        it('should identify slow-moving inventory', () => {
            // Simulate usage data (in real scenario, this would come from order history)
            const slowMovingThreshold = 10; // Items with stock > 10x minimum
            const slowMoving = db.prepare(`
        SELECT * FROM Inventory
        WHERE currentStock > (minimumStock * ?)
        AND minimumStock > 0
      `).all(slowMovingThreshold);
            // Our bulk item should be identified as slow-moving
            expect(slowMoving.some((item) => item.name === 'Bulk Item')).toBe(true);
        });
        it('should calculate inventory turnover rate', () => {
            // In a real scenario, this would use actual usage data
            const mockUsageData = [
                { inventoryId: testData.inventory.beef.id, monthlyUsage: 30 },
                { inventoryId: testData.inventory.cheese.id, monthlyUsage: 20 }
            ];
            mockUsageData.forEach(usage => {
                const inventory = db.prepare('SELECT * FROM Inventory WHERE id = ?')
                    .get(usage.inventoryId);
                const turnoverRate = usage.monthlyUsage / inventory.currentStock;
                expect(turnoverRate).toBeGreaterThan(0);
            });
        });
    });
    describe('Transaction Safety', () => {
        it('should rollback on error during stock update', () => {
            const inventory = Factory.createInventory({ currentStock: 100 });
            dbHelper.insertInventory(inventory);
            const initialStock = 100;
            try {
                db.transaction(() => {
                    // First update succeeds
                    db.prepare('UPDATE Inventory SET currentStock = ? WHERE id = ?')
                        .run(80, inventory.id);
                    // Force an error
                    throw new Error('Transaction error');
                })();
            }
            catch (error) {
                // Transaction should have rolled back
            }
            const unchanged = db.prepare('SELECT * FROM Inventory WHERE id = ?')
                .get(inventory.id);
            expect(unchanged.currentStock).toBe(initialStock);
        });
        it('should maintain consistency during order processing', () => {
            const order = Factory.createOrder();
            const menuItem = testData.menuItems.burger;
            const inventory = testData.inventory.beef;
            // Set initial stock
            db.prepare('UPDATE Inventory SET currentStock = ? WHERE id = ?')
                .run(10, inventory.id);
            // Create menu-inventory mapping
            db.prepare(`
        INSERT INTO MenuItemInventory (id, menuItemId, inventoryId, quantityPerItem, createdAt)
        VALUES (?, ?, ?, ?, ?)
      `).run(Factory.createInventory().id, menuItem.id, inventory.id, 0.5, new Date().toISOString());
            const orderQuantity = 5; // Requires 2.5 units of inventory
            // Process order in transaction
            db.transaction(() => {
                // Insert order
                dbHelper.insertOrder(order);
                // Insert order item
                const orderItem = Factory.createOrderItem(order.id, menuItem.id, {
                    quantity: orderQuantity
                });
                db.prepare(`
          INSERT INTO OrderItem (id, orderId, menuItemId, quantity, price, status, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(orderItem.id, orderItem.orderId, orderItem.menuItemId, orderItem.quantity, orderItem.price, orderItem.status, orderItem.createdAt.toISOString(), orderItem.updatedAt.toISOString());
                // Deduct inventory
                const requiredStock = 0.5 * orderQuantity; // 2.5 units
                db.prepare(`
          UPDATE Inventory
          SET currentStock = currentStock - ?
          WHERE id = ? AND currentStock >= ?
        `).run(requiredStock, inventory.id, requiredStock);
            })();
            // Verify consistency
            const finalInventory = db.prepare('SELECT * FROM Inventory WHERE id = ?')
                .get(inventory.id);
            const orderItems = db.prepare('SELECT * FROM OrderItem WHERE orderId = ?')
                .all(order.id);
            expect(finalInventory.currentStock).toBe(7.5); // 10 - 2.5
            expect(orderItems.length).toBe(1);
            expect(orderItems[0].quantity).toBe(orderQuantity);
        });
    });
    describe('Bulk Operations', () => {
        it('should handle bulk inventory updates', () => {
            const items = [];
            for (let i = 0; i < 50; i++) {
                items.push(Factory.createInventory({ currentStock: 100 }));
            }
            // Bulk insert
            const insertStmt = db.prepare(`
        INSERT INTO Inventory (id, name, description, currentStock, minimumStock, unit, category, supplier, costPerUnit, expiryDate, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
            db.transaction(() => {
                items.forEach(item => {
                    insertStmt.run(item.id, item.name, item.description, item.currentStock, item.minimumStock, item.unit, item.category, item.supplier, item.costPerUnit, item.expiryDate ? item.expiryDate.toISOString() : null, item.createdAt.toISOString(), item.updatedAt.toISOString());
                });
            })();
            // Bulk update
            const updateAmount = 10;
            db.transaction(() => {
                items.forEach(item => {
                    db.prepare('UPDATE Inventory SET currentStock = currentStock - ? WHERE id = ?')
                        .run(updateAmount, item.id);
                });
            })();
            // Verify all items updated
            const updated = db.prepare('SELECT * FROM Inventory WHERE currentStock = ?')
                .all(90);
            expect(updated.length).toBe(50);
        });
        it('should generate bulk reorder list', () => {
            // Create items needing reorder
            const needsReorder = [];
            for (let i = 0; i < 20; i++) {
                const item = Factory.createInventory({
                    name: `Reorder Item ${i}`,
                    currentStock: 5,
                    minimumStock: 20
                });
                needsReorder.push(item);
                dbHelper.insertInventory(item);
            }
            // Generate reorder list with suggested quantities
            const reorderList = db.prepare(`
        SELECT
          name,
          currentStock,
          minimumStock,
          (minimumStock * 2) - currentStock as suggestedOrder,
          supplier,
          costPerUnit,
          (((minimumStock * 2) - currentStock) * costPerUnit) as estimatedCost
        FROM Inventory
        WHERE currentStock < minimumStock
        ORDER BY (minimumStock - currentStock) DESC
      `).all();
            expect(reorderList.length).toBeGreaterThanOrEqual(20);
            reorderList.forEach((item) => {
                expect(item.suggestedOrder).toBeGreaterThan(0);
            });
        });
    });
});
