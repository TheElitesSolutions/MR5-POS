/**
 * Standardized IPC Types for mr5-POS
 *
 * This file defines the types used for IPC communication between the main and renderer processes.
 * It ensures type safety and consistency across the application.
 */

// Define enums directly (same as in main/prisma.ts)
// These enums must match exactly with the database schema and main process enums
export enum UserRole {
  OWNER = 'OWNER',
  MANAGER = 'MANAGER',
  CASHIER = 'CASHIER',
  WAITER = 'WAITER',
  KITCHEN = 'KITCHEN',
  ADMIN = 'ADMIN',
}

export enum TableStatus {
  AVAILABLE = 'AVAILABLE',
  OCCUPIED = 'OCCUPIED',
  RESERVED = 'RESERVED',
  OUT_OF_ORDER = 'OUT_OF_ORDER',
}

export enum OrderStatus {
  DRAFT = 'DRAFT',
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  PREPARING = 'PREPARING',
  READY = 'READY',
  SERVED = 'SERVED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum OrderType {
  DINE_IN = 'DINE_IN',
  TAKEOUT = 'TAKEOUT',
  DELIVERY = 'DELIVERY',
}

export enum OrderItemStatus {
  PENDING = 'PENDING',
  PREPARING = 'PREPARING',
  READY = 'READY',
  SERVED = 'SERVED',
  CANCELLED = 'CANCELLED',
}

export enum PaymentMethod {
  CASH = 'CASH',
  CARD = 'CARD',
  DIGITAL_WALLET = 'DIGITAL_WALLET',
  CHECK = 'CHECK',
  OTHER = 'OTHER',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

// Note: All types are already exported below as interfaces, no need for separate type exports

import { LogCategory, LogLevel } from '../main/utils/enhanced-logger';

/**
 * Base IPC Response interface
 * All IPC responses should follow this structure
 */
export interface IPCResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
}

/**
 * User-related types
 */
export interface User {
  id: string;
  username: string;
  email?: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: UserRole;
  isActive: boolean;
  lastLogin?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface ChangePasswordRequest {
  accessToken: string;
  currentPassword: string;
  newPassword: string;
}

/**
 * Table-related types
 */
export interface Table {
  id: string;
  name: string;
  status: TableStatus;
  isPayLater?: boolean;
  createdAt: Date;
  updatedAt: Date;
  activeOrder?: Order | null;
}

export interface CreateTableRequest {
  name: string;
  status?: TableStatus;
  isPayLater?: boolean;
}

export interface UpdateTableRequest {
  id: string;
  updates: {
    name?: string;
    status?: TableStatus;
    isPayLater?: boolean;
  };
}

export interface UpdateTableStatusRequest {
  id: string;
  status: TableStatus;
}

export interface CreateUserRequest {
  username: string;
  email: string;
  password: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  phone?: string;
}

export interface UpdateUserRequest {
  id: string;
  updates: {
    username?: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    role?: UserRole;
    isActive?: boolean;
  };
}

/**
 * Ingredient interface for menu items
 */
export interface Ingredient {
  id: string;
  name: string;
  quantityRequired: number;
  currentStock: number;
  unit: string;
  costPerUnit: number;
  isRequired: boolean;
  isSelected: boolean;
  canAdjust: boolean;
}

/**
 * Menu-related types
 */
export interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  category: string;
  categoryId?: string; // Added to support category ID
  imageUrl?: string;
  isAvailable: boolean;
  isCustomizable: boolean;
  isPrintableInKitchen?: boolean; // Controls whether item appears on kitchen tickets
  isVisibleOnWebsite?: boolean; // Controls whether item syncs to public menu website
  preparationTime?: number;
  ingredients?: Ingredient[];
  allergens?: string[];
  createdAt: Date | string;
  updatedAt: Date | string;
  // Flags for optimistic updates and soft delete
  isOptimistic?: boolean;
  isOptimisticallyUpdated?: boolean;
}

export interface CreateMenuItemRequest {
  menuItem: Partial<MenuItem>;
  userId: string;
  restoreMode?: boolean; // Flag to indicate if this is a restore operation
}

export interface UpdateMenuItemRequest {
  id: string;
  updates: Partial<MenuItem> & {
    _lastKnownUpdatedAt?: string | Date; // For version checking
  };
  userId: string;
}

