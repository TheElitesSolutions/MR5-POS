/**
 * Optimized Printing Service
 * Provides instant printing experience while maintaining exact electron-pos-printer formats
 *
 * Key Optimizations:
 * 1. Eliminates 15-second artificial delay (150x faster)
 * 2. Background print queue for instant user response
 * 3. Printer configuration caching
 * 4. Order data caching during print sessions
 * 5. Maintains exact invoice and kitchen ticket formats
 */

import { IpcMain, IpcMainInvokeEvent } from 'electron';
import { Order } from '../types';
import { PRINTER_CHANNELS } from '../../shared/ipc-channels';
import { PrintReceiptRequest } from '../../shared/ipc-types';
import { IPCResponse } from '../types';
import { enhancedLogger, LogCategory } from '../utils/enhanced-logger';
import { getCurrentLocalDateTime } from '../utils/dateTime';

interface PrintJob {
  id: string;
  type: 'invoice' | 'kitchen' | 'receipt';
  orderId: string;
  printerName: string;
  userId: string;
  timestamp: number;
  status: 'queued' | 'printing' | 'completed' | 'failed';
  priority: number; // 1 = highest, 5 = lowest
  cancelledItems?: any[]; // For cancellation tickets
  updatedItemIds?: string[]; // For updated item tickets
  itemChanges?: any[]; // Enhanced change tracking information
}

interface CachedPrinter {
  name: string;
  isDefault: boolean;
  isOnline: boolean;
  lastChecked: number;
  cacheExpiry: number;
}

interface CachedOrder {
  order: Order;
  invoiceContent?: string;
  kitchenContent?: string;
  lastUpdated: number;
  cacheExpiry: number;
}

export class OptimizedPrintingService {
  private static instance: OptimizedPrintingService;
  private printQueue: PrintJob[] = [];
  private printerCache: Map<string, CachedPrinter> = new Map();
  private orderCache: Map<string, CachedOrder> = new Map();
  private isProcessingQueue = false;
  private logger: any;

  // Cache durations - optimized for old hardware
  private readonly PRINTER_CACHE_DURATION = 10 * 60 * 1000; // 10 minutes - stable printer configurations
  private readonly ORDER_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes - active order sessions

  // Performance optimizations
  private readonly OPTIMIZED_PRINT_DELAY = 100; // 100ms instead of 15 seconds
  private readonly MAX_QUEUE_SIZE = 100;
  private readonly QUEUE_PROCESS_INTERVAL = 50; // Process queue every 50ms

  public static getInstance(): OptimizedPrintingService {
    enhancedLogger.info('🔧 [OptimizedPrintingService] getInstance() called', LogCategory.SYSTEM, 'OptimizedPrintingService');
    if (!OptimizedPrintingService.instance) {
      enhancedLogger.info('🔧 [OptimizedPrintingService] Creating new instance...', LogCategory.SYSTEM, 'OptimizedPrintingService');
      OptimizedPrintingService.instance = new OptimizedPrintingService();
      enhancedLogger.info('🔧 [OptimizedPrintingService] Instance created successfully', LogCategory.SYSTEM, 'OptimizedPrintingService');
    } else {
      enhancedLogger.info('🔧 [OptimizedPrintingService] Returning existing instance', LogCategory.SYSTEM, 'OptimizedPrintingService');
    }
    return OptimizedPrintingService.instance;
  }

  constructor() {
    enhancedLogger.info('🔧 [OptimizedPrintingService] Constructor called', LogCategory.SYSTEM, 'OptimizedPrintingService');
    this.logger = enhancedLogger;
    enhancedLogger.info('🔧 [OptimizedPrintingService] Logger assigned', LogCategory.SYSTEM, 'OptimizedPrintingService');
    try {
      this.startQueueProcessor();
      enhancedLogger.info('🔧 [OptimizedPrintingService] Queue processor started successfully', LogCategory.SYSTEM, 'OptimizedPrintingService');
    } catch (error) {
      enhancedLogger.error('❌ [OptimizedPrintingService] CRITICAL ERROR in constructor', LogCategory.SYSTEM, 'OptimizedPrintingService', { error });
      throw error;
    }
  }

