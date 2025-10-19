/**
 * Printer Types and Interfaces for mr5-POS
 *
 * This module contains all type definitions, interfaces, and enums
 * used throughout the printer system.
 */

import {
  PrintReceiptRequest as IPCPrintReceiptRequest,
  Printer as IPCPrinter,
  RONGTADetectionResult,
  RONGTADevice,
  RONGTACapabilities,
  RONGTAConnectionTest,
  ConnectionTestResult,
  ESCPOSTestSuite,
  ESCPOSCommandName,
  PrinterValidationResult,
  ValidationTestResult,
} from '../../../shared/ipc-types';

// Define local interfaces for our printer controller
export interface TestPrintRequest {
  printerName: string;
  testType?: string;
}

// Define PrinterStatus interface since it's not exported from ipc-types
export interface PrinterStatus {
  isConnected: boolean;
  status: string;
  message: string;
}

// Enhanced enums for printer classification
export enum PrinterType {
  RONGTA_THERMAL = 'RONGTA_THERMAL',
  THERMAL = 'THERMAL',
  KITCHEN = 'KITCHEN',
  BAR = 'BAR',
  DOCUMENT = 'DOCUMENT',
  GENERIC = 'GENERIC',
}

export enum ConnectionType {
  USB = 'USB',
  NETWORK = 'NETWORK',
  SERIAL = 'SERIAL',
  BLUETOOTH = 'BLUETOOTH',
  VIRTUAL = 'VIRTUAL',
  UNKNOWN = 'UNKNOWN',
}

// Retry configuration interface
export interface RetryConfig {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  jitterEnabled: boolean;
  retryableErrors: string[];
}

// Retry attempt result interface
export interface RetryAttemptResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  attemptNumber: number;
  delayMs: number;
  totalElapsedMs: number;
}

// Retry operation result interface
export interface RetryOperationResult<T> {
  success: boolean;
  data?: T;
  finalError?: Error;
  attempts: RetryAttemptResult<T>[];
  totalAttempts: number;
  totalElapsedMs: number;
}

// Extended PrintReceiptRequest - uses the base IPC type
export interface PrintReceiptRequest extends IPCPrintReceiptRequest {
  // IPCPrintReceiptRequest already has:
  // orderId: string;
  // printerName?: string;
  // copies?: number;
  // userId: string;
}

// Define types for printer-related operations
export interface PrinterInfo {
  name: string;
  driverName: string;
  portName: string;
  status: number;
  isShared?: boolean;
  location?: string;
  comment?: string;
}

// Extend the IPC Printer interface with our additional properties
export interface Printer extends IPCPrinter {
  displayName: string;
  description: string;
  status: number;
  isNetwork: boolean;
  connectionType: string;
  pageSize: string;
  printerType: string;
}

export interface PrinterResponse {
  success: boolean;
  data?: any;
  error?: string;
}

// Re-export shared types for convenience
export type {
  IPCPrintReceiptRequest,
  IPCPrinter,
  RONGTADetectionResult,
  RONGTADevice,
  RONGTACapabilities,
  RONGTAConnectionTest,
  ConnectionTestResult,
  ESCPOSTestSuite,
  ESCPOSCommandName,
  PrinterValidationResult,
  ValidationTestResult,
};
