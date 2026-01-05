/**
 * Excel Export Utility for Reports
 * Generates formatted Excel files for sales and inventory reports
 */
import ExcelJS from 'exceljs';
import { enhancedLogger, LogCategory } from './enhanced-logger';
/**
 * Export sales report to Excel with formatting
 */
export async function exportSalesReportToExcel(data, filepath, dateRange) {
    try {
        enhancedLogger.info(`Exporting sales report to Excel: ${filepath}`, LogCategory.BUSINESS, 'ExcelExport');
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'MR5 POS';
        workbook.created = new Date();
        // Sheet 1: Summary
        const summarySheet = workbook.addWorksheet('Summary');
        // Title
        summarySheet.mergeCells('A1:D1');
        summarySheet.getCell('A1').value = 'Sales Report Summary';
        summarySheet.getCell('A1').font = { size: 16, bold: true };
        summarySheet.getCell('A1').alignment = { horizontal: 'center' };
        // Date Range
        summarySheet.mergeCells('A2:D2');
        summarySheet.getCell('A2').value = `Period: ${new Date(dateRange.startDate).toLocaleDateString()} - ${new Date(dateRange.endDate).toLocaleDateString()}`;
        summarySheet.getCell('A2').alignment = { horizontal: 'center' };
        // KPIs
        summarySheet.addRow([]);
        summarySheet.addRow(['Key Performance Indicators']);
        summarySheet.getCell('A4').font = { bold: true, size: 12 };
        const kpiData = [
            ['Total Revenue', data.totalRevenue, 'currency'],
            ['Total Orders', data.totalOrders, 'number'],
            ['Average Order Value', data.averageOrderValue, 'currency'],
            ['Average Items per Order', data.averageItemsPerOrder, 'number'],
        ];
        kpiData.forEach(([label, value], index) => {
            const row = summarySheet.addRow([label, value]);
            row.getCell(1).font = { bold: true };
            if (index === 0 || index === 2) {
                row.getCell(2).numFmt = '$#,##0.00';
            }
            else if (index === 3) {
                row.getCell(2).numFmt = '0.0';
            }
        });
        summarySheet.columns = [
            { width: 25 },
            { width: 20 },
            { width: 15 },
            { width: 15 },
        ];
        // Sheet 2: Orders
        const ordersSheet = workbook.addWorksheet('Orders');
        // Header
        ordersSheet.addRow(['Order Number', 'Date', 'Time', 'Type', 'Table', 'Items', 'Total']);
        const ordersHeader = ordersSheet.getRow(1);
        ordersHeader.font = { bold: true };
        ordersHeader.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF4472C4' },
        };
        ordersHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        // Data
        data.orders.forEach(order => {
            const orderDate = new Date(order.createdAt);
            const row = ordersSheet.addRow([
                order.orderNumber,
                orderDate,
                orderDate,
                order.type,
                order.table?.name || order.tableName || '-',
                order.itemCount,
                order.total,
            ]);
            row.getCell(2).numFmt = 'yyyy-mm-dd';
            row.getCell(3).numFmt = 'hh:mm AM/PM';
            row.getCell(7).numFmt = '$#,##0.00';
        });
        ordersSheet.columns = [
            { width: 15 },
            { width: 12 },
            { width: 12 },
            { width: 12 },
            { width: 15 },
            { width: 10 },
            { width: 12 },
        ];
        // Add borders
        ordersSheet.eachRow((row, rowNumber) => {
            row.eachCell((cell) => {
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' },
                };
            });
        });
        // Write file
        await workbook.xlsx.writeFile(filepath);
        enhancedLogger.info(`Sales report exported successfully to ${filepath}`, LogCategory.BUSINESS, 'ExcelExport');
    }
    catch (error) {
        enhancedLogger.error(`Failed to export sales report: ${error}`, LogCategory.ERROR, 'ExcelExport');
        throw error;
    }
}
/**
 * Export inventory report to Excel with formatting
 */
