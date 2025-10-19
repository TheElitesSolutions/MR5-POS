/**
 * DIRECT SQLite Admin User Insertion Script
 *
 * This script bypasses Prisma and uses better-sqlite3 directly to insert
 * an admin user into the database. Use this if the automatic creation fails.
 *
 * Usage: node scripts/insert-admin-direct.js
 */

const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

// Determine database path based on environment
function getDatabasePath() {
  const platform = process.platform;
  let userDataPath;

  if (platform === 'win32') {
    userDataPath = process.env.APPDATA;
  } else if (platform === 'darwin') {
    userDataPath = path.join(process.env.HOME, 'Library', 'Application Support');
  } else {
    userDataPath = path.join(process.env.HOME, '.config');
  }

  // Check both development and production paths
  const devPath = path.join(userDataPath, 'my-nextron-app (development)', 'mr5-pos.db');
  const prodPath = path.join(userDataPath, 'my-nextron-app', 'mr5-pos.db');

  if (fs.existsSync(devPath)) {
    return devPath;
  } else if (fs.existsSync(prodPath)) {
    return prodPath;
  }

  // Default to development path if neither exists
  return devPath;
}

async function createAdminUser() {
  try {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  MR5 POS - Direct SQLite Admin User Creation');
    console.log('═══════════════════════════════════════════════════════════\n');

    // Get database path
    const dbPath = getDatabasePath();
    console.log('[Step 1/6] Database path:', dbPath);

    // Check if database exists
    if (!fs.existsSync(dbPath)) {
      console.error('\n❌ ERROR: Database file not found!');
      console.error('   Expected location:', dbPath);
      console.error('\n   Please run the application at least once to create the database.');
      console.error('   Run: yarn dev\n');
      process.exit(1);
    }
    console.log('✓ Database file found\n');

    // Open database connection
    console.log('[Step 2/6] Opening database connection...');
    const db = new Database(dbPath);
    console.log('✓ Database connected\n');

    // Check if users table exists
    console.log('[Step 3/6] Verifying users table exists...');
    try {
      const tableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").get();
      if (!tableCheck) {
        console.error('\n❌ ERROR: Users table does not exist!');
        console.error('   The database schema may not be initialized.');
        console.error('   Please run the application to initialize the database.\n');
        db.close();
        process.exit(1);
      }
      console.log('✓ Users table exists\n');
    } catch (error) {
      console.error('\n❌ ERROR: Cannot verify users table:', error.message);
      db.close();
      process.exit(1);
    }

    // Check if admin user already exists
    console.log('[Step 4/6] Checking if admin user already exists...');
    const existingAdmin = db.prepare('SELECT id, username, email, role FROM users WHERE username = ?').get('admin');

    if (existingAdmin) {
      console.log('⚠️  Admin user already exists!');
      console.log('   ID:', existingAdmin.id);
      console.log('   Username:', existingAdmin.username);
      console.log('   Email:', existingAdmin.email);
      console.log('   Role:', existingAdmin.role);
      console.log('\nDo you want to update the password to "admin"? (y/n)');

      // For non-interactive execution, update the password
      console.log('Automatically updating password...\n');

      console.log('[Step 5/6] Hashing new password...');
      const hashedPassword = await bcrypt.hash('admin', 10);
      console.log('✓ Password hashed\n');

      console.log('[Step 6/6] Updating admin user password...');
      const updateStmt = db.prepare(`
        UPDATE users
        SET password = ?, updatedAt = ?
        WHERE username = 'admin'
      `);

      const result = updateStmt.run(hashedPassword, new Date().toISOString());

      if (result.changes > 0) {
        console.log('✓ Admin user password updated successfully!\n');
        console.log('═══════════════════════════════════════════════════════════');
        console.log('  ✅ SUCCESS');
        console.log('═══════════════════════════════════════════════════════════\n');
        console.log('Credentials:');
        console.log('  Username: admin');
        console.log('  Password: admin\n');
        console.log('⚠️  IMPORTANT: Change this password after first login!\n');
      } else {
        console.error('❌ Failed to update password (no rows changed)\n');
      }

      db.close();
      return;
    }

    console.log('✓ No existing admin user found\n');

    // Hash the password
    console.log('[Step 5/6] Hashing password...');
    const hashedPassword = await bcrypt.hash('admin', 10);
    console.log('✓ Password hashed\n');

    // Insert admin user
    console.log('[Step 6/6] Inserting admin user...');
    const insertStmt = db.prepare(`
      INSERT INTO users (id, username, email, password, role, firstName, lastName, isActive, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const userId = 'admin-user-' + Date.now();
    const now = new Date().toISOString();

    const result = insertStmt.run(
      userId,
      'admin',
      'admin@mr5pos.local',
      hashedPassword,
      'ADMIN',
      'Admin',
      'User',
      1, // isActive (SQLite uses 1 for true)
      now,
      now
    );

    if (result.changes > 0) {
      console.log('✓ Admin user created successfully!\n');

      // Verify the insertion
      const verify = db.prepare('SELECT id, username, email, role, isActive FROM users WHERE username = ?').get('admin');

      console.log('═══════════════════════════════════════════════════════════');
      console.log('  ✅ SUCCESS - Admin User Created');
      console.log('═══════════════════════════════════════════════════════════\n');
      console.log('User Details:');
      console.log('  ID:', verify.id);
      console.log('  Username:', verify.username);
      console.log('  Email:', verify.email);
      console.log('  Role:', verify.role);
      console.log('  Active:', verify.isActive === 1 ? 'Yes' : 'No');
      console.log('\nLogin Credentials:');
      console.log('  Username: admin');
      console.log('  Password: admin\n');
      console.log('⚠️  IMPORTANT: Change this password after first login!\n');
    } else {
      console.error('❌ Failed to insert admin user (no rows changed)\n');
    }

    // Close database connection
    db.close();
    console.log('Database connection closed.\n');

  } catch (error) {
    console.error('\n═══════════════════════════════════════════════════════════');
    console.error('  ❌ ERROR');
    console.error('═══════════════════════════════════════════════════════════\n');
    console.error('Error:', error.message);
    console.error('\nStack trace:');
    console.error(error.stack);
    console.error('\n');
    process.exit(1);
  }
}

// Run the script
console.log('\nStarting admin user creation...\n');
createAdminUser().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
