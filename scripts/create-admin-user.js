/**
 * Script to create an admin user in the database
 * Usage: Run this from the Electron app's dev console or as a standalone script
 */

const path = require('path');
const fs = require('fs');

// For standalone execution with regular Node.js
async function createAdminUser() {
  try {
    // We'll use bcryptjs (pure JS) instead of bcrypt (native)
    const bcryptjs = require('bcryptjs');

    // Database path
    const dbPath = path.join(
      process.env.USERPROFILE || process.env.HOME,
      'AppData',
      'Roaming',
      'my-nextron-app',
      'mr5-pos.db'
    );

    console.log('Database path:', dbPath);

    if (!fs.existsSync(dbPath)) {
      console.error('Database file not found at:', dbPath);
      process.exit(1);
    }

    // Use better-sqlite3 with node (will fail, so we'll use an alternative)
    // Instead, we'll generate the SQL and hash, then you can execute it manually

    const username = 'admin';
    const password = 'admin';
    const email = 'admin@mr5pos.local';

    // Hash the password using bcryptjs (works in regular Node.js)
    console.log('Hashing password...');
    const hashedPassword = await bcryptjs.hash(password, 10);

    console.log('\n=== Admin User Creation SQL ===\n');
    console.log('-- Run this SQL in the database:');
    console.log('');
    console.log(`INSERT OR REPLACE INTO users (
  id,
  username,
  email,
  password,
  firstName,
  lastName,
  role,
  isActive,
  createdAt,
  updatedAt
) VALUES (
  'admin-user-001',
  '${username}',
  '${email}',
  '${hashedPassword}',
  'Admin',
  'User',
  'ADMIN',
  1,
  datetime('now'),
  datetime('now')
);`);

    console.log('\n=== OR Copy this hashed password ===\n');
    console.log('Hashed password:', hashedPassword);
    console.log('\nYou can use this hash to manually insert the user.');

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  createAdminUser();
}

module.exports = { createAdminUser };
