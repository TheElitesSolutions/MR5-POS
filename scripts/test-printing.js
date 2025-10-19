/**
 * Printing Test Script for MR5 POS
 * Tests electron-pos-printer functionality with different configurations
 * 
 * Usage:
 *   node scripts/test-printing.js [printer-name]
 * 
 * If no printer name is provided, it will list available printers
 */

const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(70));
  log(title, 'bright');
  console.log('='.repeat(70));
}

// Get list of printers
async function getAvailablePrinters() {
  try {
    log('\n🔍 Detecting available printers...', 'cyan');
    
    const { stdout } = await execAsync(
      'powershell -command "Get-Printer | Select-Object Name, DriverName, PrinterStatus | ConvertTo-Json"',
      { timeout: 10000 }
    );

    const printers = JSON.parse(stdout);
    const printerArray = Array.isArray(printers) ? printers : [printers];
    
    logSection('AVAILABLE PRINTERS');
    printerArray.forEach((printer, index) => {
      log(`${index + 1}. ${printer.Name}`, 'green');
      log(`   Driver: ${printer.DriverName}`, 'reset');
      log(`   Status: ${printer.PrinterStatus || 'Unknown'}`, 'reset');
    });
    
    return printerArray;
  } catch (error) {
    log('❌ Failed to get printers: ' + error.message, 'red');
    return [];
  }
}

// Test 1: Simple text print
function createSimpleTestData() {
  return [
    {
      type: 'text',
      value: '<div style="text-align: center; font-size: 24px; font-weight: bold; margin-bottom: 10px;">TEST PRINT</div>',
      style: { fontFamily: 'Arial, sans-serif', width: '100%' }
    },
    {
      type: 'text',
      value: '<div style="text-align: center; font-size: 16px; margin-bottom: 20px;">MR5 POS System</div>',
      style: { fontFamily: 'Arial, sans-serif', width: '100%' }
    },
    {
      type: 'text',
      value: '<div style="font-size: 14px;">This is a diagnostic test print.</div>',
      style: { fontFamily: 'Arial, sans-serif', width: '100%' }
    },
    {
      type: 'text',
      value: '<div style="font-size: 14px; margin-bottom: 10px;">If you see this text, the printer is working!</div>',
      style: { fontFamily: 'Arial, sans-serif', width: '100%' }
    },
    {
      type: 'text',
      value: '<div style="text-align: center; font-size: 12px;">------------------------------</div>',
      style: { fontFamily: 'monospace', width: '100%' }
    },
    {
      type: 'text',
      value: `<div style="font-size: 12px;">Date: ${new Date().toLocaleString()}</div>`,
      style: { fontFamily: 'Arial, sans-serif', width: '100%' }
    },
    {
      type: 'text',
      value: '<div style="font-size: 12px; margin-top: 10px;">Test Status: SUCCESS ✓</div>',
      style: { fontFamily: 'Arial, sans-serif', width: '100%', color: 'green' }
    }
  ];
}

