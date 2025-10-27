const Database = require('better-sqlite3');
const path = require('path');

// Path to the database
const dbPath = path.join(__dirname, '..', 'main', 'db', 'mr5pos.db');

console.log('Opening database:', dbPath);
const db = new Database(dbPath);

try {
  console.log('\n=== Checking Categories Table ===');
  const categoriesInfo = db.prepare("PRAGMA table_info('categories')").all();
  console.log('Categories columns:');
  categoriesInfo.forEach(col => {
    console.log(`  - ${col.name} (${col.type})`);
  });

  const categoriesHasColor = categoriesInfo.find(col => col.name === 'color');
  if (!categoriesHasColor) {
    console.log('\n❌ Categories table is missing color column!');
    console.log('Adding color column...');
    db.prepare('ALTER TABLE categories ADD COLUMN color TEXT').run();
    console.log('✓ Added color column to categories');
  } else {
    console.log('\n✓ Categories table has color column');
  }

  console.log('\n=== Checking Menu Items Table ===');
  const menuItemsInfo = db.prepare("PRAGMA table_info('menu_items')").all();
  console.log('Menu items columns:');
  menuItemsInfo.forEach(col => {
    console.log(`  - ${col.name} (${col.type})`);
  });

  const menuItemsHasColor = menuItemsInfo.find(col => col.name === 'color');
  if (!menuItemsHasColor) {
    console.log('\n❌ Menu items table is missing color column!');
    console.log('Adding color column...');
    db.prepare('ALTER TABLE menu_items ADD COLUMN color TEXT').run();
    console.log('✓ Added color column to menu_items');
  } else {
    console.log('\n✓ Menu items table has color column');
  }

  // Show sample data
  console.log('\n=== Sample Data ===');
  const categories = db.prepare('SELECT id, name, color FROM categories LIMIT 3').all();
  console.log('\nCategories:');
  categories.forEach(cat => {
    console.log(`  - ${cat.name} (ID: ${cat.id}, Color: ${cat.color || 'none'})`);
  });

  const menuItems = db.prepare('SELECT id, name, color, categoryId FROM menu_items LIMIT 3').all();
  console.log('\nMenu Items:');
  menuItems.forEach(item => {
    console.log(`  - ${item.name} (ID: ${item.id}, Color: ${item.color || 'none'})`);
  });

  console.log('\n✓ Verification complete!');
} catch (error) {
  console.error('Error:', error);
} finally {
  db.close();
}
