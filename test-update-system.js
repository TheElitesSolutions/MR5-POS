/**
 * MR5 POS - Auto-Update System Test Script
 *
 * This script tests the complete update workflow:
 * 1. Check for updates
 * 2. Verify GitHub connectivity
 * 3. Test download capability
 * 4. Verify update metadata
 */

const { exec } = require('child_process');
const https = require('https');
const fs = require('fs');
const path = require('path');

const GITHUB_API = 'https://api.github.com';
const OWNER = 'TheElitesSolutions';
const REPO = 'MR5-POS';
const CURRENT_VERSION = '2.1.0';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function success(message) {
  log(`✓ ${message}`, 'green');
}

function error(message) {
  log(`✗ ${message}`, 'red');
}

function info(message) {
  log(`ℹ ${message}`, 'cyan');
}

function warn(message) {
  log(`⚠ ${message}`, 'yellow');
}

// Test 1: Check GitHub repository accessibility
async function testGitHubAccess() {
  return new Promise((resolve, reject) => {
    info('Test 1: Checking GitHub repository access...');

    const options = {
      hostname: 'api.github.com',
      path: `/repos/${OWNER}/${REPO}`,
      method: 'GET',
      headers: {
        'User-Agent': 'MR5-POS-Update-Test',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200) {
          const repo = JSON.parse(data);
          success(`Repository accessible: ${repo.full_name}`);
          info(`  Private: ${repo.private}`);
          info(`  Stars: ${repo.stargazers_count}`);
          resolve(true);
        } else if (res.statusCode === 404) {
          error('Repository not found or not public');
          warn('Make sure the repository is public for auto-updates to work');
          resolve(false);
        } else {
          error(`GitHub API returned status: ${res.statusCode}`);
          resolve(false);
        }
      });
    });

    req.on('error', (err) => {
      error(`Failed to connect to GitHub: ${err.message}`);
      reject(err);
    });

    req.end();
  });
}

// Test 2: Check for latest release
async function testLatestRelease() {
  return new Promise((resolve, reject) => {
    info('\nTest 2: Checking for latest release...');

    const options = {
      hostname: 'api.github.com',
      path: `/repos/${OWNER}/${REPO}/releases/latest`,
      method: 'GET',
      headers: {
        'User-Agent': 'MR5-POS-Update-Test',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200) {
          const release = JSON.parse(data);
          success(`Latest release found: ${release.tag_name}`);
          info(`  Name: ${release.name}`);
          info(`  Published: ${new Date(release.published_at).toLocaleString()}`);
          info(`  Current version: v${CURRENT_VERSION}`);

          // Check if update is available
          const latestVersion = release.tag_name.replace('v', '');
          if (latestVersion > CURRENT_VERSION) {
            success(`Update available: ${CURRENT_VERSION} → ${latestVersion}`);
          } else if (latestVersion === CURRENT_VERSION) {
            info('Already on latest version');
          } else {
            warn('Current version is newer than latest release');
          }

          resolve(release);
        } else if (res.statusCode === 404) {
          error('No releases found in repository');
          warn('Create a release on GitHub first');
          resolve(null);
        } else {
          error(`GitHub API returned status: ${res.statusCode}`);
          resolve(null);
        }
      });
    });

    req.on('error', (err) => {
      error(`Failed to fetch releases: ${err.message}`);
      reject(err);
    });

    req.end();
  });
}

// Test 3: Verify release assets
async function testReleaseAssets(release) {
  if (!release) {
    warn('\nTest 3: Skipped (no release found)');
    return false;
  }

  info('\nTest 3: Verifying release assets...');

  const requiredAssets = [
    { name: 'latest.yml', description: 'Update metadata file' },
    { pattern: /\.exe$/, description: 'Windows installer' },
    { pattern: /\.blockmap$/, description: 'Differential update file' },
  ];

  let allAssetsFound = true;

  for (const required of requiredAssets) {
    const found = release.assets.find(asset =>
      required.name ? asset.name === required.name : required.pattern.test(asset.name)
    );

    if (found) {
      success(`Found: ${found.name} (${(found.size / 1024 / 1024).toFixed(2)} MB)`);
    } else {
      error(`Missing: ${required.description}`);
      allAssetsFound = false;
    }
  }

  return allAssetsFound;
}

// Test 4: Verify latest.yml content
async function testLatestYml(release) {
  if (!release) {
    warn('\nTest 4: Skipped (no release found)');
    return false;
  }

  info('\nTest 4: Verifying latest.yml content...');

  const latestYml = release.assets.find(asset => asset.name === 'latest.yml');

  if (!latestYml) {
    error('latest.yml not found in release assets');
    return false;
  }

  return new Promise((resolve) => {
    const download = (url) => {
      https.get(url, (res) => {
        // Handle redirects
        if (res.statusCode === 302 || res.statusCode === 301) {
          download(res.headers.location);
          return;
        }

        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          if (res.statusCode === 200) {
            success('latest.yml downloaded successfully');
            info('\nContent:');
            console.log(data);

            // Parse and validate
            const hasVersion = data.includes('version:');
            const hasFiles = data.includes('files:');
            const hasPath = data.includes('path:');
            const hasSha512 = data.includes('sha512:');

            if (hasVersion && hasFiles && hasPath && hasSha512) {
              success('latest.yml has all required fields');
              resolve(true);
            } else {
              error('latest.yml is missing required fields');
              if (!hasVersion) error('  Missing: version');
              if (!hasFiles) error('  Missing: files');
              if (!hasPath) error('  Missing: path');
              if (!hasSha512) error('  Missing: sha512');
              resolve(false);
            }
          } else {
            error(`Failed to download latest.yml: ${res.statusCode}`);
            resolve(false);
          }
        });
      }).on('error', (err) => {
        error(`Error downloading latest.yml: ${err.message}`);
        resolve(false);
      });
    };

    download(latestYml.browser_download_url);
  });
}