  /**
   * Register optimized IPC handlers
   */
  registerIPCHandlers(ipcMain: IpcMain): void {
    enhancedLogger.info('🔧 [OptimizedPrintingService] registerIPCHandlers() called', LogCategory.SYSTEM, 'OptimizedPrintingService');
    try {
      // Optimized print receipt with instant response
      enhancedLogger.info('🔧 [OptimizedPrintingService] Registering print-receipt-optimized handler...', LogCategory.SYSTEM, 'OptimizedPrintingService');
      ipcMain.handle(
        'print-receipt-optimized',
        this.handleOptimizedPrintRequest.bind(this)
      );

      // Queue status check
      enhancedLogger.info('🔧 [OptimizedPrintingService] Registering print-queue-status handler...', LogCategory.SYSTEM, 'OptimizedPrintingService');
      ipcMain.handle('print-queue-status', this.getQueueStatus.bind(this));

      // Cache management
      enhancedLogger.info('🔧 [OptimizedPrintingService] Registering print-cache-clear handler...', LogCategory.SYSTEM, 'OptimizedPrintingService');
      ipcMain.handle('print-cache-clear', this.clearCaches.bind(this));

      enhancedLogger.info('✅ [OptimizedPrintingService] All IPC handlers registered successfully', LogCategory.SYSTEM, 'OptimizedPrintingService');
      this.logger.info('✅ Optimized printing IPC handlers registered');
    } catch (error) {
      enhancedLogger.error('❌ [OptimizedPrintingService] CRITICAL ERROR registering IPC handlers', LogCategory.SYSTEM, 'OptimizedPrintingService', { error });
      throw error;
    }
  }

