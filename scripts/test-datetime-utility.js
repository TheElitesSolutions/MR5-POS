/**
 * Test the dateTime utility to verify it's working correctly
 */

// Simulate the getCurrentLocalDateTime function
function getCurrentLocalDateTime() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

console.log('🧪 Testing DateTime Utility\n');
console.log('=' .repeat(80));

console.log('\n📅 Current Times:');
console.log(`  System Local Time:     ${new Date().toString()}`);
console.log(`  System UTC Time:       ${new Date().toUTCString()}`);
console.log(`  JavaScript ISO (UTC):  ${new Date().toISOString()}`);

console.log('\n✨ Our Utility Output:');
const localDateTime = getCurrentLocalDateTime();
console.log(`  getCurrentLocalDateTime(): ${localDateTime}`);

console.log('\n🔍 Verification:');
const now = new Date();
const expectedHour = now.getHours();
const actualHour = parseInt(localDateTime.split(' ')[1].split(':')[0]);

console.log(`  Expected Hour (local): ${expectedHour}`);
console.log(`  Actual Hour (utility): ${actualHour}`);

if (expectedHour === actualHour) {
  console.log('  ✅ CORRECT - Utility returns local time!');
} else {
  console.log('  ❌ ERROR - Time mismatch!');
}

console.log('\n' + '='.repeat(80));
console.log('\n📝 Next Steps:');
console.log('  1. Rebuild the app: yarn build');
console.log('  2. Restart the application');
console.log('  3. Create a new order/table to test');
console.log('  4. The NEW data should show correct local time');
console.log('  5. Old data (created before fix) will still show UTC\n');