// Test 5: Check electron-builder configuration
function testElectronBuilderConfig() {
  info('\nTest 5: Checking electron-builder configuration...');

  const configPath = path.join(__dirname, 'electron-builder.yml');

  if (!fs.existsSync(configPath)) {
    error('electron-builder.yml not found');
    return false;
  }

  const config = fs.readFileSync(configPath, 'utf8');

  const hasPublish = config.includes('publish:');
  const hasGithub = config.includes('provider: github');
  const hasOwner = config.includes(`owner: ${OWNER}`);
  const hasRepo = config.includes(`repo: ${REPO}`);

  if (hasPublish && hasGithub && hasOwner && hasRepo) {
    success('electron-builder.yml is properly configured');
    info(`  Provider: GitHub`);
    info(`  Repository: ${OWNER}/${REPO}`);
    return true;
  } else {
    error('electron-builder.yml is missing required fields');
    if (!hasPublish) error('  Missing: publish section');
    if (!hasGithub) error('  Missing: provider: github');
    if (!hasOwner) error('  Missing: correct owner');
    if (!hasRepo) error('  Missing: correct repo');
    return false;
  }
}

// Test 6: Check package.json version
function testPackageVersion() {
  info('\nTest 6: Checking package.json version...');

  const packagePath = path.join(__dirname, 'package.json');

  if (!fs.existsSync(packagePath)) {
    error('package.json not found');
    return false;
  }

  const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

  success(`Current version in package.json: ${pkg.version}`);

  if (pkg.version === CURRENT_VERSION) {
    success('Version matches expected version');
    return true;
  } else {
    warn(`Version mismatch: expected ${CURRENT_VERSION}, found ${pkg.version}`);
    return false;
  }
}

// Run all tests
async function runTests() {
  log('\n╔════════════════════════════════════════════════════╗', 'blue');
  log('║   MR5 POS - Auto-Update System Test Suite        ║', 'blue');
  log('╚════════════════════════════════════════════════════╝\n', 'blue');

  const results = {
    githubAccess: false,
    latestRelease: null,
    releaseAssets: false,
    latestYml: false,
    builderConfig: false,
    packageVersion: false,
  };

  try {
    // Test 1
    results.githubAccess = await testGitHubAccess();

    // Test 2
    if (results.githubAccess) {
      results.latestRelease = await testLatestRelease();
    } else {
      warn('\nTest 2: Skipped (GitHub access failed)');
    }

    // Test 3
    results.releaseAssets = await testReleaseAssets(results.latestRelease);

    // Test 4
    results.latestYml = await testLatestYml(results.latestRelease);

    // Test 5
    results.builderConfig = testElectronBuilderConfig();

    // Test 6
    results.packageVersion = testPackageVersion();

  } catch (err) {
    error(`\nTest suite failed with error: ${err.message}`);
  }

  // Summary
  log('\n╔════════════════════════════════════════════════════╗', 'blue');
  log('║                  Test Summary                     ║', 'blue');
  log('╚════════════════════════════════════════════════════╝\n', 'blue');

  const tests = [
    { name: 'GitHub Access', result: results.githubAccess },
    { name: 'Latest Release', result: results.latestRelease !== null },
    { name: 'Release Assets', result: results.releaseAssets },
    { name: 'latest.yml Content', result: results.latestYml },
    { name: 'Builder Config', result: results.builderConfig },
    { name: 'Package Version', result: results.packageVersion },
  ];

  const passed = tests.filter(t => t.result).length;
  const total = tests.length;

  tests.forEach(test => {
    if (test.result) {
      success(`${test.name}: PASS`);
    } else {
      error(`${test.name}: FAIL`);
    }
  });

  log(`\n${passed}/${total} tests passed\n`, passed === total ? 'green' : 'red');

  if (passed === total) {
    success('🎉 All tests passed! Auto-update system is ready.');
  } else {
    error('❌ Some tests failed. Please fix the issues above.');

    if (!results.githubAccess) {
      warn('\n📝 Action Required: Make the GitHub repository public');
      info('   1. Go to https://github.com/TheElitesSolutions/MR5-POS/settings');
      info('   2. Scroll to "Danger Zone"');
      info('   3. Click "Change visibility" → "Make public"');
      info('   4. Run this test script again');
    }
  }
}

// Run the tests
runTests().catch(err => {
  error(`Fatal error: ${err.message}`);
  process.exit(1);
});
