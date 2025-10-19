/**
 * IPC Handler Type Definitions for mr5-POS
 *
 * This file defines the type mappings between IPC channels and their handler functions.
 * It ensures type safety across the IPC boundary between main and renderer processes.
 */

import { IpcMainInvokeEvent } from 'electron';
import {
  AUTH_CHANNELS,
  EXPENSE_CHANNELS,
  INVENTORY_CHANNELS,
  LOGGING_CHANNELS,
  MENU_ITEM_CHANNELS,
  ORDER_CHANNELS,
  PAYMENT_CHANNELS,
  PRINTER_CHANNELS,
  SETTINGS_CHANNELS,
  SYSTEM_CHANNELS,
  TABLE_CHANNELS,
  USER_CHANNELS,
} from './ipc-channels';
import * as IPCTypes from './ipc-types';

/**
 * Type for IPC channel strings - should be union of all valid channels
 */
export type IPCChannel = string;

/**
 * Type for IPC handler functions in the main process
 */
export type IPCHandlerFunction<TParams extends any[], TResult> = (
  event: IpcMainInvokeEvent,
  ...args: TParams
) => Promise<IPCTypes.IPCResponse<TResult>>;

/**
 * Get parameter types for an IPC channel
 */
export type IPCChannelParams<T extends IPCChannel> =
  Parameters<IPCHandlerMap[T]> extends [IpcMainInvokeEvent, ...infer P]
    ? P
    : never;

/**
 * Get return type for an IPC channel
 */
export type IPCChannelReturn<T extends IPCChannel> = IPCTypes.IPCResponse<
  Awaited<ReturnType<IPCHandlerMap[T]>> extends IPCTypes.IPCResponse<infer R>
    ? R
    : never
>;

/**
 * Maps each IPC channel to its parameter types and return type
 */
export interface IPCHandlerMap {
  // Auth Channels
  [AUTH_CHANNELS.LOGIN]: IPCHandlerFunction<
    [IPCTypes.LoginRequest],
    IPCTypes.AuthResponse
  >;
  [AUTH_CHANNELS.LOGOUT]: IPCHandlerFunction<[], void>;
  [AUTH_CHANNELS.VERIFY_SESSION]: IPCHandlerFunction<[], IPCTypes.AuthResponse>;
  [AUTH_CHANNELS.CHANGE_PASSWORD]: IPCHandlerFunction<
    [IPCTypes.ChangePasswordRequest],
    void
  >;
  [AUTH_CHANNELS.GET_CURRENT_USER]: IPCHandlerFunction<[], IPCTypes.User>;
  [AUTH_CHANNELS.TOKEN_REFRESH]: IPCHandlerFunction<[], IPCTypes.AuthResponse>;

  // User Channels
  [USER_CHANNELS.GET_ALL]: IPCHandlerFunction<[], IPCTypes.User[]>;
  [USER_CHANNELS.GET_BY_ID]: IPCHandlerFunction<[string], IPCTypes.User>;
  [USER_CHANNELS.CREATE]: IPCHandlerFunction<
    [IPCTypes.CreateUserRequest],
    IPCTypes.User
  >;
  [USER_CHANNELS.UPDATE]: IPCHandlerFunction<
    [string, IPCTypes.UpdateUserRequest],
    IPCTypes.User
  >;
  [USER_CHANNELS.DELETE]: IPCHandlerFunction<[string], void>;
  [USER_CHANNELS.CHANGE_ROLE]: IPCHandlerFunction<
    [string, IPCTypes.UserRole],
    IPCTypes.User
  >;
  [USER_CHANNELS.RESET_PASSWORD]: IPCHandlerFunction<[string], void>;

