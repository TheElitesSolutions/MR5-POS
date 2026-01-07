/**
 * Diagnostic Script: Menu Availability Investigation
 *
 * This script helps identify what caused all menu items to become unavailable
 * Run with: node scripts/diagnose-menu-availability.js
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(process.env.APPDATA, 'my-nextron-app', 'mr5-pos.db');
const logsDir = path.join(process.env.APPDATA, 'my-nextron-app', 'logs');

console.log('🔍 MENU AVAILABILITY DIAGNOSTIC TOOL\n');
console.log('Database:', dbPath);
console.log('');

// Connect to database
let db;
try {
  db = new Database(dbPath, { readonly: true });
} catch (error) {
  console.error('❌ ERROR connecting to database:', error.message);
  process.exit(1);
}

console.log('📊 CURRENT DATABASE STATE\n');

// 1. Menu items overview
console.log('1️⃣ Menu Items Overview:');
const menuStats = db.prepare(`
  SELECT
    COUNT(*) as total,
    SUM(CASE WHEN isActive = 1 THEN 1 ELSE 0 END) as active,
    SUM(CASE WHEN isActive = 0 THEN 1 ELSE 0 END) as inactive
  FROM menu_items
`).get();

console.log(`   Total items: ${menuStats.total}`);
console.log(`   Active: ${menuStats.active} (${Math.round(menuStats.active / menuStats.total * 100)}%)`);
console.log(`   Inactive: ${menuStats.inactive} (${Math.round(menuStats.inactive / menuStats.total * 100)}%)`);
console.log('');

// 2. Category breakdown
console.log('2️⃣ Availability by Category:');
const categoryStats = db.prepare(`
  SELECT
    c.name as category,
    COUNT(mi.id) as total,
    SUM(CASE WHEN mi.isActive = 1 THEN 1 ELSE 0 END) as active
  FROM categories c
  LEFT JOIN menu_items mi ON c.id = mi.categoryId
  GROUP BY c.id, c.name
  ORDER BY c.name
`).all();

categoryStats.forEach(cat => {
  const percent = cat.total > 0 ? Math.round(cat.active / cat.total * 100) : 0;
  console.log(`   ${cat.category}: ${cat.active}/${cat.total} active (${percent}%)`);
});
console.log('');

// 3. Check for patterns in unavailable items
if (menuStats.inactive > 0) {
  console.log('3️⃣ Unavailable Items Sample (first 10):');
  const unavailable = db.prepare(`
    SELECT id, name, categoryId, isActive
    FROM menu_items
    WHERE isActive = 0
    LIMIT 10
  `).all();

  unavailable.forEach(item => {
    console.log(`   - ${item.name} (ID: ${item.id})`);
  });
  console.log('');
}

// 4. Check recent database modifications
console.log('4️⃣ Database File Information:');
const stats = fs.statSync(dbPath);
console.log(`   Last modified: ${stats.mtime.toLocaleString()}`);
console.log(`   Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
console.log('');

// 5. Check for audit logs or triggers
console.log('5️⃣ Checking for Audit Mechanisms:');
const tables = db.prepare(`
  SELECT name FROM sqlite_master
  WHERE type='table' AND (
    name LIKE '%audit%' OR
    name LIKE '%log%' OR
    name LIKE '%history%'
  )
`).all();

if (tables.length > 0) {
  console.log('   Found audit/log tables:');
  tables.forEach(t => console.log(`   - ${t.name}`));
} else {
  console.log('   ⚠️ No audit tables found - cannot track historical changes');
}
console.log('');

// 6. Check for triggers
console.log('6️⃣ Database Triggers:');
const triggers = db.prepare(`
  SELECT name, tbl_name, sql
  FROM sqlite_master
  WHERE type='trigger'
`).all();

if (triggers.length > 0) {
  console.log(`   Found ${triggers.length} trigger(s):`);
  triggers.forEach(t => {
    console.log(`   - ${t.name} on ${t.tbl_name}`);
  });
} else {
  console.log('   ℹ️ No triggers found');
}
console.log('');

// 7. Check settings for any bulk operations
console.log('7️⃣ Relevant Settings:');
const settings = db.prepare(`
  SELECT key, value
  FROM settings
  WHERE key LIKE '%sync%' OR key LIKE '%import%' OR key LIKE '%backup%'
`).all();

if (settings.length > 0) {
  settings.forEach(s => {
    console.log(`   ${s.key}: ${s.value}`);
  });
} else {
  console.log('   ℹ️ No sync/import/backup settings found');
}
console.log('');

// 8. Check for backup files
console.log('8️⃣ Recent Backup Files:');
const backupDir = path.join(process.env.APPDATA, 'my-nextron-app');
const backupFiles = fs.readdirSync(backupDir)
  .filter(f => f.includes('backup') && f.endsWith('.db'))
  .map(f => {
    const filePath = path.join(backupDir, f);
    const stats = fs.statSync(filePath);
    return { name: f, modified: stats.mtime, size: stats.size };
  })
  .sort((a, b) => b.modified - a.modified)
  .slice(0, 5);

if (backupFiles.length > 0) {
  backupFiles.forEach(f => {
    console.log(`   ${f.name}`);
    console.log(`     Modified: ${f.modified.toLocaleString()}`);
    console.log(`     Size: ${(f.size / 1024 / 1024).toFixed(2)} MB`);
  });
} else {
  console.log('   ℹ️ No backup files found');
}
console.log('');

// 9. Recommendations
console.log('📋 INVESTIGATION RECOMMENDATIONS:\n');

if (menuStats.inactive > 0) {
  console.log('⚠️ ISSUE DETECTED: Some/all menu items are inactive');
  console.log('');
  console.log('Possible causes to investigate:');
  console.log('1. Check application logs for recent UPDATE queries on menu_items');
  console.log('2. Review Supabase sync logs if sync is enabled');
  console.log('3. Check if a database restore was performed recently');
  console.log('4. Review any recent deployments or code changes');
  console.log('5. Interview staff - did anyone manually update menu availability?');
  console.log('');
  console.log('📁 Logs directory: ' + logsDir);
  console.log('');
  console.log('To search logs for clues, run:');
  console.log('   cd "' + logsDir + '"');
  console.log('   findstr /I "UPDATE menu_items" *.log');
  console.log('   findstr /I "isActive" *.log');
  console.log('   findstr /I "supabase" *.log');
} else {
  console.log('✅ All menu items are active - system is healthy');
}

console.log('');
console.log('🔧 PREVENTION MEASURES:\n');
console.log('Consider implementing:');
console.log('1. Audit trigger to log isActive changes');
console.log('2. Application-level warning for bulk availability changes');
console.log('3. Monitoring alert if >50% items become unavailable');
console.log('4. Regular automated backups before risky operations');

db.close();
console.log('');
console.log('✅ Diagnostic complete');
