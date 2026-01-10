-- ================================================================
-- Supabase Duplicate Cleanup Script
-- Run this ONCE in Supabase SQL Editor BEFORE deploying new sync code
-- ================================================================
--
-- Purpose: Soft-delete duplicate records created by previous sync operations
-- Strategy: Keep oldest record (MIN id), soft-delete newer duplicates
-- Safety: Uses soft-delete (deleted_at timestamp) - reversible
--
-- IMPORTANT: Take a Supabase backup before running this script!
--
-- ================================================================

-- Step 1: Soft-delete duplicate categories (keep oldest by id)
-- Logic: Group by name, keep MIN(id), mark others as deleted
WITH category_duplicates AS (
  SELECT
    name,
    MIN(id) as keep_id,
    ARRAY_AGG(id ORDER BY id) as all_ids
  FROM category
  WHERE deleted_at IS NULL
  GROUP BY name
  HAVING COUNT(*) > 1
)
UPDATE category
SET deleted_at = NOW()
WHERE id IN (
  SELECT unnest(all_ids[2:])  -- Skip first (oldest), delete rest
  FROM category_duplicates
);

-- Report: How many categories were soft-deleted
SELECT
  'Categories cleaned' as action,
  COUNT(*) as records_soft_deleted
FROM category
WHERE deleted_at > (NOW() - INTERVAL '1 minute');

-- ================================================================

-- Step 2: Soft-delete duplicate items (keep oldest by id)
-- Logic: Group by name + category_id (composite key), keep MIN(id)
WITH item_duplicates AS (
  SELECT
    name,
    category_id,
    MIN(id) as keep_id,
    ARRAY_AGG(id ORDER BY id) as all_ids
  FROM item
  WHERE deleted_at IS NULL
  GROUP BY name, category_id
  HAVING COUNT(*) > 1
)
UPDATE item
SET deleted_at = NOW()
WHERE id IN (
  SELECT unnest(all_ids[2:])  -- Skip first (oldest), delete rest
  FROM item_duplicates
);

-- Report: How many items were soft-deleted
SELECT
  'Items cleaned' as action,
  COUNT(*) as records_soft_deleted
FROM item
WHERE deleted_at > (NOW() - INTERVAL '1 minute');

-- ================================================================

-- Step 3: Soft-delete duplicate add-ons (keep oldest by id)
-- Logic: Group by description + category_id (composite key), keep MIN(id)
WITH addon_duplicates AS (
  SELECT
    description,
    category_id,
    MIN(id) as keep_id,
    ARRAY_AGG(id ORDER BY id) as all_ids
  FROM add_on
  WHERE deleted_at IS NULL
  GROUP BY description, category_id
  HAVING COUNT(*) > 1
)
UPDATE add_on
SET deleted_at = NOW()
WHERE id IN (
  SELECT unnest(all_ids[2:])  -- Skip first (oldest), delete rest
  FROM addon_duplicates
);

-- Report: How many add-ons were soft-deleted
SELECT
  'Add-ons cleaned' as action,
  COUNT(*) as records_soft_deleted
FROM add_on
WHERE deleted_at > (NOW() - INTERVAL '1 minute');

-- ================================================================

-- VERIFICATION: Check for remaining duplicates
-- Expected: All counts should be 0
SELECT 'Categories with duplicates' as type, COUNT(*) as count
FROM (
  SELECT name
  FROM category
  WHERE deleted_at IS NULL
  GROUP BY name
  HAVING COUNT(*) > 1
) dup

UNION ALL

SELECT 'Items with duplicates', COUNT(*)
FROM (
  SELECT name, category_id
  FROM item
  WHERE deleted_at IS NULL
  GROUP BY name, category_id
  HAVING COUNT(*) > 1
) dup

UNION ALL

SELECT 'Add-ons with duplicates', COUNT(*)
FROM (
  SELECT description, category_id
  FROM add_on
  WHERE deleted_at IS NULL
  GROUP BY description, category_id
  HAVING COUNT(*) > 1
) dup;

-- Expected output: All counts should be 0
-- If not 0, review the duplicates manually before proceeding

-- ================================================================

-- OPTIONAL: Preview duplicates before deletion (run BEFORE cleanup)
-- Uncomment to see what will be deleted:

/*
-- Preview duplicate categories
SELECT name, COUNT(*) as duplicate_count, STRING_AGG(id::TEXT, ', ') as ids
FROM category
WHERE deleted_at IS NULL
GROUP BY name
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- Preview duplicate items
SELECT name, category_id, COUNT(*) as duplicate_count, STRING_AGG(id::TEXT, ', ') as ids
FROM item
WHERE deleted_at IS NULL
GROUP BY name, category_id
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- Preview duplicate add-ons
SELECT description, category_id, COUNT(*) as duplicate_count, STRING_AGG(id::TEXT, ', ') as ids
FROM add_on
WHERE deleted_at IS NULL
GROUP BY description, category_id
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;
*/

-- ================================================================

-- ROLLBACK: Undo cleanup (if needed within 24 hours)
-- Uncomment and modify timestamp if you need to restore deleted records:

/*
UPDATE category
SET deleted_at = NULL
WHERE deleted_at > '2026-01-10 12:00:00';  -- Adjust timestamp

UPDATE item
SET deleted_at = NULL
WHERE deleted_at > '2026-01-10 12:00:00';  -- Adjust timestamp

UPDATE add_on
SET deleted_at = NULL
WHERE deleted_at > '2026-01-10 12:00:00';  -- Adjust timestamp
*/
