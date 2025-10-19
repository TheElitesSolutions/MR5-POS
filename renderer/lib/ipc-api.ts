/**
 * IPC API for Renderer Process
 *
 * This file provides a type-safe interface for communicating with the main process.
 * It uses the standardized IPC channels and types defined in the shared directory.
 */

// Replace direct electron import with safe access through window object
import { IPC_CHANNELS } from '../../shared/ipc-channels';
import type {
  ChangePasswordRequest,
  CreateExpenseRequest,
  CreateMenuItemRequest,
  CreateOrderRequest,
  CreateTableRequest,
  DeleteMenuItemRequest,
  DashboardData,
  Expense,
  ExpenseStats,
  InventoryItem,
  IPCResponse,
  LoginRequest,
  LoginResponse,
  MenuItem,
  MenuStats,
  Order,
  OrderStats,
  Setting,
  SystemInfo,
  Table,
  UpdateExpenseRequest,
  UpdateMenuItemRequest,
  UpdateOrderRequest,
  UpdateOrderStatusRequest,
  UpdateTableRequest,
  UpdateTableStatusRequest,
  User,
  ReportDateRange,
  SalesReportData,
  InventoryReportData,
  ProfitReportData,
} from '../../shared/ipc-types';
import { retry, RetryOptions } from '@/utils/retryUtils';

/**
 * Safe access to ipcRenderer - checks if running in Electron environment
 */
const ipcRenderer =
  typeof window !== 'undefined' && window.electronAPI?.ipc
    ? window.electronAPI.ipc
    : {
        // Provide mock implementation for browser environment
        invoke: async (..._args: unknown[]) => {
          return { success: false, error: 'Not running in Electron' };
        },
      };

/**
 * Default retry options for IPC calls
 */
const DEFAULT_IPC_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  initialDelay: 250,
  maxDelay: 2000,
  factor: 2,
  jitter: true,
  retryableErrors: [
    'ERR_IPC_CHANNEL_CLOSED',
    'ERR_IPC_CONNECTION_CLOSED',
    'Channel closed',
    'Not running in Electron',
    /connection.*closed/i,
    /ipc.*error/i,
  ],
  onRetry: (error, attempt) => {
    console.warn(`IPC retry attempt ${attempt} after error:`, error.message);
  },
};

/**
 * Generic type-safe IPC invoke function with retry capabilities
 * @param channel The IPC channel to invoke
 * @param args The arguments to pass to the handler
 * @param retryOptions Options for retry behavior
 * @returns A promise that resolves to the handler's response
 */
async function typedInvoke<T>(
  channel: string,
  ...args: unknown[]
): Promise<IPCResponse<T>> {
  const lastArg = args.length > 0 ? args[args.length - 1] : undefined;

  // Check if last argument contains retry options
  let retryOpts = DEFAULT_IPC_RETRY_OPTIONS;
  let actualArgs = args;

  // If the last arg is an object with a __retryOptions property, extract it
  if (
    lastArg &&
    typeof lastArg === 'object' &&
    lastArg !== null &&
    '__retryOptions' in lastArg
  ) {
    retryOpts = {
      ...DEFAULT_IPC_RETRY_OPTIONS,
      ...(lastArg as any).__retryOptions,
    };
    // Remove the retry options from the args
    actualArgs = args.slice(0, -1);
  }

  // Use the retry utility to make the IPC call with automatic retries
  return retry(async () => {
    const result = await ipcRenderer.invoke(channel, ...actualArgs);

    // Check if result is undefined (handler not registered or failed)
    if (result === undefined || result === null) {
      throw new Error(`IPC handler for channel "${channel}" returned no response. Handler may not be registered.`);
    }

    // If the result indicates failure, throw an error to trigger a retry
    if (
      result &&
      typeof result === 'object' &&
      'success' in result &&
      result.success === false
    ) {
      if (result.error && typeof result.error === 'string') {
        // Create a proper error object with the error message
        const error = new Error(result.error);
        // Add a retry flag if this error should be retried
        if (shouldRetryError(result.error, retryOpts.retryableErrors || [])) {
          (error as any).__shouldRetry = true;
        }
        throw error;
      }
    }

    return result;
  }, retryOpts);
}

/**
 * Check if an error message indicates it should be retried
 */