export async function exportInventoryReportToExcel(data, filepath, dateRange) {
    try {
        enhancedLogger.info(`Exporting inventory report to Excel: ${filepath}`, LogCategory.BUSINESS, 'ExcelExport');
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'MR5 POS';
        workbook.created = new Date();
        // Sheet 1: Summary
        const summarySheet = workbook.addWorksheet('Summary');
        // Title
        summarySheet.mergeCells('A1:D1');
        summarySheet.getCell('A1').value = 'Inventory Report Summary';
        summarySheet.getCell('A1').font = { size: 16, bold: true };
        summarySheet.getCell('A1').alignment = { horizontal: 'center' };
        // Date Range
        summarySheet.mergeCells('A2:D2');
        summarySheet.getCell('A2').value = `Period: ${new Date(dateRange.startDate).toLocaleDateString()} - ${new Date(dateRange.endDate).toLocaleDateString()}`;
        summarySheet.getCell('A2').alignment = { horizontal: 'center' };
        // KPIs
        summarySheet.addRow([]);
        summarySheet.addRow(['Key Performance Indicators']);
        summarySheet.getCell('A4').font = { bold: true, size: 12 };
        const kpiData = [
            ['Total Items', data.totalItems, 'number'],
            ['Total Inventory Value', data.totalInventoryValue, 'currency'],
            ['Low Stock Items', data.lowStockCount, 'number'],
            ['Out of Stock Items', data.outOfStockCount, 'number'],
        ];
        kpiData.forEach(([label, value], index) => {
            const row = summarySheet.addRow([label, value]);
            row.getCell(1).font = { bold: true };
            if (index === 1) {
                row.getCell(2).numFmt = '$#,##0.00';
            }
        });
        summarySheet.columns = [
            { width: 25 },
            { width: 20 },
            { width: 15 },
            { width: 15 },
        ];
        // Sheet 2: Current Stock
        const stockSheet = workbook.addWorksheet('Current Stock');
        // Header
        stockSheet.addRow(['Item Name', 'Category', 'Current Stock', 'Min Stock', 'Unit', 'Cost/Unit', 'Total Value', 'Status']);
        const stockHeader = stockSheet.getRow(1);
        stockHeader.font = { bold: true };
        stockHeader.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF4472C4' },
        };
        stockHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        // Data
        data.currentStock.forEach(item => {
            const row = stockSheet.addRow([
                item.name,
                item.category,
                item.currentStock,
                item.minimumStock,
                item.unit,
                item.costPerUnit,
                item.totalValue,
                item.status,
            ]);
            row.getCell(6).numFmt = '$#,##0.00';
            row.getCell(7).numFmt = '$#,##0.00';
            // Highlight status
            if (item.status === 'out') {
                row.getCell(8).fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFFF0000' },
                };
                row.getCell(8).font = { color: { argb: 'FFFFFFFF' }, bold: true };
            }
            else if (item.status === 'low') {
                row.getCell(8).fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFFFC000' },
                };
                row.getCell(8).font = { bold: true };
            }
        });
        stockSheet.columns = [
            { width: 25 },
            { width: 18 },
            { width: 15 },
            { width: 12 },
            { width: 10 },
            { width: 12 },
            { width: 15 },
            { width: 12 },
        ];
        // Add borders
        stockSheet.eachRow((row, rowNumber) => {
            row.eachCell((cell) => {
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' },
                };
            });
        });
        // Sheet 3: Low Stock Alerts
        const alertSheet = workbook.addWorksheet('Low Stock Alerts');
        // Header
        alertSheet.addRow(['Item Name', 'Category', 'Current Stock', 'Min Stock', 'Shortage', 'Unit']);
        const alertHeader = alertSheet.getRow(1);
        alertHeader.font = { bold: true };
        alertHeader.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFF0000' },
        };
        alertHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        // Data
        data.lowStockItems.forEach(item => {
            const row = alertSheet.addRow([
                item.name,
                item.category,
                item.currentStock,
                item.minimumStock,
                item.shortageAmount,
                item.unit,
            ]);
            // Highlight entire row
            row.eachCell((cell) => {
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFFFCCCC' },
                };
            });
        });
        alertSheet.columns = [
            { width: 25 },
            { width: 18 },
            { width: 15 },
            { width: 12 },
            { width: 12 },
            { width: 10 },
        ];
        // Add borders
        alertSheet.eachRow((row, rowNumber) => {
            row.eachCell((cell) => {
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' },
                };
            });
        });
        // Sheet 4: Stock Usage
        if (data.stockUsage && data.stockUsage.length > 0) {
            const usageSheet = workbook.addWorksheet('Stock Usage');
            // Header
            usageSheet.addRow(['Item Name', 'Category', 'Total Used', 'Avg Daily Usage', 'Unit']);
            const usageHeader = usageSheet.getRow(1);
            usageHeader.font = { bold: true };
            usageHeader.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF70AD47' },
            };
            usageHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            // Data
            data.stockUsage.forEach(item => {
                usageSheet.addRow([
                    item.itemName,
                    item.category,
                    item.totalUsed,
                    item.averageDaily,
                    item.unit,
                ]);
            });
            usageSheet.columns = [
                { width: 25 },
                { width: 18 },
                { width: 15 },
                { width: 18 },
                { width: 10 },
            ];
            // Add borders
            usageSheet.eachRow((row, rowNumber) => {
                row.eachCell((cell) => {
                    cell.border = {
                        top: { style: 'thin' },
                        left: { style: 'thin' },
                        bottom: { style: 'thin' },
                        right: { style: 'thin' },
                    };
                });
            });
        }
        // Write file
        await workbook.xlsx.writeFile(filepath);
        enhancedLogger.info(`Inventory report exported successfully to ${filepath}`, LogCategory.BUSINESS, 'ExcelExport');
    }
    catch (error) {
        enhancedLogger.error(`Failed to export inventory report: ${error}`, LogCategory.ERROR, 'ExcelExport');
        throw error;
    }
}
/**
 * Export profit report to Excel with formatting
 */
