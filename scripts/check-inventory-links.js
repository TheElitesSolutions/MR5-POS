/**
 * Simple diagnostic script to check menu item inventory links
 * Run with: node scripts/check-inventory-links.js
 */

const path = require('path');
const os = require('os');
const fs = require('fs');

// Find the database file
const dbPath = path.join(
  os.homedir(),
  'AppData',
  'Roaming',
  'my-nextron-app',
  'mr5-pos.db'
);

console.log('🔍 Checking Stock Management Setup\n');
console.log('Database:', dbPath);

if (!fs.existsSync(dbPath)) {
  console.log('❌ Database not found at:', dbPath);
  console.log('\nPlease ensure the app has been run at least once.');
  process.exit(1);
}

// Since better-sqlite3 has build issues, let's just check if we can read the log files
const logDir = path.join(
  os.homedir(),
  'AppData',
  'Roaming',
  'my-nextron-app',
  'logs'
);

console.log('\n📋 Checking Application Logs\n');

if (fs.existsSync(logDir)) {
  const logFiles = fs.readdirSync(logDir)
    .filter(f => f.endsWith('.log'))
    .sort()
    .reverse()
    .slice(0, 3);

  console.log(`Found ${logFiles.length} recent log files:`);
  logFiles.forEach(f => console.log(`  - ${f}`));

  if (logFiles.length > 0) {
    const latestLog = path.join(logDir, logFiles[0]);
    console.log(`\n📖 Reading latest log: ${logFiles[0]}\n`);

    const logContent = fs.readFileSync(latestLog, 'utf8');
    const lines = logContent.split('\n');

    // Look for stock-related log entries
    const stockLogs = lines.filter(line =>
      line.includes('STOCK') ||
      line.includes('inventory') ||
      line.includes('INVENTORY') ||
      line.includes('ATOMIC')
    ).slice(-20); // Last 20 stock-related entries

    if (stockLogs.length > 0) {
      console.log('🔍 Recent Stock-Related Log Entries:\n');
      stockLogs.forEach(log => {
        // Color code the logs
        if (log.includes('DEDUCTION') || log.includes('DECREASE')) {
          console.log('  📉', log.substring(0, 200));
        } else if (log.includes('RESTORATION') || log.includes('INCREASE')) {
          console.log('  📈', log.substring(0, 200));
        } else if (log.includes('ATOMIC')) {
          console.log('  ⚡', log.substring(0, 200));
        } else {
          console.log('  ℹ️ ', log.substring(0, 200));
        }
      });
    } else {
      console.log('⚠️  No stock-related log entries found.');
      console.log('\nThis could mean:');
      console.log('1. No orders have been created yet');
      console.log('2. Stock management is not being triggered');
      console.log('3. Log level is set too high');
    }

    // Check for errors
    const errors = lines.filter(line =>
      line.includes('ERROR') ||
      line.includes('Error') ||
      line.includes('error')
    ).slice(-10);

    if (errors.length > 0) {
      console.log('\n\n❌ Recent Errors Found:\n');
      errors.forEach(err => {
        console.log('  ⚠️ ', err.substring(0, 200));
      });
    }
  }
} else {
  console.log('❌ Log directory not found:', logDir);
}

console.log('\n' + '='.repeat(60));
console.log('📋 Manual Verification Steps:');
console.log('='.repeat(60));
console.log('\n1. Open the POS app and create a test order');
console.log('2. Add a menu item to the order');
console.log('3. Check the logs above for stock deduction messages');
console.log('4. Look for messages like:');
console.log('   - "🔍 STOCK DEDUCTION: Processing for..."');
console.log('   - "📉 STOCK ADJUSTED: ..."');
console.log('   - "✅ ATOMIC: Item addition and inventory..."');
console.log('\n5. If you see these messages, stock management IS working!');
console.log('6. If NOT, open DB Browser and run:');
console.log('   SELECT COUNT(*) FROM menu_item_inventory;');
console.log('\n' + '='.repeat(60));
