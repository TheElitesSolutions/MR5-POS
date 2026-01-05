# Fix $0.00 Order Totals Migration

## Problem
Orders showing $0.00 total due to floating-point precision errors in previous code versions.

## Solution
This migration recalculates order totals from order items using precise arithmetic.

## How to Run

### Option 1: Windows Batch File (Recommended)
1. Close the POS application if it's running
2. Double-click `fix-zero-totals.bat`
3. Review the output to see how many orders were fixed
4. Restart the application

### Option 2: Direct SQL Execution
If you have sqlite3 CLI installed:
```bash
sqlite3 "%APPDATA%\my-nextron-app\mr5-pos.db" < fix-zero-totals.sql
```

### Option 3: Manual SQL (Database Browser)
1. Open the database with a SQLite browser tool
2. Copy and paste the contents of `fix-zero-totals.sql`
3. Execute the SQL statements

## What Gets Fixed
- All orders with `total = 0` that have at least one order item
- Recalculates `subtotal` and `total` from the sum of item `totalPrice` values

## Safety
- The migration only updates orders with $0.00 totals
- It does NOT modify orders that already have non-zero totals
- It does NOT delete or modify order items

## Verification
After running, check the orders list in the application. All orders should now show correct totals instead of $0.00.

## Technical Details
- **Bug #1**: Fixed precision loss in `addOrderItem()` - now uses Decimal.js
- **Bug #2**: Fixed missing recalculation in `updateOrderItemQuantity()` - now calls `recalculateOrderTotals()`
- **Bug #3**: This migration fixes historical data from before the code fixes were applied

## Files
- `fix-zero-totals.sql` - SQL migration script
- `fix-zero-totals.bat` - Windows batch file to run the migration
- `fix-zero-totals.js` - Node.js version (requires running from within the app context)