export async function exportProfitReportToExcel(data, filepath, dateRange) {
    try {
        enhancedLogger.info(`Exporting profit report to Excel: ${filepath}`, LogCategory.BUSINESS, 'ExcelExport');
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'MR5 POS';
        workbook.created = new Date();
        // Sheet 1: Summary
        const summarySheet = workbook.addWorksheet('Summary');
        // Title
        summarySheet.mergeCells('A1:D1');
        summarySheet.getCell('A1').value = 'Revenue & Profit Report Summary';
        summarySheet.getCell('A1').font = { size: 16, bold: true };
        summarySheet.getCell('A1').alignment = { horizontal: 'center' };
        // Date Range
        summarySheet.mergeCells('A2:D2');
        summarySheet.getCell('A2').value = `Period: ${new Date(dateRange.startDate).toLocaleDateString()} - ${new Date(dateRange.endDate).toLocaleDateString()}`;
        summarySheet.getCell('A2').alignment = { horizontal: 'center' };
        // KPIs
        summarySheet.addRow([]);
        summarySheet.addRow(['Key Performance Indicators']);
        summarySheet.getCell('A4').font = { bold: true, size: 12 };
        const kpiData = [
            ['Total Revenue', data.totalRevenue, 'currency'],
            ['Total Food Cost', data.totalFoodCost, 'currency'],
            ['Total Expenses', data.totalExpenses, 'currency'],
            ['Total Cost', data.totalCost, 'currency'],
            ['Gross Profit', data.grossProfit, 'currency'],
            ['Profit Margin', data.profitMargin, 'percentage'],
        ];
        kpiData.forEach(([label, value], index) => {
            const row = summarySheet.addRow([label, value]);
            row.getCell(1).font = { bold: true };
            if (index < 5) {
                row.getCell(2).numFmt = '$#,##0.00';
            }
            else {
                row.getCell(2).numFmt = '0.00"%"';
            }
            // Color code profit row
            if (index === 4) {
                row.getCell(2).font = { bold: true, color: { argb: data.grossProfit >= 0 ? 'FF00B050' : 'FFFF0000' } };
            }
        });
        summarySheet.columns = [
            { width: 25 },
            { width: 20 },
            { width: 15 },
            { width: 15 },
        ];
        // Sheet 2: Daily Trends
        const trendsSheet = workbook.addWorksheet('Daily Trends');
        // Header
        trendsSheet.addRow(['Date', 'Revenue', 'Food Cost', 'Expenses', 'Total Cost', 'Profit', 'Margin %']);
        const trendsHeader = trendsSheet.getRow(1);
        trendsHeader.font = { bold: true };
        trendsHeader.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF4472C4' },
        };
        trendsHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        // Data
        data.dailyTrends.forEach(trend => {
            const row = trendsSheet.addRow([
                trend.date,
                trend.revenue,
                trend.foodCost,
                trend.expenses,
                trend.totalCost,
                trend.profit,
                trend.margin,
            ]);
            row.getCell(2).numFmt = '$#,##0.00';
            row.getCell(3).numFmt = '$#,##0.00';
            row.getCell(4).numFmt = '$#,##0.00';
            row.getCell(5).numFmt = '$#,##0.00';
            row.getCell(6).numFmt = '$#,##0.00';
            row.getCell(7).numFmt = '0.00"%"';
            // Color code profit
            row.getCell(6).font = { color: { argb: trend.profit >= 0 ? 'FF00B050' : 'FFFF0000' } };
        });
        trendsSheet.columns = [
            { width: 12 },
            { width: 15 },
            { width: 15 },
            { width: 15 },
            { width: 15 },
            { width: 15 },
            { width: 12 },
        ];
        // Add borders
        trendsSheet.eachRow((row, rowNumber) => {
            row.eachCell((cell) => {
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' },
                };
            });
        });
        // Sheet 3: Item Profitability
        const itemSheet = workbook.addWorksheet('Item Profitability');
        // Header
        itemSheet.addRow(['Item Name', 'Category', 'Units Sold', 'Revenue', 'Food Cost/Unit', 'Profit/Unit', 'Total Profit', 'Margin %']);
        const itemHeader = itemSheet.getRow(1);
        itemHeader.font = { bold: true };
        itemHeader.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF70AD47' },
        };
        itemHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        // Data
        data.itemProfitability.forEach(item => {
            const row = itemSheet.addRow([
                item.itemName,
                item.category,
                item.unitsSold,
                item.revenue,
                item.foodCostPerUnit,
                item.profitPerUnit,
                item.totalProfit,
                item.margin,
            ]);
            row.getCell(4).numFmt = '$#,##0.00';
            row.getCell(5).numFmt = '$#,##0.00';
            row.getCell(6).numFmt = '$#,##0.00';
            row.getCell(7).numFmt = '$#,##0.00';
            row.getCell(8).numFmt = '0.00"%"';
            // Color code margin
            if (item.margin > 50) {
                row.getCell(8).fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFC6EFCE' },
                };
            }
            else if (item.margin >= 30) {
                row.getCell(8).fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFFFEB9C' },
                };
            }
            else if (item.margin < 30) {
                row.getCell(8).fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFFFC7CE' },
                };
            }
        });
        itemSheet.columns = [
            { width: 25 },
            { width: 18 },
            { width: 12 },
            { width: 15 },
            { width: 15 },
            { width: 15 },
            { width: 15 },
            { width: 12 },
        ];
        // Add borders
        itemSheet.eachRow((row, rowNumber) => {
            row.eachCell((cell) => {
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' },
                };
            });
        });
        // Sheet 4: Order Profitability
        const orderSheet = workbook.addWorksheet('Order Profitability');
        // Header
        orderSheet.addRow(['Order Number', 'Date', 'Type', 'Revenue', 'Food Cost', 'Allocated Expenses', 'Total Cost', 'Profit', 'Margin %']);
        const orderHeader = orderSheet.getRow(1);
        orderHeader.font = { bold: true };
        orderHeader.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFC000' },
        };
        orderHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        // Data
        data.orderProfitability.forEach(order => {
            const orderDate = new Date(order.createdAt);
            const row = orderSheet.addRow([
                order.orderNumber,
                orderDate,
                order.type,
                order.revenue,
                order.foodCost,
                order.allocatedExpenses,
                order.totalCost,
                order.profit,
                order.margin,
            ]);
            row.getCell(2).numFmt = 'yyyy-mm-dd hh:mm AM/PM';
            row.getCell(4).numFmt = '$#,##0.00';
            row.getCell(5).numFmt = '$#,##0.00';
            row.getCell(6).numFmt = '$#,##0.00';
            row.getCell(7).numFmt = '$#,##0.00';
            row.getCell(8).numFmt = '$#,##0.00';
            row.getCell(9).numFmt = '0.00"%"';
            // Color code profit
            row.getCell(8).font = { color: { argb: order.profit >= 0 ? 'FF00B050' : 'FFFF0000' } };
        });
        orderSheet.columns = [
            { width: 15 },
            { width: 20 },
            { width: 12 },
            { width: 15 },
            { width: 15 },
            { width: 18 },
            { width: 15 },
            { width: 15 },
            { width: 12 },
        ];
        // Add borders
        orderSheet.eachRow((row, rowNumber) => {
            row.eachCell((cell) => {
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' },
                };
            });
        });
        // Write file
        await workbook.xlsx.writeFile(filepath);
        enhancedLogger.info(`Profit report exported successfully to ${filepath}`, LogCategory.BUSINESS, 'ExcelExport');
    }
    catch (error) {
        enhancedLogger.error(`Failed to export profit report: ${error}`, LogCategory.ERROR, 'ExcelExport');
        throw error;
    }
}
/**
 * Export orders to Excel with formatting
 */
