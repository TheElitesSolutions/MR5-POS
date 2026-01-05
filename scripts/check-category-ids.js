const Database = require('better-sqlite3');
const path = require('path');

// Direct path to database (development mode)
const dbPath = path.join(
  process.env.APPDATA,
  'my-nextron-app (development)',
  'main.db'
);

console.log('Database path:', dbPath);

const db = new Database(dbPath);

// Check category IDs
const categories = db.prepare(`
  SELECT
    id,
    name,
    length(id) as id_length,
    isActive
  FROM categories
  LIMIT 10
`).all();

console.log('\n📋 Categories in database:');
console.log('==========================================');
categories.forEach(cat => {
  console.log(`ID: ${cat.id}`);
  console.log(`  Name: ${cat.name}`);
  console.log(`  ID Length: ${cat.id_length} characters`);
  console.log(`  Active: ${cat.isActive}`);
  console.log(`  Expected: 32 hex characters`);
  console.log(`  Valid format: ${cat.id_length === 32 ? '✅' : '❌'}`);
  console.log('------------------------------------------');
});

db.close();
