/**
 * Standardized IPC Types for mr5-POS
 *
 * This file defines the types used for IPC communication between the main and renderer processes.
 * It ensures type safety and consistency across the application.
 */
// Define enums directly (same as in main/prisma.ts)
// These enums must match exactly with the database schema and main process enums
export var UserRole;
(function (UserRole) {
    UserRole["OWNER"] = "OWNER";
    UserRole["MANAGER"] = "MANAGER";
    UserRole["CASHIER"] = "CASHIER";
    UserRole["WAITER"] = "WAITER";
    UserRole["KITCHEN"] = "KITCHEN";
    UserRole["ADMIN"] = "ADMIN";
})(UserRole || (UserRole = {}));
export var TableStatus;
(function (TableStatus) {
    TableStatus["AVAILABLE"] = "AVAILABLE";
    TableStatus["OCCUPIED"] = "OCCUPIED";
    TableStatus["RESERVED"] = "RESERVED";
    TableStatus["OUT_OF_ORDER"] = "OUT_OF_ORDER";
})(TableStatus || (TableStatus = {}));
export var OrderStatus;
(function (OrderStatus) {
    OrderStatus["DRAFT"] = "DRAFT";
    OrderStatus["PENDING"] = "PENDING";
    OrderStatus["CONFIRMED"] = "CONFIRMED";
    OrderStatus["PREPARING"] = "PREPARING";
    OrderStatus["READY"] = "READY";
    OrderStatus["SERVED"] = "SERVED";
    OrderStatus["COMPLETED"] = "COMPLETED";
    OrderStatus["CANCELLED"] = "CANCELLED";
})(OrderStatus || (OrderStatus = {}));
export var OrderType;
(function (OrderType) {
    OrderType["DINE_IN"] = "DINE_IN";
    OrderType["TAKEOUT"] = "TAKEOUT";
    OrderType["DELIVERY"] = "DELIVERY";
})(OrderType || (OrderType = {}));
export var OrderItemStatus;
(function (OrderItemStatus) {
    OrderItemStatus["PENDING"] = "PENDING";
    OrderItemStatus["PREPARING"] = "PREPARING";
    OrderItemStatus["READY"] = "READY";
    OrderItemStatus["SERVED"] = "SERVED";
    OrderItemStatus["CANCELLED"] = "CANCELLED";
})(OrderItemStatus || (OrderItemStatus = {}));
export var PaymentMethod;
(function (PaymentMethod) {
    PaymentMethod["CASH"] = "CASH";
    PaymentMethod["CARD"] = "CARD";
    PaymentMethod["DIGITAL_WALLET"] = "DIGITAL_WALLET";
    PaymentMethod["CHECK"] = "CHECK";
    PaymentMethod["OTHER"] = "OTHER";
})(PaymentMethod || (PaymentMethod = {}));
export var PaymentStatus;
(function (PaymentStatus) {
    PaymentStatus["PENDING"] = "PENDING";
    PaymentStatus["COMPLETED"] = "COMPLETED";
    PaymentStatus["FAILED"] = "FAILED";
    PaymentStatus["REFUNDED"] = "REFUNDED";
})(PaymentStatus || (PaymentStatus = {}));
/**
 * Error-related types
 */
export var ErrorSeverity;
(function (ErrorSeverity) {
    ErrorSeverity["LOW"] = "low";
    ErrorSeverity["MEDIUM"] = "medium";
    ErrorSeverity["HIGH"] = "high";
    ErrorSeverity["CRITICAL"] = "critical";
})(ErrorSeverity || (ErrorSeverity = {}));
export var ErrorCategory;
(function (ErrorCategory) {
    ErrorCategory["DATABASE"] = "database";
    ErrorCategory["IPC"] = "ipc";
    ErrorCategory["FILESYSTEM"] = "filesystem";
    ErrorCategory["NETWORK"] = "network";
    ErrorCategory["PRINTER"] = "printer";
    ErrorCategory["SECURITY"] = "security";
    ErrorCategory["VALIDATION"] = "validation";
    ErrorCategory["BUSINESS_LOGIC"] = "business_logic";
    ErrorCategory["SYSTEM"] = "system";
    ErrorCategory["UNKNOWN"] = "unknown";
})(ErrorCategory || (ErrorCategory = {}));
// Display name helper function
export function getUserDisplayName(user) {
    return `${user.firstName} ${user.lastName}`;
}
