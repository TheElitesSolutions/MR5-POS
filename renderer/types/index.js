import { z } from 'zod';
// User and Authentication Types
export var Role;
(function (Role) {
    Role["OWNER"] = "OWNER";
    Role["MANAGER"] = "MANAGER";
    Role["EMPLOYEE"] = "EMPLOYEE";
})(Role || (Role = {}));
// Order Types
export var OrderStatus;
(function (OrderStatus) {
    OrderStatus["PENDING"] = "PENDING";
    OrderStatus["COMPLETED"] = "COMPLETED";
    OrderStatus["CANCELLED"] = "CANCELLED";
})(OrderStatus || (OrderStatus = {}));
// Stock Types - Removed SALE transaction type and notes
export var TransactionType;
(function (TransactionType) {
    TransactionType["PURCHASE"] = "PURCHASE";
    TransactionType["USAGE"] = "USAGE";
    TransactionType["ADJUSTMENT"] = "ADJUSTMENT";
    TransactionType["WASTE"] = "WASTE";
})(TransactionType || (TransactionType = {}));
// Expense Types
export var ExpenseCategory;
(function (ExpenseCategory) {
    ExpenseCategory["UTILITIES"] = "UTILITIES";
    ExpenseCategory["RENT"] = "RENT";
    ExpenseCategory["SUPPLIES"] = "SUPPLIES";
    ExpenseCategory["MAINTENANCE"] = "MAINTENANCE";
    ExpenseCategory["MARKETING"] = "MARKETING";
    ExpenseCategory["INSURANCE"] = "INSURANCE";
    ExpenseCategory["LICENSES"] = "LICENSES";
    ExpenseCategory["EQUIPMENT"] = "EQUIPMENT";
    ExpenseCategory["FOOD_SUPPLIES"] = "FOOD_SUPPLIES";
    ExpenseCategory["PROFESSIONAL"] = "PROFESSIONAL";
    ExpenseCategory["TRANSPORTATION"] = "TRANSPORTATION";
    ExpenseCategory["INVENTORY"] = "INVENTORY";
    ExpenseCategory["OTHER"] = "OTHER";
})(ExpenseCategory || (ExpenseCategory = {}));
export var PaymentMethod;
(function (PaymentMethod) {
    PaymentMethod["CASH"] = "CASH";
    PaymentMethod["CARD"] = "CARD";
    PaymentMethod["BANK_TRANSFER"] = "BANK_TRANSFER";
    PaymentMethod["CHECK"] = "CHECK";
    PaymentMethod["DIGITAL_WALLET"] = "DIGITAL_WALLET";
})(PaymentMethod || (PaymentMethod = {}));
export var ExpenseStatus;
(function (ExpenseStatus) {
    ExpenseStatus["PENDING"] = "PENDING";
    ExpenseStatus["APPROVED"] = "APPROVED";
    ExpenseStatus["REJECTED"] = "REJECTED";
    ExpenseStatus["PAID"] = "PAID";
})(ExpenseStatus || (ExpenseStatus = {}));
export var RecurringType;
(function (RecurringType) {
    RecurringType["DAILY"] = "DAILY";
    RecurringType["WEEKLY"] = "WEEKLY";
    RecurringType["MONTHLY"] = "MONTHLY";
    RecurringType["QUARTERLY"] = "QUARTERLY";
    RecurringType["YEARLY"] = "YEARLY";
})(RecurringType || (RecurringType = {}));
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
        .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/, 'Password must include uppercase, lowercase, number and special character'),
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
// Import addon types first to avoid circular dependency issues
export * from './addon';
// Import backup types
export * from './backup';
