/**
 * Ultimate Thermal Receipt Printing Test
 * 
 * This script tests the enhanced receipt printing functionality
 * using the ultimate thermal solution approach.
 */

const { ipcRenderer } = require('electron');
const { PRINTER_CHANNELS } = require('../../../shared/ipc-channels');

// Sample order data for testing
const sampleOrder = {
    id: 'test-order-id',
    orderNumber: 'TEST-123',
    tableId: 'T1',
    userId: 'test-user',
    status: 'COMPLETED',
    type: 'DINE_IN',
    items: [
        {
            id: 'item1',
            name: 'Burger Deluxe',
            price: 12.99,
            quantity: 2,
            notes: 'No onions'
        },
        {
            id: 'item2',
            name: 'French Fries',
            price: 4.99,
            quantity: 1
        },
        {
            id: 'item3',
            name: 'Soda (Large)',
            price: 2.99,
            quantity: 2
        }
    ],
    subtotal: 36.95,
    tax: 3.70,
    total: 40.65,
    createdAt: new Date(),
    updatedAt: new Date()
};

/**
 * Test the ultimate thermal receipt printing
 * @param {string} printerName - Name of the printer to test
 * @returns {Promise<object>} - Test result
 */
async function testUltimateThermalReceipt(printerName) {
    console.log(`Testing ultimate thermal receipt printing on ${printerName}...`);

    try {
        // Create a test request
        const request = {
            orderId: sampleOrder.id,
            printerName,
            copies: 1,
            userId: 'test-user',
            useUltimateThermalSolution: true // Enable the ultimate solution
        };

        // Send the print request
        const result = await ipcRenderer.invoke(
            PRINTER_CHANNELS.PRINT_RECEIPT,
            request
        );

        console.log('Ultimate thermal receipt printing result:', result);
        return {
            success: result.success,
            message: result.success
                ? `Successfully printed receipt using ${result.data?.method || 'ultimate thermal solution'}`
                : `Failed to print receipt: ${result.error || 'Unknown error'}`,
            data: result.data
        };
    } catch (error) {
        console.error('Error testing ultimate thermal receipt printing:', error);
        return {
            success: false,
            message: `Error: ${error.message || error}`,
            error
        };
    }
}

// Export the test function
module.exports = {
    testUltimateThermalReceipt,
    sampleOrder
};
