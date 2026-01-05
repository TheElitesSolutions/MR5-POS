import { describe, it, expect, beforeEach } from '@jest/globals';
import { getTestDatabase } from '../setup/backend.setup';
import { Factory, DbHelper } from '../utils/test-helpers';
import Decimal from 'decimal.js';
describe('Menu Management', () => {
    let db;
    let dbHelper;
    let testData;
    beforeEach(() => {
        db = getTestDatabase();
        dbHelper = new DbHelper(db);
        testData = dbHelper.seedTestData();
    });
    describe('Menu Item CRUD Operations', () => {
        it('should create a new menu item', () => {
            const menuItem = Factory.createMenuItem({
                name: 'Spaghetti Carbonara',
                description: 'Classic Italian pasta dish',
                price: 14.99,
                categoryId: testData.categories.foodCategory.id
            });
            dbHelper.insertMenuItem(menuItem);
            const stored = db.prepare('SELECT * FROM MenuItem WHERE id = ?').get(menuItem.id);
            expect(stored).toBeDefined();
            expect(stored.name).toBe('Spaghetti Carbonara');
            expect(stored.price).toBe(14.99);
            expect(stored.isAvailable).toBe(1);
        });
        it('should update menu item details', () => {
            const menuItem = testData.menuItems.burger;
            db.prepare(`
        UPDATE MenuItem
        SET name = ?, price = ?, description = ?
        WHERE id = ?
      `).run('Premium Burger', 15.99, 'Upgraded burger with premium ingredients', menuItem.id);
            const updated = db.prepare('SELECT * FROM MenuItem WHERE id = ?').get(menuItem.id);
            expect(updated.name).toBe('Premium Burger');
            expect(updated.price).toBe(15.99);
            expect(updated.description).toBe('Upgraded burger with premium ingredients');
        });
        it('should delete menu item', () => {
            const menuItem = Factory.createMenuItem();
            dbHelper.insertMenuItem(menuItem);
            db.prepare('DELETE FROM MenuItem WHERE id = ?').run(menuItem.id);
            const deleted = db.prepare('SELECT * FROM MenuItem WHERE id = ?').get(menuItem.id);
            expect(deleted).toBeUndefined();
        });
        it('should toggle menu item availability', () => {
            const menuItem = testData.menuItems.burger;
            // Make unavailable
            db.prepare('UPDATE MenuItem SET isAvailable = ? WHERE id = ?').run(0, menuItem.id);
            let updated = db.prepare('SELECT * FROM MenuItem WHERE id = ?').get(menuItem.id);
            expect(updated.isAvailable).toBe(0);
            // Make available again
            db.prepare('UPDATE MenuItem SET isAvailable = ? WHERE id = ?').run(1, menuItem.id);
            updated = db.prepare('SELECT * FROM MenuItem WHERE id = ?').get(menuItem.id);
            expect(updated.isAvailable).toBe(1);
        });
        it('should handle price updates with decimal precision', () => {
            const menuItem = testData.menuItems.pizza;
            const newPrice = new Decimal('19.95').toNumber();
            db.prepare('UPDATE MenuItem SET price = ? WHERE id = ?').run(newPrice, menuItem.id);
            const updated = db.prepare('SELECT * FROM MenuItem WHERE id = ?').get(menuItem.id);
            expect(updated.price).toBe(19.95);
        });
    });
    describe('Category Management', () => {
        it('should create a new category', () => {
            const category = Factory.createCategory({
                name: 'Appetizers',
                color: '#FF6B6B'
            });
            dbHelper.insertCategory(category);
            const stored = db.prepare('SELECT * FROM MenuItemCategory WHERE id = ?').get(category.id);
            expect(stored).toBeDefined();
            expect(stored.name).toBe('Appetizers');
            expect(stored.color).toBe('#FF6B6B');
        });
        it('should update category details', () => {
            const category = testData.categories.foodCategory;
            db.prepare('UPDATE MenuItemCategory SET name = ?, color = ? WHERE id = ?')
                .run('Main Courses', '#4ECDC4', category.id);
            const updated = db.prepare('SELECT * FROM MenuItemCategory WHERE id = ?').get(category.id);
            expect(updated.name).toBe('Main Courses');
            expect(updated.color).toBe('#4ECDC4');
        });
        it('should delete category', () => {
            const category = Factory.createCategory({ name: 'Temp Category' });
            dbHelper.insertCategory(category);
            db.prepare('DELETE FROM MenuItemCategory WHERE id = ?').run(category.id);
            const deleted = db.prepare('SELECT * FROM MenuItemCategory WHERE id = ?').get(category.id);
            expect(deleted).toBeUndefined();
        });
        it('should list all categories', () => {
            const categories = db.prepare('SELECT * FROM MenuItemCategory ORDER BY name').all();
            expect(categories.length).toBeGreaterThanOrEqual(2);
        });
        it('should assign category to menu item', () => {
            const category = Factory.createCategory({ name: 'Desserts' });
            dbHelper.insertCategory(category);
            const menuItem = Factory.createMenuItem({
                name: 'Chocolate Cake',
                categoryId: category.id
            });
            dbHelper.insertMenuItem(menuItem);
            const stored = db.prepare('SELECT * FROM MenuItem WHERE id = ?').get(menuItem.id);
            expect(stored.categoryId).toBe(category.id);
        });
    });
    describe('Menu Item Search and Filtering', () => {
        beforeEach(() => {
            // Add more menu items for testing
            const items = [
                Factory.createMenuItem({ name: 'Margherita Pizza', categoryId: testData.categories.foodCategory.id }),
                Factory.createMenuItem({ name: 'Pepperoni Pizza', categoryId: testData.categories.foodCategory.id }),
                Factory.createMenuItem({ name: 'Iced Coffee', categoryId: testData.categories.drinkCategory.id }),
                Factory.createMenuItem({ name: 'Hot Coffee', categoryId: testData.categories.drinkCategory.id, isAvailable: false })
            ];
            items.forEach(item => dbHelper.insertMenuItem(item));
        });
        it('should search menu items by name', () => {
            const results = db.prepare('SELECT * FROM MenuItem WHERE name LIKE ?').all('%Pizza%');
            expect(results.length).toBeGreaterThanOrEqual(3); // Original pizza + 2 new ones
        });
        it('should filter menu items by category', () => {
            const foodItems = db.prepare('SELECT * FROM MenuItem WHERE categoryId = ?')
                .all(testData.categories.foodCategory.id);
            const drinkItems = db.prepare('SELECT * FROM MenuItem WHERE categoryId = ?')
                .all(testData.categories.drinkCategory.id);
            expect(foodItems.length).toBeGreaterThanOrEqual(4);
            expect(drinkItems.length).toBeGreaterThanOrEqual(3);
        });
        it('should filter available menu items only', () => {
            const availableItems = db.prepare('SELECT * FROM MenuItem WHERE isAvailable = 1').all();
            const unavailableItems = db.prepare('SELECT * FROM MenuItem WHERE isAvailable = 0').all();
            expect(availableItems.length).toBeGreaterThan(0);
            expect(unavailableItems.length).toBeGreaterThan(0);
        });
        it('should filter menu items by price range', () => {
            const minPrice = 10.00;
            const maxPrice = 20.00;
            const itemsInRange = db.prepare(`
        SELECT * FROM MenuItem
        WHERE price >= ? AND price <= ?
      `).all(minPrice, maxPrice);
            expect(itemsInRange.every((item) => item.price >= minPrice && item.price <= maxPrice)).toBe(true);
        });
        it('should sort menu items by price', () => {
            const itemsAsc = db.prepare('SELECT * FROM MenuItem ORDER BY price ASC').all();
            const itemsDesc = db.prepare('SELECT * FROM MenuItem ORDER BY price DESC').all();
            expect(itemsAsc[0].price).toBeLessThanOrEqual(itemsAsc[1].price);
            expect(itemsDesc[0].price).toBeGreaterThanOrEqual(itemsDesc[1].price);
        });
        it('should get menu items with category information', () => {
            const itemsWithCategory = db.prepare(`
        SELECT mi.*, mc.name as categoryName, mc.color as categoryColor
        FROM MenuItem mi
        LEFT JOIN MenuItemCategory mc ON mi.categoryId = mc.id
        WHERE mi.isAvailable = 1
      `).all();
            expect(itemsWithCategory.length).toBeGreaterThan(0);
            const itemWithCategory = itemsWithCategory.find((item) => item.categoryId !== null);
            expect(itemWithCategory.categoryName).toBeDefined();
        });
    });
    describe('Menu Item Statistics', () => {
        it('should count menu items by category', () => {
            const stats = db.prepare(`
        SELECT
          mc.name as categoryName,
          COUNT(mi.id) as itemCount
        FROM MenuItemCategory mc
        LEFT JOIN MenuItem mi ON mc.id = mi.categoryId
        GROUP BY mc.id, mc.name
      `).all();
            expect(stats.length).toBeGreaterThanOrEqual(2);
            stats.forEach((stat) => {
                expect(stat.itemCount).toBeGreaterThanOrEqual(0);
            });
        });
        it('should calculate average price by category', () => {
            const avgPrices = db.prepare(`
        SELECT
          mc.name as categoryName,
          AVG(mi.price) as avgPrice,
          MIN(mi.price) as minPrice,
          MAX(mi.price) as maxPrice
        FROM MenuItemCategory mc
        JOIN MenuItem mi ON mc.id = mi.categoryId
        GROUP BY mc.id, mc.name
      `).all();
            expect(avgPrices.length).toBeGreaterThan(0);
            avgPrices.forEach((stat) => {
                expect(stat.avgPrice).toBeGreaterThan(0);
                expect(stat.minPrice).toBeLessThanOrEqual(stat.maxPrice);
            });
        });
        it('should identify most expensive items', () => {
            const topItems = db.prepare(`
        SELECT * FROM MenuItem
        ORDER BY price DESC
        LIMIT 5
      `).all();
            expect(topItems.length).toBeGreaterThan(0);
            if (topItems.length > 1) {
                expect(topItems[0].price).toBeGreaterThanOrEqual(topItems[1].price);
            }
        });
        it('should calculate menu coverage percentage', () => {
            const totalItems = db.prepare('SELECT COUNT(*) as count FROM MenuItem').get();
            const availableItems = db.prepare('SELECT COUNT(*) as count FROM MenuItem WHERE isAvailable = 1').get();
            const coveragePercent = (availableItems.count / totalItems.count) * 100;
            expect(coveragePercent).toBeGreaterThan(0);
            expect(coveragePercent).toBeLessThanOrEqual(100);
        });
    });
    describe('Menu Item Validation', () => {
        it('should validate required fields', () => {
            const invalidItem = {
                id: Factory.createMenuItem().id,
                // Missing name and price
            };
            expect(() => {
                db.prepare('INSERT INTO MenuItem (id) VALUES (?)').run(invalidItem.id);
            }).toThrow();
        });
        it('should validate price is positive', () => {
            const menuItem = Factory.createMenuItem({ price: -10.00 });
            // Application layer validation
            expect(menuItem.price < 0).toBe(true);
            expect(isValidPrice(menuItem.price)).toBe(false);
        });
        it('should validate price decimal places', () => {
            const prices = [9.99, 10.50, 15.00, 7.95];
            prices.forEach(price => {
                const decimalPlaces = (price.toString().split('.')[1] || '').length;
                expect(decimalPlaces).toBeLessThanOrEqual(2);
            });
        });
        it('should validate category exists before assignment', () => {
            const nonExistentCategoryId = 'non-existent-category';
            const category = db.prepare('SELECT * FROM MenuItemCategory WHERE id = ?')
                .get(nonExistentCategoryId);
            expect(category).toBeUndefined();
        });
    });
    describe('Image Management', () => {
        it('should store image URL for menu item', () => {
            const menuItem = Factory.createMenuItem({
                imageUrl: 'https://example.com/images/burger.jpg'
            });
            dbHelper.insertMenuItem(menuItem);
            const stored = db.prepare('SELECT * FROM MenuItem WHERE id = ?').get(menuItem.id);
            expect(stored.imageUrl).toBe('https://example.com/images/burger.jpg');
        });
        it('should handle menu items without images', () => {
            const menuItem = Factory.createMenuItem({ imageUrl: null });
            dbHelper.insertMenuItem(menuItem);
            const stored = db.prepare('SELECT * FROM MenuItem WHERE id = ?').get(menuItem.id);
            expect(stored.imageUrl).toBeNull();
        });
        it('should update menu item image', () => {
            const menuItem = testData.menuItems.burger;
            const newImageUrl = 'https://example.com/images/premium-burger.jpg';
            db.prepare('UPDATE MenuItem SET imageUrl = ? WHERE id = ?').run(newImageUrl, menuItem.id);
            const updated = db.prepare('SELECT * FROM MenuItem WHERE id = ?').get(menuItem.id);
            expect(updated.imageUrl).toBe(newImageUrl);
        });
    });
    describe('Menu Item Customization', () => {
        it('should support customizable items flag', () => {
            // In a real app, this might be a separate field
            const customizableItem = Factory.createMenuItem({
                name: 'Build Your Own Pizza',
                description: 'Customizable pizza - choose your toppings'
            });
            dbHelper.insertMenuItem(customizableItem);
            const stored = db.prepare('SELECT * FROM MenuItem WHERE id = ?').get(customizableItem.id);
            expect(stored.description).toContain('Customizable');
        });
    });
    describe('Bulk Menu Operations', () => {
        it('should handle bulk price updates', () => {
            const category = testData.categories.foodCategory;
            const priceIncrease = 1.50;
            db.prepare(`
        UPDATE MenuItem
        SET price = price + ?
        WHERE categoryId = ?
      `).run(priceIncrease, category.id);
            const updatedItems = db.prepare('SELECT * FROM MenuItem WHERE categoryId = ?')
                .all(category.id);
            expect(updatedItems.length).toBeGreaterThan(0);
        });
        it('should handle bulk availability updates', () => {
            const category = testData.categories.drinkCategory;
            // Make all drinks unavailable
            db.prepare('UPDATE MenuItem SET isAvailable = 0 WHERE categoryId = ?')
                .run(category.id);
            const unavailableDrinks = db.prepare(`
        SELECT * FROM MenuItem
        WHERE categoryId = ? AND isAvailable = 0
      `).all(category.id);
            expect(unavailableDrinks.length).toBeGreaterThan(0);
        });
        it('should import multiple menu items', () => {
            const items = [];
            for (let i = 0; i < 20; i++) {
                items.push(Factory.createMenuItem({
                    name: `Imported Item ${i}`,
                    categoryId: testData.categories.foodCategory.id
                }));
            }
            db.transaction(() => {
                items.forEach(item => dbHelper.insertMenuItem(item));
            })();
            const imported = db.prepare(`
        SELECT * FROM MenuItem
        WHERE name LIKE 'Imported Item%'
      `).all();
            expect(imported.length).toBe(20);
        });
    });
    describe('Menu Item Popularity Tracking', () => {
        it('should track order counts per menu item', () => {
            // Create orders with items
            const order1 = Factory.createOrder();
            const order2 = Factory.createOrder();
            dbHelper.insertOrder(order1);
            dbHelper.insertOrder(order2);
            const burger = testData.menuItems.burger;
            // Add burger to multiple orders
            [order1, order2].forEach(order => {
                db.prepare(`
          INSERT INTO OrderItem (id, orderId, menuItemId, quantity, price, status, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(Factory.createMenuItem().id, order.id, burger.id, 2, burger.price, 'COMPLETED', new Date().toISOString(), new Date().toISOString());
            });
            // Get popularity stats
            const popularity = db.prepare(`
        SELECT
          mi.name,
          COUNT(DISTINCT oi.orderId) as orderCount,
          SUM(oi.quantity) as totalQuantity
        FROM MenuItem mi
        JOIN OrderItem oi ON mi.id = oi.menuItemId
        WHERE mi.id = ?
        GROUP BY mi.id, mi.name
      `).get(burger.id);
            expect(popularity.orderCount).toBe(2);
            expect(popularity.totalQuantity).toBe(4);
        });
        it('should identify best-selling items', () => {
            // Create sample order data
            const orders = [];
            for (let i = 0; i < 5; i++) {
                const order = Factory.createOrder();
                dbHelper.insertOrder(order);
                orders.push(order);
            }
            // Add items to orders
            orders.forEach(order => {
                db.prepare(`
          INSERT INTO OrderItem (id, orderId, menuItemId, quantity, price, status, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(Factory.createMenuItem().id, order.id, testData.menuItems.burger.id, 1, testData.menuItems.burger.price, 'COMPLETED', new Date().toISOString(), new Date().toISOString());
            });
            // Get best sellers
            const bestSellers = db.prepare(`
        SELECT
          mi.name,
          COUNT(DISTINCT oi.orderId) as orderCount,
          SUM(oi.quantity) as totalSold,
          SUM(oi.quantity * oi.price) as revenue
        FROM MenuItem mi
        JOIN OrderItem oi ON mi.id = oi.menuItemId
        GROUP BY mi.id, mi.name
        ORDER BY totalSold DESC
        LIMIT 5
      `).all();
            expect(bestSellers.length).toBeGreaterThan(0);
            expect(bestSellers[0].totalSold).toBeGreaterThan(0);
        });
    });
    describe('Menu Performance', () => {
        it('should efficiently retrieve large menu lists', () => {
            // Create 100 menu items
            for (let i = 0; i < 100; i++) {
                const item = Factory.createMenuItem({
                    name: `Item ${i}`,
                    categoryId: testData.categories.foodCategory.id
                });
                dbHelper.insertMenuItem(item);
            }
            const startTime = performance.now();
            const items = db.prepare('SELECT * FROM MenuItem LIMIT 50').all();
            const duration = performance.now() - startTime;
            expect(items.length).toBe(50);
            expect(duration).toBeLessThan(50); // Should be very fast
        });
        it('should support pagination for menu items', () => {
            const pageSize = 10;
            const page = 1;
            const offset = (page - 1) * pageSize;
            const items = db.prepare(`
        SELECT * FROM MenuItem
        ORDER BY name
        LIMIT ? OFFSET ?
      `).all(pageSize, offset);
            expect(items.length).toBeLessThanOrEqual(pageSize);
        });
    });
});
// Helper functions
function isValidPrice(price) {
    return price > 0 && isFinite(price);
}
