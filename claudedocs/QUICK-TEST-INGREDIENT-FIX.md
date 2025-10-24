# Quick Test: Ingredient Links Fix

## ✅ Fix Applied and Built

**Status**: Build completed successfully at 2025-10-25

**What was fixed**:
- Explicitly preserve `ingredients` and `allergens` in menuStore.ts sanitizedData
- Added diagnostic logging to track ingredient data flow

## Quick Test Steps (5 minutes)

### 1. Start the App
- Close any running instance completely
- Launch the app fresh
- Open DevTools (F12) - keep Console tab visible

### 2. Create Test Menu Item

Go to: **Admin → Menu → Add Item**

Fill in:
```
Name: Debug Burger
Price: 10.00
Category: Main
Description: Test for ingredient links
```

Scroll to **"Ingredients" section** (below all other fields)

Add ingredients:
```
Ingredient 1:
- Select any inventory item
- Quantity: 0.2

Ingredient 2 (optional):
- Select another inventory item
- Quantity: 1
```

Click **"Save"**

### 3. Check Console Logs

In the browser DevTools Console, look for these logs:

**Should see**:
```
🔍 menuStore.createMenuItem - Received itemData: {
  ingredientsCount: 2,        // ✅ Should be > 0
  hasIngredients: true,       // ✅ Should be true
  isArray: true              // ✅ Should be true
}

🔧 menuStore.createMenuItem sanitized: {
  ingredientsCount: 2,        // ✅ Should match received count
  hasIngredients: true        // ✅ Should be true
}
```

**Bad signs** (means fix didn't work):
```
ingredientsCount: 0           // ❌ BAD
hasIngredients: false         // ❌ BAD
```

### 4. Verify Ingredient Links Saved

Edit the menu item you just created:
- Admin → Menu → Find "Debug Burger" → Click "Edit"
- Scroll to "Ingredients" section
- **Expected**: Your added ingredients should be listed
- **Bad**: Ingredients section is empty

### 5. Quick Database Check (Optional)

Close the app and run:
```bash
node scripts/check-menu-item-inventory-links.js
```

Look for "Debug Burger" in the output - should show it has ingredients linked.

## Success Criteria

✅ **PASS** if:
1. Console shows `ingredientsCount > 0` in both logs
2. Editing the item shows the ingredients you added
3. Database check shows links exist

❌ **FAIL** if:
1. Console shows `ingredientsCount: 0`
2. Editing the item shows no ingredients
3. Database check shows no links

## If Test PASSES

The fix is successful! Stock management should now work:

**Next Steps**:
1. Link all your menu items to inventory items
2. Test stock deduction when adding items to orders
3. Verify stock restoration when removing items

See [TESTING-CHECKLIST.md](./TESTING-CHECKLIST.md) for comprehensive testing.

## If Test FAILS

The issue is more complex. Share these with me:

1. **Console Logs**: Copy/paste the two diagnostic logs
2. **Network Tab**: Check if the API call shows ingredients in the request payload
3. **Backend Logs**: Check `C:\Users\TheElitesSolutions\AppData\Roaming\my-nextron-app\logs\`

Look for:
```
🔍 MenuItemService.create - Received itemData: { ... }
ℹ️ No ingredients provided for menu item: Debug Burger
```

Share what you find, and I'll investigate further.

## Expected Timeline

- Test should take ~5 minutes
- If successful, you can start linking menu items to inventory
- Full stock management testing will take ~30 minutes (see TESTING-CHECKLIST.md)

---

**Built**: 2025-10-25
**Fix File**: [renderer/stores/menuStore.ts:461-462](../renderer/stores/menuStore.ts#L461-L462)
