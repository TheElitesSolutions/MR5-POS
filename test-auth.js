const Database = require('better-sqlite3');
const bcrypt = require('bcrypt');
const path = require('path');

// Database path
const dbPath = path.join(
  process.env.APPDATA || process.env.HOME,
  'my-nextron-app',
  'mr5-pos.db'
);

console.log('Database path:', dbPath);

// Open database
const db = new Database(dbPath, { readonly: true });

// Get admin user
console.log('\n=== Checking Admin User ===');
const adminUser = db.prepare('SELECT * FROM users WHERE username = ?').get('admin');

if (!adminUser) {
  console.error('❌ Admin user NOT FOUND in database!');
  process.exit(1);
}

console.log('✅ Admin user found:');
console.log('  ID:', adminUser.id);
console.log('  Username:', adminUser.username);
console.log('  Email:', adminUser.email);
console.log('  Role:', adminUser.role);
console.log('  Active:', adminUser.isActive);
console.log('  Password hash:', adminUser.password);

// Test password verification
console.log('\n=== Testing Password Verification ===');
const testPassword = 'admin';

bcrypt.compare(testPassword, adminUser.password, (err, result) => {
  if (err) {
    console.error('❌ Error comparing passwords:', err);
    process.exit(1);
  }

  if (result) {
    console.log('✅ Password "admin" matches hash - Authentication should work!');
  } else {
    console.log('❌ Password "admin" does NOT match hash - This is the problem!');
    console.log('   The admin user password might have been changed or corrupted.');
  }

  db.close();
});
