/**
 * Enhanced Printer Types with Order Change Tracking Support
 *
 * These types extend the basic printer functionality to support
 * intelligent kitchen printing with change context awareness.
 */

// Base print request (existing structure)
export interface BasePrintRequest {
  orderId: string;
  printerName: string;
  copies: number;
  userId: string;
  useUltimateThermalSolution?: boolean;
}

// Enhanced print request with change tracking
export interface EnhancedPrintRequest extends BasePrintRequest {
  // Print type flags
  isKitchenOrder?: boolean;
  isInvoice?: boolean;
  isReceipt?: boolean;

  // Change tracking options
  onlyUnprinted?: boolean;
  includeChangeContext?: boolean;
  markAsProcessed?: boolean;

  // Legacy change data (for backward compatibility)
  cancelledItems?: Array<{
    id: string;
    name: string;
    quantity: number;
  }>;
  updatedItemIds?: string[];

  // Enhanced change context
  changeEvents?: Array<{
    id: string;
    type: 'ADD' | 'UPDATE' | 'REMOVE' | 'CUSTOMIZE' | 'NOTE';
    timestamp: number;
    itemId?: string;
    itemName?: string;
    oldValue?: any;
    newValue?: any;
    metadata?: Record<string, any>;
  }>;

  // Smart printing options
  smartPrint?: {
    preferImmediate?: boolean;
    batchThreshold?: number;
    maxWaitTime?: number;
  };
}

// Enhanced print response
export interface EnhancedPrintResponse {
  success: boolean;
  error?: string;
  data?: {
    printJobId: string;
    method: string;
    timestamp: number;
    processedChanges?: string[];
    printedItems?: string[];
    stats?: {
      totalItems: number;
      newItems: number;
      updatedItems: number;
      removedItems: number;
      customizedItems: number;
    };
  };
}

// Print context for kitchen tickets
export interface KitchenPrintContext {
  orderId: string;
  orderType: 'DINE_IN' | 'TAKEOUT' | 'DELIVERY';
  tableInfo?: {
    tableId: string;
    tableName: string;
  };
  customerInfo?: {
    name?: string;
    phone?: string;
    address?: string;
  };
  changes: {
    added: Array<{
      itemId: string;
      itemName: string;
      quantity: number;
      notes?: string;
      customizations?: string[];
    }>;
    updated: Array<{
      itemId: string;
      itemName: string;
      oldQuantity: number;
      newQuantity: number;
      quantityChange: number;
    }>;
    removed: Array<{
      itemId: string;
      itemName: string;
      quantity: number;
      reason?: string;
    }>;
    customized: Array<{
      itemId: string;
      itemName: string;
      customizations: string[];
      notes?: string;
    }>;
  };
  timing: {
    orderStartTime: number;
    lastUpdateTime: number;
    printTime: number;
  };
  printFlags: {
    isImmediate: boolean;
    isPartial: boolean;
    isRetry: boolean;
    urgency: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  };
}

// Print job status tracking
export interface PrintJobStatus {
  jobId: string;
  orderId: string;
  status: 'QUEUED' | 'PRINTING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  timestamp: number;
  printerName: string;
  jobType: 'RECEIPT' | 'KITCHEN' | 'INVOICE' | 'CANCELLATION';
  changeIds?: string[];
  error?: string;
  retryCount?: number;
  estimatedCompletionTime?: number;
}

// Print queue management
export interface PrintQueueItem {
  id: string;
  priority: number;
  request: EnhancedPrintRequest;
  context?: KitchenPrintContext;
  retries: number;
  maxRetries: number;
  scheduledTime: number;
  dependencies?: string[]; // Other print jobs this depends on
}

// Printer capability information
export interface EnhancedPrinterInfo {
  name: string;
  displayName: string;
  isDefault: boolean;
  isOnline: boolean;
  capabilities: {
    supportsKitchenTickets: boolean;
    supportsChangeTracking: boolean;
    supportsColors: boolean;
    supportsGraphics: boolean;
    paperWidth: number; // in characters
    maxCopies: number;
  };
  status: {
    isReady: boolean;
    hasError: boolean;
    errorMessage?: string;
    paperLevel?: 'FULL' | 'LOW' | 'EMPTY' | 'UNKNOWN';
    lastPrintTime?: number;
  };
  performance: {
    averagePrintTime: number; // milliseconds
    successRate: number; // percentage
    queuedJobs: number;
  };
}

// Print statistics and monitoring
export interface PrintStatistics {
  orderId: string;
  totalPrintJobs: number;
  successfulPrints: number;
  failedPrints: number;
  averagePrintTime: number;
  lastPrintTime?: number;
  changesPrinted: number;
  changesUnprinted: number;
  printHistory: Array<{
    timestamp: number;
    jobType: string;
    success: boolean;
    error?: string;
    changeCount: number;
  }>;
}

// Export utility types
export type PrintJobType = 'RECEIPT' | 'KITCHEN' | 'INVOICE' | 'CANCELLATION';
export type PrintPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
export type PrintStatus =
  | 'QUEUED'
  | 'PRINTING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';
export type ChangeType = 'ADD' | 'UPDATE' | 'REMOVE' | 'CUSTOMIZE' | 'NOTE';
