/**
 * Migration Script: Fix Order Totals for Orders with Addons
 *
 * This script recalculates order totals for all orders that have items with addons.
 * It fixes:
 * 1. Orders with $0 totals when they should have values
 * 2. Orders with "[object Object]" serialization errors
 * 3. Orders with incorrect totals due to missing addon costs
 *
 * Usage: node scripts/fix-addon-order-totals.js [--dry-run]
 */

const path = require('path');
const Decimal = require('decimal.js');

// Use the project's prisma wrapper
const { prisma } = require(path.join(__dirname, '../main/db/prisma-wrapper.js'));

const isDryRun = process.argv.includes('--dry-run');

/**
 * Add two Decimal.js numbers safely
 */
function addDecimals(a, b) {
  const aDecimal = new Decimal(a || 0);
  const bDecimal = new Decimal(b || 0);
  return aDecimal.plus(bDecimal);
}

/**
 * Recalculate order totals based on order items
 */
async function recalculateOrderTotals(orderId) {
  // Fetch order with items and their addons
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      orderItems: {
        include: {
          addons: true,
        },
      },
    },
  });

  if (!order) {
    console.log(`⚠️  Order ${orderId} not found`);
    return null;
  }

  // Calculate subtotal from order items
  let subtotal = new Decimal(0);

  for (const item of order.orderItems) {
    // Add item's total price (which should already include addons)
    subtotal = addDecimals(subtotal, item.totalPrice);

    console.log(`   Item ${item.id}: totalPrice=${item.totalPrice}, addons=${item.addons.length}`);
  }

  // Calculate total (subtotal + delivery fee, no tax)
  const deliveryFee = new Decimal(order.deliveryFee || 0);
  const total = subtotal.plus(deliveryFee);

  const oldSubtotal = typeof order.subtotal === 'object' ? '[object Object]' : order.subtotal;
  const oldTotal = typeof order.total === 'object' ? '[object Object]' : order.total;

  console.log(`   Current: subtotal=${oldSubtotal}, total=${oldTotal}`);
  console.log(`   Calculated: subtotal=${subtotal.toNumber()}, total=${total.toNumber()}`);

  return {
    orderId,
    orderNumber: order.orderNumber,
    oldSubtotal,
    oldTotal,
    newSubtotal: subtotal.toNumber(),
    newTotal: total.toNumber(),
    itemCount: order.orderItems.length,
    changed: oldSubtotal !== subtotal.toNumber() || oldTotal !== total.toNumber(),
  };
}

/**
 * Update order with corrected totals
 */
async function updateOrderTotals(orderId, newSubtotal, newTotal) {
  if (isDryRun) {
    console.log(`   [DRY RUN] Would update order ${orderId}`);
    return;
  }

  await prisma.order.update({
    where: { id: orderId },
    data: {
      subtotal: newSubtotal,
      total: newTotal,
      tax: 0, // No tax in this system
    },
  });

  console.log(`   ✅ Updated order ${orderId}`);
}

/**
 * Main migration function
 */
async function main() {
  console.log('🔧 Order Totals Migration Script');
  console.log(`Mode: ${isDryRun ? 'DRY RUN (no changes)' : 'LIVE (will update database)'}`);
  console.log('');

  try {
    // Find all orders that have items with addons
    console.log('📊 Finding orders with addon items...');

    const ordersWithAddons = await prisma.order.findMany({
      where: {
        orderItems: {
          some: {
            addons: {
              some: {}, // Has at least one addon
            },
          },
        },
      },
      select: {
        id: true,
        orderNumber: true,
        subtotal: true,
        total: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    console.log(`Found ${ordersWithAddons.length} orders with addons\n`);

    if (ordersWithAddons.length === 0) {
      console.log('✅ No orders to migrate');
      return;
    }

    // Process each order
    const results = [];
    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const order of ordersWithAddons) {
      console.log(`\n🔍 Processing Order ${order.orderNumber} (${order.id})`);

      try {
        const result = await recalculateOrderTotals(order.id);

        if (result && result.changed) {
          await updateOrderTotals(order.id, result.newSubtotal, result.newTotal);
          updatedCount++;
          results.push(result);
        } else if (result) {
          console.log(`   ⏭️  Skipped (already correct)`);
          skippedCount++;
        }
      } catch (error) {
        console.error(`   ❌ Error processing order ${order.orderNumber}:`, error.message);
        errorCount++;
      }
    }

    // Summary
    console.log('\n' + '='.repeat(70));
    console.log('📊 Migration Summary');
    console.log('='.repeat(70));
    console.log(`Total orders processed: ${ordersWithAddons.length}`);
    console.log(`✅ Updated: ${updatedCount}`);
    console.log(`⏭️  Skipped (correct): ${skippedCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log('');

    if (results.length > 0) {
      console.log('\n📋 Updated Orders:');
      console.log('-'.repeat(70));
      results.forEach(r => {
        console.log(`Order ${r.orderNumber}:`);
        console.log(`  Old: subtotal=${r.oldSubtotal}, total=${r.oldTotal}`);
        console.log(`  New: subtotal=${r.newSubtotal}, total=${r.newTotal}`);
      });
    }

    if (isDryRun) {
      console.log('\n⚠️  DRY RUN MODE: No changes were made to the database');
      console.log('Run without --dry-run to apply changes');
    }

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration
main()
  .then(() => {
    console.log('\n✅ Migration completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  });
