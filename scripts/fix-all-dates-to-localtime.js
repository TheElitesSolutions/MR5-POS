/**
 * Script to fix all Date() calls to use local time instead of UTC
 * This ensures consistent local time usage throughout the application
 */

const fs = require('fs');
const path = require('path');

const filesToFix = [
  // Services
  'main/services/reportService.ts',
  'main/services/authService.ts',
  'main/services/backupService.ts',
  'main/services/baseService.ts',
  'main/services/supabaseSync.ts',
  'main/services/enhancedPrinterService.ts',
  'main/services/nativePrinterDetection.ts',
  'main/services/printerSpoolerService.ts',
  'main/services/optimizedPrintingService.ts',
  'main/services/AddonCacheService.ts',

  // Controllers
  'main/controllers/orderController.ts',
  'main/controllers/orderController.addon-extensions.ts',
  'main/controllers/menuItemController.ts',
  'main/controllers/printerController.ts',
  'main/controllers/logController.ts',
  'main/controllers/systemController.ts',
  'main/controllers/reportController.ts',
  'main/controllers/dashboardController.ts',
  'main/controllers/authController.ts',
  'main/controllers/addonController.ts',
  'main/controllers/baseController.ts',

  // Models
  'main/models/Order.ts',
  'main/models/Table.ts',
  'main/models/MenuItem.ts',
  'main/models/Expense.ts',
  'main/models/Inventory.ts',
  'main/models/User.ts',
  'main/models/Setting.ts',
  'main/models/Payment.ts',
  'main/models/OrderItem.ts',

  // Utils
  'main/utils/receiptGenerator.ts',
  'main/utils/enhancedKitchenTicket.ts',
  'main/utils/addonInvoiceGenerator.ts',
  'main/utils/excelExport.ts',
  'main/utils/advancedLogger.ts',
  'main/utils/logger.ts',
  'main/utils/enhanced-logger.ts',
  'main/utils/backupManager.ts',
  'main/utils/updateSafety.ts',
];

function addImportIfNeeded(content, filePath) {
  // Skip if already has the import
  if (content.includes("from '../utils/dateTime'") || content.includes('from "./dateTime"')) {
    return content;
  }

  // Determine the correct import path
  let importPath = '../utils/dateTime';
  if (filePath.includes('/utils/')) {
    importPath = './dateTime';
  } else if (filePath.includes('/models/')) {
    importPath = '../utils/dateTime';
  } else if (filePath.includes('/services/') || filePath.includes('/controllers/')) {
    importPath = '../utils/dateTime';
  }

  // Find a good place to add the import (after other imports)
  const importRegex = /^import .+ from .+;$/gm;
  const matches = content.match(importRegex);

  if (matches && matches.length > 0) {
    const lastImport = matches[matches.length - 1];
    const lastImportIndex = content.indexOf(lastImport) + lastImport.length;

    const newImport = `\nimport { getCurrentLocalDateTime } from '${importPath}';`;
    content = content.slice(0, lastImportIndex) + newImport + content.slice(lastImportIndex);
  }

  return content;
}

function fixDates(content) {
  // Replace all date patterns
  content = content.replace(/new Date\(\)\.toISOString\(\)/g, 'getCurrentLocalDateTime()');
  content = content.replace(/createdAt:\s*new Date\(\)/g, 'createdAt: getCurrentLocalDateTime()');
  content = content.replace(/updatedAt:\s*new Date\(\)/g, 'updatedAt: getCurrentLocalDateTime()');
  content = content.replace(/completedAt:\s*new Date\(\)/g, 'completedAt: getCurrentLocalDateTime()');
  content = content.replace(/paidAt:\s*new Date\(\)/g, 'paidAt: getCurrentLocalDateTime()');
  content = content.replace(/lastLogin:\s*new Date\(\)/g, 'lastLogin: getCurrentLocalDateTime()');
  content = content.replace(/lastRestocked:\s*new Date\(\)/g, 'lastRestocked: getCurrentLocalDateTime()');
  content = content.replace(/lastStatusChange:\s*new Date\(\)/g, 'lastStatusChange: getCurrentLocalDateTime()');
  content = content.replace(/expenseDate:\s*new Date\(\)/g, 'expenseDate: getCurrentLocalDateTime()');

  return content;
}

let filesFixed = 0;
let filesSkipped = 0;
let errors = [];

console.log('🔧 Fixing all date/time usages to use local time...\n');

filesToFix.forEach(filePath => {
  const fullPath = path.join(__dirname, '..', filePath);

  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️  Skipped: ${filePath} (not found)`);
    filesSkipped++;
    return;
  }

  try {
    let content = fs.readFileSync(fullPath, 'utf8');
    const originalContent = content;

    // Add import if needed
    content = addImportIfNeeded(content, filePath);

    // Fix all date usages
    content = fixDates(content);

    // Only write if content changed
    if (content !== originalContent) {
      fs.writeFileSync(fullPath, content, 'utf8');
      console.log(`✅ Fixed: ${filePath}`);
      filesFixed++;
    } else {
      console.log(`⏭️  Skipped: ${filePath} (no changes needed)`);
      filesSkipped++;
    }
  } catch (error) {
    console.error(`❌ Error: ${filePath} - ${error.message}`);
    errors.push({ file: filePath, error: error.message });
  }
});

console.log(`\n📊 Summary:`);
console.log(`   ✅ Files fixed: ${filesFixed}`);
console.log(`   ⏭️  Files skipped: ${filesSkipped}`);
console.log(`   ❌ Errors: ${errors.length}`);

if (errors.length > 0) {
  console.log(`\n⚠️  Errors encountered:`);
  errors.forEach(({ file, error }) => {
    console.log(`   - ${file}: ${error}`);
  });
}

console.log('\n✨ Date/time fix complete!');
