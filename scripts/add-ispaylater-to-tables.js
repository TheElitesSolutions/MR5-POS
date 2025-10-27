/**
 * Migration script to add isPayLater column to tables table
 * Run this script to update the database schema
 */

const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');
const fs = require('fs');

// Get the correct database path
const getDbPath = () => {
  if (process.env.NODE_ENV === 'production') {
    const userDataPath = path.join(
      os.homedir(),
      'AppData',
      'Roaming',
      'my-nextron-app'
    );
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }
    return path.join(userDataPath, 'pos.db');
  } else {
    const devDbPath = path.join(__dirname, '..', 'pos.db');
    return devDbPath;
  }
};

const dbPath = getDbPath();

console.log(`Connecting to database at: ${dbPath}`);

try {
  // Open database connection
  const db = new Database(dbPath);
  console.log('Connected to the database.');

  // Check if the column already exists
  console.log('Checking if isPayLater column already exists...');
  const tableInfo = db.prepare("PRAGMA table_info(tables)").all();
  const columnExists = tableInfo.some(row => row.name === 'isPayLater');

  if (columnExists) {
    console.log('⚠️  isPayLater column already exists. No migration needed.');
    db.close();
    process.exit(0);
  }

  // Add the isPayLater column
  console.log('Adding isPayLater column...');
  const sql = `ALTER TABLE tables ADD COLUMN isPayLater INTEGER DEFAULT 0`;
  db.exec(sql);
  console.log('✅ Successfully added isPayLater column to tables table');

  console.log('✅ Migration completed successfully!');
  db.close();
} catch (error) {
  console.error('❌ Migration failed:', error.message);
  process.exit(1);
}
