# Table Deletion Fix - Implementation Summary

## Problem
When a table is deleted, all completed orders associated with that table are automatically deleted. This causes loss of historical order data and breaks reporting/audit trails.

## Root Cause
1. **Database Schema**: `ON DELETE SET NULL` for `tableId` foreign key
2. **Application Code**: Explicitly deletes ALL orders (including completed) in transaction

## Solution
Add denormalized `tableName` column to preserve table name even after table deletion, and modify deletion logic to preserve completed/cancelled orders.

---

## Changes Implemented

### 1. Database Schema ✅
**File**: `main/db/schema.sql`
- Added `tableName TEXT` column to orders table (line 122)
- Added index on `tableName` for query performance (line 146)

### 2. Type Definitions ✅
**Files Updated**: 2
- `shared/ipc-types.ts` (line 261): Added `tableName?: string` to Order interface
- `renderer/types/index.ts` (line 62): Added `tableName?: string` to Order interface

### 3. Backend Order Model ✅
**File**: `main/models/Order.ts`

**Order Creation** (lines 799-806):
- Fetch table name when order is created
- Store in `tableName` column during order creation

**Order Mapping** (line 510):
- Include `tableName` in mapped order: `tableName: order.tableName || table?.name || undefined`

### 4. Table Deletion Logic ✅
**Files Updated**: 2

**File**: `main/models/Table.ts` (lines 397-465)
```typescript
// PRESERVE completed/cancelled orders (set tableId = NULL)
await tx.order.updateMany({
  where: {
    tableId: id,
    status: { in: ['COMPLETED', 'CANCELLED'] },
  },
  data: { tableId: null }, // tableName stays intact
});

// DELETE active orders only
const activeOrders = await tx.order.findMany({
  where: {
    tableId: id,
    status: { notIn: ['COMPLETED', 'CANCELLED'] },
  },
  select: { id: true },
});
```

**File**: `main/services/tableService.ts` (lines 165-218)
- Applied same preservation logic

### 5. Frontend Components ✅
**Files Updated**: 2

**File**: `renderer/components/orders/OrderCard.tsx` (line 124)
```tsx
{(order as any).table?.name || order.tableName || 'N/A'}
```

**File**: `renderer/components/reports/SalesReports.tsx` (line 258)
```tsx
{(order as any).table?.name || order.tableName || '-'}
```

### 6. Receipt/Invoice Generators ✅
**Files Updated**: 4

**File**: `main/utils/receiptGenerator.ts` (line 145)
```typescript
.text(`Table: ${order.table?.name || order.tableName || 'N/A'}`)
```

**File**: `main/utils/addonInvoiceGenerator.ts` (lines 650, 730)
```typescript
thermal += `Table: ${order.table?.name || order.tableName || 'N/A'}\n`;
<strong>Table:</strong> ${order.table?.name || order.tableName || 'N/A'}<br>
```

**File**: `main/utils/enhancedKitchenTicket.ts` (lines 224, 537, 741)
```typescript
const tableName = order?.table?.name || order?.tableName || 'N/A';
value: order?.type === 'DINE_IN'
  ? `Table: ${order?.table?.name || order?.tableName || 'N/A'}`
  : `Customer: ${order?.customerName || 'N/A'}`
```

**File**: `main/utils/addonKitchenTicket.ts` (line 174)
```typescript
value: `Table: ${order?.table?.name || order?.tableName || 'N/A'}`
```
*(This file already had the correct pattern!)*

### 7. Report Services ✅
**Files Updated**: 2

**File**: `main/services/reportService.ts` (line 179)
```typescript
tableName: order.table?.name || order.tableName,
```

**File**: `main/utils/excelExport.ts` (line 100)
```typescript
(order as any).table?.name || order.tableName || '-',
```

---

## Migration Script
**File**: `scripts/add-tablename-migration.sql`

Run this script to:
1. Add `tableName` column to existing database
2. Create performance index
3. Backfill existing orders with table names

---

## Testing Checklist

### Pre-Migration Testing
- [ ] Backup database before running migration
- [ ] Run migration script: `sqlite3 database.db < scripts/add-tablename-migration.sql`
- [ ] Verify column added: `PRAGMA table_info(orders);`
- [ ] Verify backfill: Check orders table for populated `tableName` values

### Functional Testing
- [ ] **Create Order**: Create order for Table A, verify `tableName` is stored
- [ ] **Complete Order**: Complete the order
- [ ] **Delete Table**: Delete Table A
- [ ] **Verify Preservation**: Check that completed order still exists with `tableId = NULL`
- [ ] **Verify Table Name**: Check that `tableName` is still populated
- [ ] **View Order**: Open order in UI, verify table name displays correctly
- [ ] **Print Receipt**: Print receipt for completed order, verify table name appears
- [ ] **Generate Report**: Generate sales report, verify table name appears in export