function shouldRetryError(
  errorMsg: string,
  retryableErrors: (string | RegExp)[]
): boolean {
  return retryableErrors.some(pattern => {
    if (typeof pattern === 'string') {
      return errorMsg.includes(pattern);
    } else {
      return pattern.test(errorMsg);
    }
  });
}

/**
 * Creates a typed invoke function with custom retry options
 * @param options Custom retry options
 * @returns A typedInvoke function with custom retry options
 */
export function createTypedInvokeWithOptions(options: RetryOptions) {
  return function customTypedInvoke<T>(
    channel: string,
    ...args: unknown[]
  ): Promise<IPCResponse<T>> {
    // Add retry options as a special property on an object at the end
    const retryOptions = {
      __retryOptions: {
        ...DEFAULT_IPC_RETRY_OPTIONS,
        ...options,
      },
    };

    return typedInvoke<T>(channel, ...args, retryOptions);
  };
}

/**
 * Auth API
 */
export const authAPI = {
  test: () => typedInvoke<string>('mr5pos:auth:test'),

  login: (credentials: LoginRequest) =>
    typedInvoke<LoginResponse>(IPC_CHANNELS.AUTH.LOGIN, credentials),

  logout: (tokenData: { accessToken: string; refreshToken: string }) =>
    typedInvoke<void>(IPC_CHANNELS.AUTH.LOGOUT, tokenData),

  verifySession: (accessToken: string) =>
    typedInvoke<{ isAuthenticated: boolean; user?: User }>(
      IPC_CHANNELS.AUTH.VERIFY_SESSION,
      accessToken
    ),

  changePassword: (data: ChangePasswordRequest) =>
    typedInvoke<void>(IPC_CHANNELS.AUTH.CHANGE_PASSWORD, data),

  getCurrentUser: (accessToken: string) =>
    typedInvoke<User>(IPC_CHANNELS.AUTH.GET_CURRENT_USER, accessToken),

  refreshToken: (refreshToken: string) =>
    typedInvoke<{ accessToken: string; refreshToken: string }>(
      IPC_CHANNELS.AUTH.TOKEN_REFRESH,
      refreshToken
    ),
};

/**
 * Table API
 */
export const tableAPI = {
  getAll: () => typedInvoke<Table[]>(IPC_CHANNELS.TABLE.GET_ALL),

  getById: (id: string) => typedInvoke<Table>(IPC_CHANNELS.TABLE.GET_BY_ID, id),

  create: (data: CreateTableRequest) =>
    typedInvoke<Table>(IPC_CHANNELS.TABLE.CREATE, data),

  update: (data: UpdateTableRequest) =>
    typedInvoke<Table>(IPC_CHANNELS.TABLE.UPDATE, data),

  updateStatus: (data: UpdateTableStatusRequest) =>
    typedInvoke<Table>(IPC_CHANNELS.TABLE.UPDATE_STATUS, data),

  delete: (id: string) => typedInvoke<void>(IPC_CHANNELS.TABLE.DELETE, id),
};

/**
 * Retry options for critical menu operations
 */
const MENU_CRITICAL_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 5,
  initialDelay: 200,
  maxDelay: 5000,
  factor: 2,
  jitter: true,
  retryableErrors: [
    ...(DEFAULT_IPC_RETRY_OPTIONS.retryableErrors || []),
    'Failed to connect to database',
    'Database connection error',
    'Transaction error',
    'Validation error',
    /database error/i,
    /connection.*lost/i,
    /database.*lock/i,
  ],
  onRetry: (error, attempt) => {
    console.warn(
      `Critical menu operation retry attempt ${attempt} after error:`,
      error.message
    );
  },
};

/**
 * Create a version of typedInvoke with menu critical retry options
 */
const criticalInvoke = createTypedInvokeWithOptions(
  MENU_CRITICAL_RETRY_OPTIONS
);

/**
 * Menu API
 */
