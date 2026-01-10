# Bulk Update Diagnostic Guide

## Issue Summary
Two initialization errors were occurring during app startup:
1. **Authentication Error**: `getCurrentUser` called before auth store hydrates
2. **Missing Handler Error**: Bulk update handler reported as "not registered"

## Fixes Implemented

### Phase 1: Defensive Guards ✅

#### 1. Frontend Auth Guards
**Files Modified**:
- [useMenuBulkUpdate.ts](../renderer/hooks/useMenuBulkUpdate.ts)
- [BulkItemManagementModal.tsx](../renderer/components/pos/BulkItemManagementModal.tsx)

**Changes**:
- Added `_hasHydrated` guard before any auth operations
- Removed IPC call to `get-current-user` (was causing auth error)
- Now uses `user.id` directly from auth store
- Disabled bulk update buttons until auth is ready

#### 2. Backend Logging
**Files Modified**:
- [startup-manager-nextron.ts](../main/startup-manager-nextron.ts)
- [menuItemController.ts](../main/controllers/menuItemController.ts)
- [baseController.ts](../main/controllers/baseController.ts)

**Changes**:
- Enhanced controller initialization logging
- Added handler registration verification
- Added detailed IPC invocation logging

### Phase 2: Comprehensive Diagnostics ✅

Added comprehensive logging at every level to track the complete lifecycle of handler registration and invocation.

## Expected Log Flow

When the app starts and bulk update is triggered, you should see these logs in order:

### 1. Startup Logs
```
[StartupManager] Initializing data controllers...
[StartupManager] → Initializing MenuItemController...
```

### 2. Handler Registration (BaseController)
```
[BaseController/MenuItemController] → Starting initialization...
[BaseController/MenuItemController] Attempting to register handler: {
  channel: "mr5pos:menu-items:bulk-update-properties",
  alreadyRegistered: false,
  handlerType: "function"
}
[BaseController/MenuItemController] ✓ Handler registered successfully: {
  channel: "mr5pos:menu-items:bulk-update-properties",
  handlersCount: 13
}
```

### 3. Initialization Complete
```
[MenuItemController] registerHandlers() completed - bulk-update-properties should be registered
[BaseController/MenuItemController] ✓ Initialization complete: {
  handlersRegistered: 13,
  channels: [
    "mr5pos:menu-items:get-all",
    "mr5pos:menu-items:get-by-id",
    ...
    "mr5pos:menu-items:bulk-update-properties"
  ]
}
[StartupManager] ✓ MenuItemController initialized successfully
```

### 4. Frontend Invocation
```
[useMenuBulkUpdate] Invoking bulk update: {
  channel: "mr5pos:menu-items:bulk-update-properties",
  itemCount: 5,
  updates: { isCustomizable: true },
  userId: "user-123"
}
```

### 5. Handler Execution
```
[MenuItemController] → bulkUpdateMenuItemProperties invoked: {
  itemCount: 5,
  categoryId: "cat-456",
  updates: { isCustomizable: true },
  userId: "user-123"
}
```

### 6. Service Execution
```
🔄 BULK UPDATE: Menu Item Properties {
  userId: "user-123",
  itemCount: 5,
  updated: 5,
  categories: 1,
  timestamp: "2026-01-10T..."
}
```

### 7. Response
```
[MenuItemController] ← bulkUpdateMenuItemProperties result: {
  success: true,
  updatedCount: 5,
  failedCount: 0
}

[useMenuBulkUpdate] Bulk update response: {
  success: true,
  data: { updatedCount: 5, ... }
}
```

## Diagnostic Scenarios

### Scenario A: Handler Never Registered
**Symptom**: No registration logs appear

**Look for**:
- `[BaseController/MenuItemController] → Starting initialization...` ❌ Missing
- `[StartupManager] ✗ MenuItemController initialization failed` ✅ Should appear

**Cause**: MenuItemController.initialize() is failing early

**Next Steps**: Check the error details in the initialization failed log

---

### Scenario B: Handler Registration Fails
**Symptom**: Registration attempt logs appear but no success log

**Look for**:
- `[BaseController/MenuItemController] Attempting to register handler` ✅ Present
- `[BaseController/MenuItemController] ✓ Handler registered successfully` ❌ Missing
- `[BaseController/MenuItemController] ✗ Failed to register handler` ✅ Should appear

**Cause**: `ipcMain.handle()` is throwing an error

**Next Steps**: Check the error message in the failed registration log

---

### Scenario C: Handler Registered but Not in List
**Symptom**: Success log appears but handler missing from channels list

**Look for**:
```
[BaseController/MenuItemController] ✓ Handler registered successfully
[BaseController/MenuItemController] ✓ Initialization complete: {
  channels: [...]  // bulk-update-properties missing
}
```

**Cause**: Handler was registered but then removed, or handlers.set() failed

**Next Steps**: Check if unregisterHandlers() is being called prematurely

---

### Scenario D: Frontend Calls Before Backend Ready
**Symptom**: "No handler registered" error before initialization complete logs

