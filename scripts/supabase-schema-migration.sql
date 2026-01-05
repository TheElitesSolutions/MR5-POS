-- ================================================================
-- Supabase Schema Migration for UUID-Based Sync
-- Run this in Supabase SQL Editor BEFORE testing sync
-- ================================================================

-- Step 1: Add UUID and deleted_at columns to category table
ALTER TABLE category ADD COLUMN uuid UUID;
ALTER TABLE category ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
CREATE INDEX idx_category_uuid ON category(uuid);
CREATE INDEX idx_category_deleted_at ON category(deleted_at);

-- Step 2: Add UUID and deleted_at columns to item table
ALTER TABLE item ADD COLUMN uuid UUID;
ALTER TABLE item ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
CREATE INDEX idx_item_uuid ON item(uuid);
CREATE INDEX idx_item_deleted_at ON item(deleted_at);

-- Step 3: Add addon_uuid and deleted_at columns to add_on table
ALTER TABLE add_on ADD COLUMN addon_uuid UUID;
ALTER TABLE add_on ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
CREATE INDEX idx_add_on_addon_uuid ON add_on(addon_uuid);

-- Step 4: Add isVisibleOnWebsite column to item table
ALTER TABLE item ADD COLUMN "isVisibleOnWebsite" BOOLEAN DEFAULT true;

-- Step 5: Backfill UUIDs for existing records (generates new UUIDs)
UPDATE category SET uuid = gen_random_uuid() WHERE uuid IS NULL;
UPDATE item SET uuid = gen_random_uuid() WHERE uuid IS NULL;
UPDATE add_on SET addon_uuid = gen_random_uuid() WHERE addon_uuid IS NULL;

-- Step 6: Make UUID columns unique (after backfilling)
ALTER TABLE category ADD CONSTRAINT category_uuid_unique UNIQUE (uuid);
ALTER TABLE item ADD CONSTRAINT item_uuid_unique UNIQUE (uuid);

-- Note: addon_uuid is NOT unique alone, only unique with category_id
-- Step 7: Create composite unique constraint for add_on
ALTER TABLE add_on ADD CONSTRAINT add_on_uuid_category_unique UNIQUE (addon_uuid, category_id);

-- Step 8: Verify schema changes
SELECT
  'category' as table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'category'
  AND table_schema = 'public'
ORDER BY ordinal_position;

SELECT
  'item' as table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'item'
  AND table_schema = 'public'
ORDER BY ordinal_position;

SELECT
  'add_on' as table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'add_on'
  AND table_schema = 'public'
ORDER BY ordinal_position;
