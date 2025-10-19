import { z } from 'zod';

// User and Authentication Types
export enum Role {
  OWNER = 'OWNER',
  MANAGER = 'MANAGER',
  EMPLOYEE = 'EMPLOYEE',
}

export interface User {
  id: string;
  username: string;
  name: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  name: string;
  username: string;
  password: string;
  role?: Role;
}

// Table Types - Simplified for dynamic management
export interface Table {
  id: string;
  name: string;
  status: string;
  positionX?: number;
  positionY?: number;
  // isActive field removed as it doesn't exist in the database
  createdAt: Date;
  updatedAt: Date;
  activeOrder?: Order | null;
}

// Order Types
export enum OrderStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export interface Order {
  id: string;
  orderNumber: string;
  tableId?: string;
  tableNumber?: number;
  type?: 'DINE_IN' | 'TAKEOUT' | 'DELIVERY'; // Order type
  status: 'PENDING' | 'PREPARING' | 'READY' | 'COMPLETED' | 'CANCELLED';
  items: OrderItem[];
  totalAmount: number;
  total?: number; // Backend compatibility
  subtotal?: number;
  tax?: number;
  deliveryFee?: number; // Delivery fee for delivery orders
  // Customer details for takeaway/delivery orders
  customerName?: string;
  customerPhone?: string;
  deliveryAddress?: string;
  customerDetails?: {
    // Alternative structure for customer details
    name?: string;
    phone?: string;
    address?: string;
  };
  notes?: string; // Special instructions or notes for the order
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  id: string;
  menuItemId: string;
  name?: string; // Backend compatibility
  menuItemName?: string; // Frontend compatibility
  quantity: number;
  unitPrice?: number; // Frontend compatibility
  totalPrice?: number; // Frontend compatibility
  price?: number; // Backend compatibility - unit price
  subtotal?: number; // Backend compatibility - total price
  notes?: string; // For storing customizations and special instructions
  specialInstructions?: string;
  customizations?: OrderItemCustomization[];
  status?: 'PENDING' | 'PREPARING' | 'READY' | 'DELIVERED' | 'CANCELLED';
  orderId?: string; // Backend includes this
  // Add-on support
  addons?: import('./addon').OrderItemAddon[];
  addonTotal?: number; // Total price of all add-ons
}

export interface OrderItemCustomization {
  id: string;
  orderItemId: string;
  menuItemCustomizationId: string;
  createdAt: Date;
  updatedAt: Date;
  menuItemCustomization?: MenuItemCustomization;
}

// Menu Types - With proper ingredient objects
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

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  categoryId?: string; // Category ID for addon lookups
  isAvailable: boolean;
  isActive: boolean;
  isCustomizable: boolean;
  ingredients: Ingredient[]; // Array of ingredient objects with stock details
}

export interface MenuCategory {
  id: string;
  name: string;
  items: MenuItem[];
}

export interface MenuItemIngredient {
  id: string;
  menuItemId: string;
  stockItemId: string;
  quantityNeeded: number;
  createdAt: Date;
  updatedAt: Date;
  stockItem?: StockItem;
}

