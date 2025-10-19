/**
 * Standardized IPC Channels for mr5-POS
 *
 * This file defines all IPC channels used for communication between main and renderer processes.
 * Channels are organized by feature area and use a consistent naming convention.
 */

// Prefix for all IPC channels to avoid conflicts with other libraries
const IPC_PREFIX = 'mr5pos';

/**
 * Helper function to create namespaced channel names
 * @param namespace The feature namespace
 * @param action The specific action
 * @returns Fully qualified channel name
 */
const createChannel = (namespace: string, action: string): string =>
  `${IPC_PREFIX}:${namespace}:${action}`;

/**
 * Authentication channels
 */
export const AUTH_CHANNELS = {
  LOGIN: createChannel('auth', 'login'),
  LOGOUT: createChannel('auth', 'logout'),
  VERIFY_SESSION: createChannel('auth', 'verify-session'),
  CHANGE_PASSWORD: createChannel('auth', 'change-password'),
  GET_CURRENT_USER: createChannel('auth', 'get-current-user'),
  TOKEN_REFRESH: createChannel('auth', 'token-refresh'),
  CHECK_AUTH: createChannel('auth', 'check-auth'),
  CREATE_DEFAULT_ADMIN: createChannel('auth', 'create-default-admin'),
};

/**
 * User management channels
 */
export const USER_CHANNELS = {
  GET_ALL: createChannel('users', 'get-all'),
  GET_BY_ID: createChannel('users', 'get-by-id'),
  CREATE: createChannel('users', 'create'),
  UPDATE: createChannel('users', 'update'),
  DELETE: createChannel('users', 'delete'),
  CHANGE_ROLE: createChannel('users', 'change-role'),
  RESET_PASSWORD: createChannel('users', 'reset-password'),
};

/**
 * Table management channels
 */
export const TABLE_CHANNELS = {
  GET_ALL: createChannel('tables', 'get-all'),
  GET_BY_ID: createChannel('tables', 'get-by-id'),
  CREATE: createChannel('tables', 'create'),
  UPDATE: createChannel('tables', 'update'),
  UPDATE_STATUS: createChannel('tables', 'update-status'),
  DELETE: createChannel('tables', 'delete'),
};

/**
 * Menu item channels
 */
export const MENU_ITEM_CHANNELS = {
  GET_ALL: createChannel('menu-items', 'get-all'),
  GET_BY_ID: createChannel('menu-items', 'get-by-id'),
  GET_BY_CATEGORY: createChannel('menu-items', 'get-by-category'),
  GET_AVAILABLE: createChannel('menu-items', 'get-available'),
  CREATE: createChannel('menu-items', 'create'),
  UPDATE: createChannel('menu-items', 'update'),
  DELETE: createChannel('menu-items', 'delete'),
  SEARCH: createChannel('menu-items', 'search'),
  GET_STATS: createChannel('menu-items', 'get-stats'),
  // Category-specific operations
  CREATE_CATEGORY: createChannel('menu-items', 'create-category'),
  UPDATE_CATEGORY: createChannel('menu-items', 'update-category'),
  DELETE_CATEGORY: createChannel('menu-items', 'delete-category'),
  GET_CATEGORIES: createChannel('menu-items', 'get-categories'),
  GET_CATEGORY_STATS: createChannel('menu-items', 'get-category-stats'),
};

/**
 * Order management channels
 */
export const ORDER_CHANNELS = {
  GET_ALL: createChannel('orders', 'get-all'),
  GET_BY_ID: createChannel('orders', 'get-by-id'),
  GET_BY_STATUS: createChannel('orders', 'get-by-status'),
  GET_BY_TABLE: createChannel('orders', 'get-by-table'),
  GET_BY_TYPE: createChannel('orders', 'get-by-type'),
  GET_BY_USER: createChannel('orders', 'get-by-user'),
  CREATE: createChannel('orders', 'create'),
  UPDATE: createChannel('orders', 'update'),
  UPDATE_STATUS: createChannel('orders', 'update-status'),
  DELETE: createChannel('orders', 'delete'),
  SEARCH: createChannel('orders', 'search'),
  GET_STATS: createChannel('orders', 'get-stats'),
  CANCEL: createChannel('orders', 'cancel'),
  COMPLETE: createChannel('orders', 'complete'),
  GENERATE_RECEIPT: createChannel('orders', 'generate-receipt'),
  ADD_ITEM: createChannel('orders', 'add-item'),
  REMOVE_ITEM: createChannel('orders', 'remove-item'),
  UPDATE_ITEM_QUANTITY: createChannel('orders', 'update-item-quantity'),
  GET_ACTIVE: createChannel('orders', 'get-active'),
  GET_COMPLETED: createChannel('orders', 'get-completed'),
  GET_CANCELLED: createChannel('orders', 'get-cancelled'),
  CALCULATE_TOTAL: createChannel('orders', 'calculate-total'),
  // Cashbox and daily summary channels
  GET_CASHBOX_SUMMARY: createChannel('orders', 'get-cashbox-summary'),
  CLOSE_CASHBOX: createChannel('orders', 'close-cashbox'),
  GET_ORDERS_COUNT: createChannel('orders', 'get-orders-count'),
  // Export channels
  EXPORT_ORDERS: createChannel('orders', 'export-orders'),
};

