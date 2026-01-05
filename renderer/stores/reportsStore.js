import { create } from 'zustand';
import { ipcAPI } from '../lib/ipc-api';
// Helper function to get date range presets
const getDateRangePreset = (preset) => {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
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
const toReportDateRange = (dateRange) => ({
    startDate: dateRange.startDate.toISOString(),
    endDate: dateRange.endDate.toISOString(),
});
export const useReportsStore = create((set, get) => ({
    // Initial state
    salesReport: null,
    inventoryReport: null,
    profitReport: null,
    isLoading: false,
    error: null,
    dateRange: getDateRangePreset('month'),
    // Actions
    fetchSalesReport: async (dateRange) => {
        try {
            set({ isLoading: true, error: null });
            // Use provided date range or current one from state
            const currentDateRange = dateRange || get().dateRange;
            const reportDateRange = toReportDateRange(currentDateRange);
            console.log('📊 Fetching sales report', { dateRange: reportDateRange });
            // Call IPC API to get sales report
            const response = await ipcAPI.report.getSalesReport(reportDateRange);
            console.log('📊 Sales report response received', {
                success: response.success,
                hasData: !!response.data,
                error: response.error,
            });
            if (!response.success) {
                const errorMsg = response.error || 'Failed to fetch sales report';
                console.error('❌ Sales report failed:', errorMsg);
                throw new Error(errorMsg);
            }
            set({
                salesReport: response.data || null,
                isLoading: false,
            });
            console.log('✅ Sales report loaded successfully');
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to fetch sales report';
            console.error('❌ Sales report error caught in store:', errorMessage, error);
            set({
                error: errorMessage,
                isLoading: false,
                salesReport: null, // Clear stale data on error
            });
        }
    },
    fetchInventoryReport: async (dateRange) => {
        try {
            set({ isLoading: true, error: null });
            // Use provided date range or current one from state
            const currentDateRange = dateRange || get().dateRange;
            const reportDateRange = toReportDateRange(currentDateRange);
            console.log('📦 Fetching inventory report', { dateRange: reportDateRange });
            // Call IPC API to get inventory report
            const response = await ipcAPI.report.getInventoryReport(reportDateRange);
            console.log('📦 Inventory report response received', {
                success: response.success,
                hasData: !!response.data,
                error: response.error,
            });
            if (!response.success) {
                const errorMsg = response.error || 'Failed to fetch inventory report';
                console.error('❌ Inventory report failed:', errorMsg);
                throw new Error(errorMsg);
            }
            set({
                inventoryReport: response.data || null,
                isLoading: false,
            });
            console.log('✅ Inventory report loaded successfully');
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to fetch inventory report';
            console.error('❌ Inventory report error caught in store:', errorMessage, error);
            set({
                error: errorMessage,
                isLoading: false,
                inventoryReport: null, // Clear stale data on error
            });
        }
    },
    exportSalesReport: async (dateRange) => {
        try {
            const currentDateRange = dateRange || get().dateRange;
            const reportDateRange = toReportDateRange(currentDateRange);
            // Call IPC API to export sales report
            const response = await ipcAPI.report.exportSalesReport(reportDateRange);
            if (!response.success) {
                throw new Error(response.error || 'Failed to export sales report');
            }
            // Success - file saved through Electron dialog
        }
        catch (error) {
            throw error instanceof Error
                ? error
                : new Error('Failed to export sales report');
        }
    },
    exportInventoryReport: async (dateRange) => {
        try {
            const currentDateRange = dateRange || get().dateRange;
            const reportDateRange = toReportDateRange(currentDateRange);
            // Call IPC API to export inventory report
            const response = await ipcAPI.report.exportInventoryReport(reportDateRange);
            if (!response.success) {
                throw new Error(response.error || 'Failed to export inventory report');
            }
            // Success - file saved through Electron dialog
        }
        catch (error) {
            throw error instanceof Error
                ? error
                : new Error('Failed to export inventory report');
        }
    },
    fetchProfitReport: async (dateRange) => {
        try {
            set({ isLoading: true, error: null });
            // Use provided date range or current one from state
            const currentDateRange = dateRange || get().dateRange;
            const reportDateRange = toReportDateRange(currentDateRange);
            console.log('💰 Fetching profit report', { dateRange: reportDateRange });
            // Call IPC API to get profit report
            const response = await ipcAPI.report.getProfitReport(reportDateRange);
            console.log('💰 Profit report response received', {
                success: response.success,
                hasData: !!response.data,
                error: response.error,
            });
            if (!response.success) {
                const errorMsg = response.error || 'Failed to fetch profit report';
                console.error('❌ Profit report failed:', errorMsg);
                throw new Error(errorMsg);
            }
            set({
                profitReport: response.data || null,
                isLoading: false,
            });
            console.log('✅ Profit report loaded successfully');
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to fetch profit report';
            console.error('❌ Profit report error caught in store:', errorMessage, error);
            set({
                error: errorMessage,
                isLoading: false,
                profitReport: null, // Clear stale data on error
            });
        }
    },
    exportProfitReport: async (dateRange) => {
        try {
            const currentDateRange = dateRange || get().dateRange;
            const reportDateRange = toReportDateRange(currentDateRange);
            // Call IPC API to export profit report
            const response = await ipcAPI.report.exportProfitReport(reportDateRange);
            if (!response.success) {
                throw new Error(response.error || 'Failed to export profit report');
            }
            // Success - file saved through Electron dialog
        }
        catch (error) {
            throw error instanceof Error
                ? error
                : new Error('Failed to export profit report');
        }
    },
    setDateRange: (dateRange) => {
        set({ dateRange });
    },
    clearError: () => {
        set({ error: null });
    },
}));
// Export helper function for external use
export { getDateRangePreset };
