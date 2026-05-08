-- ================================================================
-- Website Manager Migration
-- Adds Supabase-only columns/tables to support the POS Website
-- Manager feature. The local POS SQLite schema is intentionally
-- NOT modified — these fields live in Supabase only.
--
-- Apply with: supabase db push  (or paste into Supabase SQL Editor)
-- Idempotent: safe to re-run.
-- ================================================================

-- ----------------------------------------------------------------
-- 1. item: add website-display fields
-- ----------------------------------------------------------------
ALTER TABLE item ADD COLUMN IF NOT EXISTS display_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE item ADD COLUMN IF NOT EXISTS is_featured   BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE item ADD COLUMN IF NOT EXISTS image_url     TEXT;
ALTER TABLE item ADD COLUMN IF NOT EXISTS image_lqip    TEXT;
ALTER TABLE item ADD COLUMN IF NOT EXISTS description   TEXT;
ALTER TABLE item ADD COLUMN IF NOT EXISTS updated_at    TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_item_category_order ON item(category_id, display_order)
  WHERE deleted_at IS NULL AND "isVisibleOnWebsite" = true;
CREATE INDEX IF NOT EXISTS idx_item_featured ON item(is_featured)
  WHERE is_featured = true AND deleted_at IS NULL;

-- ----------------------------------------------------------------
-- 2. category: add website-display fields
-- ----------------------------------------------------------------
ALTER TABLE category ADD COLUMN IF NOT EXISTS display_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE category ADD COLUMN IF NOT EXISTS is_visible    BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE category ADD COLUMN IF NOT EXISTS image_url     TEXT;
ALTER TABLE category ADD COLUMN IF NOT EXISTS updated_at    TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_category_order ON category(display_order)
  WHERE deleted_at IS NULL AND is_visible = true;

-- ----------------------------------------------------------------
-- 3. website_settings: singleton table for restaurant info & branding
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS website_settings (
  id              INTEGER PRIMARY KEY CHECK (id = 1),
  phone           TEXT,
  address         TEXT,
  google_maps_url TEXT,
  hero_tagline    TEXT,
  header_subtitle TEXT,
  hours           JSONB NOT NULL DEFAULT '{}'::jsonb,
  social          JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO website_settings (id, phone, hero_tagline, header_subtitle)
VALUES (1, '+961 70 143 784', 'GRILLED TO PERFECTION', 'mr 5')
ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------
-- 4. website_audit: append-only audit log for Website Manager writes
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS website_audit (
  id          BIGSERIAL PRIMARY KEY,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor       TEXT,
  table_name  TEXT NOT NULL,
  row_id      TEXT,
  action      TEXT NOT NULL,
  diff        JSONB
);
CREATE INDEX IF NOT EXISTS idx_website_audit_occurred_at ON website_audit(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_website_audit_table_row ON website_audit(table_name, row_id);

-- ----------------------------------------------------------------
-- 5. RPC: reorder_items(category_uuid, ordered_uuids[])
--    Atomic per-category reordering. SECURITY DEFINER so anon
--    cannot call it directly; service_role from the POS calls it.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION reorder_items(p_category UUID, p_ids UUID[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE item
     SET display_order = array_position(p_ids, uuid),
         updated_at    = now()
   WHERE category_id = (SELECT id FROM category WHERE uuid = p_category)
     AND uuid = ANY(p_ids);
END;
$$;

REVOKE EXECUTE ON FUNCTION reorder_items(UUID, UUID[]) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION reorder_items(UUID, UUID[]) TO service_role;

-- ----------------------------------------------------------------
-- 6. updated_at triggers (item, category, website_settings)
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_item_updated_at             ON item;
DROP TRIGGER IF EXISTS trg_category_updated_at         ON category;
DROP TRIGGER IF EXISTS trg_website_settings_updated_at ON website_settings;

CREATE TRIGGER trg_item_updated_at
  BEFORE UPDATE ON item
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_category_updated_at
  BEFORE UPDATE ON category
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_website_settings_updated_at
  BEFORE UPDATE ON website_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ----------------------------------------------------------------
-- 7. RLS: lock down anon access
--    Without RLS, the leaked anon key allows reading soft-deleted
--    rows and items where isVisibleOnWebsite=false. RLS turns the
--    visibility flag into a hard server-side gate.
-- ----------------------------------------------------------------
ALTER TABLE item             ENABLE ROW LEVEL SECURITY;
ALTER TABLE category         ENABLE ROW LEVEL SECURITY;
ALTER TABLE add_on           ENABLE ROW LEVEL SECURITY;
ALTER TABLE website_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE website_audit    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS anon_read_visible_items   ON item;
DROP POLICY IF EXISTS anon_read_categories      ON category;
DROP POLICY IF EXISTS anon_read_addons          ON add_on;
DROP POLICY IF EXISTS anon_read_website_settings ON website_settings;

CREATE POLICY anon_read_visible_items ON item
  FOR SELECT TO anon
  USING (deleted_at IS NULL AND "isVisibleOnWebsite" = true);

CREATE POLICY anon_read_categories ON category
  FOR SELECT TO anon
  USING (deleted_at IS NULL AND is_visible = true);

CREATE POLICY anon_read_addons ON add_on
  FOR SELECT TO anon
  USING (deleted_at IS NULL);

CREATE POLICY anon_read_website_settings ON website_settings
  FOR SELECT TO anon USING (true);

-- service_role bypasses RLS automatically; no policies needed for it.
-- website_audit has no anon policy → anon cannot read it.

-- ----------------------------------------------------------------
-- 8. One-shot backfill (idempotent — only fills rows still at
--    the default 0 / true / null values)
-- ----------------------------------------------------------------
UPDATE item SET display_order = sub.rn - 1
FROM (
  SELECT uuid, ROW_NUMBER() OVER (PARTITION BY category_id ORDER BY id) AS rn
  FROM item WHERE deleted_at IS NULL
) sub
WHERE item.uuid = sub.uuid AND item.display_order = 0;

UPDATE category SET display_order = sub.rn - 1
FROM (
  SELECT uuid, ROW_NUMBER() OVER (ORDER BY id) AS rn
  FROM category WHERE deleted_at IS NULL
) sub
WHERE category.uuid = sub.uuid AND category.display_order = 0;

-- ----------------------------------------------------------------
-- 9. Storage bucket: menu-images (run via Supabase dashboard or CLI;
--    the SQL form below assumes the storage extension is available)
-- ----------------------------------------------------------------
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('menu-images', 'menu-images', true)
-- ON CONFLICT (id) DO NOTHING;
--
-- -- Public read; writes restricted to service_role.
-- CREATE POLICY menu_images_public_read ON storage.objects
--   FOR SELECT TO anon USING (bucket_id = 'menu-images');
-- (service_role bypasses RLS for storage.objects automatically)

-- ----------------------------------------------------------------
-- 10. Verification
-- ----------------------------------------------------------------
SELECT 'item'             AS table_name, column_name, data_type
  FROM information_schema.columns
 WHERE table_name = 'item' AND table_schema = 'public'
   AND column_name IN ('display_order','is_featured','image_url','image_lqip','description','updated_at')
UNION ALL
SELECT 'category', column_name, data_type
  FROM information_schema.columns
 WHERE table_name = 'category' AND table_schema = 'public'
   AND column_name IN ('display_order','is_visible','image_url','updated_at')
UNION ALL
SELECT 'website_settings', column_name, data_type
  FROM information_schema.columns
 WHERE table_name = 'website_settings' AND table_schema = 'public'
ORDER BY table_name, column_name;
