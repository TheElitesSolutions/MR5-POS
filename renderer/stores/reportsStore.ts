import { create } from 'zustand';
import { ipcAPI } from '../lib/ipc-api';
import type {
  SalesReportData,
  InventoryReportData,
  ProfitReportData,
  ReportDateRange,
} from '../../shared/ipc-types';

export interface DateRange {
  startDate: Date;
  endDate: Date;
  preset: 'today' | 'week' | 'month' | 'year' | 'custom';
}

export interface ReportsState {
  // Data
  salesReport: SalesReportData | null;
  inventoryReport: InventoryReportData | null;
  profitReport: ProfitReportData | null;

  // UI state
  isLoading: boolean;
  error: string | null;
  dateRange: DateRange;

  // Actions
  fetchSalesReport: (dateRange?: DateRange) => Promise<void>;
  fetchInventoryReport: (dateRange?: DateRange) => Promise<void>;
  fetchProfitReport: (dateRange?: DateRange) => Promise<void>;
  exportSalesReport: (dateRange?: DateRange) => Promise<void>;
  exportInventoryReport: (dateRange?: DateRange) => Promise<void>;
  exportProfitReport: (dateRange?: DateRange) => Promise<void>;
  setDateRange: (dateRange: DateRange) => void;
  clearError: () => void;
}

// Helper function to get date range presets
const getDateRangePreset = (preset: DateRange['preset']): DateRange => {
  const today = new Date();
  const startOfDay = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );
  const endOfDay = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
    23,
    59,
    59
  );

  switch (preset) {
    case 'today':
      return {
        startDate: startOfDay,
        endDate: endOfDay,
        preset: 'today',
      };
    case 'week':
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - 6);
      weekStart.setHours(0, 0, 0, 0);
      return {
        startDate: weekStart,
        endDate: endOfDay,
        preset: 'week',
      };
    case 'month':
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      return {
        startDate: monthStart,
        endDate: endOfDay,
        preset: 'month',
      };
    case 'year':
      const yearStart = new Date(today.getFullYear(), 0, 1);
      return {
        startDate: yearStart,
        endDate: endOfDay,
        preset: 'year',
      };
    default:
      return {
        startDate: startOfDay,
        endDate: endOfDay,
        preset: 'today',
      };
  }
};

// Helper function to convert DateRange to ReportDateRange
const toReportDateRange = (dateRange: DateRange): ReportDateRange => ({
  startDate: dateRange.startDate.toISOString(),
  endDate: dateRange.endDate.toISOString(),
});

export const useReportsStore = create<ReportsState>((set, get) => ({
  // Initial state
  salesReport: null,
  inventoryReport: null,
  profitReport: null,
  isLoading: false,
  error: null,
  dateRange: getDateRangePreset('month'),

  // Actions
  fetchSalesReport: async (dateRange?: DateRange) => {
    try {
      set({ isLoading: true, error: null });

      // Use provided date range or current one from state
      const currentDateRange = dateRange || get().dateRange;
      const reportDateRange = toReportDateRange(currentDateRange);

      // Call IPC API to get sales report
      const response = await ipcAPI.report.getSalesReport(reportDateRange);

      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch sales report');
      }

      set({
        salesReport: response.data || null,
        isLoading: false,
      });
    } catch (error) {
      set({
        error:
          error instanceof Error
            ? error.message
            : 'Failed to fetch sales report',
        isLoading: false,
      });
    }
  },

  fetchInventoryReport: async (dateRange?: DateRange) => {
    try {
      set({ isLoading: true, error: null });

      // Use provided date range or current one from state
      const currentDateRange = dateRange || get().dateRange;
      const reportDateRange = toReportDateRange(currentDateRange);

      // Call IPC API to get inventory report
      const response = await ipcAPI.report.getInventoryReport(reportDateRange);

      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch inventory report');
      }

      set({
        inventoryReport: response.data || null,
        isLoading: false,
      });
    } catch (error) {
      set({
        error:
          error instanceof Error
            ? error.message
            : 'Failed to fetch inventory report',
        isLoading: false,
      });
    }
  },

  exportSalesReport: async (dateRange?: DateRange) => {
    try {
      const currentDateRange = dateRange || get().dateRange;
      const reportDateRange = toReportDateRange(currentDateRange);

      // Call IPC API to export sales report
      const response = await ipcAPI.report.exportSalesReport(reportDateRange);

      if (!response.success) {
        throw new Error(response.error || 'Failed to export sales report');
      }

      // Success - file saved through Electron dialog
    } catch (error) {
      throw error instanceof Error
        ? error
        : new Error('Failed to export sales report');
    }
  },

  exportInventoryReport: async (dateRange?: DateRange) => {
    try {
      const currentDateRange = dateRange || get().dateRange;
      const reportDateRange = toReportDateRange(currentDateRange);

      // Call IPC API to export inventory report
      const response = await ipcAPI.report.exportInventoryReport(reportDateRange);

      if (!response.success) {
        throw new Error(response.error || 'Failed to export inventory report');
      }

      // Success - file saved through Electron dialog
    } catch (error) {
      throw error instanceof Error
        ? error
        : new Error('Failed to export inventory report');
    }
  },

  fetchProfitReport: async (dateRange?: DateRange) => {
    try {
      set({ isLoading: true, error: null });

      // Use provided date range or current one from state
      const currentDateRange = dateRange || get().dateRange;
      const reportDateRange = toReportDateRange(currentDateRange);

      // Call IPC API to get profit report
      const response = await ipcAPI.report.getProfitReport(reportDateRange);

      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch profit report');
      }

      set({
        profitReport: response.data || null,
        isLoading: false,
      });
    } catch (error) {
      set({
        error:
          error instanceof Error
            ? error.message
            : 'Failed to fetch profit report',
        isLoading: false,
      });
    }
  },

  exportProfitReport: async (dateRange?: DateRange) => {
    try {
      const currentDateRange = dateRange || get().dateRange;
      const reportDateRange = toReportDateRange(currentDateRange);

      // Call IPC API to export profit report
      const response = await ipcAPI.report.exportProfitReport(reportDateRange);

      if (!response.success) {
        throw new Error(response.error || 'Failed to export profit report');
      }

      // Success - file saved through Electron dialog
    } catch (error) {
      throw error instanceof Error
        ? error
        : new Error('Failed to export profit report');
    }
  },

  setDateRange: (dateRange: DateRange) => {
    set({ dateRange });
  },

  clearError: () => {
    set({ error: null });
  },
}));

// Export helper function for external use
export { getDateRangePreset };