export const menuAPI = {
  getAll: (params?: {
    page?: number;
    pageSize?: number;
    search?: string;
    category?: string;
  }) =>
    typedInvoke<{
      items: MenuItem[];
      total: number;
      page: number;
      pageSize: number;
    }>(IPC_CHANNELS.MENU_ITEM.GET_ALL, params),

  getById: (id: string) =>
    typedInvoke<MenuItem>(IPC_CHANNELS.MENU_ITEM.GET_BY_ID, id),

  getByCategory: (
    category: string,
    params?: { page?: number; pageSize?: number }
  ) =>
    typedInvoke<{
      items: MenuItem[];
      total: number;
      page: number;
      pageSize: number;
    }>(IPC_CHANNELS.MENU_ITEM.GET_BY_CATEGORY, category, params),

  getAvailable: (params?: {
    page?: number;
    pageSize?: number;
    search?: string;
  }) =>
    typedInvoke<{
      items: MenuItem[];
      total: number;
      page: number;
      pageSize: number;
    }>(IPC_CHANNELS.MENU_ITEM.GET_AVAILABLE, params),

  create: (data: CreateMenuItemRequest) =>
    criticalInvoke<MenuItem>(IPC_CHANNELS.MENU_ITEM.CREATE, data),

  update: (data: UpdateMenuItemRequest) =>
    criticalInvoke<MenuItem>(IPC_CHANNELS.MENU_ITEM.UPDATE, data),

  delete: (data: DeleteMenuItemRequest) =>
    criticalInvoke<void>(IPC_CHANNELS.MENU_ITEM.DELETE, data),

  search: (query: string) =>
    typedInvoke<MenuItem[]>(IPC_CHANNELS.MENU_ITEM.SEARCH, query),

  getStats: () => typedInvoke<MenuStats>(IPC_CHANNELS.MENU_ITEM.GET_STATS),

  // Category-specific operations
  createCategory: (data: { name: string }) =>
    criticalInvoke<{ id: string; name: string }>(IPC_CHANNELS.MENU_ITEM.CREATE_CATEGORY, data),

  updateCategory: (data: { id: string; name: string }) =>
    criticalInvoke<{ id: string; name: string }>(IPC_CHANNELS.MENU_ITEM.UPDATE_CATEGORY, data),

  deleteCategory: (id: string) =>
    criticalInvoke<void>(IPC_CHANNELS.MENU_ITEM.DELETE_CATEGORY, id),

  getCategories: () =>
    typedInvoke<Array<{ id: string; name: string }>>(IPC_CHANNELS.MENU_ITEM.GET_CATEGORIES),
};

/**
 * Order API
 */
