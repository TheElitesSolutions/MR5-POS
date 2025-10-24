# Stock Quantities Not Changing - Diagnosis & Fix

## Problem

Stock quantities aren't changing when you add/remove items from orders.

## Root Cause

**Menu items are NOT linked to inventory items in the database.**

The stock management system is fully implemented and working, but it requires menu items to be linked to their ingredients/inventory items through the `menu_item_inventory` table.

## How the System Works

```
Menu Item (Pizza) ──┐
                    ├──→ menu_item_inventory ──→ Inventory (Cheese)
                    │    - quantity: 200g
                    │
                    ├──→ menu_item_inventory ──→ Inventory (Dough)
                    │    - quantity: 300g
                    │
                    └──→ menu_item_inventory ──→ Inventory (Tomato Sauce)
                         - quantity: 100ml
```

When you add 1 Pizza to an order:
- The system looks for `menu_item_inventory` links
- If links exist: Deducts 200g Cheese, 300g Dough, 100ml Tomato Sauce
- If NO links exist: Nothing happens (current situation)

## Quick Check

### Option 1: Check via DB Browser (Recommended)

1. Download DB Browser for SQLite: https://sqlitebrowser.org/
2. Open database: `C:\Users\TheElitesSolutions\AppData\Roaming\my-nextron-app\mr5-pos.db`
3. Run this query:

```sql
SELECT COUNT(*) as total_links FROM menu_item_inventory;
```

If result is **0**, menu items are not linked to inventory.

### Option 2: Check Sample Links

```sql
SELECT
  mi.name as menu_item,
  inv.itemName as inventory_item,
  mii.quantity as quantity_needed
FROM menu_item_inventory mii
JOIN menu_items mi ON mii.menuItemId = mi.id
JOIN inventory inv ON mii.inventoryId = inv.id
LIMIT 10;
```

If this returns empty, you need to create the links.

## Solution: Link Menu Items to Inventory

### Step 1: Verify You Have Inventory Items

```sql
SELECT id, itemName, currentStock, unit, category
FROM inventory
ORDER BY category, itemName;
```

If empty, create inventory items first:
- Go to **Admin Panel → Inventory**
- Add ingredients: Cheese, Dough, Tomato Sauce, etc.
- Set quantities and units

### Step 2: Link Menu Items to Inventory

**You need to add a UI in the admin panel to manage these links, OR manually insert them:**

#### Manual SQL Method (Quick Fix):

```sql
-- Example: Link "Margherita Pizza" to ingredients
-- First, get IDs:
SELECT id, name FROM menu_items WHERE name LIKE '%Pizza%';
SELECT id, itemName FROM inventory;

-- Then create links:
INSERT INTO menu_item_inventory (id, menuItemId, inventoryId, quantity)
VALUES
  ('link-1', 'menu-item-id', 'cheese-inventory-id', 200),  -- 200g cheese
  ('link-2', 'menu-item-id', 'dough-inventory-id', 300),   -- 300g dough
  ('link-3', 'menu-item-id', 'sauce-inventory-id', 100);   -- 100ml sauce
```

#### UI Method (Better Long-term):

**Create an "Ingredients" section in the Menu Item edit form:**

```typescript
// In Menu Item Edit Form:
<div className="ingredients-section">
  <h3>Ingredients Required</h3>
  {ingredients.map(ingredient => (
    <div key={ingredient.id}>
      <Select
        options={inventoryItems}
        value={ingredient.inventoryId}
        onChange={(id) => updateIngredient(ingredient.id, id)}
      />
      <Input
        type="number"
        value={ingredient.quantity}
        onChange={(qty) => updateQuantity(ingredient.id, qty)}
        placeholder="Quantity needed"
      />
      <Button onClick={() => removeIngredient(ingredient.id)}>
        Remove
      </Button>
    </div>
  ))}
  <Button onClick={addIngredient}>Add Ingredient</Button>
</div>
```

## Testing After Fix

### 1. Verify Links Created

```sql
SELECT
  mi.name as menu_item,
  inv.itemName as inventory_item,
  mii.quantity,
  inv.currentStock as available_stock,
  inv.unit
FROM menu_item_inventory mii
JOIN menu_items mi ON mii.menuItemId = mi.id
JOIN inventory inv ON mii.inventoryId = inv.id;
```

### 2. Check Stock Before Order

```sql
SELECT itemName, currentStock, unit FROM inventory WHERE itemName = 'Cheese';
-- Example result: currentStock = 1000g
```

### 3. Create Test Order

1. Add menu item to order
2. Check logs for: `🔍 STOCK DEDUCTION: Processing for...`

### 4. Verify Stock Changed

```sql
SELECT itemName, currentStock, unit FROM inventory WHERE itemName = 'Cheese';
-- Should show: currentStock = 800g (if 200g was deducted)
```

### 5. Check Audit Log

```sql
SELECT * FROM audit_logs
WHERE tableName = 'inventory'
  AND action = 'INVENTORY_DECREASE'
ORDER BY createdAt DESC
LIMIT 5;
```

## Common Issues

### Issue: Still No Stock Changes After Linking

**Check Console Logs:**
1. Open Developer Tools (F12)
2. Check Console and Main Process logs
3. Look for errors like:
   - "Inventory item not found"
   - "Insufficient stock"
   - Transaction errors

**Check Log Files:**
```
C:\Users\TheElitesSolutions\AppData\Roaming\my-nextron-app\logs\
```

### Issue: Links Created But Wrong Quantities

**Check quantity units match:**
```sql
SELECT
  mi.name,
  mii.quantity,
  inv.itemName,
  inv.unit
FROM menu_item_inventory mii
JOIN menu_items mi ON mii.menuItemId = mi.id
JOIN inventory inv ON mii.inventoryId = inv.id;
```

Ensure:
- Quantities are in correct unit (grams, ml, pieces)
- Units match between link and inventory item

### Issue: Addons Not Deducting Stock

**Check addon inventory links:**
```sql
SELECT
  a.name as addon_name,
  inv.itemName as inventory_item,
  aii.quantity,
  inv.currentStock
FROM addon_inventory_items aii
JOIN addons a ON aii.addonId = a.id
JOIN inventory inv ON aii.inventoryId = inv.id;
```

If empty, addons need to be linked to inventory too (same process as menu items).

## Next Steps

1. **Immediate**: Manually create links for test menu items
2. **Short-term**: Create UI for managing ingredient links in admin panel
3. **Testing**: Verify stock deduction works for linked items
4. **Rollout**: Link all menu items to their ingredients

## Files to Check

- **Controller**: `main/controllers/orderController.ts:1247-1396` (has stock deduction logic)
- **Order Model**: `main/models/Order.ts:1377-1590` (addItem method with stock)
- **Addon Extensions**: `main/controllers/orderController.addon-extensions.ts:90-333`
- **Database Schema**: `main/db/schema.sql:224-236` (menu_item_inventory table)

## Summary

✅ **Stock management system is fully implemented**
❌ **Menu items are not linked to inventory items**
🔧 **Fix**: Create links in `menu_item_inventory` table
📝 **Recommended**: Build UI for managing these links in admin panel

Once menu items are linked to inventory, stock will automatically:
- ✅ Deduct when items added to orders
- ✅ Restore when items removed
- ✅ Adjust when quantities change
- ✅ Restore when orders cancelled
- ✅ Log all changes for audit
