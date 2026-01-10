# Bulk Item Management Testing Plan

**Feature**: Category-level bulk management for menu item properties
**Implementation Date**: 2026-01-10
**Status**: Ready for Testing

---

## Testing Overview

This document provides a comprehensive testing checklist for the bulk item management feature, including API verification, UI testing, and edge case validation.

---

## 1. Prerequisites

Before testing, ensure:
- [ ] Application is built and running (dev or production mode)
- [ ] SQLite database is accessible
- [ ] At least one category with 5+ menu items exists
- [ ] Test user has appropriate permissions (admin/manager)
- [ ] DevTools console is open for monitoring logs

---

## 2. Backend API Testing

### 2.1 Transaction Safety Verification

**Test Case**: Verify atomic updates (all-or-nothing)

**Steps**:
1. Open DevTools Console
2. Navigate to POS → Menu Categories
3. Click "⚙️ Manage" on any category
4. Select 5 items
5. Click "Enable Customization"
6. Check console for transaction log: `🔄 BULK UPDATE: Menu Item Properties`

**Expected Results**:
- [ ] Console shows: `updated: 5` (all items updated)
- [ ] Console shows: `failedCount: 0` (no failures)
- [ ] Success toast: "Updated 5 items"

**Database Verification** (optional):
```sql
-- Check isCustomizable values for the updated items
SELECT id, name, isCustomizable
FROM MenuItems
WHERE id IN (...item ids...);
```

---

### 2.2 Validation Testing

**Test Case**: Ensure validation prevents invalid requests

**Test 2.2.1**: No items selected
1. Open bulk management modal
2. Click any bulk action button WITHOUT selecting items
3. Expected: Modal shows "No items selected" error

**Test 2.2.2**: No property specified (backend validation)
```javascript
// This should fail in the backend validation
await window.electronAPI.ipc.invoke(
  'mr5pos:menu-items:bulk-update-properties',
  {
    itemIds: ['item-id-1'],
    updates: {}, // Empty updates object
    userId: 'test-user'
  }
);
```
Expected: Error message "At least one property must be specified for update"

---

### 2.3 Cache Invalidation Testing

**Test Case**: Verify cache is properly invalidated

**Steps**:
1. Navigate to POS → Categories view
2. Note the "items available" count for a category
3. Click "⚙️ Manage" on that category
4. Select all items
5. Click "Disable Kitchen Print"
6. Close modal
7. Check if the category view refreshes (observe console logs)

**Expected Results**:
- [ ] Console shows: `🗑️ MenuService: Invalidated X menu cache entries`
- [ ] Console shows: `🔄 MenuFlow: Detected return to categories, refreshing menu data`
- [ ] Category counts remain accurate (no stale data)

---

### 2.4 Performance Testing

**Test Case**: Verify bulk operations are efficient

**Performance Targets** (from plan):
- < 500ms for 50 items
- < 2s for 200 items

**Steps**:
1. Create or find a category with 50+ items
2. Open bulk management modal
3. Select all items
4. Note timestamp in console before clicking bulk action
5. Click "Enable Customization"
6. Note timestamp after success toast

**Expected Results**:
- [ ] Total time < 1 second for typical use (10-20 items)
- [ ] No UI freezing or lag during update
- [ ] Success toast appears promptly

---

## 3. Frontend UI Testing

### 3.1 Modal Functionality

**Test Case**: Verify modal UI components work correctly

**Steps**:
1. Navigate to POS → Menu Categories
2. Click "⚙️" button on any category
3. Verify modal opens with correct title: "Manage Items: [CategoryName]"
4. Test search functionality:
   - [ ] Type in search box → items filter correctly
   - [ ] Clear search → all items return
5. Test "Select All" checkbox:
   - [ ] Click → all items selected
   - [ ] Click again → all items deselected
6. Test individual item selection:
   - [ ] Click item → checkbox toggles
   - [ ] Click multiple items → selection count updates
7. Test bulk action buttons appear only when items selected
8. Test "Done" button closes modal

---

### 3.2 Item Display

**Test Case**: Verify items display correct information

**Checklist**:
- [ ] Item name displays correctly
- [ ] Item price badge shows correct amount
- [ ] Item description displays (if present)
- [ ] "Customizable" badge shows correct state (green/outline)
- [ ] "Kitchen Print" badge shows correct state (green/outline)
- [ ] Badges update immediately after bulk action completes

---

### 3.3 Bulk Actions

**Test Case 3.3.1**: Enable Customization
1. Select 3 items that are NOT customizable
2. Click "Enable Customization"
3. Expected:
   - [ ] Toast: "Updated 3 items"
   - [ ] Items now show green "Customizable" badge
   - [ ] Selection clears after update

**Test Case 3.3.2**: Disable Customization
1. Select 3 items that ARE customizable
2. Click "Disable Customization"
3. Expected:
   - [ ] Toast: "Updated 3 items"
   - [ ] Items now show outline "Not customizable" badge

**Test Case 3.3.3**: Enable Kitchen Print
1. Select 3 items with kitchen print disabled
2. Click "Enable Kitchen Print"
3. Expected:
   - [ ] Toast: "Updated 3 items"
   - [ ] Items now show green "Kitchen Print" badge

**Test Case 3.3.4**: Disable Kitchen Print
1. Select 3 items with kitchen print enabled
2. Click "Disable Kitchen Print"
3. Expected:
   - [ ] Toast: "Updated 3 items"
   - [ ] Items now show outline "No Kitchen Print" badge

---

