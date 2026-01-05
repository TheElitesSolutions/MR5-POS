import { jest } from '@jest/globals';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
// Set up test environment variables
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = ':memory:';
process.env.JWT_SECRET = 'test-secret-key';
process.env.REFRESH_SECRET = 'test-refresh-secret';
// Mock Electron
jest.mock('electron', () => ({
    app: {
        getPath: jest.fn((type) => {
            const basePath = path.join(__dirname, '../../test-data');
            switch (type) {
                case 'userData':
                    return path.join(basePath, 'userData');
                case 'temp':
                    return path.join(basePath, 'temp');
                case 'documents':
                    return path.join(basePath, 'documents');
                default:
                    return basePath;
            }
        }),
        getName: jest.fn(() => 'MR5-POS-Test'),
        getVersion: jest.fn(() => '1.0.0-test'),
        quit: jest.fn(),
        on: jest.fn(),
        whenReady: jest.fn(() => Promise.resolve())
    },
    BrowserWindow: jest.fn(),
    ipcMain: {
        handle: jest.fn(),
        on: jest.fn(),
        removeHandler: jest.fn()
    },
    dialog: {
        showOpenDialog: jest.fn(),
        showSaveDialog: jest.fn(),
        showMessageBox: jest.fn()
    }
}));
// Global test database instance
let testDb = null;
// Database helper functions
export const getTestDatabase = () => {
    if (!testDb) {
        testDb = new Database(':memory:');
        initializeTestDatabase(testDb);
    }
    return testDb;
};
export const initializeTestDatabase = (db) => {
    // Create tables based on Prisma schema
    const schema = `
    CREATE TABLE IF NOT EXISTS User (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL,
      refreshToken TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS MenuItem (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      price REAL NOT NULL,
      categoryId TEXT,
      imageUrl TEXT,
      isAvailable INTEGER DEFAULT 1,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (categoryId) REFERENCES MenuItemCategory(id)
    );

    CREATE TABLE IF NOT EXISTS MenuItemCategory (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS Inventory (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      currentStock REAL NOT NULL,
      minimumStock REAL NOT NULL,
      unit TEXT NOT NULL,
      category TEXT,
      supplier TEXT,
      costPerUnit REAL,
      expiryDate DATETIME,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS MenuItemInventory (
      id TEXT PRIMARY KEY,
      menuItemId TEXT NOT NULL,
      inventoryId TEXT NOT NULL,
      quantityPerItem REAL NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (menuItemId) REFERENCES MenuItem(id),
      FOREIGN KEY (inventoryId) REFERENCES Inventory(id)
    );

    CREATE TABLE IF NOT EXISTS "Order" (
      id TEXT PRIMARY KEY,
      orderNumber TEXT UNIQUE NOT NULL,
      status TEXT NOT NULL,
      type TEXT NOT NULL,
      tableId TEXT,
      customerName TEXT,
      customerPhone TEXT,
      deliveryAddress TEXT,
      subtotal REAL NOT NULL DEFAULT 0,
      tax REAL NOT NULL DEFAULT 0,
      discount REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL DEFAULT 0,
      notes TEXT,
      userId TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tableId) REFERENCES "Table"(id),
      FOREIGN KEY (userId) REFERENCES User(id)
    );

    CREATE TABLE IF NOT EXISTS OrderItem (
      id TEXT PRIMARY KEY,
      orderId TEXT NOT NULL,
      menuItemId TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      price REAL NOT NULL,
      notes TEXT,
      status TEXT DEFAULT 'PENDING',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (orderId) REFERENCES "Order"(id),
      FOREIGN KEY (menuItemId) REFERENCES MenuItem(id)
    );

    CREATE TABLE IF NOT EXISTS OrderItemAddon (
      id TEXT PRIMARY KEY,
      orderItemId TEXT NOT NULL,
      addonId TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      price REAL NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (orderItemId) REFERENCES OrderItem(id),
      FOREIGN KEY (addonId) REFERENCES Addon(id)
    );

    CREATE TABLE IF NOT EXISTS Payment (
      id TEXT PRIMARY KEY,
      orderId TEXT NOT NULL,
      amount REAL NOT NULL,
      method TEXT NOT NULL,
      status TEXT NOT NULL,
      transactionId TEXT,
      notes TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (orderId) REFERENCES "Order"(id)
    );

    CREATE TABLE IF NOT EXISTS "Table" (
      id TEXT PRIMARY KEY,
      number TEXT UNIQUE NOT NULL,
      capacity INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'AVAILABLE',
      section TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS AddonGroup (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      maxSelections INTEGER,
      isRequired INTEGER DEFAULT 0,
      displayOrder INTEGER DEFAULT 0,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS Addon (
      id TEXT PRIMARY KEY,
      groupId TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      price REAL NOT NULL DEFAULT 0,
      isAvailable INTEGER DEFAULT 1,
      inventoryId TEXT,
      displayOrder INTEGER DEFAULT 0,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (groupId) REFERENCES AddonGroup(id),
      FOREIGN KEY (inventoryId) REFERENCES Inventory(id)
    );

    CREATE TABLE IF NOT EXISTS CategoryAddonGroup (
      id TEXT PRIMARY KEY,
      categoryId TEXT NOT NULL,
      addonGroupId TEXT NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (categoryId) REFERENCES MenuItemCategory(id),
      FOREIGN KEY (addonGroupId) REFERENCES AddonGroup(id),
      UNIQUE(categoryId, addonGroupId)
    );

    CREATE TABLE IF NOT EXISTS Expense (
      id TEXT PRIMARY KEY,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      category TEXT,
      vendor TEXT,
      status TEXT DEFAULT 'PENDING',
      isRecurring INTEGER DEFAULT 0,
      recurringPeriod TEXT,
      date DATETIME,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS Setting (
      id TEXT PRIMARY KEY,
      key TEXT UNIQUE NOT NULL,
      value TEXT NOT NULL,
      type TEXT NOT NULL,
      category TEXT,
      description TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS AuditLog (
      id TEXT PRIMARY KEY,
      action TEXT NOT NULL,
      entityType TEXT NOT NULL,
      entityId TEXT,
      userId TEXT,
      changes TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES User(id)
    );
  `;
    db.exec(schema);
};
// Clean up database after each test
afterEach(async () => {
    if (testDb) {
        // Disable foreign keys temporarily for cleanup
        testDb.prepare('PRAGMA foreign_keys = OFF').run();
        // Clear all tables
        const tables = testDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
        tables.forEach(table => {
            testDb.prepare(`DELETE FROM "${table.name}"`).run();
        });
        // Re-enable foreign keys
        testDb.prepare('PRAGMA foreign_keys = ON').run();
    }
});
// Close database after all tests
afterAll(async () => {
    if (testDb) {
        testDb.close();
        testDb = null;
    }
    // Clean up test data directory
    const testDataPath = path.join(__dirname, '../../test-data');
    if (fs.existsSync(testDataPath)) {
        fs.rmSync(testDataPath, { recursive: true, force: true });
    }
});
// Mock console methods to reduce noise in test output
global.console.log = jest.fn();
global.console.info = jest.fn();
global.console.warn = jest.fn();
// Keep console.error for actual errors
// Test timeout configuration
jest.setTimeout(10000);
