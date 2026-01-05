import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import Decimal from 'decimal.js';
// Test data factories
export class TestDataFactory {
    // User factory
    static createUser(overrides) {
        return {
            id: uuidv4(),
            name: 'Test User',
            email: `test-${uuidv4()}@example.com`,
            password: bcrypt.hashSync('password123', 10),
            role: 'CASHIER',
            createdAt: new Date(),
            updatedAt: new Date(),
            ...overrides
        };
    }
    // Menu Item factory
    static createMenuItem(overrides) {
        return {
            id: uuidv4(),
            name: `Menu Item ${Math.random()}`,
            description: 'Test menu item description',
            price: new Decimal(9.99).toNumber(),
            categoryId: null,
            imageUrl: null,
            isAvailable: true,
            createdAt: new Date(),
            updatedAt: new Date(),
            ...overrides
        };
    }
    // Category factory
    static createCategory(overrides) {
        return {
            id: uuidv4(),
            name: `Category ${Math.random()}`,
            color: '#FF5733',
            createdAt: new Date(),
            updatedAt: new Date(),
            ...overrides
        };
    }
    // Inventory factory
    static createInventory(overrides) {
        return {
            id: uuidv4(),
            name: `Inventory Item ${Math.random()}`,
            description: 'Test inventory item',
            currentStock: 100,
            minimumStock: 10,
            unit: 'kg',
            category: 'Ingredients',
            supplier: 'Test Supplier',
            costPerUnit: new Decimal(5.50).toNumber(),
            expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
            createdAt: new Date(),
            updatedAt: new Date(),
            ...overrides
        };
    }
    static createOrder(overrides) {
        const orderNumber = `ORD-${Date.now()}-${++TestDataFactory.orderCounter}-${Math.floor(Math.random() * 10000)}`;
        return {
            id: uuidv4(),
            orderNumber,
            status: 'PENDING',
            type: 'DINE_IN',
            tableId: null,
            customerName: null,
            customerPhone: null,
            deliveryAddress: null,
            subtotal: 0,
            tax: 0,
            discount: 0,
            total: 0,
            notes: null,
            userId: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            ...overrides
        };
    }
    // Order Item factory
    static createOrderItem(orderId, menuItemId, overrides) {
        return {
            id: uuidv4(),
            orderId,
            menuItemId,
            quantity: 1,
            price: new Decimal(9.99).toNumber(),
            notes: null,
            status: 'PENDING',
            createdAt: new Date(),
            updatedAt: new Date(),
            ...overrides
        };
    }
    static createTable(overrides) {
        return {
            id: uuidv4(),
            number: `T-${++TestDataFactory.tableCounter}-${Math.floor(Math.random() * 1000)}`,
            capacity: 4,
            status: 'AVAILABLE',
            section: 'Main Hall',
            createdAt: new Date(),
            updatedAt: new Date(),
            ...overrides
        };
    }
    // Payment factory
    static createPayment(orderId, overrides) {
        return {
            id: uuidv4(),
            orderId,
            amount: new Decimal(100.00).toNumber(),
            method: 'CASH',
            status: 'COMPLETED',
            transactionId: `TXN-${Date.now()}`,
            notes: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            ...overrides
        };
    }
    // Addon Group factory
    static createAddonGroup(overrides) {
        return {
            id: uuidv4(),
            name: `Addon Group ${Math.random()}`,
            description: 'Test addon group',
            maxSelections: null,
            isRequired: false,
            displayOrder: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
            ...overrides
        };
    }
    // Addon factory
    static createAddon(groupId, overrides) {
        return {
            id: uuidv4(),
            groupId,
            name: `Addon ${Math.random()}`,
            description: 'Test addon',
            price: new Decimal(2.50).toNumber(),
            isAvailable: true,
            inventoryId: null,
            displayOrder: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
            ...overrides
        };
    }
    // Expense factory
    static createExpense(overrides) {
        return {
            id: uuidv4(),
            description: 'Test expense',
            amount: new Decimal(250.00).toNumber(),
            category: 'Supplies',
            vendor: 'Test Vendor',
            status: 'PENDING',
            isRecurring: false,
            recurringPeriod: null,
            date: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
            ...overrides
        };
    }
}
// Order factory with counter for unique order numbers
TestDataFactory.orderCounter = 0;
// Table factory with counter for unique table numbers
TestDataFactory.tableCounter = 0;
// Database helpers
export class DatabaseHelper {
    constructor(db) {
        this.db = db;
    }
    // Insert user
    insertUser(user) {
        const stmt = this.db.prepare(`
      INSERT INTO User (id, name, email, password, role, refreshToken, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
        return stmt.run(user.id, user.name, user.email, user.password, user.role, user.refreshToken || null, user.createdAt.toISOString(), user.updatedAt.toISOString());
    }
    // Insert menu item
    insertMenuItem(item) {
        const stmt = this.db.prepare(`
      INSERT INTO MenuItem (id, name, description, price, categoryId, imageUrl, isAvailable, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        return stmt.run(item.id, item.name, item.description, item.price, item.categoryId, item.imageUrl, item.isAvailable ? 1 : 0, item.createdAt.toISOString(), item.updatedAt.toISOString());
    }
    // Insert category
    insertCategory(category) {
        const stmt = this.db.prepare(`
      INSERT INTO MenuItemCategory (id, name, color, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?)
    `);
        return stmt.run(category.id, category.name, category.color, category.createdAt.toISOString(), category.updatedAt.toISOString());
    }
    // Insert inventory
    insertInventory(inventory) {
        const stmt = this.db.prepare(`
      INSERT INTO Inventory (id, name, description, currentStock, minimumStock, unit, category, supplier, costPerUnit, expiryDate, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        return stmt.run(inventory.id, inventory.name, inventory.description, inventory.currentStock, inventory.minimumStock, inventory.unit, inventory.category, inventory.supplier, inventory.costPerUnit, inventory.expiryDate ? inventory.expiryDate.toISOString() : null, inventory.createdAt.toISOString(), inventory.updatedAt.toISOString());
    }
    // Insert order
    insertOrder(order) {
        const stmt = this.db.prepare(`
      INSERT INTO "Order" (id, orderNumber, status, type, tableId, customerName, customerPhone, deliveryAddress, subtotal, tax, discount, total, notes, userId, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        return stmt.run(order.id, order.orderNumber, order.status, order.type, order.tableId, order.customerName, order.customerPhone, order.deliveryAddress, order.subtotal, order.tax, order.discount, order.total, order.notes, order.userId, order.createdAt.toISOString(), order.updatedAt.toISOString());
    }
    // Insert table
    insertTable(table) {
        const stmt = this.db.prepare(`
      INSERT INTO "Table" (id, number, capacity, status, section, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
        return stmt.run(table.id, table.number, table.capacity, table.status, table.section, table.createdAt.toISOString(), table.updatedAt.toISOString());
    }
    // Seed database with test data
    seedTestData() {
        // Create test users
        const admin = TestDataFactory.createUser({ role: 'ADMIN', email: 'admin@test.com' });
        const cashier = TestDataFactory.createUser({ role: 'CASHIER', email: 'cashier@test.com' });
        const manager = TestDataFactory.createUser({ role: 'MANAGER', email: 'manager@test.com' });
        this.insertUser(admin);
        this.insertUser(cashier);
        this.insertUser(manager);
        // Create categories
        const foodCategory = TestDataFactory.createCategory({ name: 'Food' });
        const drinkCategory = TestDataFactory.createCategory({ name: 'Drinks' });
        this.insertCategory(foodCategory);
        this.insertCategory(drinkCategory);
        // Create menu items
        const burger = TestDataFactory.createMenuItem({
            name: 'Burger',
            price: 12.99,
            categoryId: foodCategory.id
        });
        const pizza = TestDataFactory.createMenuItem({
            name: 'Pizza',
            price: 15.99,
            categoryId: foodCategory.id
        });
        const cola = TestDataFactory.createMenuItem({
            name: 'Cola',
            price: 2.99,
            categoryId: drinkCategory.id
        });
        this.insertMenuItem(burger);
        this.insertMenuItem(pizza);
        this.insertMenuItem(cola);
        // Create inventory items
        const beef = TestDataFactory.createInventory({ name: 'Beef', unit: 'kg' });
        const cheese = TestDataFactory.createInventory({ name: 'Cheese', unit: 'kg' });
        this.insertInventory(beef);
        this.insertInventory(cheese);
        // Create tables
        const table1 = TestDataFactory.createTable({ number: 'T-01' });
        const table2 = TestDataFactory.createTable({ number: 'T-02' });
        this.insertTable(table1);
        this.insertTable(table2);
        return {
            users: { admin, cashier, manager },
            categories: { foodCategory, drinkCategory },
            menuItems: { burger, pizza, cola },
            inventory: { beef, cheese },
            tables: { table1, table2 }
        };
    }
}
// Authentication helpers
export class AuthHelper {
    static generateToken(user) {
        return jwt.sign({ id: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET || 'test-secret', { expiresIn: '1h' });
    }
    static generateRefreshToken(user) {
        return jwt.sign({ id: user.id }, process.env.REFRESH_SECRET || 'test-refresh-secret', { expiresIn: '7d' });
    }
    static verifyToken(token) {
        return jwt.verify(token, process.env.JWT_SECRET || 'test-secret');
    }
}
// Mock IPC handler
export class MockIPCHandler {
    constructor() {
        this.handlers = new Map();
    }
    handle(channel, handler) {
        this.handlers.set(channel, handler);
    }
    async invoke(channel, ...args) {
        const handler = this.handlers.get(channel);
        if (!handler) {
            throw new Error(`No handler registered for channel: ${channel}`);
        }
        return handler(null, ...args);
    }
    removeHandler(channel) {
        this.handlers.delete(channel);
    }
    clear() {
        this.handlers.clear();
    }
}
// Price calculation helpers
export class PriceCalculator {
    static calculateOrderTotal(items, taxRate = 0.1, discount = 0) {
        // Use Decimal.js throughout to maintain precision
        const subtotalDecimal = items.reduce((sum, item) => {
            return sum.plus(new Decimal(item.price).times(item.quantity));
        }, new Decimal(0));
        const discountDecimal = new Decimal(discount);
        const afterDiscount = subtotalDecimal.minus(discountDecimal);
        const taxDecimal = afterDiscount.times(taxRate);
        const totalDecimal = afterDiscount.plus(taxDecimal);
        return {
            subtotal: subtotalDecimal.toNumber(),
            tax: taxDecimal.toNumber(),
            discount: discountDecimal.toNumber(),
            total: totalDecimal.toNumber()
        };
    }
    static formatPrice(price) {
        return new Decimal(price).toFixed(2);
    }
}
// Date helpers
export class DateHelper {
    static addDays(date, days) {
        const result = new Date(date);
        result.setDate(result.getDate() + days);
        return result;
    }
    static startOfDay(date) {
        const result = new Date(date);
        result.setHours(0, 0, 0, 0);
        return result;
    }
    static endOfDay(date) {
        const result = new Date(date);
        result.setHours(23, 59, 59, 999);
        return result;
    }
    static formatDate(date) {
        return date.toISOString().split('T')[0];
    }
}
// Performance testing helper
export class PerformanceHelper {
    constructor() {
        this.startTime = 0;
    }
    start() {
        this.startTime = performance.now();
    }
    end() {
        return performance.now() - this.startTime;
    }
    async measureAsync(fn) {
        this.start();
        const result = await fn();
        const duration = this.end();
        return { result, duration };
    }
}
// Mock printer service
export class MockPrinterService {
    constructor() {
        this.isConnected = true;
        this.printQueue = [];
    }
    connect() {
        this.isConnected = true;
        return Promise.resolve({ success: true });
    }
    disconnect() {
        this.isConnected = false;
        return Promise.resolve({ success: true });
    }
    print(data) {
        if (!this.isConnected) {
            return Promise.reject(new Error('Printer not connected'));
        }
        this.printQueue.push(data);
        return Promise.resolve({ success: true, jobId: `JOB-${Date.now()}` });
    }
    getPrintQueue() {
        return this.printQueue;
    }
    clearQueue() {
        this.printQueue = [];
    }
}
// Export all helpers
export { TestDataFactory as Factory, DatabaseHelper as DbHelper, AuthHelper as Auth, MockIPCHandler as IPCMock, PriceCalculator as Price, DateHelper as DateUtil, PerformanceHelper as Performance, MockPrinterService as PrinterMock };