### Active Order Testing
- [ ] **Create Active Order**: Create order for Table B (don't complete it)
- [ ] **Delete Table**: Delete Table B
- [ ] **Verify Deletion**: Confirm active order was deleted along with the table
- [ ] **No Orphans**: Verify no orphaned order_items remain

### Edge Cases
- [ ] **Takeout Orders**: Verify takeout/delivery orders (no table) still work
- [ ] **Null Table ID**: Test orders with `tableId = NULL` from start
- [ ] **Multiple Statuses**: Test with PENDING, PREPARING, READY, SERVED, COMPLETED, CANCELLED

---

## Files Changed Summary

### Database & Schema (1 file)
- `main/db/schema.sql`

### Type Definitions (2 files)
- `shared/ipc-types.ts`
- `renderer/types/index.ts`

### Backend Models & Services (4 files)
- `main/models/Order.ts`
- `main/models/Table.ts`
- `main/services/tableService.ts`
- `main/services/reportService.ts`

### Frontend Components (2 files)
- `renderer/components/orders/OrderCard.tsx`
- `renderer/components/reports/SalesReports.tsx`

### Receipt & Printing (4 files)
- `main/utils/receiptGenerator.ts`
- `main/utils/addonInvoiceGenerator.ts`
- `main/utils/enhancedKitchenTicket.ts`
- `main/utils/addonKitchenTicket.ts`

### Utilities (1 file)
- `main/utils/excelExport.ts`

### Scripts (1 file)
- `scripts/add-tablename-migration.sql`

**Total Files Changed**: 15 files

---

## Deployment Steps

1. **Backup Production Database**
   ```bash
   cp production.db production.db.backup
   ```

2. **Run Migration**
   ```bash
   sqlite3 production.db < scripts/add-tablename-migration.sql
   ```

3. **Deploy Code Changes**
   - Stop application
   - Deploy new code
   - Restart application

4. **Verify**
   - Create test order
   - Complete test order
   - Delete test table
   - Verify order preserved with table name

---

## Benefits

1. **Data Preservation**: Historical order data is never lost
2. **Audit Trail**: Complete order history maintained even after table removal
3. **Reporting**: Sales reports remain accurate with full historical data
4. **Receipt Printing**: Invoices for old orders still show original table name
5. **Database Integrity**: Foreign key constraints respected while preserving data

---

## Technical Notes

- **Denormalization Trade-off**: `tableName` is denormalized for data preservation
- **Storage Impact**: Minimal - adds one TEXT column per order (~10-50 bytes)
- **Query Performance**: Index added on `tableName` for reporting queries
- **Backward Compatible**: Fallback pattern ensures old code still works
- **Forward Compatible**: New orders automatically store table name

---

## Date
**Implementation Date**: 2025-01-26
**Version**: v2.3.3 (upcoming)

---

## Bug Fix - Order Creation Not Saving Table Name

### Issue Discovered
**Date**: 2025-10-26
**Symptom**: Orders were being saved to the database without the `tableName` field populated, showing "N/A" in UI

### Root Cause
In [main/models/Order.ts](../main/models/Order.ts) (lines 811-813), the table foreign key connection was being added **unconditionally** to the order creation data:

```typescript
const orderCreateData: any = {
  orderNumber: orderData.orderNumber,
  table: {
    connect: { id: orderData.tableId },  // ❌ Always included, even when tableId is null
  },
  tableName: tableName,
  ...
};
```

This caused issues because:
1. For TAKEOUT/DELIVERY orders, `tableId` could be null/undefined
2. Prisma would fail to create the foreign key relationship properly
3. The `tableName` field was not being saved to the database despite being included in the data object

### Fix Applied
Made the `table` foreign key connection conditional, matching the pattern used for `customer`:

**File**: [main/models/Order.ts](../main/models/Order.ts) (lines 824-829)
```typescript
// Only add table if tableId is provided
if (orderData.tableId) {
  orderCreateData.table = {
    connect: { id: orderData.tableId },
  };
}
```

### Impact
- **Before Fix**: All orders (including DINE_IN with tables) showed "Table: N/A"
- **After Fix**: DINE_IN orders correctly display table name, TAKEOUT/DELIVERY show appropriate fallback
- **Data Integrity**: Table name is now properly saved to database for future reference

### Testing Required
1. Create a new DINE_IN order with a table → Verify tableName is saved in database
2. View the order → Verify table name displays correctly (not "N/A")
3. Complete the order → Verify table name persists
4. Delete the table → Verify order still shows correct table name
5. Create TAKEOUT/DELIVERY order → Verify no errors and appropriate display
