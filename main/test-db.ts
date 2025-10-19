/**
 * Database Test Script
 * Tests the SQLite database setup and Prisma-compatible wrapper
 */

import { app } from 'electron';
import * as path from 'path';
import { initializeDatabase, closeDatabase, backupDatabase } from './db/index';
import { prisma, UserRole, OrderStatus, OrderType, PaymentMethod } from './prisma';

// Mock app.getPath for testing outside of Electron
if (!app || !app.getPath) {
  (global as any).app = {
    getPath: (name: string) => {
      if (name === 'userData') {
        return path.join(__dirname, '../test-data');
      }
      return '';
    }
  };
}

// Color codes for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
};

function log(message: string, type: 'success' | 'error' | 'info' | 'test' = 'info') {
  const color = type === 'success' ? colors.green :
                type === 'error' ? colors.red :
                type === 'test' ? colors.blue : colors.yellow;
  console.log(`${color}${type.toUpperCase()}:${colors.reset} ${message}`);
}

async function runTests() {
  log('Starting Database Tests', 'info');
  log('=' .repeat(50), 'info');

  try {
    // Test 1: Initialize database
    log('Initializing database...', 'test');
    const db = initializeDatabase();
    log('Database initialized successfully', 'success');

    // Test 2: Test Prisma wrapper connection
    log('Testing Prisma wrapper connection...', 'test');
    await prisma.$connect();
    log('Prisma wrapper connected', 'success');

    // Test 3: Create a user
    log('Creating test user...', 'test');
    const testUser = await prisma.user.create({
      data: {
        username: 'testuser',
        email: 'test@example.com',
        password: 'hashed_password_here',
        role: UserRole.ADMIN,
        firstName: 'Test',
        lastName: 'User',
        phone: '1234567890',
        isActive: true,
      }
    });
    log(`User created with ID: ${testUser.id}`, 'success');

    // Test 4: Find user by username
    log('Finding user by username...', 'test');
    const foundUser = await prisma.user.findUnique({
      where: { username: 'testuser' }
    });
    log(`Found user: ${foundUser?.username} (${foundUser?.email})`, 'success');

    // Test 5: Create a category
    log('Creating test category...', 'test');
    const category = await prisma.category.create({
      data: {
        name: 'Beverages',
        description: 'Hot and cold beverages',
        sortOrder: 1,
        isActive: true,
      }
    });
    log(`Category created: ${category.name}`, 'success');

    // Test 6: Create a menu item
    log('Creating test menu item...', 'test');
    const menuItem = await prisma.menuItem.create({
      data: {
        name: 'Cappuccino',
        description: 'Classic Italian coffee',
        price: 4.50,
        categoryId: category.id,
        isActive: true,
        preparationTime: 5,
        ingredients: JSON.stringify(['coffee', 'milk', 'foam']),
        allergens: JSON.stringify(['dairy']),
      }
    });
    log(`Menu item created: ${menuItem.name} ($${menuItem.price})`, 'success');

    // Test 7: Create a table
    log('Creating test table...', 'test');
    const table = await prisma.table.create({
      data: {
        name: 'Table 1',
        status: 'AVAILABLE',
        location: 'Main dining area',
      }
    });
    log(`Table created: ${table.name}`, 'success');

    // Test 8: Create an order
    log('Creating test order...', 'test');
    const orderNumber = `ORD-${Date.now()}`;
    const order = await prisma.order.create({
      data: {
        orderNumber,
        tableId: table.id,
        userId: testUser.id,
        status: OrderStatus.PENDING,
        type: OrderType.DINE_IN,
        subtotal: 4.50,
        tax: 0.45,
        discount: 0,
        total: 4.95,
        notes: 'Test order',
      }
    });
    log(`Order created: ${order.orderNumber}`, 'success');

    // Test 9: Create an order item
    log('Creating test order item...', 'test');
    const orderItem = await prisma.orderItem.create({
      data: {
        orderId: order.id,
        menuItemId: menuItem.id,
        quantity: 1,
        unitPrice: 4.50,
        totalPrice: 4.50,
        status: 'PENDING',
      }
    });
    log(`Order item created for order ${order.orderNumber}`, 'success');

    // Test 10: Update order status
    log('Updating order status...', 'test');
    const updatedOrder = await prisma.order.update({
      where: { id: order.id },
      data: { status: OrderStatus.CONFIRMED }
    });
    log(`Order status updated to: ${updatedOrder.status}`, 'success');

    // Test 11: Test aggregation
    log('Testing aggregation functions...', 'test');
    const orderCount = await prisma.order.count();
    const orderStats = await prisma.order.aggregate({
      _count: true,
      _sum: { total: true },
      _avg: { total: true },
      _min: { total: true },
      _max: { total: true },
    });
    log(`Total orders: ${orderCount}, Stats: ${JSON.stringify(orderStats)}`, 'success');

    // Test 12: Test findMany with filters
    log('Testing findMany with filters...', 'test');
    const activeMenuItems = await prisma.menuItem.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
    log(`Found ${activeMenuItems.length} active menu items`, 'success');

    // Test 13: Test settings
    log('Testing settings...', 'test');
    const taxSetting = await prisma.setting.findUnique({
      where: { key: 'tax_rate' }
    });
    log(`Tax rate setting: ${taxSetting?.value}%`, 'success');

    // Test 14: Create payment
    log('Creating test payment...', 'test');
    const payment = await prisma.payment.create({
      data: {
        orderId: order.id,
        amount: 4.95,
        method: PaymentMethod.CARD,
        status: 'COMPLETED',
        reference: 'TEST-PAY-001',
      }
    });
    log(`Payment created: ${payment.method} - $${payment.amount}`, 'success');

    // Test 15: Test transaction
    log('Testing transaction support...', 'test');
    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.COMPLETED, completedAt: new Date().toISOString() }
      });
      await tx.orderItem.update({
        where: { id: orderItem.id },
        data: { status: 'SERVED' }
      });
    });
    log('Transaction completed successfully', 'success');

    // Test 16: Test raw queries
    log('Testing raw SQL queries...', 'test');
    const rawResult = await prisma.$queryRaw<any[]>(
      'SELECT COUNT(*) as count FROM users WHERE role = ?',
      UserRole.ADMIN
    );
    log(`Raw query result: ${JSON.stringify(rawResult)}`, 'success');

    // Test 17: Test backup
    log('Testing database backup...', 'test');
    const backupPath = path.join(__dirname, '../test-data/backups/test-backup.db');
    backupDatabase(backupPath);
    log(`Database backed up to: ${backupPath}`, 'success');

    // Test 18: Cleanup - Delete test data
    log('Cleaning up test data...', 'test');
    await prisma.payment.deleteMany({ where: { orderId: order.id } });
    await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
    await prisma.order.delete({ where: { id: order.id } });
    await prisma.menuItem.delete({ where: { id: menuItem.id } });
    await prisma.category.delete({ where: { id: category.id } });
    await prisma.table.delete({ where: { id: table.id } });
    await prisma.user.delete({ where: { id: testUser.id } });
    log('Test data cleaned up', 'success');

    // Test summary
    log('=' .repeat(50), 'info');
    log('ALL TESTS PASSED SUCCESSFULLY! ✅', 'success');
    log('Database and Prisma wrapper are working correctly', 'success');
    log('=' .repeat(50), 'info');

    // Close database
    await prisma.$disconnect();
    closeDatabase();

  } catch (error) {
    log('=' .repeat(50), 'error');
    log(`TEST FAILED: ${error}`, 'error');
    if (error instanceof Error) {
      log(`Error details: ${error.stack}`, 'error');
    }
    log('=' .repeat(50), 'error');
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().then(() => {
    log('Test script completed', 'info');
    process.exit(0);
  }).catch((error) => {
    log(`Test script error: ${error}`, 'error');
    process.exit(1);
  });
}

export { runTests };