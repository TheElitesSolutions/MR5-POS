/**
 * Electron-based Printing Test Script
 * This script runs within the Electron environment to test actual printing
 * 
 * Usage: Place this in your Electron app and call it via IPC
 * Or run it as part of your dev environment
 */

const path = require('path');

async function testElectronPrinting(printerName, testMode = 'preview') {
  console.log('🧪 Starting Electron Printing Test...');
  console.log(`Printer: ${printerName}`);
  console.log(`Mode: ${testMode}`);
  
  try {
    const { PosPrinter } = require('electron-pos-printer');
    
    // Create comprehensive test data
    const testData = [
      {
        type: 'text',
        value: '<style>@page { margin: 0; } body { margin: 0; padding: 0; }</style>',
        style: { display: 'none' }
      },
      {
        type: 'text',
        value: '<div style="text-align: center; font-size: 28px; font-weight: bold; margin: 20px 0;">PRINTING TEST</div>',
        style: { fontFamily: 'Arial, sans-serif', width: '100%' }
      },
      {
        type: 'text',
        value: '<div style="text-align: center; font-size: 18px; margin: 10px 0;">MR5 POS System</div>',
        style: { fontFamily: 'Arial, sans-serif', width: '100%' }
      },
      {
        type: 'text',
        value: '<div style="text-align: center; font-size: 14px; margin: 20px 0; padding: 10px; border: 2px solid black;">DIAGNOSTIC TEST - If you can read this, printing is working!</div>',
        style: { fontFamily: 'Arial, sans-serif', width: '100%' }
      },
      {
        type: 'text',
        value: '<div style="font-size: 14px; margin-top: 20px;"><strong>Test Information:</strong></div>',
        style: { fontFamily: 'Arial, sans-serif', width: '100%' }
      },
      {
        type: 'text',
        value: `<div style="font-size: 12px;">• Date: ${new Date().toLocaleString()}</div>`,
        style: { fontFamily: 'Arial, sans-serif', width: '100%' }
      },
      {
        type: 'text',
        value: `<div style="font-size: 12px;">• Printer: ${printerName}</div>`,
        style: { fontFamily: 'Arial, sans-serif', width: '100%' }
      },
      {
        type: 'text',
        value: `<div style="font-size: 12px;">• Mode: ${testMode}</div>`,
        style: { fontFamily: 'Arial, sans-serif', width: '100%' }
      },
      {
        type: 'text',
        value: `<div style="font-size: 12px;">• Electron Version: ${process.versions.electron}</div>`,
        style: { fontFamily: 'Arial, sans-serif', width: '100%' }
      },
      {
        type: 'text',
        value: `<div style="font-size: 12px;">• Node Version: ${process.versions.node}</div>`,
        style: { fontFamily: 'Arial, sans-serif', width: '100%' }
      },
      {
        type: 'text',
        value: '<div style="text-align: center; font-size: 12px; margin: 20px 0;">━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</div>',
        style: { fontFamily: 'monospace', width: '100%' }
      },
      {
        type: 'text',
        value: '<div style="font-size: 14px; margin: 10px 0;"><strong>Sample Invoice Data:</strong></div>',
        style: { fontFamily: 'Arial, sans-serif', width: '100%' }
      },
      {
        type: 'text',
        value: '<div style="display: flex; justify-content: space-between; font-size: 12px; font-weight: bold; padding: 5px 0; border-bottom: 1px solid black;"><span style="width: 50%;">Item</span><span style="width: 15%; text-align: center;">Qty</span><span style="width: 35%; text-align: right;">Price</span></div>',
        style: { fontFamily: 'Arial, sans-serif', width: '100%' }
      },
      {
        type: 'text',
        value: '<div style="display: flex; justify-content: space-between; font-size: 12px; padding: 5px 0;"><span style="width: 50%;">Test Item 1</span><span style="width: 15%; text-align: center;">2</span><span style="width: 35%; text-align: right;">$10.00</span></div>',
        style: { fontFamily: 'Arial, sans-serif', width: '100%' }
      },
      {
        type: 'text',
        value: '<div style="display: flex; justify-content: space-between; font-size: 12px; padding: 5px 0;"><span style="width: 50%;">Test Item 2</span><span style="width: 15%; text-align: center;">1</span><span style="width: 35%; text-align: right;">$15.00</span></div>',
        style: { fontFamily: 'Arial, sans-serif', width: '100%' }
      },
      {
        type: 'text',
        value: '<div style="display: flex; justify-content: space-between; font-size: 12px; padding: 5px 0;"><span style="width: 50%;">Test Item 3</span><span style="width: 15%; text-align: center;">3</span><span style="width: 35%; text-align: right;">$25.50</span></div>',
        style: { fontFamily: 'Arial, sans-serif', width: '100%' }
      },
      {
        type: 'text',
        value: '<div style="text-align: center; font-size: 12px; margin: 10px 0;">━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</div>',
        style: { fontFamily: 'monospace', width: '100%' }
      },
      {
        type: 'text',
        value: '<div style="display: flex; justify-content: space-between; font-size: 14px; font-weight: bold; padding: 10px 0;"><span>TOTAL:</span><span>$50.50</span></div>',
        style: { fontFamily: 'Arial, sans-serif', width: '100%' }
      },
      {
        type: 'text',
        value: '<div style="text-align: center; font-size: 16px; font-weight: bold; margin: 30px 0; color: green;">✓ TEST COMPLETE</div>',
        style: { fontFamily: 'Arial, sans-serif', width: '100%' }
      }
    ];
    
    console.log(`📄 Test data prepared: ${testData.length} items`);
    
    // Configure print options based on test mode
    const printOptions = {
      printerName: printerName,
      copies: 1,
      timeOutPerLine: 3000,
    };
    
    if (testMode === 'preview') {
      printOptions.preview = true;
      printOptions.silent = false;
      printOptions.pageSize = '80mm';
      console.log('🔍 Using PREVIEW mode (will show print dialog)');
    } else if (testMode === 'silent') {
      printOptions.preview = false;
      printOptions.silent = true;
      printOptions.pageSize = '80mm';
      printOptions.margin = '0 0 0 0';
      console.log('🤫 Using SILENT mode (direct to printer)');
    } else if (testMode === 'silent-explicit') {
      printOptions.preview = false;
      printOptions.silent = true;
      printOptions.pageSize = { width: 80000, height: 200000 };
      printOptions.margin = '0 0 0 0';
      console.log('🤫 Using SILENT mode with explicit dimensions');
    }
    
    console.log('Print Options:', JSON.stringify(printOptions, null, 2));
    console.log('\n🖨️  Sending to printer...\n');
    
    const result = await PosPrinter.print(testData, printOptions);
    
    console.log('✅ Print command completed successfully!');
    console.log('Result:', result);
    
    return {
      success: true,
      result: result,
      message: 'Print test completed successfully'
    };
    
  } catch (error) {
    console.error('❌ Print test failed:', error);
    console.error('Error stack:', error.stack);
    
    return {
      success: false,
      error: error.message,
      stack: error.stack
    };
  }
}

// Export for use in main process
module.exports = { testElectronPrinting };

// If running directly
if (require.main === module) {
  console.log('⚠️  This script should be run within an Electron environment');
  console.log('Please use it via the main app or through IPC');
}

