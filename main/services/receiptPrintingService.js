/**
 * Receipt Printing Service
 * Handles automatic receipt printing for completed orders using electron-pos-printer
 */
import { getResourcesPath } from '../utils/environment';
import * as path from 'path';
// Import PosPrinter from electron-pos-printer
let PosPrinter;
try {
    PosPrinter = require('electron-pos-printer').PosPrinter;
}
catch (error) {
    console.warn('electron-pos-printer not available:', error);
}
export class ReceiptPrintingService {
    constructor() {
        this.defaultPrintOptions = {
            preview: false,
            margin: '0 0 0 0',
            copies: 1,
            silent: true,
            pageSize: '80mm', // Standard thermal printer width
        };
        console.log('ReceiptPrintingService initialized');
    }
    /**
     * Print a receipt for a completed order
     */
    async printOrderReceipt(order, options) {
        if (!PosPrinter) {
            console.warn('PosPrinter not available - receipt printing disabled');
            return false;
        }
        try {
            const printData = this.generateReceiptData(order);
            const printOptions = { ...this.defaultPrintOptions, ...options };
            console.log(`Printing receipt for order ${order.orderNumber}`);
            const result = await PosPrinter.print(printData, printOptions);
            console.log('Receipt printed successfully:', result);
            return true;
        }
        catch (error) {
            console.error('Failed to print receipt:', error);
            return false;
        }
    }
    /**
     * Generate print data for an order receipt
     */
    generateReceiptData(order) {
        const receiptData = [];
        // Add CSS to eliminate print margins and save paper
        receiptData.push({
            type: 'text',
            value: '<style>@page { margin: 0; padding: 0; } @media print { body { margin: 0; padding: 0; } }</style>',
            style: { display: 'none' },
        });
        // Logo header - minimize top spacing to save paper
        const logoPath = path.join(getResourcesPath(), 'logo.png');
        receiptData.push({
            type: 'image',
            path: logoPath,
            position: 'center',
            width: '150px',
            height: '60px',
            style: {
                marginTop: '0px',
                paddingTop: '0px',
            },
        });
        receiptData.push({
            type: 'text',
            value: '========================',
            style: { textAlign: 'center', fontSize: '12px', marginTop: '0px' },
        });
        // Order information
        receiptData.push({
            type: 'text',
            value: `Order #: ${order.orderNumber}`,
            style: { fontWeight: 'bold', fontSize: '14px' },
        });
        receiptData.push({
            type: 'text',
            value: `Date: ${new Date(order.createdAt).toLocaleString()}`,
            style: { fontSize: '12px' },
        });
        if (order.tableId) {
            receiptData.push({
                type: 'text',
                value: `Table: ${order.tableId}`,
                style: { fontSize: '12px' },
            });
        }
        receiptData.push({
            type: 'text',
            value: `Type: ${order.type || 'DINE_IN'}`,
            style: { fontSize: '12px' },
        });
        receiptData.push({
            type: 'text',
            value: '------------------------',
            style: { textAlign: 'center', fontSize: '12px' },
        });
        // Items table
        if (order.items && order.items.length > 0) {
            receiptData.push({
                type: 'table',
                style: { border: 'none' },
                tableHeader: ['Item', 'Qty', 'Price', 'Total'],
                tableBody: order.items.map((item) => [
                    item.name || 'Unknown Item',
                    item.quantity.toString(),
                    `$${(item.price || item.unitPrice || 0).toFixed(2)}`,
                    `$${((item.price || item.unitPrice || 0) * item.quantity).toFixed(2)}`,
                ]),
                tableHeaderStyle: {
                    backgroundColor: '#000',
                    color: 'white',
                    fontSize: '10px',
                },
                tableBodyStyle: { border: 'none', fontSize: '10px' },
            });
        }
        receiptData.push({
            type: 'text',
            value: '------------------------',
            style: { textAlign: 'center', fontSize: '12px' },
        });
        // Totals
        const subtotal = this.calculateSubtotal(order.items || []);
        const tax = this.calculateTax(subtotal);
        const total = subtotal + tax;
        receiptData.push({
            type: 'text',
            value: `Subtotal: $${subtotal.toFixed(2)}`,
            style: { textAlign: 'right', fontSize: '12px' },
        });
        receiptData.push({
            type: 'text',
            value: `Tax: $${tax.toFixed(2)}`,
            style: { textAlign: 'right', fontSize: '12px' },
        });
        receiptData.push({
            type: 'text',
            value: `TOTAL: $${total.toFixed(2)}`,
            style: { fontWeight: 'bold', textAlign: 'right', fontSize: '14px' },
        });
        receiptData.push({
            type: 'text',
            value: '========================',
            style: { textAlign: 'center', fontSize: '12px' },
        });
        // Footer
        receiptData.push({
            type: 'text',
            value: 'Thank you for dining with us!',
            style: { textAlign: 'center', fontSize: '12px' },
        });
        receiptData.push({
            type: 'text',
            value: 'Please come again',
            style: { textAlign: 'center', fontSize: '10px' },
        });
        return receiptData;
    }
    /**
     * Calculate subtotal from order items
     */
    calculateSubtotal(items) {
        return items.reduce((sum, item) => {
            return sum + (item.price || item.unitPrice || 0) * item.quantity;
        }, 0);
    }
    /**
     * Calculate tax (always zero - no taxes in this restaurant)
     */
    calculateTax(_subtotal) {
        return 0; // No tax applied in this restaurant
    }
    /**
     * Register IPC handlers for printing
     */
    registerIPCHandlers(ipcMain) {
        ipcMain.handle('print-receipt', async (_event, order, options) => {
            try {
                const success = await this.printOrderReceipt(order, options);
                return { success, error: null };
            }
            catch (error) {
                console.error('IPC print-receipt error:', error);
                return {
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown printing error',
                };
            }
        });
        console.log('Receipt printing IPC handlers registered');
    }
}
// Export singleton instance
export const receiptPrintingService = new ReceiptPrintingService();