  // Table Channels
  [TABLE_CHANNELS.GET_ALL]: IPCHandlerFunction<[], IPCTypes.Table[]>;
  [TABLE_CHANNELS.GET_BY_ID]: IPCHandlerFunction<[string], IPCTypes.Table>;
  [TABLE_CHANNELS.CREATE]: IPCHandlerFunction<
    [IPCTypes.CreateTableRequest],
    IPCTypes.Table
  >;
  [TABLE_CHANNELS.UPDATE]: IPCHandlerFunction<
    [string, IPCTypes.UpdateTableRequest],
    IPCTypes.Table
  >;
  [TABLE_CHANNELS.UPDATE_STATUS]: IPCHandlerFunction<
    [string, IPCTypes.TableStatus],
    IPCTypes.Table
  >;
  [TABLE_CHANNELS.DELETE]: IPCHandlerFunction<[string], void>;

  // Menu Item Channels
  [MENU_ITEM_CHANNELS.GET_ALL]: IPCHandlerFunction<[], IPCTypes.MenuItem[]>;
  [MENU_ITEM_CHANNELS.GET_BY_ID]: IPCHandlerFunction<
    [string],
    IPCTypes.MenuItem
  >;
  [MENU_ITEM_CHANNELS.GET_BY_CATEGORY]: IPCHandlerFunction<
    [string],
    IPCTypes.MenuItem[]
  >;
  [MENU_ITEM_CHANNELS.GET_AVAILABLE]: IPCHandlerFunction<
    [],
    IPCTypes.MenuItem[]
  >;
  [MENU_ITEM_CHANNELS.CREATE]: IPCHandlerFunction<
    [IPCTypes.CreateMenuItemRequest],
    IPCTypes.MenuItem
  >;
  [MENU_ITEM_CHANNELS.UPDATE]: IPCHandlerFunction<
    [string, IPCTypes.UpdateMenuItemRequest],
    IPCTypes.MenuItem
  >;
  [MENU_ITEM_CHANNELS.DELETE]: IPCHandlerFunction<[string], void>;
  [MENU_ITEM_CHANNELS.SEARCH]: IPCHandlerFunction<
    [string],
    IPCTypes.MenuItem[]
  >;
  [MENU_ITEM_CHANNELS.GET_STATS]: IPCHandlerFunction<[], IPCTypes.MenuStats>;

  // Order Channels
  [ORDER_CHANNELS.GET_ALL]: IPCHandlerFunction<[], IPCTypes.Order[]>;
  [ORDER_CHANNELS.GET_BY_ID]: IPCHandlerFunction<[string], IPCTypes.Order>;
  [ORDER_CHANNELS.GET_BY_STATUS]: IPCHandlerFunction<
    [IPCTypes.OrderStatus],
    IPCTypes.Order[]
  >;
  [ORDER_CHANNELS.GET_BY_TABLE]: IPCHandlerFunction<[string], IPCTypes.Order[]>;
  [ORDER_CHANNELS.GET_BY_USER]: IPCHandlerFunction<[string], IPCTypes.Order[]>;
  [ORDER_CHANNELS.CREATE]: IPCHandlerFunction<
    [IPCTypes.CreateOrderRequest],
    IPCTypes.Order
  >;
  [ORDER_CHANNELS.UPDATE]: IPCHandlerFunction<
    [string, IPCTypes.UpdateOrderRequest],
    IPCTypes.Order
  >;
  [ORDER_CHANNELS.UPDATE_STATUS]: IPCHandlerFunction<
    [string, IPCTypes.OrderStatus],
    IPCTypes.Order
  >;
  [ORDER_CHANNELS.DELETE]: IPCHandlerFunction<[string], void>;
  [ORDER_CHANNELS.SEARCH]: IPCHandlerFunction<
    [IPCTypes.OrderSearchParams],
    IPCTypes.Order[]
  >;
  [ORDER_CHANNELS.GET_STATS]: IPCHandlerFunction<[], IPCTypes.OrderStats>;

