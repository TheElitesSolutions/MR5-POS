/**
 * Migration Script: Add color fields to categories and menu_items tables
 *
 * This script adds optional color fields for user-customizable colors
 * Usage: node scripts/add-color-fields.js
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Get database path from environment or use default
const dbPath = process.env.DATABASE_URL?.replace('file:', '') ||
  path.join(process.env.APPDATA || process.env.HOME, 'my-nextron-app', 'mr5pos.db');

console.log('🗃️  Database path:', dbPath);

// Check if database exists
if (!fs.existsSync(dbPath)) {
  console.error('❌ Database file not found at:', dbPath);
  process.exit(1);
}

try {
  const db = new Database(dbPath);
  console.log('✅ Connected to database');

  console.log('\n🚀 Starting migrations...\n');

  // Migration 1: Add color field to categories table
  try {
    const checkCategories = db.prepare(`SELECT COUNT(*) as count FROM pragma_table_info('categories') WHERE name='color'`).get();

    if (checkCategories.count === 0) {
      db.prepare(`ALTER TABLE categories ADD COLUMN color TEXT DEFAULT NULL`).run();
      console.log('✅ Applied: Add color field to categories table');
    } else {
      console.log('⏭️  Skipped: Add color field to categories table (already exists)');
    }
  } catch (error) {
    console.error('❌ Failed: Add color field to categories table');
    console.error('   Error:', error.message);
    process.exit(1);
  }

  // Migration 2: Add color field to menu_items table
  try {
    const checkMenuItems = db.prepare(`SELECT COUNT(*) as count FROM pragma_table_info('menu_items') WHERE name='color'`).get();

    if (checkMenuItems.count === 0) {
      db.prepare(`ALTER TABLE menu_items ADD COLUMN color TEXT DEFAULT NULL`).run();
      console.log('✅ Applied: Add color field to menu_items table');
    } else {
      console.log('⏭️  Skipped: Add color field to menu_items table (already exists)');
    }
  } catch (error) {
    console.error('❌ Failed: Add color field to menu_items table');
    console.error('   Error:', error.message);
    process.exit(1);
  }

  console.log('\n✨ All migrations completed successfully!\n');

  db.close();
  console.log('✅ Database connection closed');
  process.exit(0);
} catch (error) {
  console.error('❌ Database connection failed:', error.message);
  process.exit(1);
}
