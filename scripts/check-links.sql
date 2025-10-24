-- Check Menu Item Inventory Links
.print "=== Menu Item Inventory Links ==="
SELECT COUNT(*) as total_links FROM menu_item_inventory;

.print ""
.print "=== Sample Links ==="
SELECT
    mi.name as menu_item,
    inv.itemName as inventory_item,
    mii.quantity as qty_needed,
    inv.unit,
    inv.currentStock as available
FROM menu_item_inventory mii
JOIN menu_items mi ON mii.menuItemId = mi.id
JOIN inventory inv ON mii.inventoryId = inv.id
LIMIT 10;

.print ""
.print "=== Active Menu Items ==="
SELECT id, name, price FROM menu_items WHERE isActive = 1 LIMIT 5;

.print ""
.print "=== Inventory Items ==="
SELECT id, itemName, currentStock, unit FROM inventory LIMIT 5;

.print ""
.print "=== Addon Inventory Links ==="
SELECT COUNT(*) as total_addon_links FROM addon_inventory_items;

.print ""
.print "=== Sample Addon Links ==="
SELECT
    a.name as addon_name,
    inv.itemName as inventory_item,
    aii.quantity as qty_needed,
    inv.currentStock as available
FROM addon_inventory_items aii
JOIN addons a ON aii.addonId = a.id
JOIN inventory inv ON aii.inventoryId = inv.id
LIMIT 10;