  // Payment Channels
  [PAYMENT_CHANNELS.GET_ALL]: IPCHandlerFunction<[], IPCTypes.Payment[]>;
  [PAYMENT_CHANNELS.GET_BY_ID]: IPCHandlerFunction<[string], IPCTypes.Payment>;
  [PAYMENT_CHANNELS.GET_BY_ORDER]: IPCHandlerFunction<
    [string],
    IPCTypes.Payment[]
  >;
  [PAYMENT_CHANNELS.CREATE]: IPCHandlerFunction<
    [IPCTypes.CreatePaymentRequest],
    IPCTypes.Payment
  >;
  [PAYMENT_CHANNELS.UPDATE]: IPCHandlerFunction<
    [string, IPCTypes.UpdatePaymentRequest],
    IPCTypes.Payment
  >;
  [PAYMENT_CHANNELS.DELETE]: IPCHandlerFunction<[string], void>;
  [PAYMENT_CHANNELS.GET_STATS]: IPCHandlerFunction<[], IPCTypes.PaymentStats>;

  // Printer Channels
  [PRINTER_CHANNELS.GET_ALL]: IPCHandlerFunction<[], IPCTypes.Printer[]>;
  [PRINTER_CHANNELS.GET_DEFAULT]: IPCHandlerFunction<[], IPCTypes.Printer>;
  [PRINTER_CHANNELS.PRINT_RECEIPT]: IPCHandlerFunction<
    [IPCTypes.PrintReceiptRequest],
    boolean
  >;
  [PRINTER_CHANNELS.PRINT_TEST_PAGE]: IPCHandlerFunction<[string], boolean>;
  [PRINTER_CHANNELS.CHECK_STATUS]: IPCHandlerFunction<
    [string],
    IPCTypes.PrinterStatus
  >;

  // Settings Channels
  [SETTINGS_CHANNELS.GET_ALL]: IPCHandlerFunction<[], IPCTypes.Setting[]>;
  [SETTINGS_CHANNELS.GET_BY_KEY]: IPCHandlerFunction<
    [string],
    IPCTypes.Setting
  >;
  [SETTINGS_CHANNELS.GET_BY_CATEGORY]: IPCHandlerFunction<
    [string],
    IPCTypes.Setting[]
  >;
  [SETTINGS_CHANNELS.UPDATE]: IPCHandlerFunction<
    [string, string],
    IPCTypes.Setting
  >;
  [SETTINGS_CHANNELS.UPDATE_MULTIPLE]: IPCHandlerFunction<
    [IPCTypes.UpdateSettingsRequest],
    IPCTypes.Setting[]
  >;
  [SETTINGS_CHANNELS.RESET]: IPCHandlerFunction<[string], IPCTypes.Setting>;
  [SETTINGS_CHANNELS.GET_TYPED_VALUE]: IPCHandlerFunction<[string], any>;

  // Inventory Channels
  [INVENTORY_CHANNELS.GET_ALL]: IPCHandlerFunction<
    [],
    IPCTypes.InventoryItem[]
  >;
  [INVENTORY_CHANNELS.GET_BY_ID]: IPCHandlerFunction<
    [string],
    IPCTypes.InventoryItem
  >;
  [INVENTORY_CHANNELS.CREATE]: IPCHandlerFunction<
    [IPCTypes.CreateInventoryRequest],
    IPCTypes.InventoryItem
  >;
  [INVENTORY_CHANNELS.UPDATE]: IPCHandlerFunction<
    [string, IPCTypes.UpdateInventoryRequest],
    IPCTypes.InventoryItem
  >;
  [INVENTORY_CHANNELS.DELETE]: IPCHandlerFunction<[string], void>;
  [INVENTORY_CHANNELS.ADJUST_STOCK]: IPCHandlerFunction<
    [string, number],
    IPCTypes.InventoryItem
  >;
  [INVENTORY_CHANNELS.GET_LOW_STOCK]: IPCHandlerFunction<
    [],
    IPCTypes.InventoryItem[]
  >;

