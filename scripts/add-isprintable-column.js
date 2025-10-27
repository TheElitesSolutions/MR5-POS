/**
 * Migration script to add isPrintableInKitchen column to menu_items table
 * Run with: node scripts/add-isprintable-column.js
 */

const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');

// Get the database path
const dbPath = path.join(
  os.homedir(),
  'AppData',
  'Roaming',
  'my-nextron-app',
  'database.db'
);

console.log('📂 Database path:', dbPath);

try {
  // Open database
  const db = new Database(dbPath);
  console.log('✅ Connected to database');

  // Check if column exists
  const tableInfo = db.prepare('PRAGMA table_info(menu_items)').all();
  console.log('\n📋 Current menu_items columns:');
  tableInfo.forEach(col => {
    console.log(`  - ${col.name} (${col.type}${col.dflt_value ? `, default: ${col.dflt_value}` : ''})`);
  });

  const hasColumn = tableInfo.some(col => col.name === 'isPrintableInKitchen');

  if (hasColumn) {
    console.log('\n✅ Column isPrintableInKitchen already exists!');

    // Show some sample data
    const sampleItems = db.prepare('SELECT id, name, isPrintableInKitchen FROM menu_items LIMIT 5').all();
    console.log('\n📊 Sample menu items:');
    sampleItems.forEach(item => {
      console.log(`  - ${item.name}: isPrintableInKitchen = ${item.isPrintableInKitchen}`);
    });
  } else {
    console.log('\n⚠️ Column isPrintableInKitchen does NOT exist. Adding it now...');

    // Add the column
    db.prepare('ALTER TABLE menu_items ADD COLUMN isPrintableInKitchen INTEGER DEFAULT 1').run();
    console.log('✅ Column added successfully!');

    // Verify
    const updatedTableInfo = db.prepare('PRAGMA table_info(menu_items)').all();
    const nowHasColumn = updatedTableInfo.some(col => col.name === 'isPrintableInKitchen');

    if (nowHasColumn) {
      console.log('✅ Verification successful - column now exists!');
    } else {
      console.log('❌ Verification failed - column was not added');
    }
  }

  // Test query to fetch a menu item with the column
  console.log('\n🔍 Testing query: SELECT * FROM menu_items LIMIT 1');
  const testItem = db.prepare('SELECT * FROM menu_items LIMIT 1').get();
  if (testItem) {
    console.log('📋 Fields returned by SELECT *:');
    Object.keys(testItem).forEach(key => {
      console.log(`  - ${key}: ${testItem[key]}`);
    });
    console.log(`\n✅ isPrintableInKitchen value: ${testItem.isPrintableInKitchen}`);
  } else {
    console.log('⚠️ No menu items found in database');
  }

  db.close();
  console.log('\n✅ Migration complete!');

} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
