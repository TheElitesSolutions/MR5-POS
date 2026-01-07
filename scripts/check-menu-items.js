const Database = require('better-sqlite3');
const path = require('path');

// Database path
const dbPath = path.join(
  process.env.APPDATA || process.env.HOME,
  'my-nextron-app',
  'mr5-pos.db'
);

console.log('📂 Database path:', dbPath);
console.log('');

try {
  const db = new Database(dbPath, { readonly: true });

  // Get total count
  const countResult = db.prepare('SELECT COUNT(*) as count FROM menu_items').get();
  console.log(`📊 Total menu items: ${countResult.count}`);
  console.log('');

  // Get all menu items
  const menuItems = db.prepare(`
    SELECT
      id,
      name,
      price,
      categoryId,
      ingredients,
      allergens,
      isActive,
      sortOrder
    FROM menu_items
    ORDER BY sortOrder, name
  `).all();

  console.log('🍽️  Menu Items:\n');
  console.log('ID'.padEnd(20), 'Name'.padEnd(30), 'Price'.padEnd(10), 'Ingredients'.padEnd(20), 'Allergens');
  console.log('='.repeat(120));

  menuItems.forEach((item, index) => {
    const id = item.id.substring(0, 18) + '..';
    const name = item.name.padEnd(30).substring(0, 30);
    const price = `$${item.price}`.padEnd(10);
    const ingredients = (item.ingredients || '[]').substring(0, 20);
    const allergens = (item.allergens || '[]').substring(0, 20);

    console.log(`${id.padEnd(20)} ${name} ${price} ${ingredients.padEnd(20)} ${allergens}`);

    // Check for corruption patterns
    if (typeof item.price !== 'number') {
      console.log(`  ⚠️  CORRUPTION: price is ${typeof item.price}: ${item.price}`);
    }
    if (item.ingredients && item.ingredients.includes('[object Object]')) {
      console.log(`  ⚠️  CORRUPTION: ingredients contains object: ${item.ingredients}`);
    }
    if (item.allergens && item.allergens.includes('[object Object]')) {
      console.log(`  ⚠️  CORRUPTION: allergens contains object: ${item.allergens}`);
    }
  });

  console.log('\n');

  // Check for specific corruption patterns
  console.log('🔍 Checking for corruption patterns:\n');

  // Check for non-numeric prices
  const badPrices = db.prepare(`
    SELECT id, name, price, typeof(price) as priceType
    FROM menu_items
    WHERE typeof(price) != 'real' AND typeof(price) != 'integer'
  `).all();

  if (badPrices.length > 0) {
    console.log(`❌ Found ${badPrices.length} items with non-numeric prices:`);
    badPrices.forEach(item => {
      console.log(`   - ${item.name}: ${item.price} (type: ${item.priceType})`);
    });
  } else {
    console.log('✅ All prices are numeric');
  }

  // Check for object strings in JSON fields
  const badIngredients = menuItems.filter(item =>
    item.ingredients && item.ingredients.includes('[object')
  );

  if (badIngredients.length > 0) {
    console.log(`\n❌ Found ${badIngredients.length} items with corrupted ingredients:`);
    badIngredients.forEach(item => {
      console.log(`   - ${item.name}: ${item.ingredients}`);
    });
  } else {
    console.log('\n✅ All ingredients are valid JSON');
  }

  const badAllergens = menuItems.filter(item =>
    item.allergens && item.allergens.includes('[object')
  );

  if (badAllergens.length > 0) {
    console.log(`\n❌ Found ${badAllergens.length} items with corrupted allergens:`);
    badAllergens.forEach(item => {
      console.log(`   - ${item.name}: ${item.allergens}`);
    });
  } else {
    console.log('✅ All allergens are valid JSON');
  }

  db.close();
  console.log('\n✅ Database check complete');
} catch (error) {
  console.error('❌ Error checking database:', error.message);
  console.error(error);
  process.exit(1);
}