export const orderAPI = {
  getAll: () => typedInvoke<Order[]>(IPC_CHANNELS.ORDER.GET_ALL),

  getById: (id: string) => typedInvoke<Order>(IPC_CHANNELS.ORDER.GET_BY_ID, id),

  getByStatus: (status: string) =>
    typedInvoke<Order[]>(IPC_CHANNELS.ORDER.GET_BY_STATUS, status),

  getByType: (type: string) =>
    typedInvoke<Order[]>(IPC_CHANNELS.ORDER.GET_BY_TYPE, type),

  getByTable: (tableId: string) =>
    typedInvoke<Order[]>(IPC_CHANNELS.ORDER.GET_BY_TABLE, tableId),

  getByUser: (userId: string) =>
    typedInvoke<Order[]>(IPC_CHANNELS.ORDER.GET_BY_USER, userId),

  search: (params: {
    status?: string;
    tableId?: string;
    query?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
  }) => typedInvoke<Order[]>(IPC_CHANNELS.ORDER.SEARCH, params),

  create: (data: CreateOrderRequest) =>
    typedInvoke<Order>(IPC_CHANNELS.ORDER.CREATE, data),

  update: (data: UpdateOrderRequest) =>
    typedInvoke<Order>(IPC_CHANNELS.ORDER.UPDATE, data),

  updateStatus: (data: UpdateOrderStatusRequest) =>
    typedInvoke<Order>(IPC_CHANNELS.ORDER.UPDATE_STATUS, data),

  // POS granular item operations
  addItem: async (data: {
    orderId: string;
    item: { menuItemId: string; quantity: number; notes?: string };
    userId: string;
  }) => {
    console.log(
      '🚨 CRITICAL DIAGNOSTIC: orderAPI.addItem called DIRECTLY (bypassing POS store):',
      {
        orderId: data.orderId,
        menuItemId: data.item.menuItemId,
        quantity: data.item.quantity,
        notes: data.item.notes,
        userId: data.userId,
        timestamp: new Date().toISOString(),
        stackTrace: new Error().stack?.split('\n').slice(1, 6).join('\n'),
      }
    );

    // CRITICAL FIX: Apply the same ID synchronization logic here as in POS store
    const addResult = await typedInvoke<Order>(IPC_CHANNELS.ORDER.ADD_ITEM, data);

    if (addResult.success && addResult.data) {
      console.log(
        '✅ DIRECT API: Item added successfully, returning actual item for tracking:',
        {
          addedItemId: addResult.data?.id,
          menuItemId: data.item.menuItemId,
          actualResponse: addResult.data,
        }
      );

      // Return the response with __actualAddedItem for consistent tracking
      return {
        ...addResult,
        __actualAddedItem: addResult.data, // Include actual item for frontend tracking
      };
    }

    return addResult;
  },

  removeItem: (data: { orderId: string; itemId: string; userId: string }) =>
    typedInvoke<boolean>(IPC_CHANNELS.ORDER.REMOVE_ITEM, data),

  updateItemQuantity: (data: {
    itemId: string;
    quantity: number;
    userId: string;
  }) => typedInvoke<Order>(IPC_CHANNELS.ORDER.UPDATE_ITEM_QUANTITY, data),

  delete: (data: { id: string; userId: string; reason?: string }) =>
    typedInvoke<void>(IPC_CHANNELS.ORDER.DELETE, data),

  cancel: (data: { id: string; userId: string; reason?: string }) =>
    typedInvoke<Order>(IPC_CHANNELS.ORDER.CANCEL, data),

  getStats: () => typedInvoke<OrderStats>(IPC_CHANNELS.ORDER.GET_STATS),

  // Cashbox and daily summary methods
  getCashboxSummary: (data: { date: string; businessDayStart?: number }) =>
    typedInvoke<{ totalSales: number; ordersCount: number; paymentsByMethod: Record<string, number> }>(IPC_CHANNELS.ORDER.GET_CASHBOX_SUMMARY, data),

  closeCashbox: (data: {
    date: string;
    actualCashAmount?: number;
    userId: string;
  }) => typedInvoke<{ success: boolean; discrepancy?: number }>(IPC_CHANNELS.ORDER.CLOSE_CASHBOX, data),

  getOrdersCount: (filters?: {
    status?: string;
    startDate?: string;
    endDate?: string;
    tableId?: string;
    userId?: string;
  }) =>
    typedInvoke<{ count: number }>(
      IPC_CHANNELS.ORDER.GET_ORDERS_COUNT,
      filters
    ),

  exportOrders: (params: {
    status?: string;
    tableId?: string;
    query?: string;
    dateFrom?: string;
    dateTo?: string;
  }) => typedInvoke<{ filePath: string }>(IPC_CHANNELS.ORDER.EXPORT_ORDERS, params),
};

/**
 * Printer API
 */
export const printerAPI = {
  getAll: () => typedInvoke<Array<{ name: string; displayName: string; isDefault: boolean }>>(IPC_CHANNELS.PRINTER.GET_ALL),

  getDefault: () => typedInvoke<{ name: string; displayName: string }>(IPC_CHANNELS.PRINTER.GET_DEFAULT),

  printReceipt: (orderId: string) =>
    typedInvoke<boolean>(IPC_CHANNELS.PRINTER.PRINT_RECEIPT, orderId),

  printTestPage: (printerName: string) =>
    typedInvoke<boolean>(IPC_CHANNELS.PRINTER.PRINT_TEST_PAGE, printerName),

  // Diagnostic test print
  testPrint: (params: { printerName: string; mode?: 'preview' | 'silent' }) =>
    typedInvoke<{ success: boolean; message: string; data?: any }>(IPC_CHANNELS.PRINTER.TEST_PRINT, params),

  checkStatus: (printerName: string) =>
    typedInvoke<{ isOnline: boolean; isReady: boolean; errors?: string[] }>(IPC_CHANNELS.PRINTER.CHECK_STATUS, printerName),

  // Auto print receipt for completed orders using electron-pos-printer
  printOrderReceipt: (order: Order, options?: { printerName?: string; copies?: number }) =>
    typedInvoke<{ success: boolean; error?: string }>(
      'print-receipt',
      order,
      options
    ),
};

/**
 * Settings API
 */
