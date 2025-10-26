/**
 * Script to fix frontend date parsing to use local time instead of UTC
 * Adds parseLocalDateTime function to components that format dates
 */

const fs = require('fs');
const path = require('path');

// The parseLocalDateTime utility function to add
const parseLocalDateTimeFunction = `
  // Parse SQLite datetime as local time (not UTC)
  const parseLocalDateTime = (dateString: string): Date => {
    // SQLite format: "YYYY-MM-DD HH:MM:SS"
    // We need to parse this as local time, not UTC
    const [datePart, timePart] = dateString.replace('T', ' ').split(' ');
    const [year, month, day] = datePart.split('-').map(Number);
    const [hours, minutes, seconds] = (timePart || '00:00:00').split(':').map(Number);

    // Create date in local timezone (month is 0-indexed)
    return new Date(year, month - 1, day, hours || 0, minutes || 0, seconds || 0);
  };
`;

// Files that need fixing based on their date formatting patterns
const filesToFix = [
  {
    path: 'renderer/components/orders/OrderDetailsModal.tsx',
    formatFunctionPattern: /const formatDate = \(dateString: string\) => \{\s*const date = new Date\(dateString\);/,
    insertAfterPattern: /if \(!order\) return null;/,
  },
  {
    path: 'renderer/components/orders/InvoicePreview.tsx',
    formatFunctionPattern: /const formatDate = \(dateString: string\) => \{\s*const date = new Date\(dateString\);/,
    insertAfterPattern: /const formatCurrency/,
  },
  {
    path: 'renderer/components/pos/TakeoutOrderGrid.tsx',
    formatFunctionPattern: /new Date\(.*createdAt/,
    insertAfterPattern: /const TakeoutOrderGrid/,
  },
  {
    path: 'renderer/components/expenses/ExpenseCard.tsx',
    formatFunctionPattern: /new Date\(/,
    insertAfterPattern: /const ExpenseCard/,
  },
  {
    path: 'renderer/components/dashboard/RecentActivity.tsx',
    formatFunctionPattern: /new Date\(/,
    insertAfterPattern: /const RecentActivity/,
  },
  {
    path: 'renderer/components/orders/CashboxSummary.tsx',
    formatFunctionPattern: /new Date\(/,
    insertAfterPattern: /const CashboxSummary/,
  },
];

let fixedCount = 0;
let skippedCount = 0;
let errors = [];

console.log('🔧 Starting Frontend Date Parsing Fix...\n');
console.log('=' .repeat(80));

filesToFix.forEach(({ path: filePath, formatFunctionPattern, insertAfterPattern }) => {
  const fullPath = path.join(__dirname, '..', filePath);

  try {
    if (!fs.existsSync(fullPath)) {
      console.log(`⚠️  SKIPPED: ${filePath} (file not found)`);
      skippedCount++;
      return;
    }

    let content = fs.readFileSync(fullPath, 'utf-8');

    // Check if file has date formatting that needs fixing
    if (!formatFunctionPattern.test(content)) {
      console.log(`⚠️  SKIPPED: ${filePath} (no date parsing found)`);
      skippedCount++;
      return;
    }

    // Check if already has parseLocalDateTime function
    if (content.includes('parseLocalDateTime')) {
      console.log(`✅ ALREADY FIXED: ${filePath}`);
      skippedCount++;
      return;
    }

    // Add parseLocalDateTime function after the appropriate location
    if (insertAfterPattern.test(content)) {
      content = content.replace(insertAfterPattern, (match) => {
        return match + parseLocalDateTimeFunction;
      });
    }

    // Replace new Date(dateString) with parseLocalDateTime(dateString) in format functions
    content = content.replace(
      /const formatDate = \(dateString: string\) => \{\s*const date = new Date\(dateString\);/g,
      'const formatDate = (dateString: string) => {\n    const date = parseLocalDateTime(dateString);'
    );

    content = content.replace(
      /const formatTime = \(dateString: string\) => \{\s*const date = new Date\(dateString\);/g,
      'const formatTime = (dateString: string) => {\n    const date = parseLocalDateTime(dateString);'
    );

    // For elapsed time functions
    content = content.replace(
      /typeof createdAt === 'string' \? new Date\(createdAt\) : createdAt/g,
      "typeof createdAt === 'string' ? parseLocalDateTime(createdAt) : createdAt"
    );

    // Write the updated content back
    fs.writeFileSync(fullPath, content, 'utf-8');
    console.log(`✅ FIXED: ${filePath}`);
    fixedCount++;

  } catch (error) {
    console.error(`❌ ERROR: ${filePath}`);
    console.error(`   ${error.message}`);
    errors.push({ file: filePath, error: error.message });
  }
});

console.log('\n' + '='.repeat(80));
console.log('\n📊 Summary:');
console.log(`   ✅ Fixed: ${fixedCount} files`);
console.log(`   ⚠️  Skipped: ${skippedCount} files`);
console.log(`   ❌ Errors: ${errors.length} files`);

if (errors.length > 0) {
  console.log('\n❌ Files with errors:');
  errors.forEach(({ file, error }) => {
    console.log(`   - ${file}: ${error}`);
  });
}

console.log('\n✨ Frontend date parsing fix complete!');
console.log('\n📝 Next steps:');
console.log('   1. Review the changes in the modified files');
console.log('   2. Rebuild the app: yarn build');
console.log('   3. Test date/time display in all components');
console.log('   4. Create new orders/tables to verify local time is used\n');
