/**
 * Printer Types and Interfaces for mr5-POS
 *
 * This module contains all type definitions, interfaces, and enums
 * used throughout the printer system.
 */
// Enhanced enums for printer classification
export var PrinterType;
(function (PrinterType) {
    PrinterType["RONGTA_THERMAL"] = "RONGTA_THERMAL";
    PrinterType["THERMAL"] = "THERMAL";
    PrinterType["KITCHEN"] = "KITCHEN";
    PrinterType["BAR"] = "BAR";
    PrinterType["DOCUMENT"] = "DOCUMENT";
    PrinterType["GENERIC"] = "GENERIC";
})(PrinterType || (PrinterType = {}));
export var ConnectionType;
(function (ConnectionType) {
    ConnectionType["USB"] = "USB";
    ConnectionType["NETWORK"] = "NETWORK";
    ConnectionType["SERIAL"] = "SERIAL";
    ConnectionType["BLUETOOTH"] = "BLUETOOTH";
    ConnectionType["VIRTUAL"] = "VIRTUAL";
    ConnectionType["UNKNOWN"] = "UNKNOWN";
})(ConnectionType || (ConnectionType = {}));
