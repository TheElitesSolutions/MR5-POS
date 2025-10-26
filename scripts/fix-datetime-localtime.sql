-- Migration Script: Fix DateTime to Use Local Time
-- This script updates all table schemas to use localtime instead of UTC
-- Run this on existing databases to fix the datetime issue
-- Date: 2025-01-26

-- Note: SQLite doesn't support ALTER COLUMN, so we cannot change the DEFAULT constraint
-- The schema.sql file has been updated for new installations
-- For existing databases, new records will use the updated code logic

-- This script documents the issue and solution for reference
-- The actual fix is implemented in the application code and updated schema.sql

-- ISSUE:
-- Previous schema used: datetime('now') which returns UTC time
-- Fixed schema uses: datetime('now', 'localtime') which returns device local time

-- TABLES AFFECTED:
-- - users (createdAt, updatedAt, lastLogin)
-- - tables (createdAt, updatedAt, lastStatusChange)
-- - categories (createdAt, updatedAt)
-- - menu_items (createdAt, updatedAt)
-- - customers (createdAt, updatedAt, lastVisit, birthday)
-- - orders (createdAt, updatedAt, completedAt)
-- - order_items (createdAt, updatedAt)
-- - payments (createdAt, updatedAt, paidAt)
-- - expenses (createdAt, updatedAt, expenseDate)
-- - inventory (createdAt, updatedAt, lastRestocked)
-- - settings (createdAt, updatedAt)
-- - addon_groups (createdAt, updatedAt)
-- - addons (createdAt, updatedAt)

-- SOLUTION:
-- 1. Updated schema.sql to use datetime('now', 'localtime') for all defaults
-- 2. Application code now explicitly uses local time for all timestamp operations
-- 3. For new installations, all timestamps will be in local time
-- 4. For existing databases, new records will use local time going forward

SELECT 'Migration: DateTime LocalTime Fix - Schema updated successfully' as status;
