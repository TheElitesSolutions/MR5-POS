/**
 * Migration: Add isVisibleOnWebsite column to menu_items table
 * Date: 2026-01-04
 *
 * This migration adds the isVisibleOnWebsite column that controls
 * whether menu items sync to the public website.
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Get database path - try multiple locations
const possiblePaths = [
  process.env.DB_PATH,
  path.join(process.env.APPDATA || process.env.HOME, 'my-nextron-app', 'mr5-pos.db'),
  path.join(process.env.APPDATA || process.env.HOME, 'mr5-pos', 'mr5-pos.db'),
  path.join(__dirname, '..', 'mr5-pos.db'),
].filter(Boolean);

let dbPath = null;
for (const p of possiblePaths) {
  if (fs.existsSync(p)) {
    dbPath = p;
    break;
  }
}

if (!dbPath) {
  console.error('❌ Database not found in any of the expected locations:');
  possiblePaths.forEach(p => console.error(`   - ${p}`));
  console.error('\nYou can specify the path with: DB_PATH=/path/to/db node migrate-add-isVisibleOnWebsite.js');
  process.exit(1);
}

console.log(`[Migration] Using database: ${dbPath}`);

// Open database connection
const db = new Database(dbPath);

try {
  console.log('[Migration] Starting migration...');

  // Check if column already exists
  const tableInfo = db.prepare("PRAGMA table_info(menu_items)").all();
  const hasColumn = tableInfo.some(col => col.name === 'isVisibleOnWebsite');

  if (hasColumn) {
    console.log('✅ Column isVisibleOnWebsite already exists - skipping migration');
    process.exit(0);
  }

  // Begin transaction
  db.prepare('BEGIN TRANSACTION').run();

  try {
    // Add the column with default value
    console.log('[Migration] Adding isVisibleOnWebsite column...');
    db.prepare(`
      ALTER TABLE menu_items
      ADD COLUMN isVisibleOnWebsite INTEGER DEFAULT 1
    `).run();

    // Create index for the new column
    console.log('[Migration] Creating index on isVisibleOnWebsite...');
    db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_menu_items_isVisibleOnWebsite
      ON menu_items(isVisibleOnWebsite)
    `).run();

    // Create composite index for common query pattern
    console.log('[Migration] Creating composite index...');
    db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_menu_items_isActive_isVisibleOnWebsite
      ON menu_items(isActive, isVisibleOnWebsite)
      WHERE isActive = 1 AND isVisibleOnWebsite = 1
    `).run();

    // Update all existing items to be visible on website by default
    console.log('[Migration] Setting default value for existing items...');
    const result = db.prepare(`
      UPDATE menu_items
      SET isVisibleOnWebsite = 1
      WHERE isVisibleOnWebsite IS NULL
    `).run();

    console.log(`[Migration] Updated ${result.changes} existing menu items`);

    // Commit transaction
    db.prepare('COMMIT').run();

    console.log('✅ Migration completed successfully');
    console.log('   - Added isVisibleOnWebsite column');
    console.log('   - Created indexes');
    console.log(`   - Set ${result.changes} existing items as visible on website`);

  } catch (error) {
    // Rollback on error
    db.prepare('ROLLBACK').run();
    throw error;
  }

} catch (error) {
  console.error('❌ Migration failed:', error.message);
  process.exit(1);
} finally {
  db.close();
}
