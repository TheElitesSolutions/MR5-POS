-- ================================================================
-- Supabase Sync Verification Queries
-- Run these in Supabase SQL Editor AFTER deployment and first sync
-- ================================================================
--
-- Purpose: Verify that the sync fix is working correctly
-- - No new duplicates are created
-- - Adoption logs show UUID linking
-- - Record counts match expectations
--
-- ================================================================

-- ================================================================
-- 1. CHECK FOR DUPLICATES (Should return 0 for all types)
-- ================================================================

SELECT 'Categories with duplicates' as check_name, COUNT(*) as count,
       CASE WHEN COUNT(*) = 0 THEN '✅ PASS' ELSE '❌ FAIL' END as status
FROM (
  SELECT name
  FROM category
  WHERE deleted_at IS NULL
  GROUP BY name
  HAVING COUNT(*) > 1
) dup

UNION ALL

SELECT 'Items with duplicates', COUNT(*),
       CASE WHEN COUNT(*) = 0 THEN '✅ PASS' ELSE '❌ FAIL' END
FROM (
  SELECT name, category_id
  FROM item
  WHERE deleted_at IS NULL
  GROUP BY name, category_id
  HAVING COUNT(*) > 1
) dup

UNION ALL

SELECT 'Add-ons with duplicates', COUNT(*),
       CASE WHEN COUNT(*) = 0 THEN '✅ PASS' ELSE '❌ FAIL' END
FROM (
  SELECT description, category_id
  FROM add_on
  WHERE deleted_at IS NULL
  GROUP BY description, category_id
  HAVING COUNT(*) > 1
) dup;

-- Expected: All counts = 0, all statuses = ✅ PASS

-- ================================================================
-- 2. COUNT ACTIVE RECORDS (Compare with local POS counts)
-- ================================================================

SELECT
  'Active categories' as record_type,
  COUNT(*) as supabase_count
FROM category
WHERE deleted_at IS NULL

UNION ALL

SELECT
  'Active items',
  COUNT(*)
FROM item
WHERE deleted_at IS NULL

UNION ALL

SELECT
  'Active add-ons',
  COUNT(*)
FROM add_on
WHERE deleted_at IS NULL;

-- Compare these counts with your local POS database:
-- Local query: SELECT COUNT(*) FROM categories WHERE isActive = 1;
-- Local query: SELECT COUNT(*) FROM menu_items WHERE isActive = 1;
-- Local query: SELECT COUNT(*) FROM addons WHERE isActive = 1;

-- ================================================================
-- 3. CHECK REQUIRED FIELDS (is_special should not be NULL)
-- ================================================================

SELECT
  'Items missing is_special field' as check_name,
  COUNT(*) as count,
  CASE WHEN COUNT(*) = 0 THEN '✅ PASS' ELSE '❌ FAIL' END as status
FROM item
WHERE is_special IS NULL;

-- Expected: count = 0, status = ✅ PASS

-- ================================================================
-- 4. PREVIEW RECENTLY SYNCED RECORDS
-- ================================================================

-- Recently synced or updated categories (last 1 hour)
SELECT
  'Recent categories' as record_type,
  id,
  uuid,
  name,
  deleted_at
FROM category
ORDER BY id DESC
LIMIT 10;

-- Recently synced or updated items (last 1 hour)
SELECT
  'Recent items' as record_type,
  id,
  uuid,
  name,
  price,
  is_special,
  category_id,
  deleted_at
FROM item
ORDER BY id DESC
LIMIT 10;

-- Recently synced or updated add-ons (last 1 hour)
SELECT
  'Recent add-ons' as record_type,
  id,
  addon_uuid,
  description,
  price,
  category_id,
  deleted_at
FROM add_on
ORDER BY id DESC
LIMIT 10;

-- ================================================================
-- 5. CHECK FOR ORPHANED RECORDS
-- ================================================================

-- Items with invalid category references
SELECT
  'Items with invalid categories' as check_name,
  COUNT(*) as count,
  CASE WHEN COUNT(*) = 0 THEN '✅ PASS' ELSE '⚠️ WARNING' END as status
FROM item i
WHERE i.deleted_at IS NULL
  AND i.category_id NOT IN (
    SELECT id FROM category WHERE deleted_at IS NULL
  );

-- Expected: count = 0 (all items have valid categories)

-- ================================================================
-- 6. ADOPTION VERIFICATION (Check application logs)
-- ================================================================

/*
The adoption logic logs messages in the application console. Look for:

Category adoptions:
  🔄 ADOPTING category "Pizza": 12345678-1234-... → a1b2c3d4-e5f6-...
  📋 Category Adoptions: 5 records linked

Item adoptions:
  🔄 ADOPTING item "Margherita Pizza": 87654321-4321-... → b2c3d4e5-f6a7-...
  📋 Item Adoptions: 12 records linked

Addon adoptions:
  🔄 ADOPTING addon "Extra Cheese" (cat: 1): abcdef12-3456-... → c3d4e5f6-a7b8-...
  📋 Addon Adoptions: 8 records linked

If you see these logs, UUID adoption is working correctly.
*/

-- ================================================================
-- 7. SOFT-DELETED RECORDS COUNT
-- ================================================================

SELECT
  'Soft-deleted categories' as record_type,
  COUNT(*) as count