/**
 * Payment channels
 */
export const PAYMENT_CHANNELS = {
  GET_ALL: createChannel('payments', 'get-all'),
  GET_BY_ID: createChannel('payments', 'get-by-id'),
  GET_BY_ORDER: createChannel('payments', 'get-by-order'),
  CREATE: createChannel('payments', 'create'),
  UPDATE: createChannel('payments', 'update'),
  DELETE: createChannel('payments', 'delete'),
  GET_STATS: createChannel('payments', 'get-stats'),
};

/**
 * Printer channels
 */
export const PRINTER_CHANNELS = {
  GET_ALL: createChannel('printers', 'get-all'),
  GET_DEFAULT: createChannel('printers', 'get-default'),
  PRINT_RECEIPT: createChannel('printers', 'print-receipt'),
  PRINT_TEST_PAGE: createChannel('printers', 'print-test-page'),
  TEST_PRINT: createChannel('printers', 'test-print-diagnostic'),
  CHECK_STATUS: createChannel('printers', 'check-status'),
  VALIDATE_PRINTER: createChannel('printers', 'validate-printer'),
  DETECT_RONGTA: createChannel('printers', 'detect-rongta'),
  TEST_RONGTA_CONNECTION: createChannel('printers', 'test-rongta-connection'),
};

/**
 * Settings channels
 */
export const SETTINGS_CHANNELS = {
  GET_ALL: createChannel('settings', 'get-all'),
  GET_BY_KEY: createChannel('settings', 'get-by-key'),
  GET_BY_CATEGORY: createChannel('settings', 'get-by-category'),
  UPDATE: createChannel('settings', 'update'),
  UPDATE_MULTIPLE: createChannel('settings', 'update-multiple'),
  RESET: createChannel('settings', 'reset'),
  GET_TYPED_VALUE: createChannel('settings', 'get-typed-value'),
};

/**
 * Inventory channels
 */
export const INVENTORY_CHANNELS = {
  GET_ALL: createChannel('inventory', 'get-all'),
  GET_BY_ID: createChannel('inventory', 'get-by-id'),
  CREATE: createChannel('inventory', 'create'),
  UPDATE: createChannel('inventory', 'update'),
  DELETE: createChannel('inventory', 'delete'),
  ADJUST_STOCK: createChannel('inventory', 'adjust-stock'),
  GET_LOW_STOCK: createChannel('inventory', 'get-low-stock'),
  GET_REPORTS: createChannel('inventory', 'get-reports'),
  GET_CATEGORIES: createChannel('inventory', 'get-categories'),
  UPDATE_CATEGORY_NAME: createChannel('inventory', 'update-category-name'),
  GET_MENU_ITEM_INGREDIENTS: createChannel(
    'inventory',
    'get-menu-item-ingredients'
  ),
  UPDATE_MENU_ITEM_INGREDIENTS: createChannel(
    'inventory',
    'update-menu-item-ingredients'
  ),
  CHECK_STOCK_AVAILABILITY: createChannel(
    'inventory',
    'check-stock-availability'
  ),
};

/**
 * Expense channels
 */
export const EXPENSE_CHANNELS = {
  GET_ALL: createChannel('expenses', 'get-all'),
  GET_BY_ID: createChannel('expenses', 'get-by-id'),
  GET_BY_CATEGORY: createChannel('expenses', 'get-by-category'),
  GET_BY_DATE_RANGE: createChannel('expenses', 'get-by-date-range'),
  CREATE: createChannel('expenses', 'create'),
  UPDATE: createChannel('expenses', 'update'),
  DELETE: createChannel('expenses', 'delete'),
  GET_STATS: createChannel('expenses', 'get-stats'),
  APPROVE: createChannel('expenses', 'approve'),
  GET_ANALYTICS: createChannel('expenses', 'get-analytics'),
};

/**
 * System channels
 */
export const SYSTEM_CHANNELS = {
  GET_INFO: createChannel('system', 'get-info'),
  CHECK_FOR_UPDATES: createChannel('system', 'check-for-updates'),
  INSTALL_UPDATE: createChannel('system', 'install-update'),
  RESTART_APP: createChannel('system', 'restart-app'),
  QUIT_APP: createChannel('system', 'quit-app'),
  GET_DATABASE_STATUS: createChannel('system', 'get-database-status'),
  BACKUP_DATABASE: createChannel('system', 'backup-database'),
  RESTORE_DATABASE: createChannel('system', 'restore-database'),
  GET_LOGS: createChannel('system', 'get-logs'),
};

/**
 * Backup and Recovery channels
 */
export const BACKUP_CHANNELS = {
  CREATE_BACKUP: createChannel('backup', 'create-backup'),
  RESTORE_FROM_BACKUP: createChannel('backup', 'restore-from-backup'),
  GET_BACKUPS: createChannel('backup', 'get-backups'),
};

/**
 * Logging channels
 */