export const settingsAPI = {
  getAll: () => typedInvoke<Setting[]>(IPC_CHANNELS.SETTINGS.GET_ALL),

  getByKey: (key: string) =>
    typedInvoke<Setting>(IPC_CHANNELS.SETTINGS.GET_BY_KEY, key),

  getByCategory: (category: string) =>
    typedInvoke<Setting[]>(IPC_CHANNELS.SETTINGS.GET_BY_CATEGORY, category),

  update: (data: { key: string; value: string; type?: string }) =>
    typedInvoke<void>(
      IPC_CHANNELS.SETTINGS.UPDATE,
      data.key,
      data.value,
      data.type
    ),

  updateMultiple: (data: {
    settings: {
      key: string;
      value: string;
      type?: string;
      category?: string;
    }[];
  }) => typedInvoke<void>(IPC_CHANNELS.SETTINGS.UPDATE_MULTIPLE, data.settings),

  reset: (category?: string) =>
    typedInvoke<void>(IPC_CHANNELS.SETTINGS.RESET, category),

  getTypedValue: (key: string) =>
    typedInvoke<string | number | boolean>(IPC_CHANNELS.SETTINGS.GET_TYPED_VALUE, key),
};

/**
 * System API
 */
export const systemAPI = {
  getInfo: () => typedInvoke<SystemInfo>(IPC_CHANNELS.SYSTEM.GET_INFO),

  checkForUpdates: () =>
    typedInvoke<{ updateAvailable: boolean; version?: string; releaseNotes?: string }>(IPC_CHANNELS.SYSTEM.CHECK_FOR_UPDATES),

  installUpdate: () => typedInvoke<void>(IPC_CHANNELS.SYSTEM.INSTALL_UPDATE),

  restartApp: () => typedInvoke<void>(IPC_CHANNELS.SYSTEM.RESTART_APP),

  quitApp: () => typedInvoke<void>(IPC_CHANNELS.SYSTEM.QUIT_APP),

  getDatabaseStatus: () =>
    typedInvoke<{ status: string; connected: boolean; error?: string }>(IPC_CHANNELS.SYSTEM.GET_DATABASE_STATUS),

  backupDatabase: (path?: string) =>
    typedInvoke<string>(IPC_CHANNELS.SYSTEM.BACKUP_DATABASE, path),

  restoreDatabase: (path: string) =>
    typedInvoke<void>(IPC_CHANNELS.SYSTEM.RESTORE_DATABASE, path),

  getLogs: (limit?: number) =>
    typedInvoke<Array<{ level: string; message: string; timestamp: string }>>(IPC_CHANNELS.SYSTEM.GET_LOGS, limit),
};

/**
 * Expense API
 */
export const expenseAPI = {
  getAll: (filters?: { startDate?: string; endDate?: string; category?: string }) =>
    typedInvoke<Expense[]>(IPC_CHANNELS.EXPENSE.GET_ALL, filters),

  getById: (id: string) => typedInvoke<Expense>(IPC_CHANNELS.EXPENSE.GET_BY_ID, id),

  create: (data: CreateExpenseRequest) =>
    typedInvoke<Expense>(IPC_CHANNELS.EXPENSE.CREATE, data),

  update: (id: string, data: UpdateExpenseRequest) =>
    typedInvoke<Expense>(IPC_CHANNELS.EXPENSE.UPDATE, id, data),

  delete: (id: string) => typedInvoke<void>(IPC_CHANNELS.EXPENSE.DELETE, id),

  approve: (id: string, approved: boolean) =>
    typedInvoke<Expense>(IPC_CHANNELS.EXPENSE.APPROVE, id, approved),

  getAnalytics: (filters?: { startDate?: string; endDate?: string }) =>
    typedInvoke<ExpenseStats>(IPC_CHANNELS.EXPENSE.GET_ANALYTICS, filters),
};

/**
 * Inventory API
 */
