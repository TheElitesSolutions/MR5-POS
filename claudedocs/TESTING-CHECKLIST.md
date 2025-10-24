# Stock Management Testing Checklist

Use this checklist to test if stock management is working correctly after rebuilding the app.

## Prerequisites

- [ ] App has been rebuilt: `yarn build`
- [ ] App has been restarted (close completely and reopen)
- [ ] DevTools is open (F12) to see console messages

## Test 1: Create Inventory Item

**Goal**: Verify inventory items can be created and saved

- [ ] Go to: Admin → Inventory
- [ ] Click "Add Item"
- [ ] Fill in:
  - Name: "Test Beef"
  - Category: "Meat"
  - Current Stock: 10
  - Minimum Stock: 2
  - Unit: kg
  - Cost per Unit: 5.00
- [ ] Click "Save"
- [ ] **VERIFY**: Item appears in inventory list
- [ ] Refresh page (F5)
- [ ] **VERIFY**: Item still appears
- [ ] **RESULT**: ✅ PASS / ❌ FAIL

**If FAIL**: Check console for errors, share them with me

## Test 2: Create Menu Item with Ingredients

**Goal**: Verify menu items can be linked to inventory items

- [ ] Go to: Admin → Menu
- [ ] Click "Add Item"
- [ ] Fill in:
  - Name: "Test Burger"
  - Price: 10.00
  - Category: "Main"
  - Description: "Test item"
- [ ] Scroll down to **"Ingredients" section**
- [ ] Click "Add Ingredient"
- [ ] Select "Test Beef" from dropdown
- [ ] Enter quantity: 0.2
- [ ] Click "Save"
- [ ] **VERIFY**: Item appears in menu list
- [ ] Click "Edit" on "Test Burger"
- [ ] Scroll to "Ingredients" section
- [ ] **VERIFY**: "Test Beef (0.2 kg)" is listed
- [ ] **RESULT**: ✅ PASS / ❌ FAIL

**If FAIL**:
1. Check console for error during save
2. If ingredients field is missing, scroll more - it's at the bottom
3. Share screenshot of the form

## Test 3: Stock Deduction on Order Creation

**Goal**: Verify stock changes when adding items to orders

- [ ] Go to: Admin → Inventory
- [ ] Note current stock of "Test Beef": ______ kg
- [ ] Go to: POS
- [ ] Select any table OR create takeout order
- [ ] Add "Test Burger" (quantity: 1)
- [ ] Go back to: Admin → Inventory
- [ ] Check stock of "Test Beef": ______ kg
- [ ] **VERIFY**: Stock decreased by 0.2 kg
- [ ] **RESULT**: ✅ PASS / ❌ FAIL

**Expected Math:**
- Before: 10 kg
- After adding 1 burger (needs 0.2kg): 9.8 kg
- Difference: -0.2 kg ✅

**If FAIL**: Stock didn't change - this means:
1. Menu item has no ingredient links (go back to Test 2)
2. Or code isn't executing (check logs)

## Test 4: Stock Restoration on Item Removal

**Goal**: Verify stock is restored when removing items

- [ ] Current stock of "Test Beef": ______ kg
- [ ] Go to: POS
- [ ] Remove "Test Burger" from the order
- [ ] Go to: Admin → Inventory
- [ ] Check stock of "Test Beef": ______ kg
- [ ] **VERIFY**: Stock increased by 0.2 kg (back to original)
- [ ] **RESULT**: ✅ PASS / ❌ FAIL

## Test 5: Addon Stock Management (New Fix)

**Goal**: Verify addon stock changes (this was broken, now fixed)

### Setup:
- [ ] Go to: Admin → Inventory
- [ ] Create "Test Cheese" (stock: 20 pcs, unit: pcs)
- [ ] Go to: Admin → Addons
- [ ] Create new addon group: "Extras"
- [ ] Create new addon: "Extra Cheese" ($1.50)
- [ ] Link to ingredient:
  - Select "Test Cheese"
  - Quantity: 1 pcs
- [ ] Save

### Test:
- [ ] Note stock: "Test Cheese" = ______ pcs
- [ ] Go to: POS
- [ ] Add "Test Burger" with "Extra Cheese" addon
- [ ] Check stock: "Test Cheese" = ______ pcs
- [ ] **VERIFY**: Stock decreased by 1 pcs
- [ ] **RESULT**: ✅ PASS / ❌ FAIL

**Expected Math:**
- Before: 20 pcs
- After adding 1 burger with extra cheese: 19 pcs
- Difference: -1 pcs ✅

**If FAIL**: Addon stock management is broken (this was the main bug I fixed today)

## Test 6: Order Cancellation Stock Restoration

**Goal**: Verify all stock restores when cancelling entire order

- [ ] Create new order
- [ ] Add "Test Burger" (uses 0.2kg beef)
- [ ] Add "Extra Cheese" addon (uses 1 pcs cheese)
- [ ] Note stocks:
  - Beef: ______ kg
  - Cheese: ______ pcs
- [ ] Cancel the entire order
- [ ] Check stocks:
  - Beef: ______ kg
  - Cheese: ______ pcs
- [ ] **VERIFY**: All stock restored to original values
- [ ] **RESULT**: ✅ PASS / ❌ FAIL

## Results Summary

| Test | Status | Notes |
|------|--------|-------|
| 1. Create Inventory | ⬜ PASS / ⬜ FAIL | |
| 2. Link Menu Items | ⬜ PASS / ⬜ FAIL | |
| 3. Stock Deduction | ⬜ PASS / ⬜ FAIL | |
| 4. Stock Restoration | ⬜ PASS / ⬜ FAIL | |
| 5. Addon Stock | ⬜ PASS / ⬜ FAIL | |
| 6. Order Cancellation | ⬜ PASS / ⬜ FAIL | |

## If Any Tests Fail

**For Test 1 Failure:**
- Share console errors
- Check: C:\Users\TheElitesSolutions\AppData\Roaming\my-nextron-app\logs\
- Look for validation errors

**For Test 2 Failure:**
- Share screenshot of form
- Check console for "📤 MenuItemForm sending to store"
- Look for `ingredientsCount: 0` vs `ingredientsCount: 1`

**For Test 3-6 Failures:**
- Menu items don't have ingredient links (Test 2 failed)
- Run: `node scripts/check-menu-item-inventory-links.js` (close app first)
- Share log excerpts

**Then Let Me Know:**
1. Which test(s) failed
2. Any error messages
3. Log excerpts if available
4. I'll help debug further!

## Quick Database Check (If All Else Fails)

Close the app and run this to see what's in the database:

```bash
cd "C:\Users\TheElitesSolutions\Documents\Clients\MR5-POS-v2"
node scripts/check-menu-item-inventory-links.js
```

This will show:
- Which menu items HAVE ingredient links ✅
- Which menu items DON'T have ingredient links ❌
- Which addons HAVE ingredient links ✅
- Which addons DON'T have ingredient links ❌
