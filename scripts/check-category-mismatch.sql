-- Check for category name mismatches
-- This script checks what categories exist and what categories menu items reference

.mode column
.headers on
.width 30 20 15 10

-- 1. Show all categories in the database
SELECT '';
SELECT '=== All Categories in Database ===';
SELECT
    id,
    name,
    isActive,
    (SELECT COUNT(*) FROM MenuItem WHERE categoryId = Category.id) as itemCount
FROM Category
ORDER BY name;

-- 2. Show menu items with their category information
SELECT '';
SELECT '=== Menu Items with Category Details ===';
SELECT
    mi.id as itemId,
    mi.name as itemName,
    mi.categoryId,
    c.name as categoryName,
    mi.isActive as itemActive,
    c.isActive as categoryActive
FROM MenuItem mi
LEFT JOIN Category c ON mi.categoryId = c.id
WHERE mi.isActive = 1
ORDER BY c.name, mi.name
LIMIT 20;

-- 3. Check for menu items with missing category references
SELECT '';
SELECT '=== Menu Items with Invalid Category References ===';
SELECT
    mi.id,
    mi.name,
    mi.categoryId as invalidCategoryId
FROM MenuItem mi
LEFT JOIN Category c ON mi.categoryId = c.id
WHERE c.id IS NULL AND mi.isActive = 1;

-- 4. Show category name that would be used in filtering (lowercase comparison)
SELECT '';
SELECT '=== Category Names (Case Sensitive Check) ===';
SELECT DISTINCT
    c.name as exactCategoryName,
    LOWER(c.name) as lowercaseName,
    COUNT(mi.id) as activeItems
FROM Category c
LEFT JOIN MenuItem mi ON c.categoryId = mi.categoryId AND mi.isActive = 1
WHERE c.isActive = 1
GROUP BY c.id, c.name
ORDER BY c.name;