export interface DeleteMenuItemRequest {
  id: string;
  userId: string;
  _lastKnownUpdatedAt?: string | Date; // For version checking
}

export interface MenuItemFilters {
  category?: string;
  isAvailable?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * Bulk update menu item properties request
 */
export interface BulkUpdateMenuItemPropertiesRequest {
  itemIds: string[];
  categoryId?: string; // Optional category filter
  updates: {
    isCustomizable?: boolean;
    isPrintableInKitchen?: boolean;
  };
  userId: string; // For audit trail
}

/**
 * Bulk update menu item properties response
 */
export interface BulkUpdateMenuItemPropertiesResponse {
  updatedCount: number;
  failedCount: number;
  updatedItems: string[];
  failedItems: Array<{ id: string; error: string }>;
  invalidatedCategories: string[];
}

export interface MenuStats {
  totalItems: number;
  activeItems: number;
  inactiveItems: number;
  categoryCounts: Record<string, number>;
  averagePrice: number;
  totalValue: number;
}

/**
 * Order-related types
 */
export interface Order {
  id: string;
  orderNumber: string;
  tableId?: string;
  tableName?: string; // Denormalized table name for historical preservation
  table?: Table; // Added to include table information for kitchen tickets
  customerId?: string;
  userId: string;
  status: OrderStatus;
  type: OrderType;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  discount?: number;
  total: number;
  notes?: string;
  // Customer details for takeaway/delivery orders
  customerName?: string;
  customerPhone?: string;
  deliveryAddress?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderItem {
  id: string;
  orderId: string;
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  notes: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateOrderRequest {
  tableId?: string;
  customerId?: string;
  userId: string;
  type: OrderType;
  items: {
    menuItemId: string;
    quantity: number;
    notes?: string;
  }[];
  notes?: string;
  deliveryFee?: number;
  // Customer details for takeaway/delivery orders (nested approach)
  customerDetails?: {
    name?: string;
    phone?: string;
    address?: string;
  };
  // Direct customer fields (new approach)
  customerName?: string;
  customerPhone?: string;
  deliveryAddress?: string;
}

export interface UpdateOrderRequest {
  id: string;
  updates: {
    status?: OrderStatus;
    items?: {
      id?: string;
      menuItemId: string;
      quantity: number;
      notes?: string;
    }[];
    notes?: string;
    deliveryFee?: number;
  };
  userId: string;
}

export interface UpdateOrderStatusRequest {
  id: string;
  status: OrderStatus;
}

export interface OrderSearchParams {
  query?: string;
  status?: OrderStatus;
  tableId?: string;
  userId?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
  startDate?: string;
  endDate?: string;
  minTotal?: number;
  maxTotal?: number;
  paymentMethod?: PaymentMethod;
}

export interface OrderStats {
  totalOrders: number;
  pendingOrders: number;
  completedOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
  todaysOrders: number;
  todaysRevenue: number;
}

/**
 * Payment-related types
 */
export interface Payment {
  id: string;
  orderId: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  transactionId?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePaymentRequest {
  orderId: string;
  amount: number;
  method: PaymentMethod;
  transactionId?: string;
  notes?: string;
  userId: string;
}

export interface UpdatePaymentRequest {
  id: string;
  updates: {
    amount?: number;
    method?: PaymentMethod;
    status?: PaymentStatus;
    transactionId?: string;
    notes?: string;
  };
}

export interface PaymentStats {
  totalPayments: number;
  totalAmount: number;
  byMethod: Record<string, number>;
  byStatus: Record<string, number>;
  todaysPayments: number;
  todaysAmount: number;
}

/**
 * Printer-related types
 */
export interface Printer {
  name: string;
  displayName: string;
  isDefault: boolean;
}

export interface PrintReceiptRequest {
  orderId: string;
  printerName?: string;
  copies?: number;
  userId: string;
  useUltimateThermalSolution?: boolean;
  isKitchenOrder?: boolean;
  isInvoice?: boolean;
  onlyUnprinted?: boolean; // Only print items that haven't been printed yet
  cancelledItems?: any[]; // Items that have been cancelled for cancellation tickets
  updatedItemIds?: string[]; // IDs of specific items that were updated (for printing only those)
  itemChanges?: any[]; // Enhanced change tracking information with detailed changes
}

export interface PrintTestPageRequest {
  printerName?: string;
  userId: string;
}

export interface PrinterStatus {
  name: string;
  isOnline: boolean;
  isReady: boolean;
  paperLevel: number;
  errors?: string[];
}

/**
 * Printer capability validation types
 */
export interface PrinterCapabilities {
  canPrint: boolean;
  supportsTestPage: boolean;
  supportsReceiptPrinting: boolean;
  maxPaperWidth: string;
  supportedCommands: string[];
  connectionReliable: boolean;
  responseTime: number; // in milliseconds
  lastValidated: Date;
}

export interface PrinterValidationResult {
  printerName: string;
  isOnline: boolean;
  isReady: boolean;
  capabilities: PrinterCapabilities;
  errors: string[];
  warnings: string[];
  validationTime: number;
}

/**
 * RONGTA device detection types
 */
export interface RONGTADetectionResult {
  devices: RONGTADevice[];
  detectionTime: number;
  methods: {
    usb: { attempted: boolean; successful: boolean; deviceCount: number };
    registry: { attempted: boolean; successful: boolean; entryCount: number };
    network: { attempted: boolean; successful: boolean; deviceCount: number };
  };
  errors: string[];
  warnings: string[];
}

export interface RONGTADevice {
  deviceId: string;
  name: string;
  vendorId: string;
  productId: string;
  serialNumber?: string;
  firmwareVersion?: string;
  connectionType: 'USB' | 'NETWORK' | 'SERIAL' | 'UNKNOWN';
  devicePath?: string;
  ipAddress?: string;
  port?: number;
  status: 'CONNECTED' | 'DISCONNECTED' | 'ERROR' | 'UNKNOWN';
  capabilities: RONGTACapabilities;
  lastDetected: Date;
  isInstalled: boolean;
  printerName?: string;
}

export interface RONGTACapabilities {
  supportsPaperCut: boolean;
  supportsDrawer: boolean;
  supportsBarcode: boolean;
  supportsQrCode: boolean;
  supportsImages: boolean;
  paperWidthMm: number;
  maxPrintSpeed: number;
  interfaceType: string;
  model: string;
  escPosVersion: string;
}

/**
 * RONGTA connection testing types
 */
export interface RONGTAConnectionTest {
  deviceId: string;
  testType: 'USB' | 'SPOOLER' | 'ESCPOS' | 'COMPREHENSIVE';
  connectionMethods: ConnectionTestResult[];
  recommendedMethod: string;
  overallStatus: 'OPTIMAL' | 'FUNCTIONAL' | 'LIMITED' | 'FAILED';
  testDuration: number;
  timestamp: Date;
}

export interface ConnectionTestResult {
  method: 'USB_DIRECT' | 'WINDOWS_SPOOLER' | 'ESCPOS_COMMANDS';
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
  responseTime: number;
  reliability: number;
  capabilities: string[];
  errors: string[];
  details: {
    commandsSupported?: string[];
    paperSizes?: string[];
    features?: string[];
    maxBandwidth?: number;
    latency?: number;
  };
}

/**
 * ESC/POS Command System Types
 */
export type ESCPOSCommandName =
  | 'INITIALIZE'
  | 'STATUS_CHECK'
  | 'PAPER_STATUS'
  | 'PRINT_TEST'
  | 'LINE_FEED'
  | 'FORM_FEED'
  | 'DRAWER_OPEN'
  | 'PAPER_CUT'
  | 'PARTIAL_CUT'
  | 'BARCODE_TEST'
  | 'QR_CODE_TEST';

export interface ESCPOSCommand {
  name: string;
  description: string;
  command: number[];
  expectedResponse?: number[];
  timeout: number;
  critical: boolean; // If this command fails, the test fails
}

export interface ESCPOSTestSuite {
  deviceModel: string;
  commands: ESCPOSCommandName[];
  connectionTest: boolean;
  printTest: boolean;
  drawerTest: boolean;
  cutterTest: boolean;
}

/**
 * Additional RONGTA Device Types
 */
export interface USBDeviceInfo {
  deviceId: string;
  vendorId: string;
  productId: string;
  description: string;
  manufacturer?: string;
  serialNumber?: string;
  devicePath: string;
  status: string;
  driverInstalled: boolean;
}

export interface NetworkRONGTADevice {
  ipAddress: string;
  port: number;
  model?: string;
  serialNumber?: string;
  firmwareVersion?: string;
  webInterface: boolean;
  escPosSupport: boolean;
  responseTime: number;
}

/**
 * Enhanced Printer Validation Types
 */
export interface PrinterCapabilities {
  canPrint: boolean;
  supportsTestPage: boolean;
  supportsReceiptPrinting: boolean;
  maxPaperWidth: string;
  supportedCommands: string[];
  connectionReliable: boolean;
  responseTime: number; // in milliseconds
  lastValidated: Date;
}

export interface PrinterValidationResult {
  printerName: string;
  isOnline: boolean;
  isReady: boolean;
  capabilities: PrinterCapabilities;
  errors: string[];
  warnings: string[];
  validationTime: number;
}

export interface ValidationTestResult {
  testName: string;
  success: boolean;
  responseTime: number;
  errorMessage?: string;
  error?: string; // For backwards compatibility
  details?: any;
}

/**
 * Settings-related types
 */
export interface Setting {
  id: string;
  key: string;
  value: string;
  type: string;
  category?: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpdateSettingRequest {
  key: string;
  value: string;
  type?: string;
}

export interface UpdateMultipleSettingsRequest {
  settings: {
    key: string;
    value: string;
    type?: string;
    category?: string;
  }[];
}

export interface UpdateSettingsRequest {
  key: string;
  value: string;
  type?: string;
  category?: string;
}

/**
 * Database-related types
 */
export interface DatabaseStatus {
  status: 'healthy' | 'disconnected' | 'error';
  connectionState: string;
  serverStatus?: {
    connections: number;
    maxConnections: number;
    memoryUsage: string;
    diskUsage: string;
  };
  error?: string;
}

/**
 * System-related types
 */
export interface SystemInfo {
  version: string;
  platform: string;
  arch: string;
  nodeVersion: string;
  electronVersion: string;
  chromiumVersion: string;
  v8Version: string;
  osVersion: string;
  uptime: number;
}

export interface UpdateInfo {
  version: string;
  updateAvailable: boolean;
  downloadUrl?: string;
  releaseNotes?: string;
}

/**
 * Inventory-related types
 */
export interface InventoryItem {
  id: string;
  itemName: string;
  category: string;
  currentStock: number;
  minimumStock: number;
  unit: string;
  costPerUnit: number;
  supplier?: string;
  lastRestocked?: Date;
  expiryDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateInventoryRequest {
  itemName: string;
  category: string;
  currentStock: number;
  minimumStock: number;
  unit: string;
  costPerUnit: number;
  supplier?: string;
  expiryDate?: Date;
}

export interface UpdateInventoryRequest {
  id: string;
  updates: {
    itemName?: string;
    category?: string;
    currentStock?: number;
    minimumStock?: number;
    unit?: string;
    costPerUnit?: number;
    supplier?: string;
    expiryDate?: Date;
  };
}

/**
 * Expense-related types
 */
export interface Expense {
  id: string;
  description: string;
  amount: number;
  category: string;
  date: Date;
  receipt?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateExpenseRequest {
  description: string;
  amount: number;
  category: string;
  date: Date;
  receipt?: string;
  notes?: string;
}

export interface UpdateExpenseRequest {
  id: string;
  updates: {
    description?: string;
    amount?: number;
    category?: string;
    date?: Date;
    receipt?: string;
    notes?: string;
  };
}

export interface DateRangeRequest {
  startDate: Date;
  endDate: Date;
}

export interface ExpenseStats {
  totalExpenses: number;
  totalAmount: number;
  byCategory: Record<string, number>;
  monthlyTrend: Array<{
    month: string;
    amount: number;
  }>;
  topCategories: Array<{
    category: string;
    amount: number;
    count: number;
  }>;
}

/**
 * Error-related types
 */
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum ErrorCategory {
  DATABASE = 'database',
  IPC = 'ipc',
  FILESYSTEM = 'filesystem',
  NETWORK = 'network',
  PRINTER = 'printer',
  SECURITY = 'security',
  VALIDATION = 'validation',
  BUSINESS_LOGIC = 'business_logic',
  SYSTEM = 'system',
  UNKNOWN = 'unknown',
}

// Logging types
export interface LogFile {
  name: string;
  path: string;
  size: number;
  created: Date;
  isCompressed: boolean;
}

export interface LogEntry {
  timestamp: string;
  level: string;
  levelCode: LogLevel;
  message: string;
  category?: LogCategory;
  module?: string;
  context?: Record<string, any>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  tags?: string[];
  processInfo?: {
    pid: number;
    hostname: string;
    platform: string;
    memory: number;
  };
  requestId?: string;
  sessionId?: string;
  userId?: string;
  duration?: number;
}

export interface LogSearchOptions {
  level?: LogLevel;
  category?: LogCategory;
  module?: string;
  startTime?: string;
  endTime?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface GetLogContentRequest {
  filePath: string;
  limit?: number;
  offset?: number;
}

export interface ClearLogsRequest {
  keepLatest?: number;
}

export interface ExportLogsRequest {
  outputPath: string;
  options?: LogSearchOptions;
}

export interface LogStats {
  totalLogs: number;
  byLevel: Record<string, number>;
  byCategory: Record<string, number>;
  recentErrors: number;
  diskUsage: number;
}

// Dashboard Data Types
export interface DashboardKPIData {
  title: string;
  value: number | string;
  change?: number;
  format: 'currency' | 'percentage' | 'number';
  trend?: 'up' | 'down' | 'neutral';
}

export interface DashboardSalesData {
  date: string;
  revenue: number;
  orders: number;
  averageOrderValue: number;
}

export interface DashboardTopMenuItem {
  id: string;
  name: string;
  totalSold: number;
  revenue: number;
  category: string;
  profitMargin: number;
}

export interface DashboardActivityItem {
  id: string;
  type:
    | 'order_completed'
    | 'order_cancelled'
    | 'table_occupied'
    | 'menu_updated';
  description: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface DashboardData {
  kpis: DashboardKPIData[];
  salesData: DashboardSalesData[];
  topMenuItems: DashboardTopMenuItem[];
  recentActivity: DashboardActivityItem[];
  totalRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
  activeTables: number;
}

export interface DashboardDateRange {
  startDate: string;
  endDate: string;
}

// Display name helper function
export function getUserDisplayName(user: User): string {
  return `${user.firstName} ${user.lastName}`;
}

/**
 * Report-related types
 */
export interface ReportDateRange {
  startDate: string; // ISO string
  endDate: string; // ISO string
}

export interface SalesReportData {
  // Summary KPIs
  totalRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
  averageItemsPerOrder: number;

  // Order List
  orders: {
    id: string;
    orderNumber: string;
    createdAt: string;
    type: 'DINE_IN' | 'TAKEOUT' | 'DELIVERY';
    itemCount: number;
    total: number;
    tableName?: string;
  }[];
}

export interface InventoryReportData {
  // Summary KPIs
  totalItems: number;
  totalInventoryValue: number;
  lowStockCount: number;
  outOfStockCount: number;

  // Current Stock Details
  currentStock: {
    id: string;
    name: string;
    category: string;
    currentStock: number;
    minimumStock: number;
    unit: string;
    costPerUnit: number;
    totalValue: number;
    status: 'normal' | 'low' | 'out';
  }[];

  // Low Stock Alerts
  lowStockItems: {
    id: string;
    name: string;
    category: string;
    currentStock: number;
    minimumStock: number;
    unit: string;
    shortageAmount: number;
  }[];

  // Stock Usage (over time period)
  stockUsage: {
    itemId: string;
    itemName: string;
    category: string;
    totalUsed: number;
    unit: string;
    averageDaily: number;
  }[];
}

export interface ExportReportRequest {
  reportType: 'sales' | 'inventory';
  dateRange: ReportDateRange;
}

export interface ProfitReportData {
  // Summary KPIs
  totalRevenue: number;
  totalFoodCost: number;
  totalExpenses: number;
  totalCost: number;
  grossProfit: number;
  profitMargin: number;

  // Unified Operations (Orders and Expenses chronologically)
  operations: {
    type: 'order' | 'expense';
    timestamp: string;
    id: string;
    description: string; // Order number or expense description
    category: string; // Order type or expense category
    amount: number; // Revenue (positive) or expense amount (negative for display)
    foodCost?: number; // Only for orders
    profit?: number; // Only for orders
    notes?: string; // Additional details
  }[];

  // Time-based trends
  dailyTrends: {
    date: string;
    revenue: number;
    foodCost: number;
    expenses: number;
    totalCost: number;
    profit: number;
    margin: number;
  }[];
}
