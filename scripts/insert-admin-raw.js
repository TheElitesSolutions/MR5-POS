/**
 * Direct database insertion using raw SQL
 * This bypasses the better-sqlite3 module version issue
 */

const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

function generateId() {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substr(2, 9);
  return `${timestamp}${randomStr}`;
}

async function main() {
  try {
    const userDataPath = process.env.APPDATA ||
      (process.platform === 'darwin' ? process.env.HOME + '/Library/Application Support' : process.env.HOME + '/.config');
    const dbPath = path.join(userDataPath, 'my-nextron-app', 'mr5-pos.db');

    console.log('Database path:', dbPath);

    if (!fs.existsSync(dbPath)) {
      console.error('❌ Database not found. Please run the application at least once to create it.');
      process.exit(1);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash('admin', 10);
    const userId = generateId();
    const now = new Date().toISOString();

    // Generate SQL
    const insertSql = `INSERT INTO users (id, username, email, password, role, firstName, lastName, isActive, createdAt, updatedAt)
VALUES ('${userId}', 'admin', 'admin@mr5pos.com', '${hashedPassword}', 'ADMIN', 'Admin', 'User', 1, '${now}', '${now}');`;

    const updateSql = `UPDATE users SET password = '${hashedPassword}', updatedAt = datetime('now') WHERE username = 'admin';`;

    console.log('\n✅ SQL Commands Generated!\n');
    console.log('To create the admin user, run ONE of the following:\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('OPTION 1: If admin user does NOT exist yet:\n');
    console.log(insertSql);
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('OPTION 2: If admin user already exists (update password):\n');
    console.log(updateSql);
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\nDatabase location:');
    console.log(dbPath);
    console.log('\nYou can execute these commands using:');
    console.log('1. DB Browser for SQLite (https://sqlitebrowser.org/)');
    console.log('2. Any SQLite client');
    console.log('3. Or the application will auto-create the user on next startup\n');
    console.log('Credentials:');
    console.log('  Username: admin');
    console.log('  Password: admin\n');

    // Save to file for easy copy
    const sqlFile = path.join(__dirname, 'admin-user-sql.txt');
    fs.writeFileSync(sqlFile, `-- Admin User Creation SQL
-- Database: ${dbPath}
-- Generated: ${new Date().toLocaleString()}

-- Check if admin exists:
SELECT * FROM users WHERE username = 'admin';

-- If admin does NOT exist, run this:
${insertSql}

-- If admin EXISTS, run this to update password:
${updateSql}

-- Verify:
SELECT id, username, email, role, firstName, lastName, isActive FROM users WHERE username = 'admin';
`);

    console.log(`📄 SQL commands also saved to: ${sqlFile}\n`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