export async function exportOrdersToExcel(orders, filepath, dateRange) {
    try {
        enhancedLogger.info(`Exporting orders to Excel: ${filepath}`, LogCategory.BUSINESS, 'ExcelExport');
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'MR5 POS';
        workbook.created = new Date();
        // Main Sheet: Orders
        const ordersSheet = workbook.addWorksheet('Orders');
        // Title
        ordersSheet.mergeCells('A1:J1');
        ordersSheet.getCell('A1').value = 'Orders Export';
        ordersSheet.getCell('A1').font = { size: 16, bold: true };
        ordersSheet.getCell('A1').alignment = { horizontal: 'center' };
        // Date Range (if provided)
        if (dateRange) {
            ordersSheet.mergeCells('A2:J2');
            ordersSheet.getCell('A2').value = `Period: ${new Date(dateRange.startDate).toLocaleDateString()} - ${new Date(dateRange.endDate).toLocaleDateString()}`;
            ordersSheet.getCell('A2').alignment = { horizontal: 'center' };
            ordersSheet.addRow([]);
        }
        else {
            ordersSheet.addRow([]);
        }
        // Header Row
        const headerRow = ordersSheet.addRow([
            'Order Number',
            'Date',
            'Time',
            'Type',
            'Status',
            'Table',
            'Customer Name',
            'Customer Phone',
            'Items Count',
            'Total Amount'
        ]);
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        headerRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF4472C4' },
        };
        headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
        // Data Rows
        orders.forEach(order => {
            const orderDate = new Date(order.createdAt);
            const row = ordersSheet.addRow([
                order.orderNumber,
                orderDate,
                orderDate,
                order.type || 'DINE_IN',
                order.status,
                order.table?.name || '-',
                order.customerName || '-',
                order.customerPhone || '-',
                order.items?.length || 0,
                order.total || 0,
            ]);
            // Format date and time
            row.getCell(2).numFmt = 'yyyy-mm-dd';
            row.getCell(3).numFmt = 'hh:mm AM/PM';
            // Format currency
            row.getCell(10).numFmt = '$#,##0.00';
            // Color code status
            const statusCell = row.getCell(5);
            switch (order.status) {
                case 'COMPLETED':
                    statusCell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FFC6EFCE' },
                    };
                    break;
                case 'PENDING':
                    statusCell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FFFFEB9C' },
                    };
                    break;
                case 'CANCELLED':
                    statusCell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FFFFC7CE' },
                    };
                    break;
            }
        });
        // Set column widths
        ordersSheet.columns = [
            { width: 15 }, // Order Number
            { width: 12 }, // Date
            { width: 12 }, // Time
            { width: 12 }, // Type
            { width: 12 }, // Status
            { width: 15 }, // Table
            { width: 20 }, // Customer Name
            { width: 15 }, // Customer Phone
            { width: 12 }, // Items Count
            { width: 15 }, // Total Amount
        ];
        // Add borders to all cells
        ordersSheet.eachRow((row, rowNumber) => {
            row.eachCell((cell) => {
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' },
                };
            });
        });
        // Summary Sheet
        const summarySheet = workbook.addWorksheet('Summary');
        // Title
        summarySheet.mergeCells('A1:D1');
        summarySheet.getCell('A1').value = 'Export Summary';
        summarySheet.getCell('A1').font = { size: 16, bold: true };
        summarySheet.getCell('A1').alignment = { horizontal: 'center' };
        summarySheet.addRow([]);
        // Calculate summary statistics
        const totalOrders = orders.length;
        const totalRevenue = orders.reduce((sum, order) => sum + (order.total || 0), 0);
        const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
        const statusCounts = orders.reduce((acc, order) => {
            acc[order.status] = (acc[order.status] || 0) + 1;
            return acc;
        }, {});
        const typeCounts = orders.reduce((acc, order) => {
            const type = order.type || 'DINE_IN';
            acc[type] = (acc[type] || 0) + 1;
            return acc;
        }, {});
        // Summary data
        const summaryData = [
            ['Key Metrics', ''],
            ['Total Orders', totalOrders],
            ['Total Revenue', totalRevenue],
            ['Average Order Value', avgOrderValue],
            ['', ''],
            ['Orders by Status', ''],
            ...Object.entries(statusCounts).map(([status, count]) => [status, count]),
            ['', ''],
            ['Orders by Type', ''],
            ...Object.entries(typeCounts).map(([type, count]) => [type, count]),
        ];
        summaryData.forEach(([label, value], index) => {
            const row = summarySheet.addRow([label, value]);
            // Bold headers
            if (label === 'Key Metrics' || label === 'Orders by Status' || label === 'Orders by Type') {
                row.getCell(1).font = { bold: true, size: 12 };
            }
            // Format currency
            if (label === 'Total Revenue' || label === 'Average Order Value') {
                row.getCell(2).numFmt = '$#,##0.00';
            }
        });
        summarySheet.columns = [
            { width: 25 },
            { width: 20 },
        ];
        // Write file
        await workbook.xlsx.writeFile(filepath);
        enhancedLogger.info(`Orders exported successfully to ${filepath}`, LogCategory.BUSINESS, 'ExcelExport');
    }
    catch (error) {
        enhancedLogger.error(`Failed to export orders: ${error}`, LogCategory.ERROR, 'ExcelExport');
        throw error;
    }
}
