/**
 * IPC API for Renderer Process
 *
 * This file provides a type-safe interface for communicating with the main process.
 * It uses the standardized IPC channels and types defined in the shared directory.
 */
// Replace direct electron import with safe access through window object
import { IPC_CHANNELS } from '../../shared/ipc-channels';
import { retry } from '@/utils/retryUtils';
/**
 * Safe access to ipcRenderer - checks if running in Electron environment
 */
const ipcRenderer = typeof window !== 'undefined' && window.electronAPI?.ipc
    ? window.electronAPI.ipc
    : {
        // Provide mock implementation for browser environment
        invoke: async (..._args) => {
            return { success: false, error: 'Not running in Electron' };
        },
    };
/**
 * Default retry options for IPC calls
 */
const DEFAULT_IPC_RETRY_OPTIONS = {
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
async function typedInvoke(channel, ...args) {
    const lastArg = args.length > 0 ? args[args.length - 1] : undefined;
    // Check if last argument contains retry options
    let retryOpts = DEFAULT_IPC_RETRY_OPTIONS;
    let actualArgs = args;
    // If the last arg is an object with a __retryOptions property, extract it
    if (lastArg &&
        typeof lastArg === 'object' &&
        lastArg !== null &&
        '__retryOptions' in lastArg) {
        retryOpts = {
            ...DEFAULT_IPC_RETRY_OPTIONS,
            ...lastArg.__retryOptions,
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
        if (result &&
            typeof result === 'object' &&
            'success' in result &&
            result.success === false) {
            if (result.error && typeof result.error === 'string') {
                // Create a proper error object with the error message
                const error = new Error(result.error);
                // Add a retry flag if this error should be retried
                if (shouldRetryError(result.error, retryOpts.retryableErrors || [])) {
                    error.__shouldRetry = true;
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
function shouldRetryError(errorMsg, retryableErrors) {
    return retryableErrors.some(pattern => {
        if (typeof pattern === 'string') {
            return errorMsg.includes(pattern);
        }
        else {
            return pattern.test(errorMsg);
        }
    });
}
/**
 * Creates a typed invoke function with custom retry options
 * @param options Custom retry options
 * @returns A typedInvoke function with custom retry options
 */
export function createTypedInvokeWithOptions(options) {
    return function customTypedInvoke(channel, ...args) {
        // Add retry options as a special property on an object at the end
        const retryOptions = {
            __retryOptions: {
                ...DEFAULT_IPC_RETRY_OPTIONS,
                ...options,
            },
        };
        return typedInvoke(channel, ...args, retryOptions);
    };
}
/**
 * Auth API
 */
export const authAPI = {
    test: () => typedInvoke('mr5pos:auth:test'),
    login: (credentials) => typedInvoke(IPC_CHANNELS.AUTH.LOGIN, credentials),
    logout: (tokenData) => typedInvoke(IPC_CHANNELS.AUTH.LOGOUT, tokenData),
    verifySession: (accessToken) => typedInvoke(IPC_CHANNELS.AUTH.VERIFY_SESSION, accessToken),
    changePassword: (data) => typedInvoke(IPC_CHANNELS.AUTH.CHANGE_PASSWORD, data),
    getCurrentUser: (accessToken) => typedInvoke(IPC_CHANNELS.AUTH.GET_CURRENT_USER, accessToken),
    refreshToken: (refreshToken) => typedInvoke(IPC_CHANNELS.AUTH.TOKEN_REFRESH, refreshToken),
};
/**
 * Table API
 */
export const tableAPI = {
    getAll: () => typedInvoke(IPC_CHANNELS.TABLE.GET_ALL),
    getById: (id) => typedInvoke(IPC_CHANNELS.TABLE.GET_BY_ID, id),
    create: (data) => typedInvoke(IPC_CHANNELS.TABLE.CREATE, data),
    update: (data) => typedInvoke(IPC_CHANNELS.TABLE.UPDATE, data),
    updateStatus: (data) => typedInvoke(IPC_CHANNELS.TABLE.UPDATE_STATUS, data),
    delete: (id) => typedInvoke(IPC_CHANNELS.TABLE.DELETE, id),
    togglePayLater: (id) => typedInvoke(IPC_CHANNELS.TABLE.TOGGLE_PAY_LATER, id),
};
/**
 * Retry options for critical menu operations
 */
const MENU_CRITICAL_RETRY_OPTIONS = {
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
        console.warn(`Critical menu operation retry attempt ${attempt} after error:`, error.message);
    },
};
/**
 * Create a version of typedInvoke with menu critical retry options
 */
const criticalInvoke = createTypedInvokeWithOptions(MENU_CRITICAL_RETRY_OPTIONS);
/**
 * Menu API
 */
export const menuAPI = {
    getAll: (params) => typedInvoke(IPC_CHANNELS.MENU_ITEM.GET_ALL, params),
    getById: (id) => typedInvoke(IPC_CHANNELS.MENU_ITEM.GET_BY_ID, id),
    getByCategory: (category, params) => typedInvoke(IPC_CHANNELS.MENU_ITEM.GET_BY_CATEGORY, category, params),
    getAvailable: (params) => typedInvoke(IPC_CHANNELS.MENU_ITEM.GET_AVAILABLE, params),
    create: (data) => criticalInvoke(IPC_CHANNELS.MENU_ITEM.CREATE, data),
    update: (data) => criticalInvoke(IPC_CHANNELS.MENU_ITEM.UPDATE, data),
    delete: (data) => criticalInvoke(IPC_CHANNELS.MENU_ITEM.DELETE, data),
    search: (query) => typedInvoke(IPC_CHANNELS.MENU_ITEM.SEARCH, query),
    getStats: () => typedInvoke(IPC_CHANNELS.MENU_ITEM.GET_STATS),
    // Category-specific operations
    createCategory: (data) => criticalInvoke(IPC_CHANNELS.MENU_ITEM.CREATE_CATEGORY, data),
    updateCategory: (data) => criticalInvoke(IPC_CHANNELS.MENU_ITEM.UPDATE_CATEGORY, data),
    deleteCategory: (id) => criticalInvoke(IPC_CHANNELS.MENU_ITEM.DELETE_CATEGORY, id),
    getCategories: () => typedInvoke(IPC_CHANNELS.MENU_ITEM.GET_CATEGORIES),
};
/**
 * Order API
 */
export const orderAPI = {
    getAll: () => typedInvoke(IPC_CHANNELS.ORDER.GET_ALL),
    getById: (id) => typedInvoke(IPC_CHANNELS.ORDER.GET_BY_ID, id),
    getByStatus: (status) => typedInvoke(IPC_CHANNELS.ORDER.GET_BY_STATUS, status),
    getByType: (type) => typedInvoke(IPC_CHANNELS.ORDER.GET_BY_TYPE, type),
    getByTable: (tableId) => typedInvoke(IPC_CHANNELS.ORDER.GET_BY_TABLE, tableId),
    getByUser: (userId) => typedInvoke(IPC_CHANNELS.ORDER.GET_BY_USER, userId),
    search: (params) => typedInvoke(IPC_CHANNELS.ORDER.SEARCH, params),
    create: (data) => typedInvoke(IPC_CHANNELS.ORDER.CREATE, data),
    update: (data) => typedInvoke(IPC_CHANNELS.ORDER.UPDATE, data),
    updateStatus: (data) => typedInvoke(IPC_CHANNELS.ORDER.UPDATE_STATUS, data),
    // POS granular item operations
    addItem: async (data) => {
        console.log('🚨 CRITICAL DIAGNOSTIC: orderAPI.addItem called DIRECTLY (bypassing POS store):', {
            orderId: data.orderId,
            menuItemId: data.item.menuItemId,
            quantity: data.item.quantity,
            notes: data.item.notes,
            userId: data.userId,
            timestamp: new Date().toISOString(),
            stackTrace: new Error().stack?.split('\n').slice(1, 6).join('\n'),
        });
        // CRITICAL FIX: Apply the same ID synchronization logic here as in POS store
        const addResult = await typedInvoke(IPC_CHANNELS.ORDER.ADD_ITEM, data);
        if (addResult.success && addResult.data) {
            console.log('✅ DIRECT API: Item added successfully, returning actual item for tracking:', {
                addedItemId: addResult.data?.id,
                menuItemId: data.item.menuItemId,
                actualResponse: addResult.data,
            });
            // Return the response with __actualAddedItem for consistent tracking
            return {
                ...addResult,
                __actualAddedItem: addResult.data, // Include actual item for frontend tracking
            };
        }
        return addResult;
    },
    removeItem: (data) => typedInvoke(IPC_CHANNELS.ORDER.REMOVE_ITEM, data),
    updateItemQuantity: (data) => typedInvoke(IPC_CHANNELS.ORDER.UPDATE_ITEM_QUANTITY, data),
    delete: (data) => typedInvoke(IPC_CHANNELS.ORDER.DELETE, data),
    cancel: (data) => typedInvoke(IPC_CHANNELS.ORDER.CANCEL, data),
    getStats: () => typedInvoke(IPC_CHANNELS.ORDER.GET_STATS),
    // Cashbox and daily summary methods
    getCashboxSummary: (data) => typedInvoke(IPC_CHANNELS.ORDER.GET_CASHBOX_SUMMARY, data),
    closeCashbox: (data) => typedInvoke(IPC_CHANNELS.ORDER.CLOSE_CASHBOX, data),
    getOrdersCount: (filters) => typedInvoke(IPC_CHANNELS.ORDER.GET_ORDERS_COUNT, filters),
    exportOrders: (params) => typedInvoke(IPC_CHANNELS.ORDER.EXPORT_ORDERS, params),
};
/**
 * Printer API
 */
export const printerAPI = {
    getAll: () => typedInvoke(IPC_CHANNELS.PRINTER.GET_ALL),
    getDefault: () => typedInvoke(IPC_CHANNELS.PRINTER.GET_DEFAULT),
    printReceipt: (orderId) => typedInvoke(IPC_CHANNELS.PRINTER.PRINT_RECEIPT, orderId),
    printTestPage: (printerName) => typedInvoke(IPC_CHANNELS.PRINTER.PRINT_TEST_PAGE, printerName),
    // Diagnostic test print
    testPrint: (params) => typedInvoke(IPC_CHANNELS.PRINTER.TEST_PRINT, params),
    checkStatus: (printerName) => typedInvoke(IPC_CHANNELS.PRINTER.CHECK_STATUS, printerName),
    // Auto print receipt for completed orders using electron-pos-printer
    printOrderReceipt: (order, options) => typedInvoke('print-receipt', order, options),
};
/**
 * Settings API
 */
export const settingsAPI = {
    getAll: () => typedInvoke(IPC_CHANNELS.SETTINGS.GET_ALL),
    getByKey: (key) => typedInvoke(IPC_CHANNELS.SETTINGS.GET_BY_KEY, key),
    getByCategory: (category) => typedInvoke(IPC_CHANNELS.SETTINGS.GET_BY_CATEGORY, category),
    update: (data) => typedInvoke(IPC_CHANNELS.SETTINGS.UPDATE, data.key, data.value, data.type),
    updateMultiple: (data) => typedInvoke(IPC_CHANNELS.SETTINGS.UPDATE_MULTIPLE, data.settings),
    reset: (category) => typedInvoke(IPC_CHANNELS.SETTINGS.RESET, category),
    getTypedValue: (key) => typedInvoke(IPC_CHANNELS.SETTINGS.GET_TYPED_VALUE, key),
};
/**
 * System API
 */
export const systemAPI = {
    getInfo: () => typedInvoke(IPC_CHANNELS.SYSTEM.GET_INFO),
    checkForUpdates: () => typedInvoke(IPC_CHANNELS.SYSTEM.CHECK_FOR_UPDATES),
    installUpdate: () => typedInvoke(IPC_CHANNELS.SYSTEM.INSTALL_UPDATE),
    restartApp: () => typedInvoke(IPC_CHANNELS.SYSTEM.RESTART_APP),
    quitApp: () => typedInvoke(IPC_CHANNELS.SYSTEM.QUIT_APP),
    getDatabaseStatus: () => typedInvoke(IPC_CHANNELS.SYSTEM.GET_DATABASE_STATUS),
    backupDatabase: (path) => typedInvoke(IPC_CHANNELS.SYSTEM.BACKUP_DATABASE, path),
    restoreDatabase: (path) => typedInvoke(IPC_CHANNELS.SYSTEM.RESTORE_DATABASE, path),
    getLogs: (limit) => typedInvoke(IPC_CHANNELS.SYSTEM.GET_LOGS, limit),
};
/**
 * Expense API
 */
export const expenseAPI = {
    getAll: (filters) => typedInvoke(IPC_CHANNELS.EXPENSE.GET_ALL, filters),
    getById: (id) => typedInvoke(IPC_CHANNELS.EXPENSE.GET_BY_ID, id),
    create: (data) => typedInvoke(IPC_CHANNELS.EXPENSE.CREATE, data),
    update: (id, data) => typedInvoke(IPC_CHANNELS.EXPENSE.UPDATE, id, data),
    delete: (id) => typedInvoke(IPC_CHANNELS.EXPENSE.DELETE, id),
    approve: (id, approved) => typedInvoke(IPC_CHANNELS.EXPENSE.APPROVE, id, approved),
    getAnalytics: (filters) => typedInvoke(IPC_CHANNELS.EXPENSE.GET_ANALYTICS, filters),
};
/**
 * Inventory API
 */
export const inventoryAPI = {
    getAllInventoryItems: () => typedInvoke(IPC_CHANNELS.INVENTORY.GET_ALL),
    getById: (id) => typedInvoke(IPC_CHANNELS.INVENTORY.GET_BY_ID, id),
    createInventoryItem: (data) => typedInvoke(IPC_CHANNELS.INVENTORY.CREATE, data),
    updateInventoryItem: (id, updates) => typedInvoke(IPC_CHANNELS.INVENTORY.UPDATE, { id, updates }),
    deleteInventoryItem: (id) => typedInvoke(IPC_CHANNELS.INVENTORY.DELETE, id),
    adjustStock: (id, adjustment) => typedInvoke(IPC_CHANNELS.INVENTORY.ADJUST_STOCK, { id, adjustment }),
    getLowStockItems: () => typedInvoke(IPC_CHANNELS.INVENTORY.GET_LOW_STOCK),
    getCategories: () => typedInvoke(IPC_CHANNELS.INVENTORY.GET_CATEGORIES),
    getByCategory: (category) => typedInvoke('inventory:getByCategory', category),
    updateCategoryName: (oldName, newName) => typedInvoke(IPC_CHANNELS.INVENTORY.UPDATE_CATEGORY_NAME, {
        oldName,
        newName,
    }),
    getMenuItemIngredients: (menuItemId) => typedInvoke(IPC_CHANNELS.INVENTORY.GET_MENU_ITEM_INGREDIENTS, { menuItemId }),
    updateMenuItemIngredients: (menuItemId, ingredients) => typedInvoke(IPC_CHANNELS.INVENTORY.UPDATE_MENU_ITEM_INGREDIENTS, {
        menuItemId,
        ingredients,
    }),
    checkStockAvailability: (orderItems) => typedInvoke(IPC_CHANNELS.INVENTORY.CHECK_STOCK_AVAILABILITY, { orderItems }),
};
/**
 * Dashboard API
 */
export const dashboardAPI = {
    getData: (dateRange) => typedInvoke(IPC_CHANNELS.DASHBOARD.GET_DATA, dateRange),
};
/**
 * Report API
 */
export const reportAPI = {
    getSalesReport: (dateRange) => typedInvoke(IPC_CHANNELS.REPORT.GET_SALES_REPORT, dateRange),
    getInventoryReport: (dateRange) => typedInvoke(IPC_CHANNELS.REPORT.GET_INVENTORY_REPORT, dateRange),
    getProfitReport: (dateRange) => typedInvoke(IPC_CHANNELS.REPORT.GET_PROFIT_REPORT, dateRange),
    exportSalesReport: (dateRange) => typedInvoke(IPC_CHANNELS.REPORT.EXPORT_SALES_REPORT, dateRange),
    exportInventoryReport: (dateRange) => typedInvoke(IPC_CHANNELS.REPORT.EXPORT_INVENTORY_REPORT, dateRange),
    exportProfitReport: (dateRange) => typedInvoke(IPC_CHANNELS.REPORT.EXPORT_PROFIT_REPORT, dateRange),
};
/**
 * Addon API
 */
export const addonAPI = {
    // Addon Group Management
    createGroup: (data) => typedInvoke(IPC_CHANNELS.ADDON.CREATE_GROUP, data),
    getGroup: (id) => typedInvoke(IPC_CHANNELS.ADDON.GET_GROUP, id),
    getGroups: () => typedInvoke(IPC_CHANNELS.ADDON.GET_GROUPS),
    updateGroup: (id, data) => typedInvoke(IPC_CHANNELS.ADDON.UPDATE_GROUP, id, data),
    deleteGroup: (id) => typedInvoke(IPC_CHANNELS.ADDON.DELETE_GROUP, id),
    // Addon Management
    create: (data) => typedInvoke(IPC_CHANNELS.ADDON.CREATE, data),
    get: (id) => typedInvoke(IPC_CHANNELS.ADDON.GET, id),
    getByGroup: (groupId) => typedInvoke(IPC_CHANNELS.ADDON.GET_BY_GROUP, groupId),
    getByCategory: (categoryId) => typedInvoke(IPC_CHANNELS.ADDON.GET_BY_CATEGORY, categoryId),
    update: (id, data) => typedInvoke(IPC_CHANNELS.ADDON.UPDATE, id, data),
    delete: (id) => typedInvoke(IPC_CHANNELS.ADDON.DELETE, id),
    // Category Assignment Management
    assignToCategory: (categoryId, groupId) => typedInvoke(IPC_CHANNELS.ADDON.ASSIGN_TO_CATEGORY, {
        categoryId,
        groupId,
    }),
    unassignFromCategory: (assignmentId) => typedInvoke(IPC_CHANNELS.ADDON.UNASSIGN_FROM_CATEGORY, assignmentId),
    getCategoryAssignments: () => typedInvoke(IPC_CHANNELS.ADDON.GET_CATEGORY_ASSIGNMENTS),
};
/**
 * Updater API for auto-update functionality
 */
export const updaterAPI = {
    checkForUpdates: () => typedInvoke(IPC_CHANNELS.UPDATER.CHECK_FOR_UPDATES),
    downloadUpdate: () => typedInvoke(IPC_CHANNELS.UPDATER.DOWNLOAD_UPDATE),
    installUpdate: () => typedInvoke(IPC_CHANNELS.UPDATER.INSTALL_UPDATE),
    getStatus: () => typedInvoke(IPC_CHANNELS.UPDATER.GET_STATUS),
    setAutoUpdate: (enabled) => typedInvoke(IPC_CHANNELS.UPDATER.SET_AUTO_UPDATE, enabled),
    cancelUpdate: () => typedInvoke(IPC_CHANNELS.UPDATER.CANCEL_UPDATE),
    skipVersion: (version) => typedInvoke(IPC_CHANNELS.UPDATER.SKIP_VERSION, version),
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