### 3.4 Error Handling

**Test Case**: Verify error messages display correctly

**Simulate Backend Error** (optional):
1. Temporarily rename the IPC channel in the hook to cause a failure
2. Try to perform bulk update
3. Expected:
   - [ ] Toast with error message appears
   - [ ] Selection remains (not cleared)
   - [ ] Console shows error details

---

## 4. Integration Testing

### 4.1 Kitchen Ticket Integration

**Test Case**: Verify kitchen tickets respect `isPrintableInKitchen` flag

**Steps**:
1. Disable kitchen print for item "Burger"
2. Add "Burger" to an order
3. Complete the order
4. Check kitchen ticket output

**Expected Results**:
- [ ] "Burger" does NOT appear on kitchen ticket
- [ ] Other items still appear on kitchen ticket

---

### 4.2 Customization Flow Integration

**Test Case**: Verify customization respects `isCustomizable` flag

**Steps**:
1. Disable customization for item "Pizza"
2. In POS → Select category containing "Pizza"
3. Click "Pizza" item card
4. Expected: Skip directly to addons step (no customization step)

**Steps for Enabled**:
1. Enable customization for item "Salad"
2. Click "Salad" item card
3. Expected: Shows customization step with ingredient toggles

---

### 4.3 MenuFlow Category View

**Test Case**: Verify category cards display correctly after bulk updates

**Steps**:
1. Note initial state: Category "Appetizers" has 10 items
2. Click "⚙️ Manage" on "Appetizers"
3. Select and update 5 items
4. Close modal
5. Navigate back to categories view
6. Expected:
   - [ ] "Appetizers" still shows 10 items available
   - [ ] Category counts remain accurate
   - [ ] No visual glitches

---

## 5. Edge Cases

### 5.1 Large Batch Size

**Test Case**: Verify handling of 100+ items

**Steps** (if applicable):
1. Find or create category with 100+ items
2. Open bulk management modal
3. Select all items
4. Perform bulk update
5. Monitor console for transaction log

**Expected Results**:
- [ ] Update completes successfully
- [ ] Performance remains acceptable (< 2s)
- [ ] No timeout errors
- [ ] UI remains responsive

---

### 5.2 Concurrent Edits

**Test Case**: Verify behavior with concurrent updates

**Steps**:
1. Open bulk management modal for "Category A"
2. In another window/tab (if possible), update one of the same items individually
3. Complete bulk update from first window
4. Expected:
   - [ ] Last write wins (bulk update overwrites individual edit)
   - [ ] No database corruption
   - [ ] Cache properly invalidated

---

### 5.3 Empty Category

**Test Case**: Verify handling of category with 0 items

**Steps**:
1. Create empty category or clear all items from a category
2. Click "⚙️ Manage" on empty category
3. Expected:
   - [ ] Modal opens successfully
   - [ ] Message: "No items found"
   - [ ] No errors in console

---

### 5.4 Search with No Results

**Test Case**: Verify search behavior with no matches

**Steps**:
1. Open bulk management modal
2. Type nonsense in search box
3. Expected:
   - [ ] Message: "No items found"
   - [ ] Select All checkbox disabled or hidden
   - [ ] Bulk action buttons do not appear

---

## 6. Accessibility & UX

### 6.1 Keyboard Navigation
- [ ] Tab key moves focus between elements correctly
- [ ] Enter key activates buttons
- [ ] Escape key closes modal

### 6.2 Touch/Mobile Support
- [ ] Buttons are easily tappable (48x48px minimum)
- [ ] No layout issues on small screens
- [ ] Modal scrolls properly on mobile

### 6.3 Loading States
- [ ] Bulk action buttons show loading state during update
- [ ] Buttons are disabled during update (no double-submit)
- [ ] Loading spinner or indicator visible

---

## 7. Verification Checklist

After completing all tests above, verify:

**Functionality**:
- [ ] ✅ Manager can select multiple items in a category
- [ ] ✅ Manager can bulk enable/disable customization
- [ ] ✅ Manager can bulk enable/disable kitchen printing
- [ ] ✅ Changes reflected immediately in UI (optimistic updates)
- [ ] ✅ Changes persisted to database (verified via re-opening modal)

**Quality**:
- [ ] ✅ Kitchen tickets respect updated `isPrintableInKitchen` flag
- [ ] ✅ Customization flow respects updated `isCustomizable` flag
- [ ] ✅ No performance degradation in POS workflow
- [ ] ✅ Transaction safety maintained (atomic updates)
- [ ] ✅ Cache coherency maintained (no stale data)

**Error Handling**:
- [ ] ✅ Validation errors display properly
- [ ] ✅ Network errors handled gracefully
- [ ] ✅ User receives clear feedback on success/failure

---

## 8. Regression Testing

Verify existing functionality still works:

- [ ] Regular menu item creation/editing works
- [ ] POS order flow unaffected
- [ ] Individual item availability toggle works
- [ ] Category management unaffected
- [ ] Reports and analytics accurate

---

## 9. Known Limitations

**From Implementation**:
- Bulk update uses "last write wins" for concurrent edits (acceptable for POS use case)
- Maximum 1000 items per bulk update (enforced by validation)
- No undo/redo functionality (consider for future enhancement)

---

## 10. Sign-Off

**Developer**: Implementation completed on 2026-01-10
**Tester**: ________________________
**Date**: ________________________
**Status**: [ ] Approved [ ] Needs Fixes

**Notes**:
_______________________________________________________________________
_______________________________________________________________________
_______________________________________________________________________
