import { ipcAPI } from '@/lib/ipc-api';
import { CashboxSummary, Order, OrderStatus, OrderItem } from '@/types';
import { create } from 'zustand';
import { UpdateOrderStatusRequest } from '../../shared/ipc-types';
import type { Order as BackendOrder, OrderItem as BackendOrderItem } from '../../shared/ipc-types';

// Helper function to map Backend OrderItem to Frontend OrderItem
const mapBackendOrderItem = (item: BackendOrderItem): OrderItem => ({
  ...item,
  status: item.status as OrderItem['status'], // Cast backend status to frontend type
});

// Helper function to map Backend Order to Frontend Order
const mapBackendOrderToFrontendOrder = (order: BackendOrder): Order => {
  const createdAtStr = order.createdAt instanceof Date ? order.createdAt.toISOString() : String(order.createdAt);
  const updatedAtStr = order.updatedAt instanceof Date ? order.updatedAt.toISOString() : String(order.updatedAt);

  // Debug logging for items
  console.log(`📦 Mapping order ${order.id}:`, {
    orderNumber: order.orderNumber,
    hasItems: !!order.items,
    itemsCount: order.items?.length || 0,
    items: order.items?.slice(0, 3).map(item => ({
      id: item.id,
      name: item.name || item.menuItemName,
      quantity: item.quantity,
      totalPrice: item.totalPrice
    }))
  });

  return {
    ...order,
    totalAmount: order.total, // Backend uses 'total', frontend uses 'totalAmount'
    total: order.total, // Keep both for compatibility
    status: order.status as Order['status'], // Cast backend OrderStatus enum to frontend literal type
    // Add null safety for items mapping
    items: order.items && Array.isArray(order.items)
      ? order.items.map(mapBackendOrderItem)
      : [], // Provide empty array fallback if items is null/undefined
    createdAt: createdAtStr,
    updatedAt: updatedAtStr,
  };
};

interface DateRange {
  startDate: Date;
  endDate: Date;
}

interface OrderFilters {
  status?: OrderStatus;
  tableId?: string;
  dateRange?: DateRange;
  searchTerm?: string;
}

interface OrdersState {
  orders: Order[];
  isLoading: boolean;
  error: string | null;
  filters: OrderFilters;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  cashboxSummary: CashboxSummary | null;
  _lastFetchTime: number;
  _fetchInProgress: boolean;

  // Actions
  fetchOrders: (filters?: OrderFilters) => Promise<void>;
  getOrderById: (id: string) => Promise<Order>;
  updateOrderStatus: (id: string, status: OrderStatus) => Promise<void>;
  setFilters: (filters: Partial<OrderFilters>) => void;
  setPagination: (page: number, limit?: number) => void;
  getCashboxSummary: (date: Date) => Promise<CashboxSummary>;
  closeCashbox: (
    date: Date,
    actualCashAmount?: number,
    userId?: string
  ) => Promise<CashboxSummary>;
  exportOrders: (filters?: OrderFilters) => Promise<void>;
  clearError: () => void;
}