export const inventoryAPI = {
  getAllInventoryItems: () =>
    typedInvoke<InventoryItem[]>(IPC_CHANNELS.INVENTORY.GET_ALL),

  getById: (id: string) =>
    typedInvoke<InventoryItem>(IPC_CHANNELS.INVENTORY.GET_BY_ID, id),

  createInventoryItem: (data: Partial<InventoryItem>) =>
    typedInvoke<InventoryItem>(IPC_CHANNELS.INVENTORY.CREATE, data),

  updateInventoryItem: (id: string, updates: Partial<InventoryItem>) =>
    typedInvoke<InventoryItem>(IPC_CHANNELS.INVENTORY.UPDATE, { id, updates }),

  deleteInventoryItem: (id: string) =>
    typedInvoke<void>(IPC_CHANNELS.INVENTORY.DELETE, id),

  adjustStock: (id: string, adjustment: { quantity: number; reason?: string }) =>
    typedInvoke<InventoryItem>(IPC_CHANNELS.INVENTORY.ADJUST_STOCK, { id, adjustment }),

  getLowStockItems: () =>
    typedInvoke<InventoryItem[]>(IPC_CHANNELS.INVENTORY.GET_LOW_STOCK),

  getCategories: () =>
    typedInvoke<string[]>(IPC_CHANNELS.INVENTORY.GET_CATEGORIES),

  getByCategory: (category: string) =>
    typedInvoke<InventoryItem[]>('inventory:getByCategory', category),

  updateCategoryName: (oldName: string, newName: string) =>
    typedInvoke<boolean>(IPC_CHANNELS.INVENTORY.UPDATE_CATEGORY_NAME, {
      oldName,
      newName,
    }),

  getMenuItemIngredients: (menuItemId: string) =>
    typedInvoke<
      Array<{
        inventoryId: string;
        quantity: number;
        inventory?: {
          id: string;
          itemName: string;
          unit: string;
          costPerUnit: number;
        };
      }>
    >(IPC_CHANNELS.INVENTORY.GET_MENU_ITEM_INGREDIENTS, { menuItemId }),

  updateMenuItemIngredients: (
    menuItemId: string,
    ingredients: Array<{ inventoryId: string; quantity: number }>
  ) =>
    typedInvoke<{ success: boolean; message?: string }>(IPC_CHANNELS.INVENTORY.UPDATE_MENU_ITEM_INGREDIENTS, {
      menuItemId,
      ingredients,
    }),

  checkStockAvailability: (
    orderItems: Array<{ menuItemId: string; quantity: number }>
  ) =>
    typedInvoke<{
      available: boolean;
      unavailableItems: Array<{
        id: string;
        name: string;
        required: number;
        available: number;
        unit: string;
      }>;
    }>(IPC_CHANNELS.INVENTORY.CHECK_STOCK_AVAILABILITY, { orderItems }),
};

/**
 * Dashboard API
 */
export const dashboardAPI = {
  getData: (dateRange?: { startDate?: string; endDate?: string }) =>
    typedInvoke<DashboardData>(IPC_CHANNELS.DASHBOARD.GET_DATA, dateRange),
};

/**
 * Report API
 */
export const reportAPI = {
  getSalesReport: (dateRange: ReportDateRange) =>
    typedInvoke<SalesReportData>(IPC_CHANNELS.REPORT.GET_SALES_REPORT, dateRange),
  
  getInventoryReport: (dateRange: ReportDateRange) =>
    typedInvoke<InventoryReportData>(IPC_CHANNELS.REPORT.GET_INVENTORY_REPORT, dateRange),
  
  getProfitReport: (dateRange: ReportDateRange) =>
    typedInvoke<ProfitReportData>(IPC_CHANNELS.REPORT.GET_PROFIT_REPORT, dateRange),
  
  exportSalesReport: (dateRange: ReportDateRange) =>
    typedInvoke<{ filepath: string }>(IPC_CHANNELS.REPORT.EXPORT_SALES_REPORT, dateRange),
  
  exportInventoryReport: (dateRange: ReportDateRange) =>
    typedInvoke<{ filepath: string }>(IPC_CHANNELS.REPORT.EXPORT_INVENTORY_REPORT, dateRange),
  
  exportProfitReport: (dateRange: ReportDateRange) =>
    typedInvoke<{ filepath: string }>(IPC_CHANNELS.REPORT.EXPORT_PROFIT_REPORT, dateRange),
};

/**
 * Addon API
 */
