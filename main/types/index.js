// Main Process Types for mr5-POS
// These types are used for IPC communication and main process operations
// Local enum for SettingType (not in shared)
export var SettingType;
(function (SettingType) {
    SettingType["STRING"] = "string";
    SettingType["NUMBER"] = "number";
    SettingType["BOOLEAN"] = "boolean";
    SettingType["JSON"] = "json";
})(SettingType || (SettingType = {}));
// Expense-related enums
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
// Re-export enums (as values, not types) from shared/ipc-types
export { UserRole, TableStatus, OrderStatus, OrderType, OrderItemStatus, PaymentMethod, PaymentStatus, } from '../../shared/ipc-types';
