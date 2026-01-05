import { describe, it, expect, beforeEach } from '@jest/globals';
import { getTestDatabase } from '../setup/backend.setup';
import { Factory, DbHelper } from '../utils/test-helpers';
describe('Add-ons System', () => {
    let db;
    let dbHelper;
    let testData;
    beforeEach(() => {
        db = getTestDatabase();
        dbHelper = new DbHelper(db);
        testData = dbHelper.seedTestData();
    });
    describe('Addon Group Management', () => {
        it('should create addon group', () => {
            const addonGroup = Factory.createAddonGroup({
                name: 'Toppings',
                description: 'Pizza toppings',
                maxSelections: 5,
                isRequired: false
            });
            db.prepare(`
        INSERT INTO AddonGroup (id, name, description, maxSelections, isRequired, displayOrder, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(addonGroup.id, addonGroup.name, addonGroup.description, addonGroup.maxSelections, addonGroup.isRequired ? 1 : 0, addonGroup.displayOrder, addonGroup.createdAt.toISOString(), addonGroup.updatedAt.toISOString());
            const stored = db.prepare('SELECT * FROM AddonGroup WHERE id = ?').get(addonGroup.id);
            expect(stored).toBeDefined();
            expect(stored.name).toBe('Toppings');
            expect(stored.maxSelections).toBe(5);
        });
        it('should update addon group', () => {
            const addonGroup = Factory.createAddonGroup({ name: 'Proteins' });
            db.prepare(`
        INSERT INTO AddonGroup (id, name, description, maxSelections, isRequired, displayOrder, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(addonGroup.id, addonGroup.name, addonGroup.description, addonGroup.maxSelections, addonGroup.isRequired ? 1 : 0, addonGroup.displayOrder, addonGroup.createdAt.toISOString(), addonGroup.updatedAt.toISOString());
            db.prepare('UPDATE AddonGroup SET name = ?, maxSelections = ? WHERE id = ?')
                .run('Premium Proteins', 3, addonGroup.id);
            const updated = db.prepare('SELECT * FROM AddonGroup WHERE id = ?').get(addonGroup.id);
            expect(updated.name).toBe('Premium Proteins');
            expect(updated.maxSelections).toBe(3);
        });
        it('should delete addon group', () => {
            const addonGroup = Factory.createAddonGroup();
            db.prepare(`
        INSERT INTO AddonGroup (id, name, description, maxSelections, isRequired, displayOrder, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(addonGroup.id, addonGroup.name, addonGroup.description, addonGroup.maxSelections, addonGroup.isRequired ? 1 : 0, addonGroup.displayOrder, addonGroup.createdAt.toISOString(), addonGroup.updatedAt.toISOString());
            db.prepare('DELETE FROM AddonGroup WHERE id = ?').run(addonGroup.id);
            const deleted = db.prepare('SELECT * FROM AddonGroup WHERE id = ?').get(addonGroup.id);
            expect(deleted).toBeUndefined();
        });
        it('should support required addon groups', () => {
            const requiredGroup = Factory.createAddonGroup({
                name: 'Size',
                isRequired: true
            });
            db.prepare(`
        INSERT INTO AddonGroup (id, name, description, maxSelections, isRequired, displayOrder, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(requiredGroup.id, requiredGroup.name, requiredGroup.description, requiredGroup.maxSelections, requiredGroup.isRequired ? 1 : 0, requiredGroup.displayOrder, requiredGroup.createdAt.toISOString(), requiredGroup.updatedAt.toISOString());
            const stored = db.prepare('SELECT * FROM AddonGroup WHERE id = ?').get(requiredGroup.id);
            expect(stored.isRequired).toBe(1);
        });
        it('should maintain display order', () => {
            const groups = [
                Factory.createAddonGroup({ name: 'Group 1', displayOrder: 1 }),
                Factory.createAddonGroup({ name: 'Group 2', displayOrder: 2 }),
                Factory.createAddonGroup({ name: 'Group 3', displayOrder: 0 })
            ];
            groups.forEach(group => {
                db.prepare(`
          INSERT INTO AddonGroup (id, name, description, maxSelections, isRequired, displayOrder, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(group.id, group.name, group.description, group.maxSelections, group.isRequired ? 1 : 0, group.displayOrder, group.createdAt.toISOString(), group.updatedAt.toISOString());
            });
            const ordered = db.prepare('SELECT * FROM AddonGroup ORDER BY displayOrder').all();
            expect(ordered[0].displayOrder).toBe(0);
            expect(ordered[ordered.length - 1].displayOrder).toBe(2);
        });
    });
    describe('Addon Management', () => {
        let addonGroup;
        beforeEach(() => {
            addonGroup = Factory.createAddonGroup({ name: 'Sizes' });
            db.prepare(`
        INSERT INTO AddonGroup (id, name, description, maxSelections, isRequired, displayOrder, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(addonGroup.id, addonGroup.name, addonGroup.description, addonGroup.maxSelections, addonGroup.isRequired ? 1 : 0, addonGroup.displayOrder, addonGroup.createdAt.toISOString(), addonGroup.updatedAt.toISOString());
        });
        it('should create addon', () => {
            const addon = Factory.createAddon(addonGroup.id, {
                name: 'Large',
                price: 2.00
            });
            db.prepare(`
        INSERT INTO Addon (id, groupId, name, description, price, isAvailable, inventoryId, displayOrder, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(addon.id, addon.groupId, addon.name, addon.description, addon.price, addon.isAvailable ? 1 : 0, addon.inventoryId, addon.displayOrder, addon.createdAt.toISOString(), addon.updatedAt.toISOString());
            const stored = db.prepare('SELECT * FROM Addon WHERE id = ?').get(addon.id);
            expect(stored).toBeDefined();
            expect(stored.name).toBe('Large');
            expect(stored.price).toBe(2.00);
        });
        it('should create multiple addons in same group', () => {
            const addons = [
                Factory.createAddon(addonGroup.id, { name: 'Small', price: 0 }),
                Factory.createAddon(addonGroup.id, { name: 'Medium', price: 1.00 }),
                Factory.createAddon(addonGroup.id, { name: 'Large', price: 2.00 }),
                Factory.createAddon(addonGroup.id, { name: 'Extra Large', price: 3.00 })
            ];
            addons.forEach(addon => {
                db.prepare(`
          INSERT INTO Addon (id, groupId, name, description, price, isAvailable, inventoryId, displayOrder, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(addon.id, addon.groupId, addon.name, addon.description, addon.price, addon.isAvailable ? 1 : 0, addon.inventoryId, addon.displayOrder, addon.createdAt.toISOString(), addon.updatedAt.toISOString());
            });
            const groupAddons = db.prepare('SELECT * FROM Addon WHERE groupId = ?').all(addonGroup.id);
            expect(groupAddons.length).toBe(4);
        });
        it('should update addon details', () => {
            const addon = Factory.createAddon(addonGroup.id);
            db.prepare(`
        INSERT INTO Addon (id, groupId, name, description, price, isAvailable, inventoryId, displayOrder, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(addon.id, addon.groupId, addon.name, addon.description, addon.price, addon.isAvailable ? 1 : 0, addon.inventoryId, addon.displayOrder, addon.createdAt.toISOString(), addon.updatedAt.toISOString());
            db.prepare('UPDATE Addon SET name = ?, price = ? WHERE id = ?')
                .run('Premium Option', 5.00, addon.id);
            const updated = db.prepare('SELECT * FROM Addon WHERE id = ?').get(addon.id);
            expect(updated.name).toBe('Premium Option');
            expect(updated.price).toBe(5.00);
        });
        it('should toggle addon availability', () => {
            const addon = Factory.createAddon(addonGroup.id);
            db.prepare(`
        INSERT INTO Addon (id, groupId, name, description, price, isAvailable, inventoryId, displayOrder, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(addon.id, addon.groupId, addon.name, addon.description, addon.price, addon.isAvailable ? 1 : 0, addon.inventoryId, addon.displayOrder, addon.createdAt.toISOString(), addon.updatedAt.toISOString());
            db.prepare('UPDATE Addon SET isAvailable = ? WHERE id = ?').run(0, addon.id);
            let updated = db.prepare('SELECT * FROM Addon WHERE id = ?').get(addon.id);
            expect(updated.isAvailable).toBe(0);
            db.prepare('UPDATE Addon SET isAvailable = ? WHERE id = ?').run(1, addon.id);
            updated = db.prepare('SELECT * FROM Addon WHERE id = ?').get(addon.id);
            expect(updated.isAvailable).toBe(1);
        });
        it('should link addon to inventory', () => {
            const inventory = testData.inventory.cheese;
            const addon = Factory.createAddon(addonGroup.id, {
                name: 'Extra Cheese',
                inventoryId: inventory.id
            });
            db.prepare(`
        INSERT INTO Addon (id, groupId, name, description, price, isAvailable, inventoryId, displayOrder, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(addon.id, addon.groupId, addon.name, addon.description, addon.price, addon.isAvailable ? 1 : 0, addon.inventoryId, addon.displayOrder, addon.createdAt.toISOString(), addon.updatedAt.toISOString());
            const stored = db.prepare('SELECT * FROM Addon WHERE id = ?').get(addon.id);
            expect(stored.inventoryId).toBe(inventory.id);
        });
    });
    describe('Category-Addon Group Assignment', () => {
        let addonGroup;
        beforeEach(() => {
            addonGroup = Factory.createAddonGroup({ name: 'Toppings' });
            db.prepare(`
        INSERT INTO AddonGroup (id, name, description, maxSelections, isRequired, displayOrder, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(addonGroup.id, addonGroup.name, addonGroup.description, addonGroup.maxSelections, addonGroup.isRequired ? 1 : 0, addonGroup.displayOrder, addonGroup.createdAt.toISOString(), addonGroup.updatedAt.toISOString());
        });
        it('should assign addon group to category', () => {
            const assignment = {
                id: Factory.createAddon(addonGroup.id).id,
                categoryId: testData.categories.foodCategory.id,
                addonGroupId: addonGroup.id
            };
            db.prepare(`
        INSERT INTO CategoryAddonGroup (id, categoryId, addonGroupId, createdAt)
        VALUES (?, ?, ?, ?)
      `).run(assignment.id, assignment.categoryId, assignment.addonGroupId, new Date().toISOString());
            const stored = db.prepare('SELECT * FROM CategoryAddonGroup WHERE id = ?').get(assignment.id);
            expect(stored).toBeDefined();
            expect(stored.categoryId).toBe(testData.categories.foodCategory.id);
            expect(stored.addonGroupId).toBe(addonGroup.id);
        });
        it('should get addon groups for category', () => {
            const groups = [
                Factory.createAddonGroup({ name: 'Group 1' }),
                Factory.createAddonGroup({ name: 'Group 2' })
            ];
            groups.forEach(group => {
                db.prepare(`
          INSERT INTO AddonGroup (id, name, description, maxSelections, isRequired, displayOrder, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(group.id, group.name, group.description, group.maxSelections, group.isRequired ? 1 : 0, group.displayOrder, group.createdAt.toISOString(), group.updatedAt.toISOString());
                db.prepare(`
          INSERT INTO CategoryAddonGroup (id, categoryId, addonGroupId, createdAt)
          VALUES (?, ?, ?, ?)
        `).run(Factory.createAddon(group.id).id, testData.categories.foodCategory.id, group.id, new Date().toISOString());
            });
            const categoryGroups = db.prepare(`
        SELECT ag.*
        FROM AddonGroup ag
        JOIN CategoryAddonGroup cag ON ag.id = cag.addonGroupId
        WHERE cag.categoryId = ?
      `).all(testData.categories.foodCategory.id);
            expect(categoryGroups.length).toBeGreaterThanOrEqual(2);
        });
        it('should prevent duplicate category-group assignments', () => {
            const assignment = {
                id: Factory.createAddon(addonGroup.id).id,
                categoryId: testData.categories.foodCategory.id,
                addonGroupId: addonGroup.id
            };
            db.prepare(`
        INSERT INTO CategoryAddonGroup (id, categoryId, addonGroupId, createdAt)
        VALUES (?, ?, ?, ?)
      `).run(assignment.id, assignment.categoryId, assignment.addonGroupId, new Date().toISOString());
            // Try to insert duplicate
            const duplicate = {
                id: Factory.createAddon(addonGroup.id).id,
                categoryId: testData.categories.foodCategory.id,
                addonGroupId: addonGroup.id
            };
            expect(() => {
                db.prepare(`
          INSERT INTO CategoryAddonGroup (id, categoryId, addonGroupId, createdAt)
          VALUES (?, ?, ?, ?)
        `).run(duplicate.id, duplicate.categoryId, duplicate.addonGroupId, new Date().toISOString());
            }).toThrow();
        });
    });
    describe('Order Item Addons', () => {
        let order;
        let orderItem;
        let addonGroup;
        let addon;
        beforeEach(() => {
            order = Factory.createOrder();
            dbHelper.insertOrder(order);
            orderItem = Factory.createOrderItem(order.id, testData.menuItems.burger.id);
            db.prepare(`
        INSERT INTO OrderItem (id, orderId, menuItemId, quantity, price, status, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(orderItem.id, orderItem.orderId, orderItem.menuItemId, orderItem.quantity, orderItem.price, orderItem.status, orderItem.createdAt.toISOString(), orderItem.updatedAt.toISOString());
            addonGroup = Factory.createAddonGroup({ name: 'Extras' });
            db.prepare(`
        INSERT INTO AddonGroup (id, name, description, maxSelections, isRequired, displayOrder, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(addonGroup.id, addonGroup.name, addonGroup.description, addonGroup.maxSelections, addonGroup.isRequired ? 1 : 0, addonGroup.displayOrder, addonGroup.createdAt.toISOString(), addonGroup.updatedAt.toISOString());
            addon = Factory.createAddon(addonGroup.id, { name: 'Bacon', price: 1.50 });
            db.prepare(`
        INSERT INTO Addon (id, groupId, name, description, price, isAvailable, inventoryId, displayOrder, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(addon.id, addon.groupId, addon.name, addon.description, addon.price, addon.isAvailable ? 1 : 0, addon.inventoryId, addon.displayOrder, addon.createdAt.toISOString(), addon.updatedAt.toISOString());
        });
        it('should add addon to order item', () => {
            const orderItemAddon = {
                id: Factory.createAddon(addonGroup.id).id,
                orderItemId: orderItem.id,
                addonId: addon.id,
                quantity: 1,
                price: addon.price
            };
            db.prepare(`
        INSERT INTO OrderItemAddon (id, orderItemId, addonId, quantity, price, createdAt)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(orderItemAddon.id, orderItemAddon.orderItemId, orderItemAddon.addonId, orderItemAddon.quantity, orderItemAddon.price, new Date().toISOString());
            const stored = db.prepare('SELECT * FROM OrderItemAddon WHERE id = ?').get(orderItemAddon.id);
            expect(stored).toBeDefined();
            expect(stored.addonId).toBe(addon.id);
            expect(stored.price).toBe(1.50);
        });
        it('should add multiple addons to order item', () => {
            const addons = [
                Factory.createAddon(addonGroup.id, { name: 'Bacon', price: 1.50 }),
                Factory.createAddon(addonGroup.id, { name: 'Cheese', price: 1.00 }),
                Factory.createAddon(addonGroup.id, { name: 'Avocado', price: 2.00 })
            ];
            addons.forEach(addon => {
                db.prepare(`
          INSERT INTO Addon (id, groupId, name, description, price, isAvailable, inventoryId, displayOrder, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(addon.id, addon.groupId, addon.name, addon.description, addon.price, addon.isAvailable ? 1 : 0, addon.inventoryId, addon.displayOrder, addon.createdAt.toISOString(), addon.updatedAt.toISOString());
                db.prepare(`
          INSERT INTO OrderItemAddon (id, orderItemId, addonId, quantity, price, createdAt)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(Factory.createAddon(addonGroup.id).id, orderItem.id, addon.id, 1, addon.price, new Date().toISOString());
            });
            const itemAddons = db.prepare('SELECT * FROM OrderItemAddon WHERE orderItemId = ?')
                .all(orderItem.id);
            expect(itemAddons.length).toBe(3);
        });
        it('should calculate total with addons', () => {
            const addons = [
                { price: 1.50 },
                { price: 1.00 },
                { price: 2.00 }
            ];
            const basePrice = orderItem.price * orderItem.quantity;
            const addonsTotal = addons.reduce((sum, addon) => sum + addon.price, 0);
            const total = basePrice + addonsTotal;
            expect(total).toBe(basePrice + 4.50);
        });
        it('should handle addon quantity', () => {
            const orderItemAddon = {
                id: Factory.createAddon(addonGroup.id).id,
                orderItemId: orderItem.id,
                addonId: addon.id,
                quantity: 3, // Triple the addon
                price: addon.price
            };
            db.prepare(`
        INSERT INTO OrderItemAddon (id, orderItemId, addonId, quantity, price, createdAt)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(orderItemAddon.id, orderItemAddon.orderItemId, orderItemAddon.addonId, orderItemAddon.quantity, orderItemAddon.price, new Date().toISOString());
            const stored = db.prepare('SELECT * FROM OrderItemAddon WHERE id = ?').get(orderItemAddon.id);
            const addonTotal = stored.price * stored.quantity;
            expect(addonTotal).toBe(4.50); // 1.50 * 3
        });
    });
    describe('Addon Search and Filtering', () => {
        let addonGroup;
        beforeEach(() => {
            addonGroup = Factory.createAddonGroup({ name: 'Proteins' });
            db.prepare(`
        INSERT INTO AddonGroup (id, name, description, maxSelections, isRequired, displayOrder, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(addonGroup.id, addonGroup.name, addonGroup.description, addonGroup.maxSelections, addonGroup.isRequired ? 1 : 0, addonGroup.displayOrder, addonGroup.createdAt.toISOString(), addonGroup.updatedAt.toISOString());
            const addons = [
                Factory.createAddon(addonGroup.id, { name: 'Chicken', price: 3.00 }),
                Factory.createAddon(addonGroup.id, { name: 'Beef', price: 4.00 }),
                Factory.createAddon(addonGroup.id, { name: 'Shrimp', price: 5.00, isAvailable: false })
            ];
            addons.forEach(addon => {
                db.prepare(`
          INSERT INTO Addon (id, groupId, name, description, price, isAvailable, inventoryId, displayOrder, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(addon.id, addon.groupId, addon.name, addon.description, addon.price, addon.isAvailable ? 1 : 0, addon.inventoryId, addon.displayOrder, addon.createdAt.toISOString(), addon.updatedAt.toISOString());
            });
        });
        it('should search addons by name', () => {
            const results = db.prepare('SELECT * FROM Addon WHERE name LIKE ?').all('%Beef%');
            expect(results.length).toBeGreaterThan(0);
            expect(results[0].name).toBe('Beef');
        });
        it('should filter available addons', () => {
            const available = db.prepare('SELECT * FROM Addon WHERE isAvailable = 1 AND groupId = ?')
                .all(addonGroup.id);
            const unavailable = db.prepare('SELECT * FROM Addon WHERE isAvailable = 0 AND groupId = ?')
                .all(addonGroup.id);
            expect(available.length).toBe(2);
            expect(unavailable.length).toBe(1);
        });
        it('should get addons by group', () => {
            const groupAddons = db.prepare('SELECT * FROM Addon WHERE groupId = ?').all(addonGroup.id);
            expect(groupAddons.length).toBe(3);
        });
        it('should sort addons by price', () => {
            const addonsAsc = db.prepare('SELECT * FROM Addon WHERE groupId = ? ORDER BY price ASC')
                .all(addonGroup.id);
            expect(addonsAsc[0].price).toBeLessThanOrEqual(addonsAsc[1].price);
        });
    });
    describe('Addon Validation', () => {
        it('should enforce max selections limit', () => {
            const addonGroup = Factory.createAddonGroup({
                name: 'Toppings',
                maxSelections: 3
            });
            const selectedCount = 4; // Exceeds limit
            const isValid = selectedCount <= (addonGroup.maxSelections || Infinity);
            expect(isValid).toBe(false);
        });
        it('should enforce required addon groups', () => {
            const requiredGroup = Factory.createAddonGroup({
                name: 'Size',
                isRequired: true
            });
            const selectedAddons = []; // No selection
            const isValid = !requiredGroup.isRequired || selectedAddons.length > 0;
            expect(isValid).toBe(false);
        });
        it('should validate addon price is non-negative', () => {
            const addon = Factory.createAddon('group-id', { price: -1.00 });
            expect(addon.price >= 0).toBe(false);
        });
    });
    describe('Addon Performance', () => {
        it('should efficiently load addons for category', () => {
            // Create addon groups and assign to category
            for (let i = 0; i < 10; i++) {
                const group = Factory.createAddonGroup({ name: `Group ${i}` });
                db.prepare(`
          INSERT INTO AddonGroup (id, name, description, maxSelections, isRequired, displayOrder, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(group.id, group.name, group.description, group.maxSelections, group.isRequired ? 1 : 0, group.displayOrder, group.createdAt.toISOString(), group.updatedAt.toISOString());
                // Add 5 addons per group
                for (let j = 0; j < 5; j++) {
                    const addon = Factory.createAddon(group.id, { name: `Addon ${i}-${j}` });
                    db.prepare(`
            INSERT INTO Addon (id, groupId, name, description, price, isAvailable, inventoryId, displayOrder, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(addon.id, addon.groupId, addon.name, addon.description, addon.price, addon.isAvailable ? 1 : 0, addon.inventoryId, addon.displayOrder, addon.createdAt.toISOString(), addon.updatedAt.toISOString());
                }
            }
            const startTime = performance.now();
            const result = db.prepare(`
        SELECT ag.*, a.*
        FROM AddonGroup ag
        JOIN Addon a ON ag.id = a.groupId
        WHERE a.isAvailable = 1
      `).all();
            const duration = performance.now() - startTime;
            expect(result.length).toBe(50); // 10 groups * 5 addons
            expect(duration).toBeLessThan(100);
        });
    });
});
