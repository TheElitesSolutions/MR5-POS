import { KPIData, SalesData } from '@/types';
import { create } from 'zustand';
import { ipcAPI } from '../lib/ipc-api';

interface TopMenuItem {
  id: string;
  name: string;
  totalSold: number;
  revenue: number;
  category: string;
  profitMargin: number;
}

interface WasteMetric {
  id: string;
  itemName: string;
  quantity: number;
  unit: string;
  value: number;
  date: Date;
  reason: string;
}

interface NetProfitData {
  totalRevenue: number;
  totalCosts: number;
  netProfit: number;
  profitMargin: number;
  breakdown: {
    foodCosts: number;
    laborCosts: number;
    overheadCosts: number;
  };
}

interface DateRange {
  startDate: Date;
  endDate: Date;
  preset: 'today' | 'week' | 'month' | 'quarter' | 'custom';
}

interface ActivityMetadata {
  orderId?: string;
  tableNumber?: number;
  amount?: number;
  capacity?: number;
  itemName?: string;
  action?: string;
  reason?: string;
}

interface ActivityItem {
  id: string;
  type:
    | 'order_completed'
    | 'order_cancelled'
    | 'table_occupied'
    | 'menu_updated';
  description: string;
  timestamp: Date;
  metadata?: ActivityMetadata;
}

interface DashboardData {
  kpis: KPIData[];
  salesData: SalesData[];
  topMenuItems: TopMenuItem[];
  netProfitData?: NetProfitData; // Optional - not always returned by backend
  wasteMetrics?: WasteMetric[]; // Optional - not always returned by backend
  recentActivity: ActivityItem[];
  totalRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
  activeTables: number;
  totalCustomers?: number; // Optional - not always returned by backend
}

interface DashboardState {
  data: DashboardData | null;
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  dateRange: DateRange;

  // Actions
  fetchDashboardData: (dateRange?: DateRange) => Promise<void>;
  setDateRange: (dateRange: DateRange) => void;
  refreshData: () => Promise<void>;
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
    case 'quarter':
      const quarter = Math.floor(today.getMonth() / 3);
      const quarterStart = new Date(today.getFullYear(), quarter * 3, 1);
      return {
        startDate: quarterStart,
        endDate: endOfDay,
        preset: 'quarter',
      };
    default:
      return {
        startDate: startOfDay,
        endDate: endOfDay,
        preset: 'today',
      };
  }
};

export const useDashboardStore = create<DashboardState>((set, get) => ({
  data: null,
  isLoading: false,
  error: null,
  lastUpdated: null,
  dateRange: getDateRangePreset('today'),

  fetchDashboardData: async dateRange => {
    try {
      set({ isLoading: true, error: null });

      // Use provided date range or current one from state
      const currentDateRange = dateRange || get().dateRange;

      // Fetch real data from the API using IPC
      const dashboardData = await ipcAPI.dashboard.getData({
        startDate: currentDateRange.startDate.toISOString(),
        endDate: currentDateRange.endDate.toISOString(),
      });

      // Handle IPCResponse format properly
      if (!dashboardData.success) {
        throw new Error(
          dashboardData.error || 'Failed to fetch dashboard data'
        );
      }

      if (!dashboardData.data) {
        throw new Error('No dashboard data received');
      }

      set({
        data: dashboardData.data,
        isLoading: false,
        lastUpdated: new Date(),
        dateRange: currentDateRange,
      });
    } catch (error) {
      set({
        error:
          error instanceof Error
            ? error.message
            : 'Failed to fetch dashboard data',
        isLoading: false,
      });
    }
  },

  setDateRange: dateRange => {
    set({ dateRange });
  },

  refreshData: async () => {
    const { dateRange } = get();
    await get().fetchDashboardData(dateRange);
  },

  clearError: () => {
    set({ error: null });
  },
}));

// Export helper function for external use
export { getDateRangePreset };
export type { DateRange, NetProfitData, WasteMetric };
