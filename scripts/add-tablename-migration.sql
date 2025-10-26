-- Migration Script: Add tableName Column to Orders Table
-- Date: 2025-01-26
-- Purpose: Preserve table name information for historical orders even after table deletion

-- Step 1: Add tableName column to orders table
ALTER TABLE orders ADD COLUMN tableName TEXT;

-- Step 2: Create index for performance
CREATE INDEX IF NOT EXISTS idx_orders_tableName ON orders(tableName);

-- Step 3: Backfill existing orders with table names from the tables table
UPDATE orders
SET tableName = (
  SELECT name
  FROM tables
  WHERE tables.id = orders.tableId
)
WHERE tableId IS NOT NULL AND tableName IS NULL;

-- Verification Query: Check how many orders were updated
SELECT
  COUNT(*) as total_orders,
  COUNT(tableId) as orders_with_table_id,
  COUNT(tableName) as orders_with_table_name
FROM orders;

-- Done! The migration is complete.
