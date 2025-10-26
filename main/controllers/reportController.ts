/**
 * Report Controller for mr5-POS Electron Application
 * Handles IPC communication for report generation and export
 */

import { IpcMainInvokeEvent, dialog } from 'electron';
import { BaseController } from './baseController';
import { REPORT_CHANNELS } from '../../shared/ipc-channels';
import type {
  IPCResponse,
  ReportDateRange,
  SalesReportData,
  InventoryReportData,
  ProfitReportData,
} from '../../shared/ipc-types';
import { ReportService } from '../services/reportService';
import { enhancedLogger, LogCategory } from '../utils/enhanced-logger';
import { ServiceRegistry } from '../services/serviceRegistry';
import { prisma } from '../db/prisma-wrapper';
import { getCurrentLocalDateTime } from '../utils/dateTime';

export class ReportController extends BaseController {
  private reportService: ReportService;

  constructor() {
    super();
    
    // Use ServiceRegistry for proper service instantiation
    const registry = ServiceRegistry.getInstance(prisma as any);
    this.reportService = registry.registerService(ReportService);
  }

  protected registerHandlers(): void {
    // Get sales report
    this.registerHandler(
      REPORT_CHANNELS.GET_SALES_REPORT,
      this.getSalesReport.bind(this)
    );

    // Get inventory report
    this.registerHandler(
      REPORT_CHANNELS.GET_INVENTORY_REPORT,
      this.getInventoryReport.bind(this)
    );

    // Export sales report
    this.registerHandler(
      REPORT_CHANNELS.EXPORT_SALES_REPORT,
      this.exportSalesReport.bind(this)
    );

    // Export inventory report
    this.registerHandler(
      REPORT_CHANNELS.EXPORT_INVENTORY_REPORT,
      this.exportInventoryReport.bind(this)
    );

    // Get profit report
    this.registerHandler(
      REPORT_CHANNELS.GET_PROFIT_REPORT,
      this.getProfitReport.bind(this)
    );

    // Export profit report
    this.registerHandler(
      REPORT_CHANNELS.EXPORT_PROFIT_REPORT,
      this.exportProfitReport.bind(this)
    );

    enhancedLogger.info(
      'ReportController initialized with report generation and export capabilities',
      LogCategory.SYSTEM,
      'ReportController'
    );
  }

  /**
   * Get sales report for given date range
   */
  private async getSalesReport(
    _event: IpcMainInvokeEvent,
    dateRange: ReportDateRange
  ): Promise<IPCResponse<SalesReportData>> {
    enhancedLogger.info(
      `Getting sales report from ${dateRange.startDate} to ${dateRange.endDate}`,
      LogCategory.BUSINESS,
      'ReportController'
    );

    return await this.reportService.getSalesReport(dateRange);
  }

  /**
   * Get inventory report for given date range
   */
  private async getInventoryReport(
    _event: IpcMainInvokeEvent,
    dateRange: ReportDateRange
  ): Promise<IPCResponse<InventoryReportData>> {
    enhancedLogger.info(
      `Getting inventory report from ${dateRange.startDate} to ${dateRange.endDate}`,
      LogCategory.BUSINESS,
      'ReportController'
    );

    return await this.reportService.getInventoryReport(dateRange);
  }

  /**
   * Export sales report to Excel
   */
  private async exportSalesReport(
    event: IpcMainInvokeEvent,
    dateRange: ReportDateRange
  ): Promise<IPCResponse<{ filepath: string }>> {
    try {
      enhancedLogger.info(
        'Exporting sales report to Excel',
        LogCategory.BUSINESS,
        'ReportController'
      );

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

      enhancedLogger.info(
        `Sales report exported successfully to ${result.filePath}`,
        LogCategory.BUSINESS,
        'ReportController'
      );

      return {
        success: true,
        data: { filepath: result.filePath },
        timestamp: getCurrentLocalDateTime(),
      };
    } catch (error) {
      enhancedLogger.error(
        `Failed to export sales report: ${error}`,
        LogCategory.ERROR,
        'ReportController'
      );
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
  private async exportInventoryReport(
    event: IpcMainInvokeEvent,
    dateRange: ReportDateRange
  ): Promise<IPCResponse<{ filepath: string }>> {
    try {
      enhancedLogger.info(
        'Exporting inventory report to Excel',
        LogCategory.BUSINESS,
        'ReportController'
      );

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

      enhancedLogger.info(
        `Inventory report exported successfully to ${result.filePath}`,
        LogCategory.BUSINESS,
        'ReportController'
      );

      return {
        success: true,
        data: { filepath: result.filePath },
        timestamp: getCurrentLocalDateTime(),
      };
    } catch (error) {
      enhancedLogger.error(
        `Failed to export inventory report: ${error}`,
        LogCategory.ERROR,
        'ReportController'
      );
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
  private async getProfitReport(
    _event: IpcMainInvokeEvent,
    dateRange: ReportDateRange
  ): Promise<IPCResponse<ProfitReportData>> {
    enhancedLogger.info(
      `Getting profit report from ${dateRange.startDate} to ${dateRange.endDate}`,
      LogCategory.BUSINESS,
      'ReportController'
    );

    return await this.reportService.getProfitReport(dateRange);
  }

  /**
   * Export profit report to Excel
   */
  private async exportProfitReport(
    event: IpcMainInvokeEvent,
    dateRange: ReportDateRange
  ): Promise<IPCResponse<{ filepath: string }>> {
    try {
      enhancedLogger.info(
        'Exporting profit report to Excel',
        LogCategory.BUSINESS,
        'ReportController'
      );

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

      enhancedLogger.info(
        `Profit report exported successfully to ${result.filePath}`,
        LogCategory.BUSINESS,
        'ReportController'
      );

      return {
        success: true,
        data: { filepath: result.filePath },
        timestamp: getCurrentLocalDateTime(),
      };
    } catch (error) {
      enhancedLogger.error(
        `Failed to export profit report: ${error}`,
        LogCategory.ERROR,
        'ReportController'
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to export profit report',
        timestamp: getCurrentLocalDateTime(),
      };
    }
  }
}

