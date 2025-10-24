-- Check the "Salades" category and its items
-- Run with: sqlite3 prisma/dev.db < scripts/check-salades-category.sql

.mode box
.headers on

SELECT '=== SALADES CATEGORY ===' as '';
SELECT id, name, displayOrder, createdAt
FROM categories
WHERE name LIKE '%Salad%' OR name LIKE '%Salade%';

SELECT '' as '';
SELECT '=== ITEMS IN SALADES CATEGORY (by categoryId) ===' as '';
SELECT
    mi.id,
    mi.name,
    mi.category as category_name,
    mi.categoryId,
    mi.isActive,
    c.name as actual_category_name
FROM menuItems mi
LEFT JOIN categories c ON mi.categoryId = c.id
WHERE mi.categoryId = 'mgybxxwo9wt6t5doh';

SELECT '' as '';
SELECT '=== COUNT OF ACTIVE ITEMS IN SALADES ===' as '';
SELECT COUNT(*) as active_items_count
FROM menuItems
WHERE categoryId = 'mgybxxwo9wt6t5doh' AND isActive = 1;

SELECT '' as '';
SELECT '=== ALL CATEGORIES AND THEIR ITEM COUNTS ===' as '';
SELECT
    c.id,
    c.name,
    COUNT(mi.id) as total_items,
    SUM(CASE WHEN mi.isActive = 1 THEN 1 ELSE 0 END) as active_items
FROM categories c
LEFT JOIN menuItems mi ON mi.categoryId = c.id
GROUP BY c.id, c.name
ORDER BY c.displayOrder;
