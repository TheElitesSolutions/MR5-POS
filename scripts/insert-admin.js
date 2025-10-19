/**
 * Insert admin user directly into the database
 * This script uses bcryptjs which works with regular Node.js
 */

const path = require('path');
const bcryptjs = require('bcryptjs');

async function insertAdminUser() {
  try {
    // Import better-sqlite3 dynamically
    let Database;
    try {
      Database = require('better-sqlite3');
    } catch (e) {
      console.error('better-sqlite3 not available, trying alternative...');
      console.error('Please run this script using: node scripts/insert-admin.js');

      // Generate SQL for manual execution
      const hashedPassword = await bcryptjs.hash('admin', 10);
      console.log('\n=== MANUAL SQL INSERTION ===\n');
      console.log('Please execute this SQL manually in the database:\n');
      console.log(`DELETE FROM users WHERE username = 'admin';`);
      console.log(`INSERT INTO users (id, username, email, password, firstName, lastName, role, isActive, createdAt, updatedAt)`);
      console.log(`VALUES ('admin-user-001', 'admin', 'admin@mr5pos.local', '${hashedPassword}', 'Admin', 'User', 'ADMIN', 1, datetime('now'), datetime('now'));`);
      return;
    }

    const dbPath = path.join(
      process.env.USERPROFILE || process.env.HOME,
      'AppData',
      'Roaming',
      'my-nextron-app',
      'mr5-pos.db'
    );

    console.log('Connecting to database:', dbPath);

    // Hash the password
    const hashedPassword = await bcryptjs.hash('admin', 10);
    console.log('Password hashed successfully');

    // Open database
    const db = new Database(dbPath);

    // Delete existing admin user if exists
    console.log('Removing existing admin user (if any)...');
    db.prepare('DELETE FROM users WHERE username = ?').run('admin');

    // Insert new admin user
    console.log('Creating new admin user...');
    const stmt = db.prepare(`
      INSERT INTO users (
        id, username, email, password, firstName, lastName, role, isActive, createdAt, updatedAt
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now')
      )
    `);

    stmt.run(
      'admin-user-001',
      'admin',
      'admin@mr5pos.local',
      hashedPassword,
      'Admin',
      'User',
      'ADMIN',
      1
    );

    console.log('\n✅ SUCCESS! Admin user created:');
    console.log('   Username: admin');
    console.log('   Password: admin');
    console.log('   Role: ADMIN');

    // Verify the user was created
    const user = db.prepare('SELECT id, username, email, role FROM users WHERE username = ?').get('admin');
    console.log('\n✅ Verified user in database:');
    console.log(user);

    db.close();
    console.log('\nDatabase closed. You can now login with admin/admin');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the function
insertAdminUser();
