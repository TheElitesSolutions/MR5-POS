-- Audit Trigger for Menu Item Availability Changes
-- This trigger logs all changes to the isActive field in menu_items table
-- to help track and investigate future availability issues

-- Step 1: Create audit_menu_availability table (if not exists)
CREATE TABLE IF NOT EXISTS audit_menu_availability (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  menu_item_id TEXT NOT NULL,
  menu_item_name TEXT,
  old_value INTEGER,
  new_value INTEGER,
  changed_by TEXT,  -- user_id if available
  change_source TEXT,  -- 'UI', 'API', 'SCRIPT', 'UNKNOWN'
  changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE
);

-- Step 2: Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_audit_menu_availability_item
  ON audit_menu_availability(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_audit_menu_availability_date
  ON audit_menu_availability(changed_at);

-- Step 3: Create trigger to log isActive changes
DROP TRIGGER IF EXISTS audit_menu_item_availability;

CREATE TRIGGER audit_menu_item_availability
AFTER UPDATE ON menu_items
WHEN OLD.isActive != NEW.isActive
BEGIN
  INSERT INTO audit_menu_availability (
    menu_item_id,
    menu_item_name,
    old_value,
    new_value,
    changed_by,
    change_source
  )
  VALUES (
    NEW.id,
    NEW.name,
    OLD.isActive,
    NEW.isActive,
    NULL,  -- Will be updated by application layer
    'DATABASE'  -- Default source
  );
END;

-- Step 4: Create bulk change detection trigger (security measure)
-- This trigger prevents accidental bulk disabling of menu items
DROP TRIGGER IF EXISTS prevent_bulk_unavailability;

CREATE TRIGGER prevent_bulk_unavailability
BEFORE UPDATE ON menu_items
WHEN OLD.isActive = 1 AND NEW.isActive = 0
BEGIN
  -- Count how many items are currently active
  SELECT CASE
    WHEN (SELECT COUNT(*) FROM menu_items WHERE isActive = 1) <= 5
    THEN RAISE(ABORT, 'SECURITY: Cannot disable menu items - less than 5 items would remain active. Use emergency override if intentional.')
  END;
END;

-- Verification queries
SELECT 'Audit trigger created successfully' AS status;
SELECT 'To view audit log: SELECT * FROM audit_menu_availability ORDER BY changed_at DESC;' AS usage;
SELECT 'To check for bulk changes: SELECT changed_at, COUNT(*) as changes FROM audit_menu_availability GROUP BY changed_at HAVING changes > 10;' AS monitoring;
