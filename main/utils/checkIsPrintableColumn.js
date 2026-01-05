/**
 * Check and add isPrintableInKitchen column to menu_items table
 * This runs on app startup to ensure the column exists
 */
import { getPrismaClient } from '../prisma';
export async function checkAndAddIsPrintableColumn() {
    const prisma = getPrismaClient();
    try {
        console.log('🔍 Checking if isPrintableInKitchen column exists...');
        // Try to query the column directly
        try {
            const result = prisma.db.prepare('SELECT isPrintableInKitchen FROM menu_items LIMIT 1').get();
            console.log('✅ isPrintableInKitchen column already exists!');
            console.log('📋 Sample value:', result);
            return;
        }
        catch (error) {
            if (error.message.includes('no such column')) {
                console.log('⚠️ Column isPrintableInKitchen does NOT exist. Adding it now...');
                // Add the column
                prisma.db.prepare('ALTER TABLE menu_items ADD COLUMN isPrintableInKitchen INTEGER DEFAULT 1').run();
                console.log('✅ Column added successfully!');
                // Verify
                const verifyResult = prisma.db.prepare('SELECT isPrintableInKitchen FROM menu_items LIMIT 1').get();
                console.log('✅ Verification successful! Sample value:', verifyResult);
            }
            else {
                throw error;
            }
        }
        // Also check menu_items table structure
        const tableInfo = prisma.db.prepare('PRAGMA table_info(menu_items)').all();
        console.log('📋 menu_items table columns:');
        tableInfo.forEach((col) => {
            if (col.name.toLowerCase().includes('print')) {
                console.log(`  ✨ ${col.name}: ${col.type} (default: ${col.dflt_value})`);
            }
        });
    }
    catch (error) {
        console.error('❌ Error checking isPrintableInKitchen column:', error);
    }
}
