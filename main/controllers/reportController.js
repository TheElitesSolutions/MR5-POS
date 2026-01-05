/**
 * Report Controller for mr5-POS Electron Application
 * Handles IPC communication for report generation and export
 */
import { dialog } from 'electron';
import { randomUUID } from 'crypto';
import { BaseController } from './baseController';
import { REPORT_CHANNELS } from '../../shared/ipc-channels';
import { ReportService } from '../services/reportService';
import { enhancedLogger, LogCategory } from '../utils/enhanced-logger';
import { ServiceRegistry } from '../services/serviceRegistry';
import { prisma } from '../db/prisma-wrapper';
import { getCurrentLocalDateTime } from '../utils/dateTime';
export class ReportController extends BaseController {
    constructor() {
        super();
        // Use ServiceRegistry for proper service instantiation
        const registry = ServiceRegistry.getInstance(prisma);
        this.reportService = registry.registerService(ReportService);
    }
    registerHandlers() {
        // Get sales report
        this.registerHandler(REPORT_CHANNELS.GET_SALES_REPORT, this.getSalesReport.bind(this));
        // Get inventory report
        this.registerHandler(REPORT_CHANNELS.GET_INVENTORY_REPORT, this.getInventoryReport.bind(this));
        // Export sales report
        this.registerHandler(REPORT_CHANNELS.EXPORT_SALES_REPORT, this.exportSalesReport.bind(this));
        // Export inventory report
        this.registerHandler(REPORT_CHANNELS.EXPORT_INVENTORY_REPORT, this.exportInventoryReport.bind(this));
        // Get profit report
        this.registerHandler(REPORT_CHANNELS.GET_PROFIT_REPORT, this.getProfitReport.bind(this));
        // Export profit report
        this.registerHandler(REPORT_CHANNELS.EXPORT_PROFIT_REPORT, this.exportProfitReport.bind(this));
        enhancedLogger.info('ReportController initialized with report generation and export capabilities', LogCategory.SYSTEM, 'ReportController');
    }
    /**
     * Get sales report for given date range
     */
    async getSalesReport(_event, dateRange) {
        const requestId = randomUUID();
        const startTime = performance.now();
        enhancedLogger.info(`[${requestId}] Getting sales report from ${dateRange.startDate} to ${dateRange.endDate}`, LogCategory.BUSINESS, 'ReportController');
        try {
            const result = await this.reportService.getSalesReport(dateRange);
            const duration = (performance.now() - startTime).toFixed(2);
            if (result.success) {
                enhancedLogger.info(`[${requestId}] Sales report completed successfully in ${duration}ms`, LogCategory.BUSINESS, 'ReportController');
            }
            else {
                enhancedLogger.warn(`[${requestId}] Sales report failed in ${duration}ms: ${result.error}`, LogCategory.BUSINESS, 'ReportController');
            }
            return result;
        }
        catch (error) {
            const duration = (performance.now() - startTime).toFixed(2);
            enhancedLogger.error(`[${requestId}] Sales report error after ${duration}ms: ${error}`, LogCategory.BUSINESS, 'ReportController');
            throw error; // Re-throw to ensure IPC layer catches
        }
    }
    /**
     * Get inventory report for given date range
     */
    async getInventoryReport(_event, dateRange) {
        const requestId = randomUUID();
        const startTime = performance.now();
        enhancedLogger.info(`[${requestId}] Getting inventory report from ${dateRange.startDate} to ${dateRange.endDate}`, LogCategory.BUSINESS, 'ReportController');
        try {
            const result = await this.reportService.getInventoryReport(dateRange);
            const duration = (performance.now() - startTime).toFixed(2);
            if (result.success) {
                enhancedLogger.info(`[${requestId}] Inventory report completed successfully in ${duration}ms`, LogCategory.BUSINESS, 'ReportController');
            }
            else {
                enhancedLogger.warn(`[${requestId}] Inventory report failed in ${duration}ms: ${result.error}`, LogCategory.BUSINESS, 'ReportController');
            }
            return result;
        }
        catch (error) {
            const duration = (performance.now() - startTime).toFixed(2);
            enhancedLogger.error(`[${requestId}] Inventory report error after ${duration}ms: ${error}`, LogCategory.BUSINESS, 'ReportController');
            throw error; // Re-throw to ensure IPC layer catches
        }
    }
    /**
     * Export sales report to Excel
     */
    async exportSalesReport(event, dateRange) {
        try {
            enhancedLogger.info('Exporting sales report to Excel', LogCategory.BUSINESS, 'ReportController');
            // Get the sales report data
            const reportResponse = await this.reportService.getSalesReport(dateRange);
            if (!reportResponse.success || !reportResponse.data) {
                throw new Error(reportResponse.error || 'Failed to generate sales report');
            }
            // Show save dialog
            const result = await dialog.showSaveDialog({
                title: 'Export Sales Report',
                defaultPath: `sales-report-${getCurrentLocalDateTime().split('T')[0]}.xlsx`,
                filters: [
                    { name: 'Excel Files', extensions: ['xlsx'] },
                    { name: 'All Files', extensions: ['*'] },
                ],
            });
            if (result.canceled || !result.filePath) {
                return {
                    success: false,
                    error: 'Export cancelled by user',
                    timestamp: getCurrentLocalDateTime(),
                };
            }
            // Import the Excel export utility dynamically
            const { exportSalesReportToExcel } = await import('../utils/excelExport');
            // Generate Excel file
            await exportSalesReportToExcel(reportResponse.data, result.filePath, dateRange);
            enhancedLogger.info(`Sales report exported successfully to ${result.filePath}`, LogCategory.BUSINESS, 'ReportController');
            return {
                success: true,
                data: { filepath: result.filePath },
                timestamp: getCurrentLocalDateTime(),
            };
        }
        catch (error) {
            enhancedLogger.error(`Failed to export sales report: ${error}`, LogCategory.ERROR, 'ReportController');
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to export sales report',
                timestamp: getCurrentLocalDateTime(),
            };
        }
    }
    /**
     * Export inventory report to Excel
     */
    async exportInventoryReport(event, dateRange) {
        try {
            enhancedLogger.info('Exporting inventory report to Excel', LogCategory.BUSINESS, 'ReportController');
            // Get the inventory report data
            const reportResponse = await this.reportService.getInventoryReport(dateRange);
            if (!reportResponse.success || !reportResponse.data) {
                throw new Error(reportResponse.error || 'Failed to generate inventory report');
            }
            // Show save dialog
            const result = await dialog.showSaveDialog({
                title: 'Export Inventory Report',
                defaultPath: `inventory-report-${getCurrentLocalDateTime().split('T')[0]}.xlsx`,
                filters: [
                    { name: 'Excel Files', extensions: ['xlsx'] },
                    { name: 'All Files', extensions: ['*'] },
                ],
            });
            if (result.canceled || !result.filePath) {
                return {
                    success: false,
                    error: 'Export cancelled by user',
                    timestamp: getCurrentLocalDateTime(),
                };
            }
            // Import the Excel export utility dynamically
            const { exportInventoryReportToExcel } = await import('../utils/excelExport');
            // Generate Excel file
            await exportInventoryReportToExcel(reportResponse.data, result.filePath, dateRange);
            enhancedLogger.info(`Inventory report exported successfully to ${result.filePath}`, LogCategory.BUSINESS, 'ReportController');
            return {
                success: true,
                data: { filepath: result.filePath },
                timestamp: getCurrentLocalDateTime(),
            };
        }
        catch (error) {
            enhancedLogger.error(`Failed to export inventory report: ${error}`, LogCategory.ERROR, 'ReportController');
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to export inventory report',
                timestamp: getCurrentLocalDateTime(),
            };
        }
    }
    /**
     * Get profit report for given date range
     */
    async getProfitReport(_event, dateRange) {
        const requestId = randomUUID();
        const startTime = performance.now();
        enhancedLogger.info(`[${requestId}] Getting profit report from ${dateRange.startDate} to ${dateRange.endDate}`, LogCategory.BUSINESS, 'ReportController');
        try {
            const result = await this.reportService.getProfitReport(dateRange);
            const duration = (performance.now() - startTime).toFixed(2);
            if (result.success) {
                enhancedLogger.info(`[${requestId}] Profit report completed successfully in ${duration}ms`, LogCategory.BUSINESS, 'ReportController');
            }
            else {
                enhancedLogger.warn(`[${requestId}] Profit report failed in ${duration}ms: ${result.error}`, LogCategory.BUSINESS, 'ReportController');
            }
            return result;
        }
        catch (error) {
            const duration = (performance.now() - startTime).toFixed(2);
            enhancedLogger.error(`[${requestId}] Profit report error after ${duration}ms: ${error}`, LogCategory.BUSINESS, 'ReportController');
            throw error; // Re-throw to ensure IPC layer catches
        }
    }
    /**
     * Export profit report to Excel
     */
    async exportProfitReport(event, dateRange) {
        try {
            enhancedLogger.info('Exporting profit report to Excel', LogCategory.BUSINESS, 'ReportController');
            // Get the profit report data
            const reportResponse = await this.reportService.getProfitReport(dateRange);
            if (!reportResponse.success || !reportResponse.data) {
                throw new Error(reportResponse.error || 'Failed to generate profit report');
            }
            // Show save dialog
            const result = await dialog.showSaveDialog({
                title: 'Export Profit Report',
                defaultPath: `profit-report-${getCurrentLocalDateTime().split('T')[0]}.xlsx`,
                filters: [
                    { name: 'Excel Files', extensions: ['xlsx'] },
                    { name: 'All Files', extensions: ['*'] },
                ],
            });
            if (result.canceled || !result.filePath) {
                return {
                    success: false,
                    error: 'Export cancelled by user',
                    timestamp: getCurrentLocalDateTime(),
                };
            }
            // Import the Excel export utility dynamically
            const { exportProfitReportToExcel } = await import('../utils/excelExport');
            // Generate Excel file
            await exportProfitReportToExcel(reportResponse.data, result.filePath, dateRange);
            enhancedLogger.info(`Profit report exported successfully to ${result.filePath}`, LogCategory.BUSINESS, 'ReportController');
            return {
                success: true,
                data: { filepath: result.filePath },
                timestamp: getCurrentLocalDateTime(),
            };
        }
        catch (error) {
            enhancedLogger.error(`Failed to export profit report: ${error}`, LogCategory.ERROR, 'ReportController');
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to export profit report',
                timestamp: getCurrentLocalDateTime(),
            };
        }
    }
}
