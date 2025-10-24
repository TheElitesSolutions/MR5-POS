# Stock Management User Guide

## Overview
Your POS system has FULL automatic stock management for both menu items and addons. Stock quantities change automatically when orders are created, items are removed, or orders are cancelled.

## Current Status: ✅ FULLY WORKING

All stock management code is implemented and working correctly:
- ✅ Menu item stock deduction when adding to orders
- ✅ Addon stock deduction when adding to orders
- ✅ Stock restoration when removing items
- ✅ Stock restoration when cancelling orders
- ✅ Addon stock adjustment when changing item quantities

## How to Enable Stock Management for Menu Items

### Step 1: Create Inventory Items
1. Go to **Admin → Inventory**
2. Create inventory items for your ingredients (e.g., "Tomatoes", "Lettuce", "Cheese")
3. Set:
   - Name
   - Current stock quantity
   - Unit (kg, pcs, liters, etc.)
   - Cost per unit (optional)

### Step 2: Link Menu Items to Inventory
When creating or editing a menu item:

1. Go to **Admin → Menu**
2. Click "Add Item" or edit existing item
3. **CRITICAL**: Scroll down to the "Ingredients" section
4. Click "Add Ingredient"
5. Select inventory item from dropdown
6. Enter quantity needed per menu item (e.g., 0.2 kg of tomatoes)
7. Add all required ingredients
8. Save

### Step 3: Verify Links
After saving, check that ingredients appear in the menu item form when you edit it again.

## How to Enable Stock Management for Addons

### Step 1: Edit Addon
1. Go to **Admin → Addons**
2. Edit an existing addon
3. Link it to inventory items (same as menu items)

### Step 2: Save and Test
Save the addon and verify the link is saved.

## How It Works

### When Adding Items to Orders:
```
Menu Item: "Burger" (needs 0.2kg beef, 0.05kg cheese)
+ Addon: "Extra Cheese" (needs 0.05kg cheese)

Stock Before:
- Beef: 10 kg
- Cheese: 5 kg

After adding 1 burger with extra cheese:
- Beef: 9.8 kg  ✅ (deducted 0.2kg)
- Cheese: 4.9 kg  ✅ (deducted 0.05 + 0.05 = 0.1kg)
```

### When Removing Items:
Stock is restored automatically.

### When Cancelling Orders:
All stock for all items (including addons) is restored.

## Troubleshooting

### Stock Not Changing?

**Check 1: Are menu items linked to inventory?**
```
Admin → Menu → Edit Item → Scroll to "Ingredients" section
Should see: List of ingredients with quantities
If empty: Menu item has NO inventory links!
```

**Fix**: Add ingredients to the menu item (see Step 2 above)

**Check 2: Are addons linked to inventory?**
```
Admin → Addons → Edit Addon → Check inventory links
```

**Fix**: Add inventory links to addons

### How to Verify It's Working:

1. **Before Testing:**
   - Note current stock: Admin → Inventory (e.g., Beef = 10kg)

2. **Create Order:**
   - POS → Add item with ingredients → Complete order

3. **After Testing:**
   - Check stock again: Admin → Inventory (e.g., Beef = 9.8kg)
   - Should see reduction!

4. **Test Restoration:**
   - Cancel the order
   - Stock should return to original value

## Database Table Structure

The system uses these tables for stock management:

### menu_item_inventory
Links menu items to inventory items:
```sql
menuItemId | inventoryId | quantity
-----------+-------------+---------
burger-id  | beef-id     | 0.2
burger-id  | cheese-id   | 0.05
```

### addon_inventory_items
Links addons to inventory items:
```sql
addonId        | inventoryId | quantity
---------------+-------------+---------
extra-cheese   | cheese-id   | 0.05
```

## Technical Details

### Code Paths

**Items WITHOUT addons:**
- Uses `ORDER_CHANNELS.ADD_ITEM` → `orderController.addOrderItem()`
- Deducts menu item inventory only

**Items WITH addons:**
- Uses `order:addItemWithAddons` → `orderController.addOrderItemWithAddons()`
- Deducts both menu item AND addon inventory

### All Operations Are Atomic
All stock operations use database transactions, so if any part fails, ALL changes are rolled back. This prevents partial stock deductions.

### Audit Logging
Every stock change is logged in the `audit_log` table for tracking and debugging.

## Recent Fixes (2025-10-25)

### Fixed Addon Stock Management Bugs:
1. **Fixed addon stock deduction** - Changed from `addon.inventory` (NULL) to `addon.inventoryItems` (correct relationship)
2. **Fixed addon stock restoration** - Same fix applied to removal operations
3. **Added comprehensive audit logging** - Every addon stock change is now logged

### What Changed:
- `orderController.addon-extensions.ts:152-253` - Addon stock deduction when adding items
- `orderController.addon-extensions.ts:585-655` - Addon stock restoration when removing items

## Summary

Your stock management system is **fully functional**. The only requirement is that **menu items and addons must be linked to inventory items** when they are created or edited.

If stock isn't changing, it's because the links don't exist - not because the code is broken!
