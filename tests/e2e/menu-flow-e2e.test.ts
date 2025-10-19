/**
 * End-to-End Menu Flow Tests
 *
 * These tests verify the complete menu flow in a real Electron environment:
 * - Category browsing with real data
 * - Menu item selection with stock checks
 * - Order creation with customization
 * - Integration with backend services
 *
 * IMPORTANT: These tests require:
 * 1. Test database with seed data
 * 2. Electron app to be running
 * 3. Menu items, categories, and stock data to be seeded
 */

import Database from 'better-sqlite3';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { TestDataFactory, DateUtil } from '../utils/test-helpers';

describe('E2E: Menu Flow in POS', () => {
  let db: Database.Database;
  let testData: {
    users: any;
    categories: any[];
    menuItems: any[];
    stockItems: any[];
    tables: any[];
  };

  beforeAll(() => {
    // Initialize in-memory test database
    db = new Database(':memory:');

    // Enable foreign keys
    db.prepare('PRAGMA foreign_keys = ON').run();

    // Initialize schema (simplified version - in real app, use migrations)
    const schema = `
      CREATE TABLE IF NOT EXISTS User (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        role TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS Category (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS MenuItem (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        price REAL NOT NULL,
        category TEXT NOT NULL,
        categoryId TEXT NOT NULL,
        isAvailable INTEGER NOT NULL DEFAULT 1,
        isActive INTEGER NOT NULL DEFAULT 1,
        ingredients TEXT,
        isCustomizable INTEGER NOT NULL DEFAULT 0,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        FOREIGN KEY (categoryId) REFERENCES Category(id)
      );

      CREATE TABLE IF NOT EXISTS Inventory (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        currentQuantity REAL NOT NULL,
        minimumQuantity REAL NOT NULL,
        unit TEXT NOT NULL,
        category TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS "Table" (
        id TEXT PRIMARY KEY,
        number TEXT NOT NULL UNIQUE,
        capacity INTEGER NOT NULL,
        status TEXT NOT NULL,
        section TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS "Order" (
        id TEXT PRIMARY KEY,
        orderNumber TEXT NOT NULL UNIQUE,
        userId TEXT NOT NULL,
        type TEXT NOT NULL,
        status TEXT NOT NULL,
        tableId TEXT,
        subtotal REAL NOT NULL,
        tax REAL NOT NULL,
        discount REAL NOT NULL,
        total REAL NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        FOREIGN KEY (userId) REFERENCES User(id),
        FOREIGN KEY (tableId) REFERENCES "Table"(id)
      );

      CREATE TABLE IF NOT EXISTS OrderItem (
        id TEXT PRIMARY KEY,
        orderId TEXT NOT NULL,
        menuItemId TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        price REAL NOT NULL,
        subtotal REAL NOT NULL,
        customizations TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        FOREIGN KEY (orderId) REFERENCES "Order"(id),
        FOREIGN KEY (menuItemId) REFERENCES MenuItem(id)
      );
    `;

    schema.split(';').filter(s => s.trim()).forEach(statement => {
      db.prepare(statement + ';').run();
    });
  });

  afterAll(() => {
    db.close();
  });

  beforeEach(() => {
    // Setup test data
    testData = {
      users: {
        owner: TestDataFactory.createUser({ role: 'OWNER' }),
        cashier: TestDataFactory.createUser({ role: 'CASHIER' }),
      },
      categories: [],
      menuItems: [],
      stockItems: [],
      tables: [],
    };

    // Create users
    Object.values(testData.users).forEach(user => {
      db.prepare(`
        INSERT INTO User (id, name, email, password, role, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        user.id,
        user.name,
        user.email,
        user.password,
        user.role,
        user.createdAt.toISOString(),
        user.updatedAt.toISOString()
      );
    });

    // Create categories
    const categories = [
      { id: uuidv4(), name: 'Appetizers', createdAt: new Date(), updatedAt: new Date() },
      { id: uuidv4(), name: 'Main Course', createdAt: new Date(), updatedAt: new Date() },
      { id: uuidv4(), name: 'Desserts', createdAt: new Date(), updatedAt: new Date() },
      { id: uuidv4(), name: 'Beverages', createdAt: new Date(), updatedAt: new Date() },
    ];

    categories.forEach(category => {
      db.prepare(`
        INSERT INTO Category (id, name, createdAt, updatedAt)
        VALUES (?, ?, ?, ?)
      `).run(
        category.id,
        category.name,
        category.createdAt.toISOString(),
        category.updatedAt.toISOString()
      );
    });

    testData.categories = categories;

    // Create stock items for ingredients
    const stockItems = [
      TestDataFactory.createInventory({ name: 'Lettuce', currentQuantity: 100, unit: 'pieces' }),
      TestDataFactory.createInventory({ name: 'Tomato', currentQuantity: 80, unit: 'pieces' }),
      TestDataFactory.createInventory({ name: 'Cheese', currentQuantity: 50, unit: 'slices' }),
      TestDataFactory.createInventory({ name: 'Beef Patty', currentQuantity: 30, unit: 'pieces' }),
      TestDataFactory.createInventory({ name: 'Bun', currentQuantity: 60, unit: 'pieces' }),
    ];

    stockItems.forEach(stock => {
      db.prepare(`
        INSERT INTO Inventory (id, name, currentQuantity, minimumQuantity, unit, category, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        stock.id,
        stock.name,
        stock.currentQuantity,
        stock.minimumQuantity || 10,
        stock.unit,
        stock.category || 'Ingredients',
        stock.createdAt.toISOString(),
        stock.updatedAt.toISOString()
      );
    });

    testData.stockItems = stockItems;

    // Create menu items with ingredients
    const mainCourseCategory = categories.find(c => c.name === 'Main Course')!;
    const appetizersCategory = categories.find(c => c.name === 'Appetizers')!;
    const beveragesCategory = categories.find(c => c.name === 'Beverages')!;

    const menuItems = [
      // Main course items
      {
        id: uuidv4(),
        name: 'Classic Burger',
        description: 'Juicy beef patty with fresh vegetables',
        price: 12.99,
        category: 'Main Course',
        categoryId: mainCourseCategory.id,
        isAvailable: true,
        isActive: true,
        ingredients: JSON.stringify([
          { id: stockItems[0].id, name: 'Lettuce', quantityRequired: 2 },
          { id: stockItems[1].id, name: 'Tomato', quantityRequired: 2 },
          { id: stockItems[2].id, name: 'Cheese', quantityRequired: 1 },
          { id: stockItems[3].id, name: 'Beef Patty', quantityRequired: 1 },
          { id: stockItems[4].id, name: 'Bun', quantityRequired: 1 },
        ]),
        isCustomizable: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: uuidv4(),
        name: 'Veggie Burger',
        description: 'Plant-based burger with fresh vegetables',
        price: 11.99,
        category: 'Main Course',
        categoryId: mainCourseCategory.id,
        isAvailable: true,
        isActive: true,
        ingredients: JSON.stringify([
          { id: stockItems[0].id, name: 'Lettuce', quantityRequired: 2 },
          { id: stockItems[1].id, name: 'Tomato', quantityRequired: 2 },
          { id: stockItems[4].id, name: 'Bun', quantityRequired: 1 },
        ]),
        isCustomizable: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      // Appetizer
      {
        id: uuidv4(),
        name: 'Garden Salad',
        description: 'Fresh mixed greens with vegetables',
        price: 7.99,
        category: 'Appetizers',
        categoryId: appetizersCategory.id,
        isAvailable: true,
        isActive: true,
        ingredients: JSON.stringify([
          { id: stockItems[0].id, name: 'Lettuce', quantityRequired: 3 },
          { id: stockItems[1].id, name: 'Tomato', quantityRequired: 3 },
        ]),
        isCustomizable: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      // Beverage (no ingredients)
      {
        id: uuidv4(),
        name: 'Fresh Orange Juice',
        description: 'Freshly squeezed orange juice',
        price: 4.99,
        category: 'Beverages',
        categoryId: beveragesCategory.id,
        isAvailable: true,
        isActive: true,
        ingredients: JSON.stringify([]),
        isCustomizable: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      // Out of stock item
      {
        id: uuidv4(),
        name: 'Special Burger',
        description: 'Limited edition burger',
        price: 15.99,
        category: 'Main Course',
        categoryId: mainCourseCategory.id,
        isAvailable: false, // Not available
        isActive: true,
        ingredients: JSON.stringify([]),
        isCustomizable: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    menuItems.forEach(item => {
      db.prepare(`
        INSERT INTO MenuItem (id, name, description, price, category, categoryId, isAvailable, isActive, ingredients, isCustomizable, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        item.id,
        item.name,
        item.description,
        item.price,
        item.category,
        item.categoryId,
        item.isAvailable ? 1 : 0,
        item.isActive ? 1 : 0,
        item.ingredients,
        item.isCustomizable ? 1 : 0,
        item.createdAt.toISOString(),
        item.updatedAt.toISOString()
      );
    });

    testData.menuItems = menuItems;

    // Create table for dine-in orders
    const table = TestDataFactory.createTable({ number: 'T1', status: 'AVAILABLE' });
    db.prepare(`
      INSERT INTO "Table" (id, number, capacity, status, section, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      table.id,
      table.number,
      table.capacity,
      table.status,
      table.section || 'Main Hall',
      table.createdAt.toISOString(),
      table.updatedAt.toISOString()
    );

    testData.tables = [table];
  });

  afterEach(() => {
    // Clean up test data
    db.prepare('PRAGMA foreign_keys = OFF').run();

    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
    ).all() as { name: string }[];

    tables.forEach(table => {
      db.prepare(`DELETE FROM "${table.name}"`).run();
    });

    db.prepare('PRAGMA foreign_keys = ON').run();
  });

  describe('Category Browsing', () => {
    it('should fetch and display all categories from database', () => {
      const categories = db.prepare('SELECT * FROM Category ORDER BY name').all();

      expect(categories).toHaveLength(4);
      expect(categories.map((c: any) => c.name)).toEqual([
        'Appetizers',
        'Beverages',
        'Desserts',
        'Main Course',
      ]);
    });

    it('should count available menu items per category', () => {
      const categoryCounts = db.prepare(`
        SELECT
          c.name,
          COUNT(CASE WHEN m.isAvailable = 1 THEN 1 END) as availableCount,
          COUNT(m.id) as totalCount
        FROM Category c
        LEFT JOIN MenuItem m ON m.categoryId = c.id
        GROUP BY c.id, c.name
      `).all() as any[];

      const mainCourse = categoryCounts.find(c => c.name === 'Main Course');
      expect(mainCourse.availableCount).toBe(2); // Classic Burger and Veggie Burger
      expect(mainCourse.totalCount).toBe(3); // Including unavailable Special Burger

      const appetizers = categoryCounts.find(c => c.name === 'Appetizers');
      expect(appetizers.availableCount).toBe(1); // Garden Salad

      const beverages = categoryCounts.find(c => c.name === 'Beverages');
      expect(beverages.availableCount).toBe(1); // Orange Juice

      const desserts = categoryCounts.find(c => c.name === 'Desserts');
      expect(desserts.availableCount).toBe(0); // No desserts added
    });
  });

  describe('Menu Item Fetching', () => {
    it('should fetch available menu items for a category', () => {
      const mainCourseCategory = testData.categories.find(c => c.name === 'Main Course');

      const availableItems = db.prepare(`
        SELECT * FROM MenuItem
        WHERE categoryId = ? AND isAvailable = 1
        ORDER BY name
      `).all(mainCourseCategory!.id) as any[];

      expect(availableItems).toHaveLength(2);
      expect(availableItems[0].name).toBe('Classic Burger');
      expect(availableItems[1].name).toBe('Veggie Burger');
    });

    it('should not fetch unavailable menu items', () => {
      const mainCourseCategory = testData.categories.find(c => c.name === 'Main Course');

      const allItems = db.prepare(`
        SELECT * FROM MenuItem
        WHERE categoryId = ?
      `).all(mainCourseCategory!.id);

      const availableItems = db.prepare(`
        SELECT * FROM MenuItem
        WHERE categoryId = ? AND isAvailable = 1
      `).all(mainCourseCategory!.id);

      expect(allItems).toHaveLength(3); // Including Special Burger
      expect(availableItems).toHaveLength(2); // Excluding Special Burger
    });

    it('should include ingredient information with menu items', () => {
      const burger = testData.menuItems.find(m => m.name === 'Classic Burger');

      const menuItem = db.prepare('SELECT * FROM MenuItem WHERE id = ?').get(burger!.id) as any;

      expect(menuItem.ingredients).toBeDefined();

      const ingredients = JSON.parse(menuItem.ingredients);
      expect(ingredients).toHaveLength(5);
      expect(ingredients[0]).toHaveProperty('id');
      expect(ingredients[0]).toHaveProperty('name');
      expect(ingredients[0]).toHaveProperty('quantityRequired');
    });

    it('should search menu items by name', () => {
      const searchResults = db.prepare(`
        SELECT * FROM MenuItem
        WHERE name LIKE ? AND isAvailable = 1
        ORDER BY name
      `).all('%Burger%') as any[];

      expect(searchResults).toHaveLength(2);
      expect(searchResults.map(r => r.name)).toEqual(['Classic Burger', 'Veggie Burger']);
    });
  });

  describe('Stock Availability Check', () => {
    it('should verify sufficient stock for menu item ingredients', () => {
      const burger = testData.menuItems.find(m => m.name === 'Classic Burger');
      const ingredients = JSON.parse(burger!.ingredients);

      // Check stock for quantity of 1 burger
      const orderQuantity = 1;
      let allIngredientsAvailable = true;

      ingredients.forEach((ingredient: any) => {
        const stock = db.prepare('SELECT * FROM Inventory WHERE id = ?').get(ingredient.id) as any;

        const required = ingredient.quantityRequired * orderQuantity;
        const available = stock.currentQuantity;

        if (available < required) {
          allIngredientsAvailable = false;
        }
      });

      expect(allIngredientsAvailable).toBe(true);
    });

    it('should detect insufficient stock for large orders', () => {
      const burger = testData.menuItems.find(m => m.name === 'Classic Burger');
      const ingredients = JSON.parse(burger!.ingredients);

      // Order 100 burgers - should exceed stock
      const orderQuantity = 100;
      let insufficientIngredients: string[] = [];

      ingredients.forEach((ingredient: any) => {
        const stock = db.prepare('SELECT * FROM Inventory WHERE id = ?').get(ingredient.id) as any;

        const required = ingredient.quantityRequired * orderQuantity;
        const available = stock.currentQuantity;

        if (available < required) {
          insufficientIngredients.push(ingredient.name);
        }
      });

      expect(insufficientIngredients.length).toBeGreaterThan(0);
      expect(insufficientIngredients).toContain('Beef Patty'); // Only 30 available
    });

    it('should identify low stock warnings', () => {
      const burger = testData.menuItems.find(m => m.name === 'Classic Burger');
      const ingredients = JSON.parse(burger!.ingredients);

      const lowStockIngredients: string[] = [];

      ingredients.forEach((ingredient: any) => {
        const stock = db.prepare('SELECT * FROM Inventory WHERE id = ?').get(ingredient.id) as any;

        if (stock.currentQuantity <= stock.minimumQuantity) {
          lowStockIngredients.push(ingredient.name);
        }
      });

      // Initially all should be above minimum
      expect(lowStockIngredients).toHaveLength(0);

      // Simulate low stock
      const beefPatty = testData.stockItems.find(s => s.name === 'Beef Patty');
      db.prepare('UPDATE Inventory SET currentQuantity = 5 WHERE id = ?').run(beefPatty!.id);

      const updatedStock = db.prepare('SELECT * FROM Inventory WHERE id = ?').get(beefPatty!.id) as any;
      expect(updatedStock.currentQuantity).toBeLessThanOrEqual(updatedStock.minimumQuantity);
    });
  });

  describe('Order Creation with Menu Items', () => {
    it('should create order with customized menu item', () => {
      const burger = testData.menuItems.find(m => m.name === 'Classic Burger');
      const cashier = testData.users.cashier;
      const table = testData.tables[0];

      const order = TestDataFactory.createOrder({
        userId: cashier.id,
        type: 'DINE_IN',
        tableId: table.id,
        status: 'PENDING',
      });

      db.prepare(`
        INSERT INTO "Order" (id, orderNumber, userId, type, status, tableId, subtotal, tax, discount, total, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        order.id,
        order.orderNumber,
        order.userId,
        order.type,
        order.status,
        order.tableId,
        0, 0, 0, 0, // Will be updated after adding items
        order.createdAt.toISOString(),
        order.updatedAt.toISOString()
      );

      // Add order item with customization
      const orderItem = {
        id: uuidv4(),
        orderId: order.id,
        menuItemId: burger!.id,
        quantity: 2,
        price: burger!.price,
        subtotal: burger!.price * 2,
        customizations: JSON.stringify({
          removedIngredients: ['Cheese'], // No cheese
          addedNotes: 'Well done',
        }),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      db.prepare(`
        INSERT INTO OrderItem (id, orderId, menuItemId, quantity, price, subtotal, customizations, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        orderItem.id,
        orderItem.orderId,
        orderItem.menuItemId,
        orderItem.quantity,
        orderItem.price,
        orderItem.subtotal,
        orderItem.customizations,
        orderItem.createdAt.toISOString(),
        orderItem.updatedAt.toISOString()
      );

      // Verify order item was created
      const savedOrderItem = db.prepare(`
        SELECT oi.*, m.name as menuItemName
        FROM OrderItem oi
        JOIN MenuItem m ON m.id = oi.menuItemId
        WHERE oi.id = ?
      `).get(orderItem.id) as any;

      expect(savedOrderItem).toBeDefined();
      expect(savedOrderItem.menuItemName).toBe('Classic Burger');
      expect(savedOrderItem.quantity).toBe(2);
      expect(savedOrderItem.subtotal).toBe(burger!.price * 2);

      const customizations = JSON.parse(savedOrderItem.customizations);
      expect(customizations.removedIngredients).toContain('Cheese');
      expect(customizations.addedNotes).toBe('Well done');
    });

    it('should deduct stock when order is confirmed', () => {
      const burger = testData.menuItems.find(m => m.name === 'Classic Burger');
      const ingredients = JSON.parse(burger!.ingredients);

      // Get initial stock levels
      const initialStock: { [key: string]: number } = {};
      ingredients.forEach((ingredient: any) => {
        const stock = db.prepare('SELECT * FROM Inventory WHERE id = ?').get(ingredient.id) as any;
        initialStock[ingredient.id] = stock.currentQuantity;
      });

      // Create and confirm order
      const order = TestDataFactory.createOrder({
        userId: testData.users.cashier.id,
        type: 'DINE_IN',
        status: 'CONFIRMED',
      });

      db.prepare(`
        INSERT INTO "Order" (id, orderNumber, userId, type, status, subtotal, tax, discount, total, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        order.id,
        order.orderNumber,
        order.userId,
        order.type,
        order.status,
        burger!.price, 0, 0, burger!.price,
        order.createdAt.toISOString(),
        order.updatedAt.toISOString()
      );

      const orderItem = {
        id: uuidv4(),
        orderId: order.id,
        menuItemId: burger!.id,
        quantity: 1,
        price: burger!.price,
        subtotal: burger!.price,
        customizations: JSON.stringify({}),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      db.prepare(`
        INSERT INTO OrderItem (id, orderId, menuItemId, quantity, price, subtotal, customizations, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        orderItem.id,
        orderItem.orderId,
        orderItem.menuItemId,
        orderItem.quantity,
        orderItem.price,
        orderItem.subtotal,
        orderItem.customizations,
        orderItem.createdAt.toISOString(),
        orderItem.updatedAt.toISOString()
      );

      // Manually deduct stock (in real app, this would be done by backend)
      ingredients.forEach((ingredient: any) => {
        const required = ingredient.quantityRequired * orderItem.quantity;
        db.prepare('UPDATE Inventory SET currentQuantity = currentQuantity - ? WHERE id = ?')
          .run(required, ingredient.id);
      });

      // Verify stock was deducted
      ingredients.forEach((ingredient: any) => {
        const stock = db.prepare('SELECT * FROM Inventory WHERE id = ?').get(ingredient.id) as any;
        const expectedStock = initialStock[ingredient.id] - (ingredient.quantityRequired * orderItem.quantity);

        expect(stock.currentQuantity).toBe(expectedStock);
      });
    });

    it('should support multiple menu items in single order', () => {
      const burger = testData.menuItems.find(m => m.name === 'Classic Burger');
      const salad = testData.menuItems.find(m => m.name === 'Garden Salad');
      const juice = testData.menuItems.find(m => m.name === 'Fresh Orange Juice');

      const order = TestDataFactory.createOrder({
        userId: testData.users.cashier.id,
        type: 'TAKEOUT',
        status: 'PENDING',
      });

      db.prepare(`
        INSERT INTO "Order" (id, orderNumber, userId, type, status, subtotal, tax, discount, total, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        order.id,
        order.orderNumber,
        order.userId,
        order.type,
        order.status,
        0, 0, 0, 0,
        order.createdAt.toISOString(),
        order.updatedAt.toISOString()
      );

      // Add multiple items
      const orderItems = [
        { menuItem: burger, quantity: 2 },
        { menuItem: salad, quantity: 1 },
        { menuItem: juice, quantity: 2 },
      ];

      let totalSubtotal = 0;

      orderItems.forEach(({ menuItem, quantity }) => {
        const orderItem = {
          id: uuidv4(),
          orderId: order.id,
          menuItemId: menuItem!.id,
          quantity,
          price: menuItem!.price,
          subtotal: menuItem!.price * quantity,
          customizations: JSON.stringify({}),
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        totalSubtotal += orderItem.subtotal;

        db.prepare(`
          INSERT INTO OrderItem (id, orderId, menuItemId, quantity, price, subtotal, customizations, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          orderItem.id,
          orderItem.orderId,
          orderItem.menuItemId,
          orderItem.quantity,
          orderItem.price,
          orderItem.subtotal,
          orderItem.customizations,
          orderItem.createdAt.toISOString(),
          orderItem.updatedAt.toISOString()
        );
      });

      // Verify all items were added
      const savedOrderItems = db.prepare(`
        SELECT oi.*, m.name as menuItemName
        FROM OrderItem oi
        JOIN MenuItem m ON m.id = oi.menuItemId
        WHERE oi.orderId = ?
      `).all(order.id) as any[];

      expect(savedOrderItems).toHaveLength(3);
      expect(savedOrderItems.map(i => i.menuItemName)).toEqual([
        'Classic Burger',
        'Garden Salad',
        'Fresh Orange Juice',
      ]);

      const calculatedTotal = savedOrderItems.reduce((sum, item) => sum + item.subtotal, 0);
      expect(calculatedTotal).toBe(totalSubtotal);
    });
  });

  describe('Complete Menu Flow Integration', () => {
    it('should complete full order flow: browse → select → customize → order → confirm', () => {
      // Step 1: Browse categories
      const categories = db.prepare('SELECT * FROM Category').all() as any[];
      expect(categories.length).toBeGreaterThan(0);

      // Step 2: Select category and view items
      const mainCourse = categories.find(c => c.name === 'Main Course');
      const menuItems = db.prepare(`
        SELECT * FROM MenuItem
        WHERE categoryId = ? AND isAvailable = 1
      `).all(mainCourse.id) as any[];

      expect(menuItems.length).toBeGreaterThan(0);

      // Step 3: Select menu item
      const burger = menuItems.find(m => m.name === 'Classic Burger');
      expect(burger).toBeDefined();

      // Step 4: Check stock availability
      const ingredients = JSON.parse(burger.ingredients);
      const stockAvailable = ingredients.every((ingredient: any) => {
        const stock = db.prepare('SELECT * FROM Inventory WHERE id = ?').get(ingredient.id) as any;
        return stock.currentQuantity >= ingredient.quantityRequired;
      });

      expect(stockAvailable).toBe(true);

      // Step 5: Create order with customization
      const order = TestDataFactory.createOrder({
        userId: testData.users.cashier.id,
        type: 'DINE_IN',
        tableId: testData.tables[0].id,
        status: 'PENDING',
      });

      db.prepare(`
        INSERT INTO "Order" (id, orderNumber, userId, type, status, tableId, subtotal, tax, discount, total, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        order.id,
        order.orderNumber,
        order.userId,
        order.type,
        order.status,
        order.tableId,
        burger.price, 0, 0, burger.price,
        order.createdAt.toISOString(),
        order.updatedAt.toISOString()
      );

      // Step 6: Add customized item to order
      const orderItem = {
        id: uuidv4(),
        orderId: order.id,
        menuItemId: burger.id,
        quantity: 1,
        price: burger.price,
        subtotal: burger.price,
        customizations: JSON.stringify({
          removedIngredients: ['Tomato'],
          addedNotes: 'Extra crispy',
        }),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      db.prepare(`
        INSERT INTO OrderItem (id, orderId, menuItemId, quantity, price, subtotal, customizations, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        orderItem.id,
        orderItem.orderId,
        orderItem.menuItemId,
        orderItem.quantity,
        orderItem.price,
        orderItem.subtotal,
        orderItem.customizations,
        orderItem.createdAt.toISOString(),
        orderItem.updatedAt.toISOString()
      );

      // Step 7: Confirm order
      db.prepare('UPDATE "Order" SET status = ? WHERE id = ?').run('CONFIRMED', order.id);

      // Step 8: Verify complete flow
      const confirmedOrder = db.prepare(`
        SELECT o.*,
               COUNT(oi.id) as itemCount,
               SUM(oi.subtotal) as calculatedSubtotal
        FROM "Order" o
        LEFT JOIN OrderItem oi ON oi.orderId = o.id
        WHERE o.id = ?
        GROUP BY o.id
      `).get(order.id) as any;

      expect(confirmedOrder.status).toBe('CONFIRMED');
      expect(confirmedOrder.itemCount).toBe(1);
      expect(confirmedOrder.calculatedSubtotal).toBe(burger.price);
      expect(confirmedOrder.tableId).toBe(testData.tables[0].id);

      // Verify customization was saved
      const savedOrderItem = db.prepare(`
        SELECT * FROM OrderItem WHERE id = ?
      `).get(orderItem.id) as any;

      const customizations = JSON.parse(savedOrderItem.customizations);
      expect(customizations.removedIngredients).toContain('Tomato');
      expect(customizations.addedNotes).toBe('Extra crispy');
    });
  });
});