export interface MenuItemCustomization {
  id: string;
  menuItemId: string;
  name: string;
  type: string;
  options: string[];
  priceAdjustment: number;
  isRequired: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Stock Types - Removed SALE transaction type and notes
export enum TransactionType {
  PURCHASE = 'PURCHASE',
  USAGE = 'USAGE',
  ADJUSTMENT = 'ADJUSTMENT',
  WASTE = 'WASTE',
}

// StockItem type that matches the backend InventoryItem structure
// This allows proper type conversion from API responses
export interface StockItem {
  id: string;
  itemName: string; // Backend uses 'itemName'
  name?: string; // Alias for compatibility with existing frontend code
  unit: string;
  currentStock: number; // Backend uses 'currentStock'
  currentQuantity?: number; // Alias for compatibility with existing frontend code
  minimumStock: number; // Backend uses 'minimumStock'
  minimumQuantity?: number; // Alias for compatibility with existing frontend code
  costPerUnit: number;
  category?: string;
  supplier?: string;
  lastRestocked?: Date;
  expiryDate?: Date;
  createdAt?: Date;
  updatedAt?: Date;
  lastUpdated?: string; // Legacy field for compatibility
}

export interface StockTransaction {
  id: string;
  stockItemId: string;
  quantity: number;
  type: 'PURCHASE' | 'USAGE' | 'ADJUSTMENT' | 'WASTE';
  notes?: string;
  createdAt: string;
}

// API Response Types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// UI State Types
export interface NotificationState {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  timestamp: Date;
}

export interface LoadingState {
  [key: string]: boolean;
}

// Customization Types for POS
export interface Customization {
  type: string;
  name: string; // Changed from 'value' to 'name' for consistency
  priceAdjustment: number;
}

// Chart Data Types for Reports
export interface SalesData {
  date: string;
  revenue: number;
  orders: number;
  averageOrderValue: number;
}

export interface KPIData {
  title: string;
  value: number | string;
  change?: number;
  format: 'currency' | 'percentage' | 'number';
  trend?: 'up' | 'down' | 'neutral';
}

export interface CashboxSummary {
  totalCash: number;
  totalCard?: number; // Optional for backwards compatibility, but not used
  // New order type breakdown (replacing card tracking)
  dineInTotal?: number;
  takeoutTotal?: number;
  deliveryTotal?: number;
  totalOrders: number;
  averageOrderValue: number;
  date: string;
  ordersByStatus: {
    completed: number;
    pending: number;
    cancelled: number;
  };
  ordersByType?: {
    dineIn: number;
    takeout: number;
    delivery: number;
  };
  businessDayRange?: {
    start: string;
    end: string;
  };
  totalRevenue?: number;
  isClosed?: boolean;
  closedAt?: string;
  closedBy?: string;
  actualCashAmount?: number;
  variance?: number;
  orders?: Array<{
    id: string;
    orderNumber: string;
    status: string;
    type?: string;
    total: number;
    paymentMethod?: string;
    createdAt: string;
    items?: number;
  }>;
}

export interface ExportFilters {
  startDate?: string;
  endDate?: string;
  status?: string;
  tableId?: string;
  format?: 'csv' | 'excel' | 'pdf';
}

// Expense Types
export enum ExpenseCategory {
  UTILITIES = 'UTILITIES',
  RENT = 'RENT',
  SUPPLIES = 'SUPPLIES',
  MAINTENANCE = 'MAINTENANCE',
  MARKETING = 'MARKETING',
  INSURANCE = 'INSURANCE',
  LICENSES = 'LICENSES',
  EQUIPMENT = 'EQUIPMENT',
  FOOD_SUPPLIES = 'FOOD_SUPPLIES',
  PROFESSIONAL = 'PROFESSIONAL',
  TRANSPORTATION = 'TRANSPORTATION',
  INVENTORY = 'INVENTORY',
  OTHER = 'OTHER',
}

export enum PaymentMethod {
  CASH = 'CASH',
  CARD = 'CARD',
  BANK_TRANSFER = 'BANK_TRANSFER',
  CHECK = 'CHECK',
  DIGITAL_WALLET = 'DIGITAL_WALLET',
}

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

export interface Expense {
  id: string;
  title: string;
  description?: string;
  amount: number;
  category: string;
  subcategory?: string;
  vendor?: string;
  receiptUrl?: string;
  paymentMethod: string;
  status: string;
  isRecurring: boolean;
  recurringType?: string;
  nextDueDate?: string;
  budgetCategory?: string;
  approvedBy?: string;
  approvedAt?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateExpenseRequest {
  description: string;
  amount: number;
  category: string;
  date: Date;
  receipt?: string;
  notes?: string | undefined;
}

export interface UpdateExpenseRequest {
  title?: string;
  description?: string;
  amount?: number;
  category?: string;
  subcategory?: string;
  vendor?: string;
  receiptUrl?: string;
  paymentMethod?: string;
  status?: string;
  isRecurring?: boolean;
  recurringType?: string;
  nextDueDate?: string;
  budgetCategory?: string;
}

export interface ExpenseFilters {
  searchTerm?: string;
  category?: ExpenseCategory;
  status?: ExpenseStatus;
  startDate?: Date | string;
  endDate?: Date | string;
  vendor?: string;
  budgetCategory?: string;
  isRecurring?: boolean;
}

export interface ExpenseAnalytics {
  totalExpenses: number;
  totalApproved: number;
  totalPending: number;
  categoryBreakdown: Record<string, number>;
  totalByCategory?: Record<ExpenseCategory, number>;
  totalByStatus?: Record<ExpenseStatus, number>;
  monthlyTrend?: Array<{
    month: string;
    total: number;
    categoryBreakdown: Record<ExpenseCategory, number>;
  }>;
  budgetTracking?: Array<{
    category: string;
    budgeted: number;
    actual: number;
    variance: number;
    percentage: number;
  }>;
}

// Form validation schemas
export const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Invalid email format')
    .max(255, 'Email cannot exceed 255 characters'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(100, 'Password cannot exceed 100 characters'),
});

export const registerSchema = z
  .object({
    name: z
      .string()
      .min(2, 'Name must be at least 2 characters')
      .max(100, 'Name cannot exceed 100 characters'),
    email: z
      .string()
      .min(1, 'Email is required')
      .email('Invalid email format')
      .max(255, 'Email cannot exceed 255 characters'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(100, 'Password cannot exceed 100 characters')
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
        'Password must include uppercase, lowercase, number and special character'
      ),
    confirmPassword: z.string(),
  })
  .refine(data => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const expenseSchema = z.object({
  title: z
    .string()
    .min(2, 'Title must be at least 2 characters')
    .max(100, 'Title cannot exceed 100 characters'),
  description: z
    .string()
    .max(500, 'Description cannot exceed 500 characters')
    .optional(),
  amount: z
    .number()
    .min(0.01, 'Amount must be greater than 0')
    .max(1000000, 'Amount cannot exceed 1,000,000'),
  category: z.string().min(1, 'Category is required'),
  subcategory: z.string().optional(),
  vendor: z
    .string()
    .max(100, 'Vendor name cannot exceed 100 characters')
    .optional(),
  paymentMethod: z.string().optional(),
  isRecurring: z.boolean().optional(),
  recurringType: z.string().optional(),
  nextDueDate: z.string().optional(),
  budgetCategory: z.string().optional(),
});

// Token refresh response
export interface TokenRefreshResponse {
  accessToken: string;
  refreshToken?: string;
}

// Import addon types first to avoid circular dependency issues
export * from './addon';

// Import backup types
export * from './backup';