export const addonAPI = {
  // Addon Group Management
  createGroup: (data: { name: string; description?: string; minSelections?: number; maxSelections?: number }) =>
    typedInvoke<{ id: string; name: string; description?: string }>(IPC_CHANNELS.ADDON.CREATE_GROUP, data),

  getGroup: (id: string) => typedInvoke<{ id: string; name: string; description?: string; addons: any[] }>(IPC_CHANNELS.ADDON.GET_GROUP, id),

  getGroups: () => typedInvoke<Array<{ id: string; name: string; description?: string }>>(IPC_CHANNELS.ADDON.GET_GROUPS),

  updateGroup: (id: string, data: { name?: string; description?: string; minSelections?: number; maxSelections?: number }) =>
    typedInvoke<{ id: string; name: string; description?: string }>(IPC_CHANNELS.ADDON.UPDATE_GROUP, id, data),

  deleteGroup: (id: string) =>
    typedInvoke<void>(IPC_CHANNELS.ADDON.DELETE_GROUP, id),

  // Addon Management
  create: (data: { name: string; price: number; groupId: string; isActive?: boolean }) => typedInvoke<{ id: string; name: string; price: number }>(IPC_CHANNELS.ADDON.CREATE, data),

  get: (id: string) => typedInvoke<{ id: string; name: string; price: number; groupId: string; isActive: boolean }>(IPC_CHANNELS.ADDON.GET, id),

  getByGroup: (groupId: string) =>
    typedInvoke<Array<{ id: string; name: string; price: number; isActive: boolean }>>(IPC_CHANNELS.ADDON.GET_BY_GROUP, groupId),

  getByCategory: (categoryId: string) =>
    typedInvoke<Array<{ id: string; name: string; price: number; groupId: string }>>(IPC_CHANNELS.ADDON.GET_BY_CATEGORY, categoryId),

  update: (id: string, data: { name?: string; price?: number; isActive?: boolean }) =>
    typedInvoke<{ id: string; name: string; price: number }>(IPC_CHANNELS.ADDON.UPDATE, id, data),

  delete: (id: string) => typedInvoke<void>(IPC_CHANNELS.ADDON.DELETE, id),

  // Category Assignment Management
  assignToCategory: (categoryId: string, groupId: string) =>
    typedInvoke<{ id: string; categoryId: string; groupId: string }>(IPC_CHANNELS.ADDON.ASSIGN_TO_CATEGORY, {
      categoryId,
      groupId,
    }),

  unassignFromCategory: (assignmentId: string) =>
    typedInvoke<void>(IPC_CHANNELS.ADDON.UNASSIGN_FROM_CATEGORY, assignmentId),

  getCategoryAssignments: () =>
    typedInvoke<Array<{ id: string; categoryId: string; groupId: string }>>(IPC_CHANNELS.ADDON.GET_CATEGORY_ASSIGNMENTS),
};

/**
 * Updater API for auto-update functionality
 */
export const updaterAPI = {
  checkForUpdates: () =>
    typedInvoke<{ updateInfo: any; checking: boolean }>(
      IPC_CHANNELS.UPDATER.CHECK_FOR_UPDATES
    ),

  downloadUpdate: () =>
    typedInvoke<{ downloading: boolean }>(IPC_CHANNELS.UPDATER.DOWNLOAD_UPDATE),

  installUpdate: () =>
    typedInvoke<{ installing: boolean }>(IPC_CHANNELS.UPDATER.INSTALL_UPDATE),

  getStatus: () =>
    typedInvoke<{
      checking: boolean;
      available: boolean;
      downloading: boolean;
      downloaded: boolean;
      error: string | null;
      updateInfo: any;
      progress: any;
      autoUpdateEnabled: boolean;
    }>(IPC_CHANNELS.UPDATER.GET_STATUS),

  setAutoUpdate: (enabled: boolean) =>
    typedInvoke<{ autoUpdateEnabled: boolean }>(
      IPC_CHANNELS.UPDATER.SET_AUTO_UPDATE,
      enabled
    ),

  cancelUpdate: () =>
    typedInvoke<{ cancelled: boolean }>(IPC_CHANNELS.UPDATER.CANCEL_UPDATE),

  skipVersion: (version: string) =>
    typedInvoke<{ skipped: boolean }>(IPC_CHANNELS.UPDATER.SKIP_VERSION, version),
};

// Export all APIs as a single object
export const ipcAPI = {
  auth: authAPI,
  table: tableAPI,
  menu: menuAPI,
  order: orderAPI,
  printer: printerAPI,
  settings: settingsAPI,
  system: systemAPI,
  expense: expenseAPI,
  inventory: inventoryAPI,
  dashboard: dashboardAPI,
  addon: addonAPI,
  report: reportAPI,
  updater: updaterAPI,
};

// Legacy export for backward compatibility
export const ipcApiClient = ipcAPI;

// Also export as default for easier importing
export default ipcAPI;
