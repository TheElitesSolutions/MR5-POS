/**
 * Check and add isVisibleOnWebsite column to menu_items table
 * This runs on app startup to ensure the column exists
 */

import { getPrismaClient } from '../prisma';

export async function checkAndAddIsVisibleOnWebsiteColumn(): Promise<void> {
  try {
    const prisma = getPrismaClient();

    // Safety check: ensure prisma and db are available
    if (!prisma || !(prisma as any).db) {
      console.error('⚠️ Prisma client or database not available, skipping isVisibleOnWebsite migration');
      return;
    }

    console.log('🔍 Checking if isVisibleOnWebsite column exists...');

    // Try to query the column directly
    try {
      const result = (prisma as any).db.prepare(
        'SELECT isVisibleOnWebsite FROM menu_items LIMIT 1'
      ).get();

      console.log('✅ isVisibleOnWebsite column already exists!');
      console.log('📋 Sample value:', result);
      return;

    } catch (error: any) {
      if (error.message.includes('no such column')) {
        console.log('⚠️ Column isVisibleOnWebsite does NOT exist. Adding it now...');

        // Add the column
        (prisma as any).db.prepare(
          'ALTER TABLE menu_items ADD COLUMN isVisibleOnWebsite INTEGER DEFAULT 1'
        ).run();

        console.log('✅ Column added successfully!');

        // Create index for the new column
        console.log('🔍 Creating index on isVisibleOnWebsite...');
        (prisma as any).db.prepare(
          'CREATE INDEX IF NOT EXISTS idx_menu_items_isVisibleOnWebsite ON menu_items(isVisibleOnWebsite)'
        ).run();

        // Create composite index for common query pattern
        console.log('🔍 Creating composite index...');
        (prisma as any).db.prepare(
          'CREATE INDEX IF NOT EXISTS idx_menu_items_isActive_isVisibleOnWebsite ON menu_items(isActive, isVisibleOnWebsite) WHERE isActive = 1 AND isVisibleOnWebsite = 1'
        ).run();

        // Verify
        const verifyResult = (prisma as any).db.prepare(
          'SELECT isVisibleOnWebsite FROM menu_items LIMIT 1'
        ).get();

        console.log('✅ Verification successful! Sample value:', verifyResult);
      } else {
        throw error;
      }
    }

    // Also check menu_items table structure
    const tableInfo = (prisma as any).db.prepare(
      'PRAGMA table_info(menu_items)'
    ).all();

    console.log('📋 menu_items table columns:');
    tableInfo.forEach((col: any) => {
      if (col.name.toLowerCase().includes('visible') || col.name.toLowerCase().includes('website')) {
        console.log(`  ✨ ${col.name}: ${col.type} (default: ${col.dflt_value})`);
      }
    });

  } catch (outerError) {
    console.error('❌ Error checking isVisibleOnWebsite column:', outerError);
    // Don't re-throw - we don't want migration failures to crash the app
    console.error('⚠️ Migration failed but app will continue running');
  }
}