export const LOGGING_CHANNELS = {
  GET_FILES: createChannel('logs', 'get-files'),
  GET_CONTENT: createChannel('logs', 'get-content'),
  SEARCH: createChannel('logs', 'search'),
  GET_STATS: createChannel('logs', 'get-stats'),
  CLEAR: createChannel('logs', 'clear'),
  EXPORT: createChannel('logs', 'export'),
};

/**
 * Dashboard channels
 */
export const DASHBOARD_CHANNELS = {
  GET_DATA: createChannel('dashboard', 'get-data'),
  GET_KPI_DATA: createChannel('dashboard', 'get-kpi-data'),
  GET_SALES_DATA: createChannel('dashboard', 'get-sales-data'),
  GET_TOP_MENU_ITEMS: createChannel('dashboard', 'get-top-menu-items'),
  GET_RECENT_ACTIVITY: createChannel('dashboard', 'get-recent-activity'),
};

/**
 * Addon channels
 */
export const ADDON_CHANNELS = {
  // Addon Group Management
  CREATE_GROUP: 'addon:createGroup',
  GET_GROUP: 'addon:getGroup',
  GET_GROUPS: 'addon:getGroups',
  UPDATE_GROUP: 'addon:updateGroup',
  DELETE_GROUP: 'addon:deleteGroup',

  // Addon Management
  CREATE: 'addon:create',
  GET: 'addon:get',
  GET_BY_GROUP: 'addon:getByGroup',
  GET_BY_CATEGORY: 'addon:getByCategory',
  UPDATE: 'addon:update',
  DELETE: 'addon:delete',

  // Category Assignment Management
  ASSIGN_TO_CATEGORY: 'addon:assignToCategory',
  UNASSIGN_FROM_CATEGORY: 'addon:unassignFromCategory',
  GET_CATEGORY_ASSIGNMENTS: 'addon:getCategoryAssignments',
};

/**
 * Supabase sync channels
 */
export const SYNC_CHANNELS = {
  MANUAL_SYNC: 'mr5pos:sync:manual-sync',
  GET_STATUS: 'mr5pos:sync:get-status',
  SET_AUTO_SYNC: 'mr5pos:sync:set-auto-sync',
  SET_INTERVAL: 'mr5pos:sync:set-interval',
};

/**
 * Database management channels
 */
export const DATABASE_MANAGEMENT_CHANNELS = {
  CLEAR_DATABASE: 'mr5pos:db:clear',
  IMPORT_FROM_SUPABASE: 'mr5pos:db:import-from-supabase',
  VERIFY_ADMIN_PASSWORD: 'mr5pos:db:verify-password',
};

/**
 * Report channels
 */
export const REPORT_CHANNELS = {
  GET_SALES_REPORT: createChannel('report', 'get-sales-report'),
  GET_INVENTORY_REPORT: createChannel('report', 'get-inventory-report'),
  GET_PROFIT_REPORT: createChannel('report', 'get-profit-report'),
  EXPORT_SALES_REPORT: createChannel('report', 'export-sales-report'),
  EXPORT_INVENTORY_REPORT: createChannel('report', 'export-inventory-report'),
  EXPORT_PROFIT_REPORT: createChannel('report', 'export-profit-report'),
};

/**
 * Updater channels for auto-update functionality
 */
export const UPDATER_CHANNELS = {
  CHECK_FOR_UPDATES: createChannel('updater', 'check-for-updates'),
  DOWNLOAD_UPDATE: createChannel('updater', 'download-update'),
  INSTALL_UPDATE: createChannel('updater', 'install-update'),
  GET_STATUS: createChannel('updater', 'get-status'),
  SET_AUTO_UPDATE: createChannel('updater', 'set-auto-update'),
  CANCEL_UPDATE: createChannel('updater', 'cancel-update'),
  SKIP_VERSION: createChannel('updater', 'skip-version'),
  GET_UPDATE_INFO: createChannel('updater', 'get-update-info'),
};

/**
 * Export all channels as a single object for convenience
 */
export const IPC_CHANNELS = {
  AUTH: AUTH_CHANNELS,
  USER: USER_CHANNELS,
  TABLE: TABLE_CHANNELS,
  MENU_ITEM: MENU_ITEM_CHANNELS,
  ORDER: ORDER_CHANNELS,
  PAYMENT: PAYMENT_CHANNELS,
  PRINTER: PRINTER_CHANNELS,
  SETTINGS: SETTINGS_CHANNELS,
  INVENTORY: INVENTORY_CHANNELS,
  EXPENSE: EXPENSE_CHANNELS,
  SYSTEM: SYSTEM_CHANNELS,
  LOGGING: LOGGING_CHANNELS,
  DASHBOARD: DASHBOARD_CHANNELS,
  BACKUP: BACKUP_CHANNELS,
  ADDON: ADDON_CHANNELS,
  SYNC: SYNC_CHANNELS,
  DATABASE_MANAGEMENT: DATABASE_MANAGEMENT_CHANNELS,
  REPORT: REPORT_CHANNELS,
  UPDATER: UPDATER_CHANNELS,
};

/**
 * Type representing any IPC channel
 */
export type ChannelType = string;
