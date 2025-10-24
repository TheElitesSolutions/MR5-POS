-- Create Test Inventory Links
-- This script creates sample links between menu items and inventory for testing
-- Run this in DB Browser for SQLite

-- =====================================================
-- STEP 1: Check existing data
-- =====================================================

-- Check menu items
SELECT '=== Menu Items ===' as info;
SELECT id, name, price FROM menu_items WHERE isActive = 1 LIMIT 5;

-- Check inventory items
SELECT '' as space;
SELECT '=== Inventory Items ===' as info;
SELECT id, itemName, currentStock, unit, category FROM inventory LIMIT 5;

-- Check existing links
SELECT '' as space;
SELECT '=== Existing Links ===' as info;
SELECT COUNT(*) as total_links FROM menu_item_inventory;

-- =====================================================
-- STEP 2: Create sample inventory items (if needed)
-- =====================================================

-- Only run if you don't have inventory items yet
/*
INSERT INTO inventory (id, itemName, category, currentStock, minimumStock, unit, costPerUnit, supplier, lastRestocked)
VALUES
  (lower(hex(randomblob(16))), 'Cheese (Mozzarella)', 'Dairy', 5000, 500, 'g', 0.012, 'Local Supplier', datetime('now')),
  (lower(hex(randomblob(16))), 'Pizza Dough', 'Bakery', 10000, 1000, 'g', 0.005, 'Local Supplier', datetime('now')),
  (lower(hex(randomblob(16))), 'Tomato Sauce', 'Sauces', 3000, 300, 'ml', 0.008, 'Local Supplier', datetime('now')),
  (lower(hex(randomblob(16))), 'Olive Oil', 'Oils', 2000, 200, 'ml', 0.015, 'Local Supplier', datetime('now')),
  (lower(hex(randomblob(16))), 'Basil Leaves', 'Herbs', 500, 50, 'g', 0.025, 'Local Supplier', datetime('now')),
  (lower(hex(randomblob(16))), 'Chicken Breast', 'Meat', 3000, 300, 'g', 0.018, 'Local Supplier', datetime('now')),
  (lower(hex(randomblob(16))), 'Lettuce', 'Vegetables', 2000, 200, 'g', 0.004, 'Local Supplier', datetime('now')),
  (lower(hex(randomblob(16))), 'Burger Buns', 'Bakery', 100, 10, 'pieces', 0.50, 'Local Supplier', datetime('now')),
  (lower(hex(randomblob(16))), 'Ground Beef', 'Meat', 5000, 500, 'g', 0.015, 'Local Supplier', datetime('now')),
  (lower(hex(randomblob(16))), 'French Fries', 'Frozen', 3000, 300, 'g', 0.006, 'Local Supplier', datetime('now'));
*/

-- =====================================================
-- STEP 3: Create links (EXAMPLE - adjust IDs to your data)
-- =====================================================

-- First, get the actual IDs from your database:
-- 1. Run: SELECT id, name FROM menu_items WHERE name LIKE '%Pizza%' OR name LIKE '%Burger%';
-- 2. Run: SELECT id, itemName FROM inventory;
-- 3. Copy the IDs and use them below

-- EXAMPLE: Link "Margherita Pizza" to ingredients
-- Replace 'YOUR-MENU-ITEM-ID' and 'YOUR-INVENTORY-ID' with actual IDs

/*
-- Example for a Pizza (adjust IDs!)
INSERT INTO menu_item_inventory (id, menuItemId, inventoryId, quantity)
VALUES
  (lower(hex(randomblob(16))), 'YOUR-PIZZA-MENU-ID', 'YOUR-CHEESE-INVENTORY-ID', 200),      -- 200g cheese
  (lower(hex(randomblob(16))), 'YOUR-PIZZA-MENU-ID', 'YOUR-DOUGH-INVENTORY-ID', 300),       -- 300g dough
  (lower(hex(randomblob(16))), 'YOUR-PIZZA-MENU-ID', 'YOUR-SAUCE-INVENTORY-ID', 100),       -- 100ml sauce
  (lower(hex(randomblob(16))), 'YOUR-PIZZA-MENU-ID', 'YOUR-OLIVE-OIL-INVENTORY-ID', 10),    -- 10ml oil
  (lower(hex(randomblob(16))), 'YOUR-PIZZA-MENU-ID', 'YOUR-BASIL-INVENTORY-ID', 5);         -- 5g basil

-- Example for a Burger (adjust IDs!)
INSERT INTO menu_item_inventory (id, menuItemId, inventoryId, quantity)
VALUES
  (lower(hex(randomblob(16))), 'YOUR-BURGER-MENU-ID', 'YOUR-BUN-INVENTORY-ID', 1),          -- 1 bun
  (lower(hex(randomblob(16))), 'YOUR-BURGER-MENU-ID', 'YOUR-BEEF-INVENTORY-ID', 150),       -- 150g beef
  (lower(hex(randomblob(16))), 'YOUR-BURGER-MENU-ID', 'YOUR-LETTUCE-INVENTORY-ID', 30),     -- 30g lettuce
  (lower(hex(randomblob(16))), 'YOUR-BURGER-MENU-ID', 'YOUR-CHEESE-INVENTORY-ID', 50);      -- 50g cheese

-- Example for Fries (adjust IDs!)
INSERT INTO menu_item_inventory (id, menuItemId, inventoryId, quantity)
VALUES
  (lower(hex(randomblob(16))), 'YOUR-FRIES-MENU-ID', 'YOUR-FRIES-INVENTORY-ID', 200);       -- 200g fries
*/

-- =====================================================
-- STEP 4: Verify links created
-- =====================================================

SELECT '' as space;
SELECT '=== Verification ===' as info;
SELECT
  mi.name as menu_item,
  inv.itemName as inventory_item,
  mii.quantity as qty_needed,
  inv.unit,
  inv.currentStock as available
FROM menu_item_inventory mii
JOIN menu_items mi ON mii.menuItemId = mi.id
JOIN inventory inv ON mii.inventoryId = inv.id;

-- =====================================================
-- STEP 5: Test stock deduction
-- =====================================================

-- After creating links, test by:
-- 1. Note current stock: SELECT itemName, currentStock FROM inventory;
-- 2. Add menu item to an order in the POS
-- 3. Check stock again: SELECT itemName, currentStock FROM inventory;
-- 4. Stock should have decreased!

-- Check audit logs to see stock changes:
/*
SELECT
  action,
  recordId,
  json_extract(newValues, '$.reason') as reason,
  json_extract(newValues, '$.previousStock') as before,
  json_extract(newValues, '$.newStock') as after,
  json_extract(newValues, '$.adjustment') as change,
  createdAt
FROM audit_logs
WHERE tableName = 'inventory'
ORDER BY createdAt DESC
LIMIT 10;
*/