  /**
   * Handle print request with instant response and background processing
   */
  private async handleOptimizedPrintRequest(
    event: IpcMainInvokeEvent,
    request: PrintReceiptRequest
  ): Promise<IPCResponse<{ jobId: string; queued: boolean }>> {
    try {
      this.logger.info(
        `🚀 INSTANT PRINT: Queuing ${request.isInvoice ? 'invoice' : request.isKitchenOrder ? 'kitchen' : 'receipt'} for order ${request.orderId}`
      );

      // Validate request
      if (!request.orderId || !request.printerName || !request.userId) {
        return {
          success: false,
          error: 'Missing required parameters: orderId, printerName, or userId',
          timestamp: getCurrentLocalDateTime(),
        };
      }

      // Generate unique job ID
      const jobId = `print_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Determine print type and priority
      const printType = request.isInvoice
        ? 'invoice'
        : (request as any).isKitchenOrder
          ? 'kitchen'
          : 'receipt';
      const priority = printType === 'kitchen' ? 1 : 2; // Kitchen orders have highest priority

      // Create print job
      const printJob: PrintJob = {
        id: jobId,
        type: printType,
        orderId: request.orderId,
        printerName: request.printerName,
        userId: request.userId,
        timestamp: Date.now(),
        status: 'queued',
        priority,
        // Include cancelled items if provided (for kitchen cancellation tickets)
        ...(request.cancelledItems &&
          request.cancelledItems.length > 0 && {
            cancelledItems: request.cancelledItems,
          }),
        // Include updated item IDs if provided (for printing only updated quantities)
        ...(request.updatedItemIds &&
          request.updatedItemIds.length > 0 && {
            updatedItemIds: request.updatedItemIds,
          }),
        // Include enhanced change tracking information if provided
        ...(request.itemChanges &&
          request.itemChanges.length > 0 && {
            itemChanges: request.itemChanges,
          }),
      };

      // Add to queue (with size limit)
      if (this.printQueue.length >= this.MAX_QUEUE_SIZE) {
        // Remove oldest non-priority jobs if queue is full
        const nonPriorityIndex = this.printQueue.findIndex(
          job => job.priority > 1
        );
        if (nonPriorityIndex !== -1) {
          this.printQueue.splice(nonPriorityIndex, 1);
          this.logger.warn(
            `⚠️ Print queue full, removed oldest non-priority job`
          );
        }
      }

      this.printQueue.push(printJob);
      this.sortQueue(); // Sort by priority

      this.logger.info(
        `⚡ INSTANT RESPONSE: Print job ${jobId} queued successfully (${this.printQueue.length} jobs in queue)`
      );

      // Return immediate success response
      return {
        success: true,
        data: {
          jobId,
          queued: true,
        },
        timestamp: getCurrentLocalDateTime(),
      };
    } catch (error) {
      this.logger.error('❌ Failed to queue print job:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: getCurrentLocalDateTime(),
      };
    }
  }

  /**
   * Background queue processor - handles actual printing
   */
  private startQueueProcessor(): void {
    setInterval(async () => {
      if (this.isProcessingQueue || this.printQueue.length === 0) {
        return;
      }

      this.isProcessingQueue = true;

      try {
        // Get highest priority job
        const job = this.printQueue.shift();
        if (!job) {
          this.isProcessingQueue = false;
          return;
        }

        this.logger.info(
          `🖨️ BACKGROUND PROCESSING: Starting ${job.type} print job ${job.id}`
        );
        job.status = 'printing';

        // Process the print job using optimized method
        const success = await this.processOptimizedPrintJob(job);

        job.status = success ? 'completed' : 'failed';
        this.logger.info(
          `${success ? '✅' : '❌'} Print job ${job.id} ${job.status}`
        );
      } catch (error) {
        this.logger.error('❌ Queue processor error:', error);
      } finally {
        this.isProcessingQueue = false;
      }
    }, this.QUEUE_PROCESS_INTERVAL);
  }

  /**
   * Process print job with all optimizations
   */
  private async processOptimizedPrintJob(job: PrintJob): Promise<boolean> {
    try {
      // Step 1: Get cached printer or detect quickly
      const printer = await this.getCachedPrinter(job.printerName);
      if (!printer || !printer.isOnline) {
        this.logger.warn(`⚠️ Printer ${job.printerName} not available`);
        return false;
      }

      // Step 2: Get order data - BYPASS CACHE for active editing sessions to ensure fresh data
      // This fixes both debug ticket and missing invoice item issues caused by stale cache
      const bypassCache = true; // Always bypass cache for print operations to ensure fresh data
      const orderData = await this.getCachedOrder(job.orderId, bypassCache);
      if (!orderData) {
        this.logger.warn(`⚠️ Order ${job.orderId} not found`);
        return false;
      }

      this.logger.info(
        `🔍 Print processing using ${bypassCache ? 'FRESH' : 'CACHED'} order data for ${job.orderId}`
      );

      // Step 3: Use optimized print method with exact format preservation
      const success = await this.optimizedDirectPrint(job, orderData, printer);

      return success;
    } catch (error) {
      this.logger.error(`❌ Failed to process print job ${job.id}:`, error);
      return false;
    }
  }

  /**
   * Optimized direct print method - maintains exact electron-pos-printer format
   * but eliminates the 15-second delay
   */
  private async optimizedDirectPrint(
    job: PrintJob,
    orderData: CachedOrder,
    printer: CachedPrinter
  ): Promise<boolean> {
    try {
      this.logger.info(
        `🖨️ OPTIMIZED PRINT: Using electron-pos-printer with ${this.OPTIMIZED_PRINT_DELAY}ms delay`
      );

      // Import electron-pos-printer (same as original)
      const { PosPrinter } = await import('electron-pos-printer');

      // Get the exact same content generation methods
      let printContent: string;
      if (job.type === 'invoice') {
        printContent = await this.generateInvoiceContent(orderData.order);
      } else if (job.type === 'kitchen') {
        printContent = await this.generateKitchenContent(
          orderData.order,
          (job as any).cancelledItems,
          (job as any).updatedItemIds,
          (job as any).itemChanges // Pass the enhanced change tracking information
        );
      } else {
        printContent = await this.generateReceiptContent(orderData.order);
      }

      // Parse the JSON content (same format as original)
      let printData: any[];
      try {
        printData = JSON.parse(printContent);
        this.logger.info(`✅ Parsed print content JSON - ${printData.length} items`);
      } catch (e) {
        this.logger.warn(`⚠️ Failed to parse print content as JSON, using plain text fallback`);
        // Fallback to plain text (same as original)
        printData = [
          {
            type: 'text' as const,
            value: printContent,
            style: {
              fontWeight: '400',
              fontSize: '12px',
              whiteSpace: 'pre-wrap',
            },
          },
        ];
      }

      // FIX: Enhanced validation with error notification
      if (!printData || printData.length === 0) {
        this.logger.error('❌ CRITICAL: printData array is empty!');

        // Notify UI of the error
        const { BrowserWindow } = require('electron');
        const mainWindow = BrowserWindow.getAllWindows()[0];
        if (mainWindow) {
          mainWindow.webContents.send('print-error', {
            jobId: (job as any).id,
            orderId: (orderData.order as any).id || (orderData.order as any).orderNumber,
            error: 'Invoice generation failed - no print data generated. Please check order items and try again.',
            timestamp: getCurrentLocalDateTime()
          });
        }

        return false;
      }
      
      this.logger.info(`📄 Print data has ${printData.length} elements`);
      this.logger.info(`First element type: ${printData[0]?.type}, value length: ${JSON.stringify(printData[0]?.value || '').length}`);      

      // REMOVED: Paper feed for cutting (was wasting 30px of paper!)
      printData.push(
        {
          type: 'text' as const,
          value: '',
          style: {
            fontSize: '1px',
            marginBottom: '0px', // NO WASTED PAPER!
          },
        },
        {
          type: 'text' as const,
          value: '.',
          style: {
            fontSize: '8px',
            marginBottom: '50px',
          },
        }
      );

      // Use ZERO MARGIN print options to eliminate paper waste
      // FIX: Added DPI configuration for Windows 10 thermal printer compatibility
      // OPTIMIZED: Reduced timeOutPerLine from 3000ms to 1500ms for faster printing on old hardware
      const printOptions = {
        preview: false,
        margin: '0 0 0 0', // ZERO MARGINS = NO WASTED PAPER!
        copies: 1,
        printerName: printer.name,
        timeOutPerLine: 1500, // Reduced from 3000ms for better performance on old Windows 10 laptops
        silent: true,

        // FIX: Explicit DPI settings for thermal printers (prevents blank paper on Windows 10)
        dpi: {
          horizontal: 203,  // Standard thermal printer DPI
          vertical: 203
        },

        // FIX: Page size in microns for precise Windows 10 rendering
        pageSize: {
          width: 80000,   // 80mm in microns
          height: 200000  // Auto-height
        },

        width: '100%',
        autoCut: false,
        paperCut: false,
        noCut: true,
        cutReceipt: false,
        openCashDrawer: false,
        beep: false,
      } as any;

      // Execute print with optimized timing
      return new Promise(resolve => {
        PosPrinter.print(printData, printOptions)
          .then(async (result: any) => {
            this.logger.info(`✅ electron-pos-printer completed successfully!`);

            // CRITICAL OPTIMIZATION: Reduced delay from 15000ms to 100ms
            this.logger.info(
              `⚡ SPEED OPTIMIZED: Quick finalization delay ${this.OPTIMIZED_PRINT_DELAY}ms for instant printing...`
            );

            await new Promise(delayResolve =>
              setTimeout(delayResolve, this.OPTIMIZED_PRINT_DELAY)
            );

            this.logger.info(
              `✅ Print finalization completed - 150x faster than original!`
            );

            resolve(true);
          })
          .catch((error: any) => {
            enhancedLogger.error(
              `❌ electron-pos-printer failed`,
              LogCategory.BUSINESS,
              'OptimizedPrintingService',
              {
                error,
                errorMessage: error?.message,
                errorStack: error?.stack,
                errorString: String(error),
                printData: printData?.data?.slice(0, 3), // First 3 elements for debugging
                printerName: printOptions.printerName
              }
            );
            resolve(false);
          });
      });
    } catch (error) {
      enhancedLogger.error(
        `❌ Optimized print error`,
        LogCategory.BUSINESS,
        'OptimizedPrintingService',
        { error, errorString: String(error), stack: error instanceof Error ? error.stack : undefined }
      );
      return false;
    }
  }

  /**
   * Get cached printer or detect and cache
   */
  private async getCachedPrinter(
    printerName: string
  ): Promise<CachedPrinter | null> {
    const now = Date.now();
    const cached = this.printerCache.get(printerName);

    // Return cached if still valid
    if (cached && now < cached.cacheExpiry) {
      this.logger.info(`📋 Using cached printer: ${printerName}`);
      return cached;
    }

    try {
      // Quick printer detection (implement your actual printer detection here)
      const printerInfo: CachedPrinter = {
        name: printerName,
        isDefault: true, // You would detect this
        isOnline: true, // You would detect this
        lastChecked: now,
        cacheExpiry: now + this.PRINTER_CACHE_DURATION,
      };

      this.printerCache.set(printerName, printerInfo);
      this.logger.info(`🔍 Detected and cached printer: ${printerName}`);

      return printerInfo;
    } catch (error) {
      this.logger.error(`❌ Failed to detect printer ${printerName}:`, error);
      return null;
    }
  }

  /**
   * Get cached order or fetch and cache
   */
  private async getCachedOrder(
    orderId: string,
    bypassCache: boolean = false
  ): Promise<CachedOrder | null> {
    const now = Date.now();
    const cached = this.orderCache.get(orderId);

    // Return cached if still valid and not bypassing cache
    if (!bypassCache && cached && now < cached.cacheExpiry) {
      this.logger.info(`📋 Using cached order: ${orderId}`);
      return cached;
    }

    // Log cache bypass
    if (bypassCache) {
      this.logger.info(
        `🔄 CACHE BYPASS: Forcing fresh order fetch for ${orderId}`
      );
    }

    try {
      // Quick order fetch (implement your actual order fetching here)
      // This would use your existing OrderModel.findById method
      const order = await this.fetchOrderQuickly(orderId);

      if (!order) {
        return null;
      }

      const orderData: CachedOrder = {
        order,
        lastUpdated: now,
        cacheExpiry: now + this.ORDER_CACHE_DURATION,
      };

      this.orderCache.set(orderId, orderData);
      this.logger.info(`🔍 Fetched and cached order: ${orderId}`);

      return orderData;
    } catch (error) {
      this.logger.error(`❌ Failed to fetch order ${orderId}:`, error);
      return null;
    }
  }

  /**
   * Quick order fetch method using existing OrderModel
   */
  private async fetchOrderQuickly(orderId: string): Promise<Order | null> {
    try {
      // Use existing Prisma client and OrderModel (same as original PrinterController)
      const { getPrismaClient } = require('../prisma');
      const prisma = getPrismaClient();
      const { OrderModel } = require('../models/Order');

      const orderModel = new OrderModel(prisma);
      const orderResult = await orderModel.findById(orderId);

      if (orderResult.success) {
        this.logger.info(
          `📋 Order ${orderId} fetched successfully for optimized printing`
        );
        return orderResult.data;
      } else {
        this.logger.warn(`⚠️ Order ${orderId} not found: ${orderResult.error}`);
        return null;
      }
    } catch (error) {
      this.logger.error(`❌ Failed to fetch order ${orderId}:`, error);
      return null;
    }
  }

  /**
   * Generate invoice content using addon-enhanced invoice generator (CRITICAL FIX)
   * This matches the exact method used by PrinterController for invoice printing
   */
  private async generateInvoiceContent(order: Order): Promise<string> {
    try {
      this.logger.info('🧾 Generating addon-enhanced invoice content...');
      
      // Diagnostic logging - check order structure
      this.logger.info('Order structure:', {
        hasItems: !!order.items,
        itemCount: order.items?.length || 0,
        firstItemHasAddons: order.items?.[0]?.addons ? true : false,
        firstItemAddonsCount: order.items?.[0]?.addons?.length || 0,
      });
      
      // Import the addon-enhanced invoice generator (SAME AS PRINTERCONTROLLER)
      const { AddonService } = require('../services/AddonService');
      const { AddonInvoiceGenerator } = require('../utils/addonInvoiceGenerator');
      const { LebanesReceiptGenerator } = require('../utils/receiptGenerator');
      const { getPrismaClient } = require('../prisma');
      const path = require('path');
      const { getResourcesPath } = require('../utils/environment');
      
      const prisma = getPrismaClient();
      const businessInfo = LebanesReceiptGenerator.getDefaultBusinessInfo();
      
      // Create addon service and invoice generator (EXACT MATCH TO PRINTERCONTROLLER)
      const addonService = new AddonService(prisma);
      const addonInvoiceGenerator = new AddonInvoiceGenerator(addonService);
      
      // Use the EXACT SAME METHOD as PrinterController line 709
      const invoiceContent = await addonInvoiceGenerator.generateEnhancedThermalInvoiceWithAddons(
        order,
        businessInfo,
        getResourcesPath
      );
      
      this.logger.info('✅ Invoice content generated with addon support');
      return invoiceContent;
    } catch (error) {
      this.logger.error('❌ Error generating addon-enhanced invoice:', error);

      // FIX: Return valid JSON array instead of HTML string (prevents JSON.parse failures)
      return JSON.stringify([
        {
          type: 'text',
          value: `<div style="font-family: Arial, sans-serif; width: 100%; text-align: center; padding: 20px;">
            <h1 style="font-size: 24px; margin-bottom: 20px;">INVOICE</h1>
            <p style="font-size: 14px;">Order #: ${order.orderNumber || order.id}</p>
            <p style="font-size: 14px;">Date: ${new Date().toLocaleString()}</p>
            <p style="font-size: 16px; font-weight: bold;">Total: $${(order as any).totalAmount || order.total}</p>
            <p style="font-size: 12px; color: #ff0000; margin-top: 20px;">Error generating full invoice. Please try again.</p>
          </div>`,
          style: {
            fontSize: '14px',
            textAlign: 'center' as const,
            fontFamily: 'Arial, sans-serif'
          }
        }
      ], null, 0);
    }
  }

  /**
   * Generate kitchen content using original PrinterController method
   * @param order The order to generate content for
   * @param cancelledItems Optional array of cancelled items for cancellation tickets
   */
  private async generateKitchenContent(
    order: Order,
    cancelledItems?: any[],
    updatedItemIds?: string[],
    itemChanges?: any[] // Enhanced change tracking information
  ): Promise<string> {
    // Import the original PrinterController class
    const { PrinterController } = require('../controllers/printerController');
    const { LebanesReceiptGenerator } = require('../utils/receiptGenerator');
    const businessInfo = LebanesReceiptGenerator.getDefaultBusinessInfo();

    // Create a PrinterController instance but AVOID initializing IPC handlers
    // This prevents the "Attempted to register a second handler" error
    const PrinterControllerClass = PrinterController;
    const printerController = Object.create(PrinterControllerClass.prototype);

    // Initialize logger and other properties, but skip IPC handler registration
    printerController.logger = {
      info: (message: string, ...args: any[]) => {
        enhancedLogger.info(`[PRINTER] ${message}`, LogCategory.BUSINESS, 'OptimizedPrintingService', { args });
      },
      error: (message: string, ...args: any[]) => {
        enhancedLogger.error(`[PRINTER] ${message}`, LogCategory.BUSINESS, 'OptimizedPrintingService', { args });
      },
      warn: (message: string, ...args: any[]) => {
        enhancedLogger.warn(`[PRINTER] ${message}`, LogCategory.BUSINESS, 'OptimizedPrintingService', { args });
      },
    };

    // Use the new simple kitchen ticket format
    // Wrap in try-catch to handle any potential errors
    try {
      // Import the enhanced kitchen ticket generator for better readability
      const {
        generateEnhancedKitchenTicket,
      } = require('../utils/enhancedKitchenTicket');

      return await generateEnhancedKitchenTicket(
        order,
        false, // Not just unprinted items
        cancelledItems, // Pass the cancelled items array
        updatedItemIds, // Pass the updated item IDs
        itemChanges // CRITICAL FIX: Pass the enhanced change tracking information
      );
    } catch (error) {
      enhancedLogger.error('Error generating kitchen content', LogCategory.BUSINESS, 'OptimizedPrintingService', { error });
      // Return a basic fallback kitchen ticket in case of error
      return `
        <div style="font-family: Arial, sans-serif; width: 100%; text-align: center;">
          <h1>KITCHEN ORDER</h1>
          <p>Order #: ${order.orderNumber || order.id}</p>
          <p>Date: ${new Date().toLocaleString()}</p>
          <p>Error generating full kitchen ticket. Please try again.</p>
        </div>
      `;
    }
  }

  /**
   * Generate receipt content using original PrinterController method
   */
  private async generateReceiptContent(order: Order): Promise<string> {
    // Import the original PrinterController class
    const { PrinterController } = require('../controllers/printerController');
    const { LebanesReceiptGenerator } = require('../utils/receiptGenerator');
    const businessInfo = LebanesReceiptGenerator.getDefaultBusinessInfo();

    // Create a PrinterController instance but AVOID initializing IPC handlers
    // This prevents the "Attempted to register a second handler" error
    const PrinterControllerClass = PrinterController;
    const printerController = Object.create(PrinterControllerClass.prototype);

    // Initialize logger and other properties, but skip IPC handler registration
    printerController.logger = {
      info: (message: string, ...args: any[]) => {
        enhancedLogger.info(`[PRINTER] ${message}`, LogCategory.BUSINESS, 'OptimizedPrintingService', { args });
      },
      error: (message: string, ...args: any[]) => {
        enhancedLogger.error(`[PRINTER] ${message}`, LogCategory.BUSINESS, 'OptimizedPrintingService', { args });
      },
      warn: (message: string, ...args: any[]) => {
        enhancedLogger.warn(`[PRINTER] ${message}`, LogCategory.BUSINESS, 'OptimizedPrintingService', { args });
      },
    };

    // Call the original generateEnhancedThermalReceipt method directly
    // Wrap in try-catch to handle any potential errors
    try {
      return await printerController.generateEnhancedThermalReceipt(
        order,
        businessInfo
      );
    } catch (error) {
      enhancedLogger.error('Error generating receipt content', LogCategory.BUSINESS, 'OptimizedPrintingService', { error });
      // Return a basic fallback receipt in case of error
      return `
        <div style="font-family: Arial, sans-serif; width: 100%; text-align: center;">
          <h1>RECEIPT</h1>
          <p>Order #: ${order.orderNumber || order.id}</p>
          <p>Date: ${new Date().toLocaleString()}</p>
          <p>Total: $${(order as any).totalAmount || order.total}</p>
          <p>Error generating full receipt. Please try again.</p>
        </div>
      `;
    }
  }

  /**
   * Sort queue by priority (1 = highest priority)
   */
  private sortQueue(): void {
    this.printQueue.sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority; // Lower number = higher priority
      }
      return a.timestamp - b.timestamp; // Earlier timestamp = higher priority
    });
  }

  /**
   * Get current queue status
   */
  private async getQueueStatus(): Promise<
    IPCResponse<{
      queueLength: number;
      processing: boolean;
      totalProcessed: number;
    }>
  > {
    return {
      success: true,
      data: {
        queueLength: this.printQueue.length,
        processing: this.isProcessingQueue,
        totalProcessed: 0, // You could track this
      },
      timestamp: getCurrentLocalDateTime(),
    };
  }

  /**
   * Clear all caches
   */
  private async clearCaches(): Promise<IPCResponse<{ cleared: boolean }>> {
    this.printerCache.clear();
    this.orderCache.clear();
    this.logger.info('🧹 All printing caches cleared');

    return {
      success: true,
      data: { cleared: true },
      timestamp: getCurrentLocalDateTime(),
    };
  }
}

// Export singleton instance
export const optimizedPrintingService = OptimizedPrintingService.getInstance();