// Test 2: Invoice-like format
function createInvoiceTestData() {
  return [
    {
      type: 'text',
      value: '<div style="text-align: center; font-size: 20px; font-weight: bold; margin-bottom: 10px;">INVOICE</div>',
      style: { fontFamily: 'Arial, sans-serif', width: '100%' }
    },
    {
      type: 'text',
      value: '<div style="font-size: 14px;"><strong>Inv #:</strong> TEST-001</div>',
      style: { fontFamily: 'Arial, sans-serif', width: '100%' }
    },
    {
      type: 'text',
      value: `<div style="font-size: 14px;"><strong>Date:</strong> ${new Date().toLocaleDateString()}</div>`,
      style: { fontFamily: 'Arial, sans-serif', width: '100%' }
    },
    {
      type: 'text',
      value: '<div style="text-align: center; font-size: 12px; margin: 10px 0;">------------------------------</div>',
      style: { fontFamily: 'monospace', width: '100%' }
    },
    {
      type: 'text',
      value: '<div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 14px;"><span>Item</span><span>Qty</span><span>Price</span></div>',
      style: { fontFamily: 'Arial, sans-serif', width: '100%' }
    },
    {
      type: 'text',
      value: '<div style="text-align: center; font-size: 12px;">------------------------------</div>',
      style: { fontFamily: 'monospace', width: '100%' }
    },
    {
      type: 'text',
      value: '<div style="display: flex; justify-content: space-between; font-size: 12px;"><span>Test Item 1</span><span>2</span><span>$10.00</span></div>',
      style: { fontFamily: 'Arial, sans-serif', width: '100%' }
    },
    {
      type: 'text',
      value: '<div style="display: flex; justify-content: space-between; font-size: 12px;"><span>Test Item 2</span><span>1</span><span>$15.00</span></div>',
      style: { fontFamily: 'Arial, sans-serif', width: '100%' }
    },
    {
      type: 'text',
      value: '<div style="text-align: center; font-size: 12px; margin: 10px 0;">------------------------------</div>',
      style: { fontFamily: 'monospace', width: '100%' }
    },
    {
      type: 'text',
      value: '<div style="display: flex; justify-content: space-between; font-size: 14px; font-weight: bold;"><span>Total:</span><span>$35.00</span></div>',
      style: { fontFamily: 'Arial, sans-serif', width: '100%' }
    }
  ];
}

// Print options configurations to test
function getPrintOptionsConfigs(printerName) {
  return [
    {
      name: 'Preview Mode (Diagnostic)',
      options: {
        preview: true,
        silent: false,
        printerName: printerName,
        copies: 1,
        pageSize: '80mm',
        timeOutPerLine: 3000,
      }
    },
    {
      name: 'Silent Print - Standard',
      options: {
        preview: false,
        silent: true,
        printerName: printerName,
        copies: 1,
        pageSize: '80mm',
        margin: '0 0 0 0',
        timeOutPerLine: 3000,
      }
    },
    {
      name: 'Silent Print - Explicit Size',
      options: {
        preview: false,
        silent: true,
        printerName: printerName,
        copies: 1,
        pageSize: { width: 80000, height: 200000 },
        margin: '0 0 0 0',
        timeOutPerLine: 3000,
      }
    }
  ];
}

// Run print test
async function runPrintTest(printerName, testData, testName, printOptions) {
  log(`\n🖨️  Running: ${testName}`, 'cyan');
  log(`   Printer: ${printerName}`, 'reset');
  log(`   Data items: ${testData.length}`, 'reset');
  log(`   Options: ${JSON.stringify(printOptions, null, 2)}`, 'yellow');
  
  try {
    // Dynamic import to avoid issues if electron-pos-printer is not available
    const { PosPrinter } = require('electron-pos-printer');
    
    log('   Sending to printer...', 'cyan');
    const result = await PosPrinter.print(testData, printOptions);
    
    log(`   ✅ SUCCESS: ${testName}`, 'green');
    log(`   Result: ${JSON.stringify(result)}`, 'reset');
    return true;
  } catch (error) {
    log(`   ❌ FAILED: ${error.message}`, 'red');
    log(`   Stack: ${error.stack}`, 'red');
    return false;
  }
}

// Interactive menu
function displayMenu() {
  logSection('PRINTING TEST MENU');
  log('1. Test Simple Print (Preview Mode)', 'cyan');
  log('2. Test Invoice Format (Preview Mode)', 'cyan');
  log('3. Test Simple Print (Silent Mode)', 'cyan');
  log('4. Test All Configurations', 'cyan');
  log('5. List Printers', 'cyan');
  log('0. Exit', 'cyan');
}

