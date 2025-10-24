/**
 * Check which menu items are linked to inventory items
 *
 * This diagnostic script helps identify menu items that DON'T have
 * inventory links, which is why stock quantities aren't changing.
 */

const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');

// Database path
const dbPath = path.join(
  os.homedir(),
  'AppData',
  'Roaming',
  'my-nextron-app',
  'database.db'
);

console.log(`📊 Checking Menu Item Inventory Links`);
console.log(`Database: ${dbPath}\n`);

try {
  const db = new Database(dbPath, { readonly: true });

  // Get all active menu items
  const menuItems = db.prepare(`
    SELECT id, name, price, categoryId, isActive
    FROM menu_items
    WHERE isActive = 1
    ORDER BY name
  `).all();

  console.log(`Found ${menuItems.length} active menu items\n`);
  console.log(`${'='.repeat(80)}\n`);

  let itemsWithIngredients = 0;
  let itemsWithoutIngredients = 0;
  const missingLinks = [];

  for (const item of menuItems) {
    // Check if this menu item has inventory links
    const links = db.prepare(`
      SELECT
        mii.quantity,
        inv.itemName,
        inv.unit,
        inv.currentStock
      FROM menu_item_inventory mii
      JOIN inventory inv ON mii.inventoryId = inv.id
      WHERE mii.menuItemId = ?
    `).all(item.id);

    if (links.length > 0) {
      itemsWithIngredients++;
      console.log(`✅ ${item.name} ($${item.price})`);
      console.log(`   Ingredients:`);
      links.forEach(link => {
        console.log(`   - ${link.itemName}: ${link.quantity} ${link.unit} (stock: ${link.currentStock})`);
      });
      console.log('');
    } else {
      itemsWithoutIngredients++;
      missingLinks.push(item);
    }
  }

  // Summary
  console.log(`${'='.repeat(80)}\n`);
  console.log(`📊 SUMMARY:`);
  console.log(`   ✅ Items WITH inventory links: ${itemsWithIngredients}`);
  console.log(`   ❌ Items WITHOUT inventory links: ${itemsWithoutIngredients}\n`);

  if (missingLinks.length > 0) {
    console.log(`⚠️  THESE ITEMS NEED INVENTORY LINKS:`);
    missingLinks.forEach(item => {
      console.log(`   ❌ ${item.name} ($${item.price}) - ID: ${item.id}`);
    });
    console.log('');
    console.log(`💡 TO FIX:`);
    console.log(`   1. Go to Admin → Menu`);
    console.log(`   2. Edit each item above`);
    console.log(`   3. Scroll to "Ingredients" section`);
    console.log(`   4. Click "Add Ingredient"`);
    console.log(`   5. Select inventory item and quantity`);
    console.log(`   6. Save\n`);
  } else {
    console.log(`🎉 ALL menu items have inventory links! Stock management should work.`);
  }

  // Check addon inventory links too
  console.log(`${'='.repeat(80)}\n`);
  console.log(`📊 CHECKING ADDON INVENTORY LINKS:\n`);

  const addons = db.prepare(`
    SELECT id, name, price, isActive
    FROM addons
    WHERE isActive = 1
    ORDER BY name
  `).all();

  let addonsWithIngredients = 0;
  let addonsWithoutIngredients = 0;
  const missingAddonLinks = [];

  for (const addon of addons) {
    const links = db.prepare(`
      SELECT
        aii.quantity,
        inv.itemName,
        inv.unit,
        inv.currentStock
      FROM addon_inventory_items aii
      JOIN inventory inv ON aii.inventoryId = inv.id
      WHERE aii.addonId = ?
    `).all(addon.id);

    if (links.length > 0) {
      addonsWithIngredients++;
      console.log(`✅ ${addon.name} ($${addon.price})`);
      console.log(`   Ingredients:`);
      links.forEach(link => {
        console.log(`   - ${link.itemName}: ${link.quantity} ${link.unit} (stock: ${link.currentStock})`);
      });
      console.log('');
    } else {
      addonsWithoutIngredients++;
      missingAddonLinks.push(addon);
    }
  }

  console.log(`${'='.repeat(80)}\n`);
  console.log(`📊 ADDON SUMMARY:`);
  console.log(`   ✅ Addons WITH inventory links: ${addonsWithIngredients}`);
  console.log(`   ❌ Addons WITHOUT inventory links: ${addonsWithoutIngredients}\n`);

  if (missingAddonLinks.length > 0) {
    console.log(`⚠️  THESE ADDONS NEED INVENTORY LINKS:`);
    missingAddonLinks.forEach(addon => {
      console.log(`   ❌ ${addon.name} ($${addon.price})`);
    });
    console.log('');
  }

  db.close();

} catch (error) {
  console.error(`❌ Error: ${error.message}`);
  console.error(`\nMake sure the application is not running.`);
  process.exit(1);
}
