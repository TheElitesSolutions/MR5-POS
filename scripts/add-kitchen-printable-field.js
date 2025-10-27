/**
 * Migration Script: Add isPrintableInKitchen field to menu_items and addons tables
 *
 * Purpose: Add a boolean field to control whether items/addons appear on kitchen tickets
 * Date: 2025-01-26
 *
 * Default: 1 (true) to maintain backward compatibility - all existing items will print by default
 */

const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');

// Get database path (same as app uses)
const userDataPath = path.join(os.homedir(), 'AppData', 'Roaming', 'my-nextron-app');
const dbPath = path.join(userDataPath, 'mr5-pos.db');

console.log('🔧 Kitchen Printable Field Migration\n');
console.log('Database path:', dbPath);
console.log('Migration: Adding isPrintableInKitchen column\n');
console.log('='.repeat(80) + '\n');

try {
  const db = new Database(dbPath);

  // Start transaction for safety
  db.exec('BEGIN TRANSACTION');

  console.log('📝 Step 1: Checking if columns already exist...\n');

  // Check if column exists in menu_items
  const menuItemsInfo = db.pragma('table_info(menu_items)');
  const menuItemsHasColumn = menuItemsInfo.some(col => col.name === 'isPrintableInKitchen');

  // Check if column exists in addons
  const addonsInfo = db.pragma('table_info(addons)');
  const addonsHasColumn = addonsInfo.some(col => col.name === 'isPrintableInKitchen');

  // Add column to menu_items if it doesn't exist
  if (!menuItemsHasColumn) {
    console.log('✅ Adding isPrintableInKitchen to menu_items table...');
    db.exec(`
      ALTER TABLE menu_items
      ADD COLUMN isPrintableInKitchen INTEGER DEFAULT 1
    `);

    // Update all existing records to be printable (backward compatibility)
    const menuItemsUpdated = db.exec('UPDATE menu_items SET isPrintableInKitchen = 1 WHERE isPrintableInKitchen IS NULL');
    console.log('   ✓ Column added successfully');
    console.log('   ✓ All existing menu items set to printable\n');
  } else {
    console.log('⚠️  Column isPrintableInKitchen already exists in menu_items\n');
  }

  // Add column to addons if it doesn't exist
  if (!addonsHasColumn) {
    console.log('✅ Adding isPrintableInKitchen to addons table...');
    db.exec(`
      ALTER TABLE addons
      ADD COLUMN isPrintableInKitchen INTEGER DEFAULT 1
    `);

    // Update all existing records to be printable (backward compatibility)
    const addonsUpdated = db.exec('UPDATE addons SET isPrintableInKitchen = 1 WHERE isPrintableInKitchen IS NULL');
    console.log('   ✓ Column added successfully');
    console.log('   ✓ All existing addons set to printable\n');
  } else {
    console.log('⚠️  Column isPrintableInKitchen already exists in addons\n');
  }

  // Commit transaction
  db.exec('COMMIT');

  console.log('='.repeat(80));
  console.log('\n✅ Migration completed successfully!\n');

  // Verify the changes
  console.log('📊 Verification:\n');

  const menuItemCount = db.prepare('SELECT COUNT(*) as count FROM menu_items').get();
  const menuItemPrintableCount = db.prepare('SELECT COUNT(*) as count FROM menu_items WHERE isPrintableInKitchen = 1').get();
  console.log(`   Menu Items: ${menuItemCount.count} total, ${menuItemPrintableCount.count} printable`);

  const addonCount = db.prepare('SELECT COUNT(*) as count FROM addons').get();
  const addonPrintableCount = db.prepare('SELECT COUNT(*) as count FROM addons WHERE isPrintableInKitchen = 1').get();
  console.log(`   Addons: ${addonCount.count} total, ${addonPrintableCount.count} printable`);

  console.log('\n✨ All items and addons are set to print in kitchen tickets by default');
  console.log('   You can now change this setting in the menu/addon forms\n');

  db.close();

} catch (error) {
  console.error('\n❌ Migration failed:', error.message);
  console.error('\nStack trace:', error.stack);

  // Try to rollback if possible
  try {
    const db = new Database(dbPath);
    db.exec('ROLLBACK');
    db.close();
    console.log('\n✓ Transaction rolled back');
  } catch (rollbackError) {
    console.error('⚠️  Could not rollback transaction');
  }

  process.exit(1);
}