// Main function
async function main() {
  logSection('MR5 POS - PRINTING DIAGNOSTIC TOOL');
  
  const args = process.argv.slice(2);
  let printerName = args[0];
  
  // Get available printers
  const printers = await getAvailablePrinters();
  
  if (printers.length === 0) {
    log('\n❌ No printers found. Please check your printer installation.', 'red');
    process.exit(1);
  }
  
  // If no printer specified, use the first one
  if (!printerName) {
    printerName = printers[0].Name;
    log(`\n📌 No printer specified. Using: ${printerName}`, 'yellow');
    log(`   To specify a printer, run: node scripts/test-printing.js "Printer Name"`, 'yellow');
  }
  
  // Verify electron-pos-printer is available
  try {
    require('electron-pos-printer');
    log('\n✅ electron-pos-printer is available', 'green');
  } catch (error) {
    log('\n❌ electron-pos-printer is not available!', 'red');
    log('   Run: yarn add electron-pos-printer', 'yellow');
    process.exit(1);
  }
  
  // Check if running in Electron environment
  try {
    const electron = require('electron');
    log('✅ Running in Electron environment', 'green');
  } catch (error) {
    log('⚠️  Not running in Electron environment', 'yellow');
    log('   Some features may not work outside Electron', 'yellow');
    log('   To test in Electron, use the main app: yarn dev', 'cyan');
  }
  
  logSection('RUNNING AUTOMATED TESTS');
  
  // Test 1: Preview mode with simple data
  log('\n📋 Test 1: Simple Print with Preview', 'bright');
  const simpleData = createSimpleTestData();
  const previewOptions = {
    preview: true,
    silent: false,
    printerName: printerName,
    copies: 1,
    pageSize: '80mm',
    timeOutPerLine: 3000,
  };
  
  const test1Success = await runPrintTest(
    printerName,
    simpleData,
    'Simple Print Preview',
    previewOptions
  );
  
  // Wait a bit between tests
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Test 2: Invoice format with preview
  log('\n📋 Test 2: Invoice Format with Preview', 'bright');
  const invoiceData = createInvoiceTestData();
  const test2Success = await runPrintTest(
    printerName,
    invoiceData,
    'Invoice Print Preview',
    previewOptions
  );
  
  // Summary
  logSection('TEST RESULTS SUMMARY');
  log(`Test 1 (Simple Preview): ${test1Success ? '✅ PASSED' : '❌ FAILED'}`, test1Success ? 'green' : 'red');
  log(`Test 2 (Invoice Preview): ${test2Success ? '✅ PASSED' : '❌ FAILED'}`, test2Success ? 'green' : 'red');
  
  log('\n📝 NEXT STEPS:', 'bright');
  if (test1Success || test2Success) {
    log('✅ Print preview works! This means:', 'green');
    log('   1. electron-pos-printer is working correctly', 'reset');
    log('   2. Print data is being generated properly', 'reset');
    log('   3. The issue might be with SILENT printing mode', 'reset');
    log('\n🔧 Recommended fix:', 'yellow');
    log('   Change silent mode settings in printerController.ts', 'yellow');
    log('   Or try different pageSize configurations', 'yellow');
  } else {
    log('❌ Print preview failed. Possible issues:', 'red');
    log('   1. electron-pos-printer version incompatibility', 'reset');
    log('   2. Electron version issues', 'reset');
    log('   3. Printer driver problems', 'reset');
    log('\n🔧 Try these fixes:', 'yellow');
    log('   1. Check Electron version: yarn list electron', 'yellow');
    log('   2. Try different electron-pos-printer version', 'yellow');
    log('   3. Update printer drivers', 'yellow');
  }
  
  log('\n✅ Test completed!', 'green');
}

// Run the script
if (require.main === module) {
  main().catch(error => {
    log('\n💥 Fatal error:', 'red');
    log(error.stack, 'red');
    process.exit(1);
  });
}

module.exports = { 
  getAvailablePrinters, 
  createSimpleTestData, 
  createInvoiceTestData,
  runPrintTest 
};

