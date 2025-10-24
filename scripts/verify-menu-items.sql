-- Database Verification Script for Menu Items
-- Run this with: sqlite3 prisma/dev.db < scripts/verify-menu-items.sql
--
-- This script verifies:
-- 1. All menu items have valid isActive boolean values
-- 2. Category associations are correct
-- 3. Reports statistics per category

.mode column
.headers on
.width 30 10 10 10

-- Section 1: Check for NULL isActive values
SELECT '=== Checking for NULL isActive values ===';
SELECT
    id,
    name,
    isActive,
    categoryId
FROM MenuItem
WHERE isActive IS NULL;

-- Section 2: Check for orphaned menu items (invalid category reference)
SELECT '';
SELECT '=== Checking for orphaned menu items (invalid category) ===';
SELECT
    mi.id,
    mi.name,
    mi.categoryId AS invalidCategoryId
FROM MenuItem mi
LEFT JOIN Category c ON mi.categoryId = c.id
WHERE c.id IS NULL;

-- Section 3: Category statistics
SELECT '';
SELECT '=== Category Statistics ===';
SELECT
    c.name AS categoryName,
    c.isActive AS categoryActive,
    COUNT(mi.id) AS totalItems,
    SUM(CASE WHEN mi.isActive = 1 THEN 1 ELSE 0 END) AS activeItems,
    SUM(CASE WHEN mi.isActive = 0 THEN 1 ELSE 0 END) AS inactiveItems,
    ROUND(AVG(mi.price), 2) AS avgPrice
FROM Category c
LEFT JOIN MenuItem mi ON c.id = mi.categoryId
WHERE c.isActive = 1
GROUP BY c.id, c.name, c.isActive
ORDER BY activeItems DESC;

-- Section 4: Inactive categories with active items
SELECT '';
SELECT '=== Inactive categories with active menu items (potential issue) ===';
SELECT
    c.name AS categoryName,
    c.isActive AS categoryActive,
    COUNT(mi.id) AS totalItems,
    SUM(CASE WHEN mi.isActive = 1 THEN 1 ELSE 0 END) AS activeItems
FROM Category c
INNER JOIN MenuItem mi ON c.id = mi.categoryId
WHERE c.isActive = 0 AND mi.isActive = 1
GROUP BY c.id, c.name, c.isActive;

-- Section 5: Duplicate menu item names within same category
SELECT '';
SELECT '=== Duplicate menu item names within same category ===';
SELECT
    c.name AS categoryName,
    mi.name AS itemName,
    COUNT(*) AS duplicateCount
FROM MenuItem mi
INNER JOIN Category c ON mi.categoryId = c.id
GROUP BY c.id, mi.name
HAVING COUNT(*) > 1;

-- Section 6: Overall summary
SELECT '';
SELECT '=== Overall Summary ===';
SELECT
    (SELECT COUNT(*) FROM MenuItem) AS totalMenuItems,
    (SELECT COUNT(*) FROM MenuItem WHERE isActive = 1) AS activeMenuItems,
    (SELECT COUNT(*) FROM MenuItem WHERE isActive = 0) AS inactiveMenuItems,
    (SELECT COUNT(*) FROM Category) AS totalCategories,
    (SELECT COUNT(*) FROM Category WHERE isActive = 1) AS activeCategories;
