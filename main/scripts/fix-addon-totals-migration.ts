/**
 * Migration Function: Fix Order Totals for Orders with Addons
 *
 * Call this from the application or a controller to fix historical data
 */

import { prisma } from '../db/prisma-wrapper';
import Decimal from 'decimal.js';
import { enhancedLogger } from '../utils/advancedLogger';

function addDecimals(a: any, b: any): Decimal {
  const aDecimal = new Decimal(a || 0);
  const bDecimal = new Decimal(b || 0);
  return aDecimal.plus(bDecimal);
}

export interface MigrationResult {
  orderId: string;
  orderNumber: string;
  oldSubtotal: any;
  oldTotal: any;
  newSubtotal: number;
  newTotal: number;
  changed: boolean;
}

export async function fixOrderTotalsWithAddons(dryRun = true): Promise<{
  processed: number;
  updated: number;
  skipped: number;
  errors: number;
  results: MigrationResult[];
}> {
  enhancedLogger.info(`🔧 Starting order totals migration (${dryRun ? 'DRY RUN' : 'LIVE'})`);

  try {
    // Find all orders with addon items
    const ordersWithAddons = await prisma.order.findMany({
      where: {
        orderItems: {
          some: {
            addons: {
              some: {},
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

    enhancedLogger.info(`Found ${ordersWithAddons.length} orders with addons`);

    const results: MigrationResult[] = [];
    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const order of ordersWithAddons) {
      try {
        // Fetch full order details
        const fullOrder = await prisma.order.findUnique({
          where: { id: order.id },
          include: {
            orderItems: {
              include: {
                addons: true,
              },
            },
          },
        });

        if (!fullOrder) continue;

        // Calculate correct subtotal
        let subtotal = new Decimal(0);
        for (const item of fullOrder.orderItems) {
          subtotal = addDecimals(subtotal, item.totalPrice);
        }

        // Calculate total
        const deliveryFee = new Decimal(fullOrder.deliveryFee || 0);
        const total = subtotal.plus(deliveryFee);

        const oldSubtotal = fullOrder.subtotal;
        const oldTotal = fullOrder.total;
        const newSubtotal = subtotal.toNumber();
        const newTotal = total.toNumber();

        const changed = oldSubtotal !== newSubtotal || oldTotal !== newTotal;

        if (changed) {
          enhancedLogger.info(
            `📝 Order ${fullOrder.orderNumber}: ` +
            `Old(${oldSubtotal}, ${oldTotal}) → New(${newSubtotal}, ${newTotal})`
          );

          if (!dryRun) {
            await prisma.order.update({
              where: { id: order.id },
              data: {
                subtotal: newSubtotal,
                total: newTotal,
                tax: 0,
              },
            });
            enhancedLogger.info(`✅ Updated order ${fullOrder.orderNumber}`);
          }

          updatedCount++;
          results.push({
            orderId: order.id,
            orderNumber: fullOrder.orderNumber,
            oldSubtotal,
            oldTotal,
            newSubtotal,
            newTotal,
            changed: true,
          });
        } else {
          skippedCount++;
        }
      } catch (error) {
        enhancedLogger.error(`❌ Error processing order ${order.orderNumber}`, error);
        errorCount++;
      }
    }

    const summary = {
      processed: ordersWithAddons.length,
      updated: updatedCount,
      skipped: skippedCount,
      errors: errorCount,
      results,
    };

    enhancedLogger.info('📊 Migration Summary:', summary);

    if (dryRun) {
      enhancedLogger.info('⚠️  DRY RUN: No changes made. Run with dryRun=false to apply');
    }

    return summary;
  } catch (error) {
    enhancedLogger.error('❌ Migration failed', error);
    throw error;
  }
}