export const useOrdersStore = create<OrdersState>((set, get) => ({
  orders: [],
  isLoading: false,
  error: null,
  filters: {},
  pagination: {
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  },
  cashboxSummary: null,
  _lastFetchTime: 0,
  _fetchInProgress: false,

  fetchOrders: async filters => {
    try {
      const currentState = get();

      // Debounce rapid successive calls (within 500ms)
      const now = Date.now();
      if (
        currentState._fetchInProgress ||
        now - currentState._lastFetchTime < 500
      ) {
        console.log('OrdersStore: Debouncing duplicate fetch call');
        return;
      }

      set({
        isLoading: true,
        error: null,
        _fetchInProgress: true,
        _lastFetchTime: now,
      });

      const { pagination } = get();
      // Build search params for the API call
      const searchParams = {
        ...(filters?.status && { status: filters.status }),
        ...(filters?.tableId && { tableId: filters.tableId }),
        ...(filters?.searchTerm && { query: filters.searchTerm }),
        ...(filters?.dateRange?.startDate && {
          dateFrom: filters.dateRange.startDate.toISOString(),
        }),
        ...(filters?.dateRange?.endDate && {
          dateTo: filters.dateRange.endDate.toISOString(),
        }),
        page: pagination.page,
        limit: pagination.limit,
      };

      // Use the search params in the API call
      console.log('Fetching orders with params:', searchParams);

      const response = await ipcAPI.order.search(searchParams);

      // Handle IPCResponse format properly
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch orders');
      }

      if (!Array.isArray(response.data)) {
        throw new Error('Invalid response data format');
      }

      // Create pagination response structure since IPC returns array
      const paginationResponse = {
        data: response.data,
        pagination: {
          page: pagination.page,
          limit: pagination.limit,
          total: response.data.length,
          totalPages: Math.ceil(response.data.length / pagination.limit),
        },
      };

      set({
        orders: paginationResponse.data.map(mapBackendOrderToFrontendOrder),
        pagination: paginationResponse.pagination,
        filters: { ...get().filters, ...filters },
        isLoading: false,
        _fetchInProgress: false,
      });
    } catch (error) {
      set({
        error:
          error instanceof Error ? error.message : 'Failed to fetch orders',
        isLoading: false,
        _fetchInProgress: false,
      });
    }
  },

  getOrderById: async id => {
    try {
      set({ isLoading: true, error: null });
      const response = await ipcAPI.order.getById(id);

      // Handle IPCResponse format properly
      if (!response.success) {
        throw new Error(response.error || 'Order not found');
      }

      if (!response.data) {
        throw new Error('Order not found');
      }

      set({ isLoading: false });
      return mapBackendOrderToFrontendOrder(response.data);
    } catch (error) {
      set({
        error:
          error instanceof Error
            ? error.message
            : 'Failed to fetch order details',
        isLoading: false,
      });
      throw error;
    }
  },

  updateOrderStatus: async (id, status) => {
    try {
      set({ isLoading: true, error: null });

      const updateRequest: UpdateOrderStatusRequest = {
        id,
        status,
      };

      await ipcAPI.order.updateStatus(updateRequest);

      // Update the order in the local state
      const { orders } = get();
      const updatedOrders = orders.map(order =>
        order.id === id ? { ...order, status } : order
      );

      set({
        orders: updatedOrders,
        isLoading: false,
      });
    } catch (error) {
      set({
        error:
          error instanceof Error
            ? error.message
            : 'Failed to update order status',
        isLoading: false,
      });
      throw error;
    }
  },

  setFilters: newFilters => {
    const { filters } = get();
    set({
      filters: { ...filters, ...newFilters },
      pagination: { ...get().pagination, page: 1 }, // Reset to first page
    });
  },

  setPagination: (page, limit) => {
    const { pagination } = get();
    set({
      pagination: {
        ...pagination,
        page,
        ...(limit && { limit }),
      },
    });
  },

  getCashboxSummary: async date => {
    try {
      set({ isLoading: true, error: null });

      const result = await ipcAPI.order.getCashboxSummary({
        date: date.toISOString(),
        businessDayStart: 6, // Restaurant business day starts at 6 AM
      });

      if (result.success && result.data) {
        // The backend now returns the full cashbox summary structure
        const cashboxSummary: CashboxSummary = {
          date: result.data.date || date.toISOString(),
          totalCash: result.data.totalCash || 0,
          totalCard: result.data.totalCard || 0, // Optional, for backwards compatibility
          // New order type totals
          dineInTotal: result.data.dineInTotal || 0,
          takeoutTotal: result.data.takeoutTotal || 0,
          deliveryTotal: result.data.deliveryTotal || 0,
          totalOrders: result.data.totalOrders || 0,
          averageOrderValue: result.data.averageOrderValue || 0,
          ordersByStatus: result.data.ordersByStatus || {
            completed: 0,
            pending: 0,
            cancelled: 0,
          },
          ordersByType: result.data.ordersByType || {
            dineIn: 0,
            takeout: 0,
            delivery: 0,
          },
          businessDayRange: result.data.businessDayRange,
          totalRevenue: result.data.totalRevenue || 0,
          orders: result.data.orders || [],
        };

        set({
          cashboxSummary,
          isLoading: false,
        });
        return cashboxSummary;
      } else {
        throw new Error(result.error || 'Failed to get cashbox summary');
      }
    } catch (error) {
      set({
        error:
          error instanceof Error
            ? error.message
            : 'Failed to get cashbox summary',
        isLoading: false,
      });
      throw error;
    }
  },

  closeCashbox: async (date, actualCashAmount, userId) => {
    try {
      set({ isLoading: true, error: null });

      const result = await ipcAPI.order.closeCashbox({
        date: date.toISOString(),
        actualCashAmount,
        userId: userId || 'system',
      });

      if (result.success && result.data) {
        // Get current cashbox summary first to get the full data
        const current = get().cashboxSummary;

        const cashboxSummary: CashboxSummary = {
          date: date.toISOString(),
          totalCash: current?.totalCash || 0,
          totalCard: current?.totalCard || 0,
          // Include new order type totals
          dineInTotal: current?.dineInTotal || 0,
          takeoutTotal: current?.takeoutTotal || 0,
          deliveryTotal: current?.deliveryTotal || 0,
          totalOrders: current?.totalOrders || 0,
          averageOrderValue: current?.averageOrderValue || 0,
          ordersByStatus: current?.ordersByStatus || {
            completed: 0,
            pending: 0,
            cancelled: 0,
          },
          ordersByType: current?.ordersByType || {
            dineIn: 0,
            takeout: 0,
            delivery: 0,
          },
          businessDayRange: current?.businessDayRange,
          totalRevenue: current?.totalRevenue || 0,
          isClosed: true,
          closedAt: new Date().toISOString(),
          closedBy: userId || 'system',
          actualCashAmount,
          variance: result.data.discrepancy || 0,
          orders: current?.orders || [],
        };

        set({
          cashboxSummary,
          isLoading: false,
        });
        return cashboxSummary;
      } else {
        throw new Error(result.error || 'Failed to close cashbox');
      }
    } catch (error) {
      set({
        error:
          error instanceof Error ? error.message : 'Failed to close cashbox',
        isLoading: false,
      });
      throw error;
    }
  },

  exportOrders: async filters => {
    try {
      set({ isLoading: true, error: null });

      // Build export params from current filters
      const exportParams = {
        ...(filters?.status && { status: filters.status }),
        ...(filters?.tableId && { tableId: filters.tableId }),
        ...(filters?.searchTerm && { query: filters.searchTerm }),
        ...(filters?.dateRange?.startDate && {
          dateFrom: filters.dateRange.startDate.toISOString(),
        }),
        ...(filters?.dateRange?.endDate && {
          dateTo: filters.dateRange.endDate.toISOString(),
        }),
      };

      console.log('Exporting orders with params:', exportParams);

      const response = await ipcAPI.order.exportOrders(exportParams);

      if (!response.success) {
        throw new Error(response.error || 'Failed to export orders');
      }

      set({ isLoading: false });

      // Show success message (using a toast if available in the calling component)
      console.log('✅ Orders exported successfully to:', response.data?.filePath);
    } catch (error) {
      set({
        error:
          error instanceof Error ? error.message : 'Failed to export orders',
        isLoading: false,
      });
      throw error;
    }
  },

  clearError: () => {
    set({ error: null });
  },
}));
