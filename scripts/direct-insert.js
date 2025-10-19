/**
 * Direct database insertion using pure Node.js
 */

const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

function generateId() {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substr(2, 9);
  return `${timestamp}${randomStr}`;
}

async function createAdmin() {
  try {
    // Get the database path
    const userDataPath = process.env.APPDATA ||
      (process.platform === 'darwin' ? process.env.HOME + '/Library/Application Support' : process.env.HOME + '/.config');
    const dbPath = path.join(userDataPath, 'my-nextron-app', 'mr5-pos.db');

    console.log('Database path:', dbPath);

    // Check if database exists
    if (!fs.existsSync(dbPath)) {
      console.error('❌ Database not found at:', dbPath);
      console.error('Please make sure the application has been run at least once.');
      process.exit(1);
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash('admin', 10);
    const userId = generateId();
    const now = new Date().toISOString();

    // Create SQL commands
    const checkSql = `SELECT COUNT(*) as count FROM users WHERE username = 'admin';`;
    const insertSql = `INSERT INTO users (id, username, email, password, role, firstName, lastName, isActive, createdAt, updatedAt) VALUES ('${userId}', 'admin', 'admin@mr5pos.com', '${hashedPassword}', 'ADMIN', 'Admin', 'User', 1, '${now}', '${now}');`;
    const updateSql = `UPDATE users SET password = '${hashedPassword}', updatedAt = datetime('now') WHERE username = 'admin';`;

    // Save SQL to temp file
    const sqlFile = path.join(__dirname, 'temp-insert.sql');
    const sql = `
${checkSql}
.exit
`;
    fs.writeFileSync(sqlFile, sql);

    console.log('\n📝 Generated SQL commands');
    console.log('\nTo create the admin user, you have two options:\n');

    console.log('OPTION 1: Use the Windows PowerShell script');
    console.log('Run this command in PowerShell:');
    console.log(`$db = "${dbPath.replace(/\\/g, '\\\\')}"`);
    console.log(`$check = "SELECT COUNT(*) as count FROM users WHERE username = 'admin';"`);
    console.log('Add-Type -Path "C:\\path\\to\\System.Data.SQLite.dll"');
    console.log('');

    console.log('OPTION 2: Manual SQL (RECOMMENDED)');
    console.log('Copy and paste these commands into a SQLite client:\n');
    console.log('1. First check if admin exists:');
    console.log(checkSql);
    console.log('\n2. If count is 0, run INSERT:');
    console.log(insertSql);
    console.log('\n3. If count is greater than 0, run UPDATE:');
    console.log(updateSql);

    console.log('\n\n✅ Done! Use one of the options above to create the admin user.');
    console.log('\nCredentials:');
    console.log('  Username: admin');
    console.log('  Password: admin');

    // Clean up temp file
    if (fs.existsSync(sqlFile)) {
      fs.unlinkSync(sqlFile);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

createAdmin();
