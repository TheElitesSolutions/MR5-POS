const fs = require('fs');
const path = require('path');
const os = require('os');

const appDataPath = path.join(
  process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'),
  'mr5-pos'
);
const crashFile = path.join(appDataPath, 'crash-detection.json');

console.log('🔍 Looking for crash detection file:', crashFile);

if (fs.existsSync(crashFile)) {
  const data = JSON.parse(fs.readFileSync(crashFile, 'utf8'));
  console.log('📊 Current state:', JSON.stringify(data, null, 2));

  fs.unlinkSync(crashFile);
  console.log('✅ Crash detection file deleted successfully');
  console.log('ℹ️  The file will be recreated with crashCount: 0 on next startup');
} else {
  console.log('✅ No crash detection file found (already clean)');
}

console.log('\n🚀 You can now start the app!');
