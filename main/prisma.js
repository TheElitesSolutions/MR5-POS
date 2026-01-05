/**
 * Prisma Client Compatibility Layer
 *
 * This file exports the Prisma-compatible wrapper to maintain
 * compatibility with existing code that imports from '../prisma'
 */
import { PrismaClient, getPrismaClient, prisma as prismaInstance } from './db/prisma-wrapper';
// Export the lazy-loaded prisma instance (uses Proxy for lazy init)
export const prisma = prismaInstance;
// Export the getPrismaClient function for code that calls it explicitly
export { getPrismaClient };
// Export the class for type compatibility
export { PrismaClient };
// Export enums to match Prisma's generated client
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
// Export default client
export default prisma;