FROM category
WHERE deleted_at IS NOT NULL

UNION ALL

SELECT
  'Soft-deleted items',
  COUNT(*)
FROM item
WHERE deleted_at IS NOT NULL

UNION ALL

SELECT
  'Soft-deleted add-ons',
  COUNT(*)
FROM add_on
WHERE deleted_at IS NOT NULL;

-- These show records that were removed from POS but preserved in Supabase

-- ================================================================
-- 8. DATA INTEGRITY CHECKS
-- ================================================================

-- Check for items with NULL required fields
SELECT
  'Items with NULL name' as check_name,
  COUNT(*) as count,
  CASE WHEN COUNT(*) = 0 THEN '✅ PASS' ELSE '❌ FAIL' END as status
FROM item
WHERE deleted_at IS NULL AND name IS NULL

UNION ALL

SELECT
  'Items with NULL price',
  COUNT(*),
  CASE WHEN COUNT(*) = 0 THEN '✅ PASS' ELSE '❌ FAIL' END
FROM item
WHERE deleted_at IS NULL AND price IS NULL

UNION ALL

SELECT
  'Categories with NULL name',
  COUNT(*),
  CASE WHEN COUNT(*) = 0 THEN '✅ PASS' ELSE '❌ FAIL' END
FROM category
WHERE deleted_at IS NULL AND name IS NULL;

-- Expected: All counts = 0

-- ================================================================
-- 9. SAMPLE RECORDS FOR MANUAL SPOT-CHECK
-- ================================================================

-- Sample categories (first 5)
SELECT 'Sample categories' as type, id, uuid, name, deleted_at
FROM category
WHERE deleted_at IS NULL
ORDER BY name
LIMIT 5;

-- Sample items (first 5)
SELECT 'Sample items' as type, id, uuid, name, price, is_special, category_id
FROM item
WHERE deleted_at IS NULL
ORDER BY name
LIMIT 5;

-- Sample add-ons (first 5)
SELECT 'Sample add-ons' as type, id, addon_uuid, description, price, category_id
FROM add_on
WHERE deleted_at IS NULL
ORDER BY description
LIMIT 5;

-- Manually verify these records match what's in your POS system

-- ================================================================
-- 10. PERFORMANCE CHECK
-- ================================================================

-- Check table sizes (for performance monitoring)
SELECT
  'category' as table_name,
  COUNT(*) as total_records,
  COUNT(*) FILTER (WHERE deleted_at IS NULL) as active_records,
  COUNT(*) FILTER (WHERE deleted_at IS NOT NULL) as deleted_records
FROM category

UNION ALL

SELECT
  'item',
  COUNT(*),
  COUNT(*) FILTER (WHERE deleted_at IS NULL),
  COUNT(*) FILTER (WHERE deleted_at IS NOT NULL)
FROM item

UNION ALL

SELECT
  'add_on',
  COUNT(*),
  COUNT(*) FILTER (WHERE deleted_at IS NULL),
  COUNT(*) FILTER (WHERE deleted_at IS NOT NULL)
FROM add_on;

-- ================================================================
-- SUMMARY REPORT
-- ================================================================

-- Run this to get a quick health check summary
SELECT
  '=== SYNC VERIFICATION SUMMARY ===' as report_section,
  '' as detail

UNION ALL

SELECT
  'Total Active Records',
  CONCAT(
    (SELECT COUNT(*) FROM category WHERE deleted_at IS NULL), ' categories, ',
    (SELECT COUNT(*) FROM item WHERE deleted_at IS NULL), ' items, ',
    (SELECT COUNT(*) FROM add_on WHERE deleted_at IS NULL), ' add-ons'
  )

UNION ALL

SELECT
  'Duplicate Check',
  CASE
    WHEN (
      SELECT COUNT(*) FROM (
        SELECT name FROM category WHERE deleted_at IS NULL GROUP BY name HAVING COUNT(*) > 1
      ) dup
    ) = 0
    AND (
      SELECT COUNT(*) FROM (
        SELECT name, category_id FROM item WHERE deleted_at IS NULL GROUP BY name, category_id HAVING COUNT(*) > 1
      ) dup
    ) = 0
    AND (
      SELECT COUNT(*) FROM (
        SELECT description, category_id FROM add_on WHERE deleted_at IS NULL GROUP BY description, category_id HAVING COUNT(*) > 1
      ) dup
    ) = 0
    THEN '✅ NO DUPLICATES FOUND'
    ELSE '❌ DUPLICATES DETECTED - INVESTIGATE'
  END

UNION ALL

SELECT
  'Required Fields',
  CASE
    WHEN (SELECT COUNT(*) FROM item WHERE is_special IS NULL) = 0
    THEN '✅ ALL ITEMS HAVE is_special'
    ELSE '❌ MISSING is_special VALUES'
  END

UNION ALL

SELECT
  'Data Integrity',
  CASE
    WHEN (SELECT COUNT(*) FROM item WHERE deleted_at IS NULL AND (name IS NULL OR price IS NULL)) = 0
    THEN '✅ ALL RECORDS VALID'
    ELSE '⚠️ SOME NULL FIELDS DETECTED'
  END;

-- ================================================================
-- END OF VERIFICATION QUERIES
-- ================================================================
