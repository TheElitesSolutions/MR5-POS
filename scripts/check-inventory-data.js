/**
 * Diagnostic script to check inventory report data availability
 * Run with: node scripts/check-inventory-data.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkInventoryData() {
  console.log('\n🔍 Checking Inventory Report Data...\n');

  try {
    // Check total inventory items
    const totalInventory = await prisma.inventory.count();
    console.log(`📦 Total inventory items in database: ${totalInventory}`);

    // Check placeholder items
    const allItems = await prisma.inventory.findMany({
      select: {
        id: true,
        itemName: true,
        category: true,
        currentStock: true,
        minimumStock: true,
      },
    });

    const placeholderItems = allItems.filter(
      item =>
        item.itemName?.toLowerCase().includes('placeholder') ||
        item.category?.toLowerCase().includes('placeholder')
    );

    const nonPlaceholderItems = allItems.filter(
      item =>
        !item.itemName?.toLowerCase().includes('placeholder') &&
        !item.category?.toLowerCase().includes('placeholder')
    );

    console.log(`🏷️  Placeholder items (filtered out): ${placeholderItems.length}`);
    console.log(`✅ Non-placeholder items (will show in report): ${nonPlaceholderItems.length}`);

    if (nonPlaceholderItems.length === 0) {
      console.log('\n⚠️  WARNING: No non-placeholder inventory items found!');
      console.log('   This would result in an empty inventory report.\n');

      if (placeholderItems.length > 0) {
        console.log('   Placeholder items found:');
        placeholderItems.forEach(item => {
          console.log(`   - ${item.itemName} (${item.category})`);
        });
      }
    } else {
      console.log('\n📊 Sample inventory items (first 5):');
      nonPlaceholderItems.slice(0, 5).forEach(item => {
        console.log(`   - ${item.itemName} | Stock: ${item.currentStock} | Min: ${item.minimumStock}`);
      });
    }

    // Check for low stock items
    const lowStockItems = nonPlaceholderItems.filter(
      item => Number(item.currentStock) > 0 && Number(item.currentStock) < Number(item.minimumStock)
    );

    const outOfStockItems = nonPlaceholderItems.filter(
      item => Number(item.currentStock) <= 0
    );

    console.log(`\n📊 Stock Status:`);
    console.log(`   Low stock: ${lowStockItems.length} items`);
    console.log(`   Out of stock: ${outOfStockItems.length} items`);

    // Check for orders in current month
    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59);

    const ordersCount = await prisma.order.count({
      where: {
        createdAt: {
          gte: monthStart.toISOString(),
          lte: monthEnd.toISOString(),
        },
        status: {
          in: ['COMPLETED', 'SERVED'],
        },
      },
    });

    console.log(`\n📅 Orders this month (for stock usage): ${ordersCount}`);

    if (ordersCount === 0) {
      console.log('   ⚠️  No completed orders this month - stock usage will be empty');
    }

    console.log('\n✅ Diagnostic check complete!\n');

  } catch (error) {
    console.error('\n❌ Error during diagnostic check:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

checkInventoryData();
