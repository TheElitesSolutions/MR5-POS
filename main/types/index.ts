// Main Process Types for mr5-POS
// These types are used for IPC communication and main process operations

import { IpcMainInvokeEvent } from 'electron';

/**
 * IPC Response
 */
export interface IPCResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
  message?: string;
}

// Utility type for error responses
export type IPCErrorResponse = {
  success: false;
  error: string;
  timestamp: string;
};

// Utility type for success responses
export type IPCSuccessResponse<T> = {
  success: true;
  data: T;
  timestamp: string;
};

/**
 * IPC handler function type
 */
export type IPCHandlerFunction<
  RequestType extends any[] = any[],
  ResponseType = any,
> = (
  event: IpcMainInvokeEvent,
  ...args: RequestType
) => Promise<IPCResponse<ResponseType>>;

/**
 * JWT Payload interface
 */
export interface JWTPayload {
  userId: string;
  username: string;
  role: string;
  type?: string;
  iat?: number;
  exp?: number;
}

// Local enum for SettingType (not in shared)
export enum SettingType {
  STRING = 'string',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  JSON = 'json',
}

// Expense-related enums
export enum ExpenseStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  PAID = 'PAID',
}

export enum RecurringType {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  YEARLY = 'YEARLY',
}

// Expense filter interface
export interface ExpenseFilters {
  searchTerm?: string;
  search?: string; // Alias for searchTerm
  category?: string;
  status?: ExpenseStatus;
  startDate?: Date | string;
  endDate?: Date | string;
  dateFrom?: Date | string; // Alias for startDate
  dateTo?: Date | string; // Alias for endDate
  vendor?: string;
  budgetCategory?: string;
  isRecurring?: boolean;
}

// Re-export enums (as values, not types) from shared/ipc-types
export {
  UserRole,
  TableStatus,
  OrderStatus,
  OrderType,
  OrderItemStatus,
  PaymentMethod,
  PaymentStatus,
} from '../../shared/ipc-types';

// Re-export types from shared/ipc-types for convenience
export type {
  User,
  Table,
  MenuItem,
  Order,
  OrderItem,
  Payment,
  Setting,
  InventoryItem,
  Expense,
  CreateOrderRequest,
  UpdateOrderRequest,
  CreateMenuItemRequest,
  CreateTableRequest,
  UpdateTableRequest,
  LoginRequest,
  LoginResponse,
  ChangePasswordRequest,
  UpdateSettingRequest,
  UpdateMultipleSettingsRequest,
} from '../../shared/ipc-types';

// Type alias for Inventory (same as InventoryItem)
export type { InventoryItem as Inventory } from '../../shared/ipc-types';
