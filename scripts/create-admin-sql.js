/**
 * Script to generate SQL for creating an admin user
 * This script generates the SQL commands that can be executed manually
 */

const bcrypt = require('bcryptjs');

function generateId() {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substr(2, 9);
  return `${timestamp}${randomStr}`;
}

async function generateAdminSQL() {
  try {
    // Hash the password
    const hashedPassword = await bcrypt.hash('admin', 10);
    const userId = generateId();
    const now = new Date().toISOString();

    console.log('-- SQL to create admin user');
    console.log('-- Username: admin');
    console.log('-- Password: admin');
    console.log('-- Execute this in your SQLite database\n');

    const sql = `
-- Check if admin user exists
SELECT * FROM users WHERE username = 'admin';

-- If admin exists, update password:
UPDATE users
SET password = '${hashedPassword}',
    updatedAt = datetime('now')
WHERE username = 'admin';

-- If admin doesn't exist, insert new user:
INSERT INTO users (id, username, email, password, role, firstName, lastName, isActive, createdAt, updatedAt)
VALUES (
  '${userId}',
  'admin',
  'admin@mr5pos.com',
  '${hashedPassword}',
  'ADMIN',
  'Admin',
  'User',
  1,
  '${now}',
  '${now}'
);

-- Verify the user was created:
SELECT id, username, email, role, firstName, lastName, isActive FROM users WHERE username = 'admin';
`;

    console.log(sql);
    console.log('\n✅ SQL generated successfully!');
    console.log('\nTo execute:');
    console.log('1. Open the database file in a SQLite client');
    console.log('2. Run the INSERT statement above');
    console.log('\nDatabase location: C:\\Users\\TheElitesSolutions\\AppData\\Roaming\\my-nextron-app\\mr5-pos.db');

  } catch (error) {
    console.error('❌ Error generating SQL:', error.message);
    process.exit(1);
  }
}

// Run the script
generateAdminSQL();
