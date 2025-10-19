/**
 * Script to create an admin user in the database
 * Username: admin
 * Password: admin
 */

const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Get the database path
const userDataPath = process.env.APPDATA ||
  (process.platform === 'darwin' ? process.env.HOME + '/Library/Application Support' : process.env.HOME + '/.config');
const dbPath = path.join(userDataPath, 'my-nextron-app', 'mr5-pos.db');

console.log('Database path:', dbPath);

// Check if database exists
if (!fs.existsSync(dbPath)) {
  console.error('❌ Database not found at:', dbPath);
  console.error('Please make sure the application has been run at least once to create the database.');
  process.exit(1);
}

// Connect to database
const db = new Database(dbPath);

// Generate ID
function generateId() {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substr(2, 9);
  return `${timestamp}${randomStr}`;
}

async function createAdminUser() {
  try {
    // Check if admin user already exists
    const existingUser = db.prepare('SELECT * FROM users WHERE username = ?').get('admin');

    if (existingUser) {
      console.log('⚠️  Admin user already exists!');
      console.log('User details:', {
        id: existingUser.id,
        username: existingUser.username,
        email: existingUser.email,
        role: existingUser.role,
        firstName: existingUser.firstName,
        lastName: existingUser.lastName
      });

      // Ask if we should update the password
      console.log('\nUpdating password to "admin"...');
      const hashedPassword = await bcrypt.hash('admin', 10);

      db.prepare(`
        UPDATE users
        SET password = ?, updatedAt = datetime('now')
        WHERE username = 'admin'
      `).run(hashedPassword);

      console.log('✅ Admin password updated successfully!');
      return;
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash('admin', 10);
    const userId = generateId();
    const now = new Date().toISOString();

    // Create the admin user
    const stmt = db.prepare(`
      INSERT INTO users (id, username, email, password, role, firstName, lastName, isActive, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      userId,
      'admin',
      'admin@mr5pos.com',
      hashedPassword,
      'ADMIN',
      'Admin',
      'User',
      1,
      now,
      now
    );

    console.log('✅ Admin user created successfully!');
    console.log('\nCredentials:');
    console.log('  Username: admin');
    console.log('  Password: admin');
    console.log('  Role: ADMIN');
    console.log('\n⚠️  Please change this password after first login!');

  } catch (error) {
    console.error('❌ Error creating admin user:', error.message);
    process.exit(1);
  } finally {
    db.close();
  }
}

// Run the script
createAdminUser();