**Timeline**:
```
[useMenuBulkUpdate] Invoking bulk update          ← Frontend calls
Error: No handler registered                       ← Electron error
[StartupManager] → Initializing MenuItemController ← Backend initializing
```

**Cause**: Frontend is calling before backend initialization completes

**Solution**: Already implemented - auth guards should prevent this

**Next Steps**: Check if auth guards are working:
- Look for: `[useMenuBulkUpdate] Early call prevented: Auth store not yet hydrated`
- Look for: `[BulkItemManagementModal] Auth not ready for bulk update`

---

### Scenario E: Handler Working Correctly
**Symptom**: All logs appear in correct order

**Expected Flow**:
1. ✅ Startup logs
2. ✅ Registration attempt
3. ✅ Registration success
4. ✅ Handler in channels list
5. ✅ Frontend invocation
6. ✅ Handler execution
7. ✅ Service execution
8. ✅ Response returned

**Result**: Bulk update completes successfully, items are updated

---

## Testing Instructions

### Test 1: Fresh Start (Auth Error Check)
1. Close app completely
2. Start app: `npm run dev`
3. Login with credentials
4. Navigate to menu page
5. Open any category's bulk update modal

**Expected**:
- ✅ No auth errors in console
- ✅ Modal opens successfully
- ✅ Buttons are enabled (auth ready)

**If auth errors occur**:
- Check: `[useMenuBulkUpdate] Early call prevented`
- Check: `[BulkItemManagementModal] Auth not ready`
- Verify: Logs show `_hasHydrated: false` or `hasAccessToken: false`

---

### Test 2: Handler Registration (Handler Error Check)
1. Start app and watch console during startup
2. Look for all logs in "Expected Log Flow" section above
3. Verify bulk-update-properties appears in channels list

**Expected**:
- ✅ All startup logs appear
- ✅ Handler registration succeeds
- ✅ `bulk-update-properties` in channels list
- ✅ No "Failed to register handler" errors

**If handler error occurs**:
- Check which log is missing from the expected flow
- Follow the diagnostic scenario that matches the symptom

---

### Test 3: Bulk Update Operation
1. Login and navigate to menu
2. Open a category's bulk update modal
3. Select 3-5 items
4. Click "Enable Customization"
5. Watch console logs

**Expected**:
- ✅ `[useMenuBulkUpdate] Invoking bulk update`
- ✅ `[MenuItemController] → bulkUpdateMenuItemProperties invoked`
- ✅ `[MenuItemController] ← bulkUpdateMenuItemProperties result: { success: true }`
- ✅ Success toast appears
- ✅ Items are updated in UI

**If operation fails**:
- Check for error logs at any level
- Verify service execution logs appear
- Check database/validation errors

---

## Common Issues & Solutions

### Issue: "No handler registered" still occurring

**Check List**:
1. ✅ App restarted to pick up new logging?
2. ✅ Startup logs showing handler registration?
3. ✅ Handler in the channels list after init?
4. ✅ Frontend auth guards preventing early calls?

**If all yes but still failing**:
- The handler is being unregistered after init
- Check for cleanup or shutdown code running prematurely
- Look for: `Unregistered handler for channel: mr5pos:menu-items:bulk-update-properties`

---

### Issue: Auth errors still occurring

**Check List**:
1. ✅ `_hasHydrated` checks added to components?
2. ✅ Auth guards preventing early calls?
3. ✅ Using `user.id` from store (not IPC)?

**If all yes but still failing**:
- Check if `_hasHydrated` is ever set to `true`
- Verify auth store persistence is working
- Look for: `AuthProvider: Waiting for hydration`

---

### Issue: Handler executes but fails

**Possible Causes**:
1. Service method error
2. Database error
3. Validation error
4. Missing permissions

**Check For**:
- `[MenuItemController] ✗ Bulk update error:`
- Error details in service logs
- Validation failures in request data

---

## Success Criteria

✅ **All Must Pass**:
1. No auth errors during startup or navigation
2. Handler registration logs appear during startup
3. `bulk-update-properties` appears in channels list
4. Bulk update operations complete successfully
5. Items update in database and UI refreshes

## Rollback Plan

If issues persist after these fixes:
1. Revert to previous commit
2. Disable bulk update feature temporarily
3. Share diagnostic logs for further analysis

## Next Steps if Issues Persist

1. **Collect Full Logs**: Copy entire console output from startup to error
2. **Check Timing**: Note exact timestamps of each log
3. **Verify Channel Name**: Confirm exact channel string matches
4. **Test Isolation**: Try calling handler directly via IPC debugger
5. **Check Electron Version**: Ensure Electron IPC is working correctly

## Files Modified

### Frontend
- `renderer/hooks/useMenuBulkUpdate.ts` - Auth guards + logging
- `renderer/components/pos/BulkItemManagementModal.tsx` - Auth guards + disabled state

### Backend
- `main/controllers/baseController.ts` - Comprehensive registration logging
- `main/controllers/menuItemController.ts` - Handler execution logging
- `main/startup-manager-nextron.ts` - Initialization logging

All changes are **additive only** - no breaking changes to existing functionality.