  // Expense Channels
  [EXPENSE_CHANNELS.GET_ALL]: IPCHandlerFunction<[], IPCTypes.Expense[]>;
  [EXPENSE_CHANNELS.GET_BY_ID]: IPCHandlerFunction<[string], IPCTypes.Expense>;
  [EXPENSE_CHANNELS.GET_BY_CATEGORY]: IPCHandlerFunction<
    [string],
    IPCTypes.Expense[]
  >;
  [EXPENSE_CHANNELS.GET_BY_DATE_RANGE]: IPCHandlerFunction<
    [IPCTypes.DateRangeRequest],
    IPCTypes.Expense[]
  >;
  [EXPENSE_CHANNELS.CREATE]: IPCHandlerFunction<
    [IPCTypes.CreateExpenseRequest],
    IPCTypes.Expense
  >;
  [EXPENSE_CHANNELS.UPDATE]: IPCHandlerFunction<
    [string, IPCTypes.UpdateExpenseRequest],
    IPCTypes.Expense
  >;
  [EXPENSE_CHANNELS.DELETE]: IPCHandlerFunction<[string], void>;
  [EXPENSE_CHANNELS.GET_STATS]: IPCHandlerFunction<
    [IPCTypes.DateRangeRequest],
    IPCTypes.ExpenseStats
  >;

  // System Channels
  [SYSTEM_CHANNELS.GET_INFO]: IPCHandlerFunction<[], IPCTypes.SystemInfo>;
  [SYSTEM_CHANNELS.CHECK_FOR_UPDATES]: IPCHandlerFunction<
    [],
    IPCTypes.UpdateInfo
  >;
  [SYSTEM_CHANNELS.INSTALL_UPDATE]: IPCHandlerFunction<[], boolean>;
  [SYSTEM_CHANNELS.RESTART_APP]: IPCHandlerFunction<[], void>;
  [SYSTEM_CHANNELS.QUIT_APP]: IPCHandlerFunction<[], void>;
  [SYSTEM_CHANNELS.GET_DATABASE_STATUS]: IPCHandlerFunction<
    [],
    IPCTypes.DatabaseStatus
  >;
  [SYSTEM_CHANNELS.BACKUP_DATABASE]: IPCHandlerFunction<[string], string>;
  [SYSTEM_CHANNELS.RESTORE_DATABASE]: IPCHandlerFunction<[string], boolean>;
  [SYSTEM_CHANNELS.GET_LOGS]: IPCHandlerFunction<[], string[]>;

  // Logging Channels
  [LOGGING_CHANNELS.GET_FILES]: IPCHandlerFunction<[], IPCTypes.LogFile[]>;
  [LOGGING_CHANNELS.GET_CONTENT]: IPCHandlerFunction<
    [IPCTypes.GetLogContentRequest],
    string[]
  >;
  [LOGGING_CHANNELS.SEARCH]: IPCHandlerFunction<
    [IPCTypes.LogSearchOptions],
    IPCTypes.LogEntry[]
  >;
  [LOGGING_CHANNELS.GET_STATS]: IPCHandlerFunction<[], IPCTypes.LogStats>;
  [LOGGING_CHANNELS.CLEAR]: IPCHandlerFunction<
    [IPCTypes.ClearLogsRequest],
    { deletedCount: number }
  >;
  [LOGGING_CHANNELS.EXPORT]: IPCHandlerFunction<
    [IPCTypes.ExportLogsRequest],
    { filePath: string }
  >;
}

/**
 * Type for IPC events sent from main to renderer
 */
export interface IPCEvents {
  'order:updated': (order: IPCTypes.Order) => void;
  'order:created': (order: IPCTypes.Order) => void;
  'table:status-changed': (table: IPCTypes.Table) => void;
  'printer:status-changed': (status: { name: string; online: boolean }) => void;
  'system:update-available': (info: {
    version: string;
    releaseNotes?: string;
  }) => void;
  'system:update-downloaded': (info: {
    version: string;
    releaseNotes?: string;
  }) => void;
  'system:database-status': (status: IPCTypes.DatabaseStatus) => void;
}

/**
 * Type for IPC channels in the renderer process
 */
export type IPCChannels = {
  [K in IPCChannel]: (
    ...args: IPCChannelParams<K>
  ) => Promise<IPCTypes.IPCResponse<IPCChannelReturn<K>>>;
};
