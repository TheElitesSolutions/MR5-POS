/**
 * Check category-item relationships in the database
 * Run with: node scripts/check-category-items.js
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'prisma', 'dev.db');
const db = new Database(dbPath, { readonly: true });

console.log('📊 Checking Category-Item Relationships\n');
console.log('='.repeat(80));

try {
  // Check Salades category specifically
  const category = db.prepare(`
    SELECT id, name, displayOrder
    FROM categories
    WHERE name LIKE '%Salad%' OR name LIKE '%Salade%'
  `).get();

  console.log('\n🔍 SALADES CATEGORY:');
  console.log(category || '⚠️  Not found');

  if (category) {
    // Check items in this category
    const items = db.prepare(`
      SELECT
        mi.id,
        mi.name,
        mi.category as category_name,
        mi.categoryId,
        mi.isActive,
        c.name as actual_category_name
      FROM menuItems mi
      LEFT JOIN categories c ON mi.categoryId = c.id
      WHERE mi.categoryId = ?
    `).all(category.id);

    console.log(`\n📦 ITEMS IN "${category.name}" (${items.length} items):`);
    if (items.length === 0) {
      console.log('⚠️  NO ITEMS FOUND - This explains why filteredCount = 0!');
    } else {
      items.forEach(item => {
        const activeEmoji = item.isActive ? '✅' : '❌';
        console.log(`  ${activeEmoji} ${item.name} (active: ${item.isActive})`);
      });
    }
  }

  // Check all categories and their counts
  console.log('\n' + '='.repeat(80));
  console.log('\n📊 ALL CATEGORIES AND THEIR ITEM COUNTS:\n');

  const categories = db.prepare(`
    SELECT
      c.id,
      c.name,
      COUNT(mi.id) as total_items,
      SUM(CASE WHEN mi.isActive = 1 THEN 1 ELSE 0 END) as active_items
    FROM categories c
    LEFT JOIN menuItems mi ON mi.categoryId = c.id
    GROUP BY c.id, c.name
    ORDER BY c.displayOrder
  `).all();

  categories.forEach(cat => {
    const emoji = cat.active_items > 0 ? '✅' : '⚠️ ';
    const activeCount = cat.active_items || 0;
    console.log(`${emoji} ${cat.name}: ${activeCount} active / ${cat.total_items} total (ID: ${cat.id.substring(0, 10)}...)`);
  });

  // Check for items with mismatched category names
  console.log('\n' + '='.repeat(80));
  const mismatches = db.prepare(`
    SELECT
      mi.id,
      mi.name as item_name,
      mi.category as item_category_name,
      c.name as actual_category_name,
      mi.categoryId
    FROM menuItems mi
    LEFT JOIN categories c ON mi.categoryId = c.id
    WHERE mi.category != c.name
    LIMIT 10
  `).all();

  if (mismatches.length > 0) {
    console.log('\n⚠️  CATEGORY NAME MISMATCHES (item.category != categories.name):');
    mismatches.forEach(item => {
      console.log(`  - "${item.item_name}": stored as "${item.item_category_name}" but categoryId points to "${item.actual_category_name}"`);
    });
  } else {
    console.log('\n✅ No category name mismatches found');
  }

  db.close();
  console.log('\n✅ Database check complete\n');

} catch (error) {
  console.error('❌ Error:', error);
  db.close();
  process.exit(1);
}
