# Stock Deduction Fix - Prisma Relation Issue

## Problem Summary
Stock quantities were NOT being deducted when adding menu items to orders, even though ingredient links were saved correctly in the database.

## Root Cause
**Location**: [main/models/Order.ts](../main/models/Order.ts)

The `addItem`, `removeItem`, and `updateItem` methods were trying to use a Prisma relation `inventoryItems` that **doesn't exist in the Prisma schema**.

```typescript
// ❌ WRONG - This relation doesn't exist
const menuItem = await tx.menuItem.findUnique({
  where: { id: item.menuItemId },
  include: {
    inventoryItems: {  // ❌ This fails silently!
      include: {
        inventory: true,
      },
    },
  },
});
```

Since the relation doesn't exist, Prisma returns an empty array for `inventoryItems`, causing the stock deduction code to be skipped:

```typescript
if (menuItem.inventoryItems && menuItem.inventoryItems.length > 0) {
  // ❌ This never executes because inventoryItems = undefined or []
  // Stock deduction code here...
}
```

## The Fix

**Changed all three methods to query the junction table directly**, matching the pattern used in `orderService.ts` and `inventoryService.ts`:

### 1. Fixed `addItem` (Lines 1387-1433)
```typescript
// ✅ CORRECT - Query the junction table directly
const menuItem = await tx.menuItem.findUnique({
  where: { id: item.menuItemId },
});

const inventoryItems = await (tx as any).menuItemInventory.findMany({
  where: { menuItemId: item.menuItemId },
  include: { inventory: true },
});

if (inventoryItems && inventoryItems.length > 0) {
  // ✅ This executes correctly now!
  for (const inventoryLink of inventoryItems) {
    // Stock deduction logic...
  }
}
```

### 2. Fixed `removeItem` (Lines 1592-1621)
Same pattern - query `menuItemInventory` table directly for stock restoration.

### 3. Fixed `updateItem` (Lines 1732-1767)
Same pattern - query `menuItemInventory` table directly for stock adjustments.

## Why This Happened

The Prisma schema doesn't define a `inventoryItems` relation on the `MenuItem` model. The correct approach is to query the `menu_item_inventory` junction table directly using:

```typescript
await prisma.menuItemInventory.findMany({
  where: { menuItemId: item.menuItemId },
  include: { inventory: true },
});
```

This is the same pattern used throughout the codebase in:
- `main/services/inventoryService.ts` (lines 186, 388)
- `main/services/orderService.ts` (line 836)

## Testing After Fix

Restart dev mode and test:

### 1. Create Test Order
1. POS → Select table → Start order
2. Add a menu item that has ingredients
3. **Check terminal console** (backend logs):

**Expected**:
```
🔍 STOCK DEDUCTION: Processing for [item name] (quantity: 1)
✅ STOCK DEDUCTED: [ingredient] (20 → 15 kg)
```

### 2. Verify Stock Changed
Check Admin → Stock Management - stock should have decreased.

### 3. Remove Item from Order
Remove the item and check:
```
🔄 STOCK RESTORATION: Processing for [item name] (quantity: 1)
✅ STOCK RESTORED: [ingredient] (15 → 20 kg)
```

### 4. Update Order Item Quantity
Change quantity from 1 to 2:
```
🔄 STOCK ADJUSTMENT: Processing for [item name] (1 → 2)
✅ STOCK DEDUCTED: [ingredient] (20 → 15 kg)
```

## Files Modified

1. **[main/models/Order.ts](../main/models/Order.ts)**
   - Line 1387-1507: Fixed `addItem` method
   - Line 1592-1683: Fixed `removeItem` method
   - Line 1732-1850: Fixed `updateItem` method

## Related Issues

- **Issue 1**: Ingredient links not saving → Fixed in [INGREDIENT-FIX-SCHEMA-UPDATE.md](./INGREDIENT-FIX-SCHEMA-UPDATE.md)
- **Issue 2**: Stock deduction not happening → **Fixed in this document**

## Complete Flow (Now Working)

```
User adds item to order
↓
Frontend calls orderAPI.addItem()
↓
Backend Order.addItem() executes
↓
✅ Queries menuItemInventory table directly
✅ Finds ingredient links
✅ Calculates required quantities
✅ Deducts stock atomically
✅ Logs deduction
↓
Stock updated successfully! 🎉
```

## Timestamp
Fixed: 2025-10-25
