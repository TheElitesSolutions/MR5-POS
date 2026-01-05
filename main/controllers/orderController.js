// Order Controller for Main Process IPC Handling
import { dialog, app } from 'electron';
import { ORDER_CHANNELS } from '../../shared/ipc-channels';
import { logError, logInfo } from '../error-handler';
import { OrderModel } from '../models/Order';
import { OrderService } from '../services/orderService';
import { ServiceRegistry } from '../services/serviceRegistry';
import { OrderStatus, } from '../types/index';
import { AdvancedLogger } from '../utils/advancedLogger';
import { LebanesReceiptGenerator } from '../utils/receiptGenerator';
import { BaseController } from './baseController';
import { InventoryService } from '../services/inventoryService';
import { AddonService } from '../services/AddonService';
import { OrderControllerAddonExtensions, } from './orderController.addon-extensions';
import { prisma } from '../db/prisma-wrapper';
import { CreateOrderSchema, UpdateOrderStatusSchema } from '../../shared/validation-schemas';
import { validateWithSchema } from '../utils/validation-helpers';
import { Decimal } from 'decimal.js';
import { exportOrdersToExcel } from '../utils/excelExport';
import * as path from 'path';
import { getCurrentLocalDateTime } from '../utils/dateTime';
/**
 * Safely convert a date to ISO string
 * Handles both Date objects and string inputs
 */
function toISOString(date) {
    if (!date)
        return getCurrentLocalDateTime();
    if (typeof date === 'string')
        return date;
    if (date instanceof Date)
        return date.toISOString();
    return getCurrentLocalDateTime();
}
/**
 * Order Controller handles IPC communication for order-related operations
 * Acts as a bridge between renderer process and backend server
 */
export class OrderController extends BaseController {
    constructor() {
        super();
        this.orderModel = new OrderModel(prisma);
        // Use ServiceRegistry for proper service instantiation
        this.registry = ServiceRegistry.getInstance(prisma);
        this.orderService = this.registry.registerService(OrderService);
        // Initialize add-on services
        this.addonService = new AddonService(prisma);
        this.addonExtensions = new OrderControllerAddonExtensions(prisma, this.addonService, this.orderModel);
        // this.initialize(); // Removed: StartupManager calls initialize() explicitly
    }
    registerHandlers() {
        // Order handlers
        this.registerHandler(ORDER_CHANNELS.GET_ALL, this.getAllOrders.bind(this));
        this.registerHandler(ORDER_CHANNELS.GET_BY_ID, this.getOrderById.bind(this));
        this.registerHandler(ORDER_CHANNELS.CREATE, this.createOrder.bind(this));
        this.registerHandler(ORDER_CHANNELS.UPDATE, this.updateOrder.bind(this));
        this.registerHandler(ORDER_CHANNELS.CANCEL, this.cancelOrder.bind(this));
        this.registerHandler(ORDER_CHANNELS.COMPLETE, this.completeOrder.bind(this));
        this.registerHandler(ORDER_CHANNELS.GENERATE_RECEIPT, this.generateReceipt.bind(this));
        this.registerHandler(ORDER_CHANNELS.GET_BY_TABLE, this.getOrdersByTable.bind(this));
        this.registerHandler(ORDER_CHANNELS.GET_BY_TYPE, this.getOrdersByType.bind(this));
        this.registerHandler(ORDER_CHANNELS.GET_BY_STATUS, this.getOrdersByStatus.bind(this));
        this.registerHandler(ORDER_CHANNELS.SEARCH, this.searchOrders.bind(this));
        this.registerHandler(ORDER_CHANNELS.DELETE, this.deleteOrder.bind(this));
        this.registerHandler(ORDER_CHANNELS.UPDATE_STATUS, this.updateOrderStatus.bind(this));
        this.registerHandler(ORDER_CHANNELS.ADD_ITEM, this.addOrderItem.bind(this));
        this.registerHandler(ORDER_CHANNELS.REMOVE_ITEM, this.removeOrderItem.bind(this));
        // Register the new handler for updating order item quantity
        this.registerHandler(ORDER_CHANNELS.UPDATE_ITEM_QUANTITY, this.updateOrderItemQuantity.bind(this));
        this.registerHandler(ORDER_CHANNELS.GET_ACTIVE, this.getActiveOrders.bind(this));
        this.registerHandler(ORDER_CHANNELS.GET_COMPLETED, this.getCompletedOrders.bind(this));
        this.registerHandler(ORDER_CHANNELS.GET_CANCELLED, this.getCancelledOrders.bind(this));
        this.registerHandler(ORDER_CHANNELS.CALCULATE_TOTAL, this.calculateOrderTotal.bind(this));
        // Using a proper channel name for payment processing
        this.registerHandler(ORDER_CHANNELS.CALCULATE_TOTAL + ':payment', this.processPayment.bind(this));
        // Cashbox and daily summary handlers
        this.registerHandler(ORDER_CHANNELS.GET_CASHBOX_SUMMARY, this.getCashboxSummary.bind(this));
        this.registerHandler(ORDER_CHANNELS.CLOSE_CASHBOX, this.closeCashbox.bind(this));
        this.registerHandler(ORDER_CHANNELS.GET_ORDERS_COUNT, this.getOrdersCount.bind(this));
        this.registerHandler(ORDER_CHANNELS.EXPORT_ORDERS, this.exportOrders.bind(this));
        // Add-on related handlers
        this.registerHandler('order:addItemWithAddons', this.addOrderItemWithAddons.bind(this));
        this.registerHandler('order:addAddonsToItem', this.addAddonsToOrderItem.bind(this));
        this.registerHandler('order:removeAddonFromItem', this.removeAddonFromOrderItem.bind(this));
        this.registerHandler('order:getItemAddons', this.getOrderItemAddons.bind(this));
        this.registerHandler('order:removeItemWithAddons', this.removeOrderItemWithAddons.bind(this));
        logInfo('Order IPC handlers registered with receipt generation, advanced logging, and add-on support');
        AdvancedLogger.info('OrderController initialized with receipt generation capabilities and add-on support');
    }
    /**
     * Get all orders with logging
     */
    async getAllOrders(_event, filters) {
        try {
            AdvancedLogger.info('Fetching all orders', { filters });
            // Use findAllWithOptions instead of findAll which doesn't accept parameters
            // For findAllWithOptions, we need to cast the filters to match the expected types
            const result = await this.orderModel.findAllWithOptions(filters);
            if (result.success) {
                AdvancedLogger.userAction(filters?.userId || 'system', 'orders_fetched', {
                    count: result.data?.length || 0,
                    filters: filters || {},
                    timestamp: getCurrentLocalDateTime(),
                });
                // Fast shallow copy for IPC safety
                const safeData = result.data
                    ? result.data.map((order) => ({ ...order }))
                    : [];
                return {
                    success: result.success,
                    data: safeData,
                    ...(result.error && { error: result.error }),
                    timestamp: getCurrentLocalDateTime(),
                };
            }
            else {
                return {
                    success: false,
                    error: result.error || 'Unknown order fetch error',
                    timestamp: getCurrentLocalDateTime(),
                };
            }
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to fetch orders';
            AdvancedLogger.errorEvent(`Order fetch error: ${errorMessage}`, 'OrderController', 'error', error instanceof Error ? error.stack : undefined);
            logError(error instanceof Error ? error : new Error('Get all orders error'), 'OrderController');
            return {
                success: false,
                error: errorMessage,
                timestamp: getCurrentLocalDateTime(),
            };
        }
    }
    /**
     * Search orders with filters (date range, status, search term, etc.)
     */
    async searchOrders(_event, params) {
        try {
            AdvancedLogger.info('Searching orders', { params });
            // Use findAllWithOptions with the search parameters
            const result = await this.orderModel.findAllWithOptions({
                status: params?.status,
                tableId: params?.tableId,
                startDate: params?.dateFrom ? new Date(params.dateFrom) : undefined,
                endDate: params?.dateTo ? new Date(params.dateTo) : undefined,
                limit: params?.limit || 20,
                offset: params?.page ? (params.page - 1) * (params.limit || 20) : 0,
            });
            // If there's a search query, filter the results
            let filteredData = result.data || [];
            if (params?.query && result.success && result.data) {
                const searchTerm = params.query.toLowerCase();
                filteredData = result.data.filter((order) => {
                    return (order.orderNumber?.toLowerCase().includes(searchTerm) ||
                        order.table?.name?.toLowerCase().includes(searchTerm) ||
                        order.customerName?.toLowerCase().includes(searchTerm) ||
                        order.customerPhone?.includes(searchTerm));
                });
            }
            if (result.success) {
                AdvancedLogger.userAction('system', 'orders_searched', {
                    count: filteredData.length,
                    params: params || {},
                    timestamp: getCurrentLocalDateTime(),
                });
                // Fast shallow copy for IPC safety
                const safeData = filteredData.map((order) => ({ ...order }));
                return {
                    success: result.success,
                    data: safeData,
                    ...(result.error && { error: result.error }),
                    timestamp: getCurrentLocalDateTime(),
                };
            }
            else {
                return {
                    success: false,
                    error: result.error || 'Unknown search error',
                    timestamp: getCurrentLocalDateTime(),
                };
            }
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to search orders';
            AdvancedLogger.errorEvent(`Order search error: ${errorMessage}`, 'OrderController', 'error', error instanceof Error ? error.stack : undefined);
            logError(error instanceof Error ? error : new Error('Search orders error'), 'OrderController');
            return {
                success: false,
                error: errorMessage,
                timestamp: getCurrentLocalDateTime(),
            };
        }
    }
    /**
     * Get order by ID with logging
     */
    async getOrderById(_event, id) {
        try {
            AdvancedLogger.info(`Fetching order by ID: ${id}`);
            const result = await this.orderModel.findById(id);
            if (result.success && result.data) {
                AdvancedLogger.userAction('system', 'order_viewed', {
                    orderId: id,
                    orderNumber: result.data.orderNumber,
                    timestamp: getCurrentLocalDateTime(),
                });
            }
            return {
                success: result.success,
                data: result.data,
                ...(result.error && { error: result.error }),
                timestamp: getCurrentLocalDateTime(),
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to fetch order';
            AdvancedLogger.errorEvent(`Order fetch error: ${errorMessage}`, 'OrderController', 'error', error instanceof Error ? error.stack : undefined);
            logError(error instanceof Error ? error : new Error('Get order by ID error'), 'OrderController');
            return {
                success: false,
                error: errorMessage,
                timestamp: getCurrentLocalDateTime(),
            };
        }
    }
    /**
     * Create order - properly aligned with IPC contract
     * Follows: IPC -> Controller -> Service -> Model architecture
     */
    async createOrder(_event, orderRequest) {
        try {
            // Runtime validation with Zod
            const validation = validateWithSchema(CreateOrderSchema, orderRequest, 'CreateOrder');
            if (!validation.success) {
                AdvancedLogger.error(`CreateOrder: Validation failed - ${validation.error}`);
                return this.createErrorResponse(new Error(validation.error));
            }
            const validatedRequest = validation.data;
            // Additional business logic validation
            if (validatedRequest.type === 'DINE_IN' && !validatedRequest.tableId) {
                AdvancedLogger.error('CreateOrder: Missing tableId for DINE_IN order');
                return this.createErrorResponse(new Error('Table ID is required for dine-in orders'));
            }
            // Note: Allow empty orders for initial POS workflow - items are added after order creation
            if (!validatedRequest.items || validatedRequest.items.length === 0) {
                validatedRequest.items = []; // Initialize empty items array if not provided
            }
            const orderType = validatedRequest.type || 'DINE_IN';
            AdvancedLogger.info(orderType === 'DINE_IN'
                ? `Creating new DINE_IN order for table: ${validatedRequest.tableId}`
                : `Creating new ${orderType} order`, {
                ...(validatedRequest.tableId && { tableId: validatedRequest.tableId }),
                userId: validatedRequest.userId,
                itemCount: validatedRequest.items.length,
                orderType,
            });
            // Call the service layer (proper architecture)
            const result = await this.orderService.create(validatedRequest);
            if (result.success && result.data) {
                const order = result.data;
                // Log order creation with full details
                AdvancedLogger.userAction(validatedRequest.userId, 'order_created', {
                    orderId: order.id,
                    orderNumber: order.orderNumber,
                    ...(order.tableId && { tableId: order.tableId }),
                    orderType: order.type || 'DINE_IN',
                    total: order.total,
                    itemCount: validatedRequest.items.length,
                    createdAt: getCurrentLocalDateTime(),
                }, '127.0.0.1', 'Electron-Desktop-App');
                // Log detailed order activity
                AdvancedLogger.logOrder({
                    orderId: order.id,
                    action: 'created',
                    changes: {
                        orderRequest: validatedRequest,
                    },
                    userId: validatedRequest.userId,
                    newState: order,
                });
                AdvancedLogger.securityEvent('order_transaction', {
                    action: 'create',
                    userId: validatedRequest.userId,
                    orderId: order.id,
                    amount: order.total,
                    orderType: order.type || 'DINE_IN',
                    ...(order.tableId && { tableId: order.tableId }),
                    timestamp: getCurrentLocalDateTime(),
                }, 'low');
                logInfo(`Order created successfully: ${order.orderNumber} (ID: ${order.id})`);
                return this.createSuccessResponse(order);
            }
            else {
                const errorMessage = result.error || 'Failed to create order';
                AdvancedLogger.error(`Order creation failed: ${errorMessage}`);
                return this.createErrorResponse(new Error(errorMessage));
            }
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to create order';
            AdvancedLogger.errorEvent(`Order creation error: ${errorMessage}`, 'OrderController', 'error', error instanceof Error ? error.stack : undefined, orderRequest?.userId);
            logError(error instanceof Error ? error : new Error('Create order error'), 'OrderController');
            return this.createErrorResponse(error);
        }
    }
    /**
     * Update order with change tracking
     */
    async updateOrder(_event, data) {
        try {
            AdvancedLogger.info(`Updating order: ${data.id}`);
            // Get current state for change tracking
            const currentOrder = await this.orderModel.findById(data.id);
            const result = await this.orderModel.update(data.id, data.updates);
            if (result.success && result.data) {
                const order = result.data;
                // Log order update with detailed change tracking
                AdvancedLogger.userAction(data.userId, 'order_updated', {
                    orderId: data.id,
                    orderNumber: order.orderNumber,
                    changes: data.updates,
                    previousState: currentOrder.data || {},
                    newState: order,
                    updatedAt: getCurrentLocalDateTime(),
                }, '127.0.0.1', 'Electron-Desktop-App');
                // Log detailed order activity
                AdvancedLogger.logOrder({
                    orderId: data.id,
                    action: 'updated',
                    changes: data.updates,
                    userId: data.userId,
                    previousState: currentOrder.data,
                    newState: order,
                });
                // Log security event for significant changes (status, total amount)
                const significantChanges = ['status', 'total', 'discount'];
                const hasSignificantChanges = Object.keys(data.updates).some(key => significantChanges.includes(key));
                if (hasSignificantChanges) {
                    AdvancedLogger.securityEvent('order_modification', {
                        action: 'update',
                        userId: data.userId,
                        orderId: data.id,
                        significantChanges: Object.keys(data.updates).filter(key => significantChanges.includes(key)),
                        changes: data.updates,
                        previousTotal: currentOrder.data?.total,
                        newTotal: order.total,
                        timestamp: getCurrentLocalDateTime(),
                    }, 'medium');
                }
                logInfo(`Order updated successfully: ${order.orderNumber} (ID: ${data.id})`);
            }
            return {
                success: result.success,
                data: result.data,
                ...(result.error && { error: result.error }),
                timestamp: getCurrentLocalDateTime(),
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to update order';
            AdvancedLogger.errorEvent(`Order update error: ${errorMessage}`, 'OrderController', 'error', error instanceof Error ? error.stack : undefined, data.userId);
            logError(error instanceof Error ? error : new Error('Update order error'), 'OrderController');
            return {
                success: false,
                error: errorMessage,
                timestamp: getCurrentLocalDateTime(),
            };
        }
    }
    /**
     * Cancel order with audit trail
     */
    async cancelOrder(_event, data) {
        try {
            AdvancedLogger.info(`Cancelling order: ${data.id}`);
            const result = await this.orderModel.cancel(data.id, data.reason);
            if (result.success && result.data) {
                const order = result.data;
                // Log order cancellation
                AdvancedLogger.userAction(data.userId, 'order_cancelled', {
                    orderId: data.id,
                    orderNumber: order.orderNumber,
                    reason: data.reason,
                    cancelledAmount: order.total,
                    cancelledAt: new Date(),
                }, '127.0.0.1', 'Electron-Desktop-App');
                // Log detailed order activity
                AdvancedLogger.logOrder({
                    orderId: data.id,
                    action: 'cancelled',
                    changes: { status: 'CANCELLED', reason: data.reason },
                    userId: data.userId,
                    newState: order,
                });
                AdvancedLogger.securityEvent('order_cancellation', {
                    userId: data.userId,
                    orderId: data.id,
                    reason: data.reason,
                    cancelledAmount: order.total,
                    timestamp: getCurrentLocalDateTime(),
                }, 'medium');
                logInfo(`Order cancelled successfully: ${order.orderNumber} (ID: ${data.id})`);
            }
            return {
                success: result.success,
                data: result.data,
                ...(result.error && { error: result.error }),
                timestamp: getCurrentLocalDateTime(),
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to cancel order';
            AdvancedLogger.errorEvent(`Order cancellation error: ${errorMessage}`, 'OrderController', 'error', error instanceof Error ? error.stack : undefined, data.userId);
            logError(error instanceof Error ? error : new Error('Cancel order error'), 'OrderController');
            return {
                success: false,
                error: errorMessage,
                timestamp: getCurrentLocalDateTime(),
            };
        }
    }
    /**
     * Complete order with receipt generation
     */
    async completeOrder(_event, data) {
        try {
            AdvancedLogger.info(`Completing order: ${data.id}`);
            const result = await this.orderModel.complete(data.id);
            if (result.success && result.data) {
                const order = result.data;
                // Log order completion
                AdvancedLogger.userAction(data.userId, 'order_completed', {
                    orderId: data.id,
                    orderNumber: order.orderNumber,
                    finalAmount: order.total,
                    completedAt: getCurrentLocalDateTime(),
                }, '127.0.0.1', 'Electron-Desktop-App');
                // Log detailed order activity
                AdvancedLogger.logOrder({
                    orderId: data.id,
                    action: 'completed',
                    changes: { status: 'COMPLETED' },
                    userId: data.userId,
                    newState: order,
                });
                AdvancedLogger.securityEvent('order_completion', {
                    userId: data.userId,
                    orderId: data.id,
                    finalAmount: order.total,
                    timestamp: getCurrentLocalDateTime(),
                }, 'low');
                let receiptData;
                // Generate receipt if requested
                if (data.generateReceipt) {
                    try {
                        const receiptBuffer = await this.generateReceiptForOrder(order);
                        receiptData = receiptBuffer;
                        AdvancedLogger.userAction(data.userId, 'receipt_generated', {
                            orderId: data.id,
                            orderNumber: order.orderNumber,
                            generatedAt: new Date(),
                        });
                    }
                    catch (receiptError) {
                        AdvancedLogger.errorEvent(`Receipt generation failed for order ${data.id}: ${receiptError}`, 'OrderController', 'warning');
                    }
                }
                logInfo(`Order completed successfully: ${order.orderNumber} (ID: ${data.id})`);
                return {
                    success: true,
                    data: { order, ...(receiptData && { receiptData }) },
                    timestamp: getCurrentLocalDateTime(),
                };
            }
            return {
                success: result.success,
                ...(result.error && { error: result.error }),
                timestamp: getCurrentLocalDateTime(),
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to complete order';
            AdvancedLogger.errorEvent(`Order completion error: ${errorMessage}`, 'OrderController', 'error', error instanceof Error ? error.stack : undefined, data.userId);
            logError(error instanceof Error ? error : new Error('Complete order error'), 'OrderController');
            return {
                success: false,
                error: errorMessage,
                timestamp: getCurrentLocalDateTime(),
            };
        }
    }
    /**
     * Generate receipt for an order
     */
    async generateReceipt(_event, data) {
        try {
            AdvancedLogger.info(`Generating receipt for order: ${data.orderId}`);
            const orderResult = await this.orderModel.findById(data.orderId);
            if (!orderResult.success || !orderResult.data) {
                return {
                    success: false,
                    error: 'Order not found',
                    timestamp: getCurrentLocalDateTime(),
                };
            }
            const order = orderResult.data;
            const format = data.format || 'pdf';
            let receiptData;
            if (format === 'thermal') {
                // Generate thermal receipt text
                receiptData = this.generateThermalReceiptForOrder(order);
            }
            else {
                // Generate PDF receipt
                receiptData = await this.generateReceiptForOrder(order);
            }
            // Log receipt generation
            AdvancedLogger.userAction(data.userId, 'receipt_generated', {
                orderId: data.orderId,
                orderNumber: order.orderNumber,
                format,
                generatedAt: new Date(),
            }, '127.0.0.1', 'Electron-Desktop-App');
            AdvancedLogger.securityEvent('receipt_generation', {
                userId: data.userId,
                orderId: data.orderId,
                format,
                timestamp: getCurrentLocalDateTime(),
            }, 'low');
            logInfo(`Receipt generated successfully for order: ${order.orderNumber} (Format: ${format})`);
            return {
                success: true,
                data: { receiptData, format },
                timestamp: getCurrentLocalDateTime(),
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to generate receipt';
            AdvancedLogger.errorEvent(`Receipt generation error: ${errorMessage}`, 'OrderController', 'error', error instanceof Error ? error.stack : undefined, data.userId);
            logError(error instanceof Error ? error : new Error('Generate receipt error'), 'OrderController');
            return {
                success: false,
                error: errorMessage,
                timestamp: getCurrentLocalDateTime(),
            };
        }
    }
    /**
     * Get orders by table with logging
     */
    async getOrdersByTable(_event, tableId) {
        try {
            AdvancedLogger.info(`Fetching orders for table: ${tableId}`);
            const result = await this.orderModel.findByTable(tableId);
            if (result.success) {
                AdvancedLogger.userAction('system', 'table_orders_fetched', {
                    tableId,
                    orderCount: result.data?.length || 0,
                    timestamp: getCurrentLocalDateTime(),
                });
            }
            return {
                success: result.success,
                data: result.data,
                ...(result.error && { error: result.error }),
                timestamp: getCurrentLocalDateTime(),
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error
                ? error.message
                : 'Failed to fetch orders by table';
            AdvancedLogger.errorEvent(`Table orders fetch error: ${errorMessage}`, 'OrderController', 'error', error instanceof Error ? error.stack : undefined);
            logError(error instanceof Error ? error : new Error('Get orders by table error'), 'OrderController');
            return {
                success: false,
                error: errorMessage,
                timestamp: getCurrentLocalDateTime(),
            };
        }
    }
    /**
     * Get orders by status with logging
     */
    async getOrdersByStatus(_event, status) {
        try {
            AdvancedLogger.info(`Fetching orders by status: ${status}`);
            const result = await this.orderModel.findByStatus(status);
            if (result.success) {
                AdvancedLogger.userAction('system', 'status_orders_fetched', {
                    status,
                    orderCount: result.data?.length || 0,
                    timestamp: getCurrentLocalDateTime(),
                });
            }
            return {
                success: result.success,
                data: result.data,
                ...(result.error && { error: result.error }),
                timestamp: getCurrentLocalDateTime(),
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error
                ? error.message
                : 'Failed to fetch orders by status';
            AdvancedLogger.errorEvent(`Status orders fetch error: ${errorMessage}`, 'OrderController', 'error', error instanceof Error ? error.stack : undefined);
            logError(error instanceof Error
                ? error
                : new Error('Get orders by status error'), 'OrderController');
            return {
                success: false,
                error: errorMessage,
                timestamp: getCurrentLocalDateTime(),
            };
        }
    }
    /**
     * Get orders by type with logging
     */
    async getOrdersByType(_event, type) {
        try {
            AdvancedLogger.info(`Fetching orders by type: ${type}`);
            // Convert type string to proper Prisma OrderType
            let orderType = 'DINE_IN';
            if (type === 'TAKEOUT' || type === 'TAKEAWAY') {
                orderType = 'TAKEOUT';
            }
            else if (type === 'DELIVERY') {
                orderType = 'DELIVERY';
            }
            const result = await this.orderService.findByType(orderType);
            if (result.success) {
                AdvancedLogger.userAction('system', 'type_orders_fetched', {
                    type: orderType,
                    orderCount: result.data?.length || 0,
                    timestamp: getCurrentLocalDateTime(),
                });
            }
            return {
                success: result.success,
                data: result.data,
                ...(result.error && { error: result.error }),
                timestamp: getCurrentLocalDateTime(),
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error
                ? error.message
                : 'Failed to fetch orders by type';
            AdvancedLogger.errorEvent(`Type orders fetch error: ${errorMessage}`, 'OrderController', 'error', error instanceof Error ? error.stack : undefined);
            logError(error instanceof Error ? error : new Error('Get orders by type error'), 'OrderController');
            return {
                success: false,
                error: errorMessage,
                timestamp: getCurrentLocalDateTime(),
            };
        }
    }
    /**
     * Generate PDF receipt for order
     */
    async generateReceiptForOrder(order) {
        const receiptData = {
            order: {
                ...order,
                items: order.items || [],
                table: order.table || null,
                user: order.user || null,
            },
            businessInfo: LebanesReceiptGenerator.getDefaultBusinessInfo(),
        };
        return await LebanesReceiptGenerator.generateReceipt(receiptData);
    }
    /**
     * Generate thermal receipt text for order
     */
    generateThermalReceiptForOrder(order) {
        const receiptData = {
            order: {
                ...order,
                items: order.items || [],
                table: order.table || null,
                user: order.user || null,
            },
            businessInfo: LebanesReceiptGenerator.getDefaultBusinessInfo(),
        };
        return LebanesReceiptGenerator.generateThermalReceipt(receiptData);
    }
    /**
     * Delete order with logging
     */
    async deleteOrder(_event, data) {
        try {
            AdvancedLogger.info(`Deleting order: ${data.id}`);
            // Note: OrderModel doesn't have delete method, using update to mark as deleted
            const result = await this.orderModel.updateStatus(data.id, OrderStatus.CANCELLED);
            if (result.success) {
                AdvancedLogger.userAction(data.userId, 'order_deleted', {
                    orderId: data.id,
                    reason: data.reason || 'No reason provided',
                    timestamp: getCurrentLocalDateTime(),
                });
            }
            return {
                success: result.success,
                data: result.success,
                ...(result.error && { error: result.error }),
                timestamp: getCurrentLocalDateTime(),
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to delete order';
            AdvancedLogger.errorEvent(`Order deletion error: ${errorMessage}`, 'OrderController', 'error', error instanceof Error ? error.stack : undefined);
            return {
                success: false,
                error: errorMessage,
                timestamp: getCurrentLocalDateTime(),
            };
        }
    }
    /**
     * Update order status with logging
     */
    async updateOrderStatus(_event, data) {
        try {
            // Runtime validation with Zod
            const validation = validateWithSchema(UpdateOrderStatusSchema, data, 'UpdateOrderStatus');
            if (!validation.success) {
                AdvancedLogger.error(`UpdateOrderStatus: Validation failed - ${validation.error}`);
                return this.createErrorResponse(new Error(validation.error));
            }
            const validatedData = validation.data;
            AdvancedLogger.info(`Updating order status: ${validatedData.id} to ${validatedData.status}`);
            const result = await this.orderModel.updateStatus(validatedData.id, validatedData.status);
            if (result.success && result.data) {
                AdvancedLogger.userAction(validatedData.userId, 'order_status_updated', {
                    orderId: validatedData.id,
                    newStatus: validatedData.status,
                    timestamp: getCurrentLocalDateTime(),
                });
            }
            return {
                success: result.success,
                data: result.data,
                ...(result.error && { error: result.error }),
                timestamp: getCurrentLocalDateTime(),
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error
                ? error.message
                : 'Failed to update order status';
            return {
                success: false,
                error: errorMessage,
                timestamp: getCurrentLocalDateTime(),
            };
        }
    }
    /**
     * Add item to order
     */
    async addOrderItem(_event, data) {
        try {
            AdvancedLogger.info(`Adding item to order atomically: ${data.orderId}`);
            // CRITICAL FIX: Atomic item addition and inventory update in single transaction
            let result;
            try {
                result = await prisma.$transaction(async (tx) => {
                    // Step 1: Add the item to the order within the transaction
                    const menuItemId = data.item.menuItemId;
                    const quantity = data.item.quantity || 1;
                    // Get the menu item to determine pricing
                    const menuItem = await tx.menuItem.findUnique({
                        where: { id: menuItemId },
                    });
                    if (!menuItem) {
                        throw new Error(`Menu item ${menuItemId} not found`);
                    }
                    const unitPrice = data.item.unitPrice || data.item.price || menuItem.price;
                    const totalPrice = Number(unitPrice) * quantity;
                    // ✅ CRITICAL FIX: Don't merge items in backend - let frontend handle matching
                    // The frontend already has sophisticated addon comparison logic
                    // Backend should ALWAYS create new items - frontend decides when to update existing ones
                    // This prevents issues where items with different addons get merged
                    // Always create new item
                    const orderItem = await tx.orderItem.create({
                        data: {
                            orderId: data.orderId,
                            menuItemId: menuItemId,
                            quantity: quantity,
                            unitPrice: unitPrice,
                            totalPrice: totalPrice,
                            notes: data.item.notes || null,
                        },
                        include: { menuItem: true },
                    });
                    // Recalculate order totals
                    const allItems = await tx.orderItem.findMany({
                        where: { orderId: data.orderId },
                    });
                    // ✅ Use Decimal.js for precise calculation
                    let subtotalDecimal = new Decimal(0);
                    for (const item of allItems) {
                        subtotalDecimal = subtotalDecimal.add(item.totalPrice || 0);
                    }
                    const subtotal = Number(subtotalDecimal.toString());
                    const total = subtotal; // No tax
                    console.log('🔍 DEBUG: addOrderItem total recalculation:', {
                        orderId: data.orderId,
                        itemCount: allItems.length,
                        subtotal,
                        total,
                    });
                    await tx.order.update({
                        where: { id: data.orderId },
                        data: {
                            subtotal: subtotal,
                            total: total,
                        },
                    });
                    // Step 2: Process inventory within the same transaction
                    // Get the ingredients for this menu item
                    const ingredients = await tx.menuItemInventory.findMany({
                        where: { menuItemId },
                        include: { inventory: true },
                    });
                    if (ingredients && ingredients.length > 0) {
                        // Calculate required inventory for each ingredient
                        const inventoryUpdates = new Map();
                        for (const inventoryLink of ingredients) {
                            const inventoryId = inventoryLink.inventoryId;
                            const requiredQuantity = inventoryLink.quantity * quantity;
                            // Add to existing quantity or create new entry
                            const currentTotal = inventoryUpdates.get(inventoryId) || 0;
                            inventoryUpdates.set(inventoryId, currentTotal + requiredQuantity);
                        }
                        // Process inventory updates atomically
                        for (const [inventoryId, requiredQuantity,] of Array.from(inventoryUpdates.entries())) {
                            // Get current inventory
                            const inventoryItem = await tx.inventory.findUnique({
                                where: { id: inventoryId },
                            });
                            if (!inventoryItem) {
                                console.warn(`Inventory item ${inventoryId} not found during item addition`);
                                continue;
                            }
                            // Calculate new stock level
                            const currentStock = Number(inventoryItem.currentStock);
                            const newStock = currentStock - requiredQuantity;
                            // Check if we have enough stock
                            if (newStock < 0) {
                                throw new Error(`Insufficient stock for item: ${inventoryItem.itemName}. Available: ${currentStock}, Required: ${requiredQuantity}`);
                            }
                            // Update inventory atomically
                            await tx.inventory.update({
                                where: { id: inventoryId },
                                data: { currentStock: newStock },
                            });
                            console.log('🔍 ATOMIC: Updated inventory for added item:', {
                                inventoryId,
                                itemName: inventoryItem.itemName,
                                previousStock: currentStock,
                                used: requiredQuantity,
                                newStock: newStock,
                                unit: inventoryItem.unit,
                            });
                            // Log the transaction for audit
                            await tx.auditLog.create({
                                data: {
                                    action: 'INVENTORY_DECREASE',
                                    tableName: 'inventory',
                                    recordId: inventoryId,
                                    newValues: {
                                        reason: 'Item added to order',
                                        orderId: data.orderId,
                                        itemId: orderItem.id,
                                        previousStock: currentStock,
                                        used: requiredQuantity,
                                        newStock: newStock,
                                    },
                                },
                            });
                        }
                        console.log('✅ ATOMIC: Item addition and inventory operations completed atomically');
                    }
                    else {
                        console.log('ℹ️ ATOMIC: Menu item has no linked inventory items');
                    }
                    // Serialize orderItem for IPC - convert Prisma Decimals to numbers
                    return {
                        success: true,
                        data: {
                            id: orderItem.id,
                            orderId: orderItem.orderId,
                            menuItemId: orderItem.menuItemId,
                            quantity: orderItem.quantity,
                            unitPrice: Number(orderItem.unitPrice),
                            totalPrice: Number(orderItem.totalPrice),
                            notes: orderItem.notes,
                            status: orderItem.status,
                            createdAt: toISOString(orderItem.createdAt),
                            updatedAt: toISOString(orderItem.updatedAt),
                            name: menuItem.name,
                            menuItemName: menuItem.name,
                            // Include menuItem data if needed
                            menuItem: orderItem.menuItem
                                ? {
                                    id: orderItem.menuItem.id,
                                    name: orderItem.menuItem.name,
                                    description: orderItem.menuItem.description,
                                    price: Number(orderItem.menuItem.price),
                                    categoryId: orderItem.menuItem.categoryId,
                                    isActive: orderItem.menuItem.isActive,
                                }
                                : undefined,
                        },
                        timestamp: getCurrentLocalDateTime(),
                    };
                });
            }
            catch (error) {
                // Transaction failed - both item addition and inventory update are rolled back
                console.error('❌ ATOMIC TRANSACTION FAILED: Item addition and inventory update rolled back', {
                    orderId: data.orderId,
                    menuItemId: data.item.menuItemId,
                    error: error instanceof Error ? error.message : String(error),
                });
                return {
                    success: false,
                    error: error instanceof Error
                        ? error.message
                        : 'Failed to add item and update inventory atomically',
                    timestamp: getCurrentLocalDateTime(),
                };
            }
            return {
                success: result.success,
                data: result.data, // Returns OrderItem, not Order
                ...(result.error && { error: result.error }),
                timestamp: getCurrentLocalDateTime(),
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to add item to order';
            return {
                success: false,
                error: errorMessage,
                timestamp: getCurrentLocalDateTime(),
            };
        }
    }
    /**
     * Remove item from order
     */
    async removeOrderItem(_event, data) {
        try {
            AdvancedLogger.info(`Removing item from order: ${data.orderId}`);
            // First, restore stock for this item before removal
            try {
                // Get the inventory service
                let inventoryService;
                try {
                    inventoryService = this.registry.getServiceByClass(InventoryService);
                }
                catch (e) {
                    // If service doesn't exist yet, register it
                    inventoryService = this.registry.registerService(InventoryService);
                }
                // Restore inventory stock for the item being removed
                AdvancedLogger.info(`Restoring stock for item: ${data.itemId}`);
                const stockResult = await inventoryService.increaseStockForOrderItem(data.itemId);
                if (!stockResult.success) {
                    AdvancedLogger.warn(`Failed to restore stock for item: ${data.itemId}`, {
                        error: stockResult.error,
                    });
                    // Continue with item removal even if stock restoration fails
                    // This prevents order operations from being blocked by inventory issues
                }
                else {
                    AdvancedLogger.info(`Successfully restored stock for item: ${data.itemId}`);
                }
            }
            catch (stockError) {
                // Log the error but continue with item removal
                AdvancedLogger.error(`Error restoring stock: ${stockError instanceof Error ? stockError.message : 'Unknown error'}`, {
                    itemId: data.itemId,
                    orderId: data.orderId,
                });
            }
            // Now remove the item from the order
            const result = await this.orderModel.removeItem(data.itemId);
            return {
                success: result.success,
                data: result.data || false, // Returns boolean
                ...(result.error && { error: result.error }),
                timestamp: getCurrentLocalDateTime(),
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error
                ? error.message
                : 'Failed to remove item from order';
            return {
                success: false,
                error: errorMessage,
                timestamp: getCurrentLocalDateTime(),
            };
        }
    }
    /**
     * Update order item quantity
     * This handles both increasing and decreasing quantities with proper stock adjustment
     */
    async updateOrderItemQuantity(_event, data) {
        try {
            AdvancedLogger.info(`Updating quantity for order item: ${data.itemId} to ${data.quantity}`);
            // First get the current order item to compare quantities
            const orderItem = await prisma.orderItem.findUnique({
                where: { id: data.itemId },
                include: { menuItem: true },
            });
            if (!orderItem) {
                return {
                    success: false,
                    error: 'Order item not found',
                    timestamp: getCurrentLocalDateTime(),
                };
            }
            const currentQuantity = orderItem.quantity;
            const newQuantity = data.quantity;
            // If decreasing quantity, we need to restore stock for the difference
            if (newQuantity < currentQuantity) {
                try {
                    // Get the inventory service
                    let inventoryService; // Available if needed
                    try {
                        inventoryService = this.registry.getService('InventoryService');
                    }
                    catch (e) {
                        // If service doesn't exist yet, register it
                        inventoryService = this.registry.registerService(InventoryService);
                    }
                    // Process partial stock restoration by getting the ingredients and calculating the difference
                    const menuItemId = orderItem.menuItemId;
                    const quantityToRestore = currentQuantity - newQuantity;
                    AdvancedLogger.info(`Partially restoring stock for decreasing quantity`, {
                        menuItemId,
                        currentQuantity,
                        newQuantity,
                        quantityToRestore,
                    });
                    // We need to get all ingredients and manually restore the correct amount
                    // This is a simplified approach - for a full solution we would need a dedicated method
                    // in inventoryService for partial stock restoration
                    const prismaAny = prisma;
                    const ingredients = await prismaAny.menuItemInventory.findMany({
                        where: { menuItemId },
                        include: { inventory: true },
                    });
                    if (ingredients && ingredients.length > 0) {
                        await prisma.$transaction(async (tx) => {
                            for (const link of ingredients) {
                                const inventoryId = link.inventoryId;
                                const amountToRestore = new Decimal(link.quantity).mul(quantityToRestore);
                                const inventoryItem = await tx.inventory.findUnique({
                                    where: { id: inventoryId },
                                });
                                if (inventoryItem) {
                                    const newStock = inventoryItem.currentStock.add(amountToRestore);
                                    await tx.inventory.update({
                                        where: { id: inventoryId },
                                        data: { currentStock: newStock },
                                    });
                                    AdvancedLogger.info(`Restored partial inventory for ${inventoryItem.itemName}`, {
                                        inventoryId,
                                        previousStock: inventoryItem.currentStock.toString(),
                                        restored: amountToRestore.toString(),
                                        newStock: newStock.toString(),
                                        unit: inventoryItem.unit,
                                    });
                                }
                            }
                            // Log the transaction
                            await tx.auditLog.create({
                                data: {
                                    action: 'INVENTORY_PARTIAL_RESTORE',
                                    tableName: 'inventory',
                                    recordId: data.itemId,
                                    newValues: {
                                        reason: 'Order item quantity decreased',
                                        oldQuantity: currentQuantity,
                                        newQuantity: newQuantity,
                                        difference: quantityToRestore,
                                    },
                                },
                            });
                        });
                    }
                }
                catch (stockError) {
                    // Log the error but continue with quantity update
                    AdvancedLogger.error(`Error restoring stock: ${stockError instanceof Error ? stockError.message : 'Unknown error'}`, {
                        itemId: data.itemId,
                        oldQuantity: currentQuantity,
                        newQuantity,
                    });
                }
            }
            // If increasing quantity, atomically check and decrease stock to prevent race conditions
            else if (newQuantity > currentQuantity) {
                try {
                    const quantityToAdd = newQuantity - currentQuantity;
                    const menuItemId = orderItem.menuItemId;
                    // RACE CONDITION FIX: Atomic stock check and decrease within transaction
                    await prisma.$transaction(async (tx) => {
                        // Get menu item and its ingredients
                        const ingredients = await tx.menuItemInventory.findMany({
                            where: { menuItemId },
                            include: { inventory: true },
                        });
                        if (ingredients && ingredients.length > 0) {
                            // Calculate required inventory for additional quantity
                            const inventoryUpdates = new Map();
                            for (const inventoryLink of ingredients) {
                                const inventoryId = inventoryLink.inventoryId;
                                const requiredQuantity = inventoryLink.quantity * quantityToAdd;
                                // Add to existing quantity or create new entry
                                const currentTotal = inventoryUpdates.get(inventoryId) || 0;
                                inventoryUpdates.set(inventoryId, currentTotal + requiredQuantity);
                            }
                            // Process inventory updates atomically with stock checking
                            for (const [inventoryId, requiredQuantity,] of Array.from(inventoryUpdates.entries())) {
                                // Get current inventory and check availability atomically
                                const inventoryItem = await tx.inventory.findUnique({
                                    where: { id: inventoryId },
                                });
                                if (!inventoryItem) {
                                    throw new Error(`Inventory item ${inventoryId} not found`);
                                }
                                // Calculate new stock level
                                const currentStock = Number(inventoryItem.currentStock);
                                const newStock = currentStock - requiredQuantity;
                                // ATOMIC CHECK: Verify stock availability and update in same operation
                                if (newStock < 0) {
                                    throw new Error(`Insufficient stock for item: ${inventoryItem.itemName}. Available: ${currentStock}, Required: ${requiredQuantity}`);
                                }
                                // Update inventory atomically - prevents race conditions
                                await tx.inventory.update({
                                    where: { id: inventoryId },
                                    data: { currentStock: newStock },
                                });
                                AdvancedLogger.info(`Atomically decreased inventory for quantity increase`, {
                                    inventoryId,
                                    itemName: inventoryItem.itemName,
                                    previousStock: currentStock,
                                    used: requiredQuantity,
                                    newStock: newStock,
                                    unit: inventoryItem.unit,
                                    reason: 'Quantity increased',
                                });
                                // Log the transaction for audit
                                await tx.auditLog.create({
                                    data: {
                                        action: 'INVENTORY_DECREASE',
                                        tableName: 'inventory',
                                        recordId: inventoryId,
                                        newValues: {
                                            reason: 'Order item quantity increased',
                                            itemId: data.itemId,
                                            oldQuantity: currentQuantity,
                                            newQuantity: newQuantity,
                                            difference: quantityToAdd,
                                            previousStock: currentStock,
                                            used: requiredQuantity,
                                            newStock: newStock,
                                        },
                                    },
                                });
                            }
                            console.log('✅ ATOMIC: Stock check and decrease completed atomically for quantity increase');
                        }
                    });
                }
                catch (stockError) {
                    AdvancedLogger.error(`Atomic stock operation failed for quantity increase: ${stockError instanceof Error ? stockError.message : 'Unknown error'}`, {
                        itemId: data.itemId,
                        oldQuantity: currentQuantity,
                        newQuantity,
                        quantityToAdd: newQuantity - currentQuantity,
                    });
                    return {
                        success: false,
                        error: stockError instanceof Error
                            ? stockError.message
                            : 'Failed to check and update stock atomically',
                        timestamp: getCurrentLocalDateTime(),
                    };
                }
            }
            // Now update the order item quantity
            const result = await this.orderModel.updateItemQuantity(data.itemId, data.quantity);
            if (!result.success) {
                return {
                    success: false,
                    error: result.error || 'Unknown error',
                    timestamp: getCurrentLocalDateTime(),
                };
            }
            // ✅ FIX: Recalculate order totals after quantity change
            try {
                // Get the order ID from the updated item
                const updatedItem = result.data;
                if (updatedItem && updatedItem.orderId) {
                    console.log('🔍 DEBUG: Recalculating totals after quantity update:', {
                        orderId: updatedItem.orderId,
                        itemId: data.itemId,
                        newQuantity: data.quantity,
                    });
                    await this.orderModel.recalculateOrderTotals(updatedItem.orderId);
                }
            }
            catch (recalcError) {
                console.error('⚠️ WARNING: Failed to recalculate order totals:', recalcError);
                // Don't fail the whole operation, just log the error
            }
            // Handle kitchen notification for the quantity change
            if (result.success && result.data) {
                // If we want to print a kitchen ticket for quantity changes, do it here
                // This could be configurable based on settings
            }
            return {
                success: result.success,
                data: result.data,
                ...(result.error && { error: result.error }),
                timestamp: getCurrentLocalDateTime(),
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error
                ? error.message
                : 'Failed to update order item quantity';
            return {
                success: false,
                error: errorMessage,
                timestamp: getCurrentLocalDateTime(),
            };
        }
    }
    /**
     * Get active orders
     */
    async getActiveOrders(_event) {
        try {
            AdvancedLogger.info('Fetching active orders');
            const result = await this.orderModel.findByStatus('active');
            return {
                success: result.success,
                data: result.data,
                ...(result.error && { error: result.error }),
                timestamp: getCurrentLocalDateTime(),
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error
                ? error.message
                : 'Failed to fetch active orders';
            return {
                success: false,
                error: errorMessage,
                timestamp: getCurrentLocalDateTime(),
            };
        }
    }
    /**
     * Get completed orders
     */
    async getCompletedOrders(_event) {
        try {
            AdvancedLogger.info('Fetching completed orders');
            const result = await this.orderModel.findByStatus('completed');
            return {
                success: result.success,
                data: result.data,
                ...(result.error && { error: result.error }),
                timestamp: getCurrentLocalDateTime(),
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error
                ? error.message
                : 'Failed to fetch completed orders';
            return {
                success: false,
                error: errorMessage,
                timestamp: getCurrentLocalDateTime(),
            };
        }
    }
    /**
     * Get cancelled orders
     */
    async getCancelledOrders(_event) {
        try {
            AdvancedLogger.info('Fetching cancelled orders');
            const result = await this.orderModel.findByStatus('cancelled');
            return {
                success: result.success,
                data: result.data,
                ...(result.error && { error: result.error }),
                timestamp: getCurrentLocalDateTime(),
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error
                ? error.message
                : 'Failed to fetch cancelled orders';
            return {
                success: false,
                error: errorMessage,
                timestamp: getCurrentLocalDateTime(),
            };
        }
    }
    /**
     * Calculate order total
     */
    async calculateOrderTotal(_event, data) {
        try {
            let total = 0;
            let subtotal = 0;
            let tax = 0; // Always 0 since there are no taxes in this restaurant
            if (data.orderId) {
                const orderResult = await this.orderModel.findById(data.orderId);
                if (orderResult.success && orderResult.data) {
                    const order = orderResult.data;
                    total = parseFloat(order.total?.toString() || '0');
                    // Subtotal is same as total since there's no tax
                    subtotal = total;
                    tax = 0;
                }
            }
            else if (data.items) {
                // Calculate from items
                subtotal = data.items.reduce((sum, item) => {
                    const price = parseFloat((item.unitPrice || item.price)?.toString() || '0');
                    const quantity = item.quantity || 1;
                    return sum + price * quantity;
                }, 0);
                tax = 0; // No tax
                total = subtotal; // Total equals subtotal (no tax)
            }
            return {
                success: true,
                data: { total, subtotal, tax },
                timestamp: getCurrentLocalDateTime(),
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error
                ? error.message
                : 'Failed to calculate order total';
            return {
                success: false,
                error: errorMessage,
                timestamp: getCurrentLocalDateTime(),
            };
        }
    }
    /**
     * Process payment for an order
     */
    async processPayment(_event, data) {
        try {
            AdvancedLogger.info(`Processing payment for order: ${data.id}`);
            // Since processPayment doesn't exist, use update instead
            const result = await this.orderModel.update(data.id, {
                paymentMethod: data.paymentMethod,
                tip: data.tip,
            });
            if (result.success && result.data) {
                const order = result.data;
                // Log payment processing
                AdvancedLogger.userAction('system', 'payment_processed', {
                    orderId: data.id,
                    paymentMethod: data.paymentMethod,
                    amount: data.amount,
                    tip: data.tip,
                    processedAt: new Date(),
                }, '127.0.0.1', 'Electron-Desktop-App');
                // Log detailed order activity
                AdvancedLogger.logOrder({
                    orderId: data.id,
                    action: 'paid', // Use a valid action type
                    changes: {
                        paymentMethod: data.paymentMethod,
                        amount: data.amount,
                        tip: data.tip,
                    },
                    userId: 'system',
                    newState: order,
                });
                AdvancedLogger.securityEvent('payment_processing', {
                    userId: 'system',
                    orderId: data.id,
                    paymentMethod: data.paymentMethod,
                    amount: data.amount,
                    tip: data.tip,
                    timestamp: getCurrentLocalDateTime(),
                }, 'low');
                logInfo(`Payment processed successfully for order: ${order.orderNumber} (ID: ${data.id})`);
            }
            return {
                success: result.success,
                data: result.data,
                ...(result.error && { error: result.error }),
                timestamp: getCurrentLocalDateTime(),
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to process payment';
            AdvancedLogger.errorEvent(`Payment processing error: ${errorMessage}`, 'OrderController', 'error', error instanceof Error ? error.stack : undefined, 'system');
            logError(error instanceof Error ? error : new Error('Process payment error'), 'OrderController');
            return {
                success: false,
                error: errorMessage,
                timestamp: getCurrentLocalDateTime(),
            };
        }
    }
    /**
     * Get cashbox summary for a specific business day
     * Business day logic: orders from 6 AM of the selected date to 5:59 AM of the next day
     */
    async getCashboxSummary(_event, data // businessDayStart in hours (default: 6 AM)
    ) {
        try {
            const selectedDate = new Date(data.date);
            const businessDayStart = data.businessDayStart || 6; // Default to 6 AM
            // Calculate business day range
            // Start: 6 AM of selected date
            const startDate = new Date(selectedDate);
            startDate.setHours(businessDayStart, 0, 0, 0);
            // End: 5:59:59 AM of next day
            const endDate = new Date(selectedDate);
            endDate.setDate(endDate.getDate() + 1);
            endDate.setHours(businessDayStart - 1, 59, 59, 999);
            // Convert to ISO strings for SQLite - SQLite can't bind Date objects
            const startDateISO = startDate.toISOString();
            const endDateISO = endDate.toISOString();
            AdvancedLogger.info(`Getting cashbox summary for business day`, {
                selectedDate: selectedDate.toISOString(),
                businessDayRange: {
                    start: startDateISO,
                    end: endDateISO,
                },
            });
            // Since Prisma has issues with date filtering, use raw SQL which works correctly
            const completedOrdersRaw = await prisma.$queryRawUnsafe(`SELECT id, orderNumber, status, type, tableId, customerId, userId,
                subtotal, tax, discount, deliveryFee, total, notes,
                customerName, customerPhone, deliveryAddress,
                createdAt, updatedAt
         FROM orders
         WHERE status = 'COMPLETED'
         AND datetime(updatedAt) >= datetime(?)
         AND datetime(updatedAt) <= datetime(?)`, startDateISO, endDateISO);
            // Convert raw SQL results to match the expected format
            const completedOrders = completedOrdersRaw.map(order => ({
                id: order.id,
                orderNumber: order.orderNumber,
                status: order.status,
                type: order.type || 'DINE_IN',
                tableId: order.tableId,
                customerId: order.customerId,
                userId: order.userId,
                subtotal: parseFloat(order.subtotal?.toString() || '0'),
                tax: parseFloat(order.tax?.toString() || '0'),
                discount: parseFloat(order.discount?.toString() || '0'),
                deliveryFee: parseFloat(order.deliveryFee?.toString() || '0'),
                total: parseFloat(order.total?.toString() || '0'),
                notes: order.notes,
                customerName: order.customerName,
                customerPhone: order.customerPhone,
                deliveryAddress: order.deliveryAddress,
                createdAt: order.createdAt,
                updatedAt: order.updatedAt,
                items: [] // Will be fetched separately
            }));
            // Now manually fetch items for each order (Prisma wrapper limitation workaround)
            const ordersWithItems = await Promise.all(completedOrders.map(async (order) => {
                const items = await prisma.orderItem.findMany({
                    where: { orderId: order.id },
                });
                return { ...order, items };
            }));
            // Calculate totals
            let totalCash = 0;
            let dineInTotal = 0;
            let takeoutTotal = 0;
            let deliveryTotal = 0;
            let totalOrders = completedOrders.length;
            const ordersByStatus = {
                completed: 0,
                pending: 0,
                cancelled: 0,
            };
            const ordersByType = {
                dineIn: 0,
                takeout: 0,
                delivery: 0,
            };
            // Process completed orders
            completedOrders.forEach((order) => {
                const orderTotal = parseFloat(order.total?.toString() || '0');
                // All payments are cash since no card is used
                totalCash += orderTotal;
                // Categorize by order type
                if (order.type === 'DINE_IN') {
                    dineInTotal += orderTotal;
                    ordersByType.dineIn++;
                }
                else if (order.type === 'TAKEOUT' || order.type === 'TAKEAWAY') {
                    takeoutTotal += orderTotal;
                    ordersByType.takeout++;
                }
                else if (order.type === 'DELIVERY') {
                    deliveryTotal += orderTotal;
                    ordersByType.delivery++;
                }
                else {
                    // Default to dine-in if type is not specified
                    dineInTotal += orderTotal;
                    ordersByType.dineIn++;
                }
                ordersByStatus.completed++;
            });
            // Get pending orders for the same period using raw SQL
            const pendingOrdersRaw = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as count FROM orders
         WHERE status = 'PENDING'
         AND datetime(createdAt) >= datetime(?)
         AND datetime(createdAt) <= datetime(?)`, startDateISO, endDateISO);
            ordersByStatus.pending = pendingOrdersRaw[0]?.count || 0;
            // Get cancelled orders for the same period using raw SQL
            const cancelledOrdersRaw = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as count FROM orders
         WHERE status = 'CANCELLED'
         AND datetime(updatedAt) >= datetime(?)
         AND datetime(updatedAt) <= datetime(?)`, startDateISO, endDateISO);
            ordersByStatus.cancelled = cancelledOrdersRaw[0]?.count || 0;
            const totalRevenue = totalCash; // All revenue is cash
            const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
            const cashboxSummary = {
                date: selectedDate.toISOString(),
                businessDayRange: {
                    start: startDate.toISOString(),
                    end: endDate.toISOString(),
                },
                totalCash,
                // Replace card with order type breakdown
                dineInTotal,
                takeoutTotal,
                deliveryTotal,
                totalOrders,
                averageOrderValue,
                ordersByStatus,
                ordersByType,
                totalRevenue,
                // Include the actual orders for display
                orders: completedOrders.map((order) => ({
                    id: order.id,
                    orderNumber: order.orderNumber,
                    status: order.status,
                    type: order.type,
                    total: parseFloat(order.total?.toString() || '0'),
                    createdAt: order.createdAt,
                    items: order.items?.length || 0,
                })),
            };
            AdvancedLogger.info('Cashbox summary calculated', {
                date: selectedDate.toISOString(),
                summary: cashboxSummary,
            });
            return {
                success: true,
                data: cashboxSummary,
                timestamp: getCurrentLocalDateTime(),
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error
                ? error.message
                : 'Failed to get cashbox summary';
            AdvancedLogger.errorEvent(`Cashbox summary error: ${errorMessage}`, 'OrderController', 'error', error instanceof Error ? error.stack : undefined);
            return {
                success: false,
                error: errorMessage,
                timestamp: getCurrentLocalDateTime(),
            };
        }
    }
    /**
     * Close cashbox for a specific business day
     */
    async closeCashbox(_event, data) {
        try {
            const selectedDate = new Date(data.date);
            // Get the cashbox summary first
            const summaryResult = await this.getCashboxSummary(_event, {
                date: data.date,
            });
            if (!summaryResult.success || !summaryResult.data) {
                return {
                    success: false,
                    error: 'Failed to get cashbox summary for closing',
                    timestamp: getCurrentLocalDateTime(),
                };
            }
            const summary = summaryResult.data;
            // Log the cashbox closing event
            AdvancedLogger.userAction(data.userId, 'cashbox_closed', {
                date: selectedDate.toISOString(),
                expectedCash: summary.totalCash,
                actualCash: data.actualCashAmount,
                variance: data.actualCashAmount
                    ? data.actualCashAmount - summary.totalCash
                    : 0,
                totalRevenue: summary.totalRevenue,
                ordersCount: summary.totalOrders,
                closedAt: new Date(),
            });
            AdvancedLogger.securityEvent('cashbox_closing', {
                userId: data.userId,
                date: selectedDate.toISOString(),
                expectedCash: summary.totalCash,
                actualCash: data.actualCashAmount,
                totalRevenue: summary.totalRevenue,
                timestamp: getCurrentLocalDateTime(),
            }, 'medium');
            // Create audit log entry for cashbox closing
            await prisma.auditLog.create({
                data: {
                    action: 'CASHBOX_CLOSED',
                    tableName: 'orders',
                    recordId: `cashbox_${selectedDate.toISOString().split('T')[0]}`,
                    userId: data.userId,
                    newValues: {
                        date: selectedDate.toISOString(),
                        expectedCash: summary.totalCash,
                        actualCash: data.actualCashAmount,
                        variance: data.actualCashAmount
                            ? data.actualCashAmount - summary.totalCash
                            : 0,
                        totalRevenue: summary.totalRevenue,
                        ordersCount: summary.totalOrders,
                    },
                },
            });
            const closedSummary = {
                ...summary,
                isClosed: true,
                closedAt: getCurrentLocalDateTime(),
                closedBy: data.userId,
                actualCashAmount: data.actualCashAmount,
                variance: data.actualCashAmount
                    ? data.actualCashAmount - summary.totalCash
                    : 0,
            };
            return {
                success: true,
                data: closedSummary,
                timestamp: getCurrentLocalDateTime(),
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to close cashbox';
            AdvancedLogger.errorEvent(`Cashbox closing error: ${errorMessage}`, 'OrderController', 'error', error instanceof Error ? error.stack : undefined, data.userId);
            return {
                success: false,
                error: errorMessage,
                timestamp: getCurrentLocalDateTime(),
            };
        }
    }
    /**
     * Get orders count with optional filters
     */
    async getOrdersCount(_event, filters) {
        try {
            const where = {};
            if (filters?.status)
                where.status = filters.status;
            if (filters?.tableId)
                where.tableId = filters.tableId;
            if (filters?.userId)
                where.userId = filters.userId;
            if (filters?.startDate || filters?.endDate) {
                where.createdAt = {};
                // Use ISO strings directly - SQLite stores dates as TEXT and can't bind Date objects
                if (filters.startDate)
                    where.createdAt.gte = filters.startDate;
                if (filters.endDate)
                    where.createdAt.lte = filters.endDate;
            }
            const count = await prisma.order.count({ where });
            return {
                success: true,
                data: { count },
                timestamp: getCurrentLocalDateTime(),
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to get orders count';
            return {
                success: false,
                error: errorMessage,
                timestamp: getCurrentLocalDateTime(),
            };
        }
    }
    /**
     * Export orders to Excel file
     */
    async exportOrders(_event, params) {
        console.log('🔍 OrderController.exportOrders called with params:', params);
        try {
            // Build search params for the API call
            const searchParams = {
                ...(params?.status && { status: params.status }),
                ...(params?.tableId && { tableId: params.tableId }),
                ...(params?.query && { query: params.query }),
                ...(params?.dateFrom && {
                    dateFrom: new Date(params.dateFrom).toISOString(),
                }),
                ...(params?.dateTo && {
                    dateTo: new Date(params.dateTo).toISOString(),
                }),
            };
            // Fetch all orders matching the filters (no pagination for export)
            const result = await this.orderModel.findAllWithOptions({
                status: params?.status,
                tableId: params?.tableId,
                startDate: params?.dateFrom ? new Date(params.dateFrom) : undefined,
                endDate: params?.dateTo ? new Date(params.dateTo) : undefined,
            });
            if (!result.success || !result.data) {
                return {
                    success: false,
                    error: result.error || 'Failed to fetch orders for export',
                    timestamp: getCurrentLocalDateTime(),
                };
            }
            // Client-side search filtering (if query provided)
            let filteredData = result.data;
            if (params?.query) {
                const searchTerm = params.query.toLowerCase();
                filteredData = result.data.filter((order) => {
                    return (order.orderNumber?.toLowerCase().includes(searchTerm) ||
                        order.table?.name?.toLowerCase().includes(searchTerm) ||
                        order.customerName?.toLowerCase().includes(searchTerm) ||
                        order.customerPhone?.includes(searchTerm));
                });
            }
            // Generate filename with timestamp
            const timestamp = getCurrentLocalDateTime().replace(/[:.]/g, '-').slice(0, -5);
            const filename = `orders-export-${timestamp}.xlsx`;
            // Use dialog to let user choose save location
            const downloadsPath = app.getPath('downloads');
            const defaultPath = path.join(downloadsPath, filename);
            const { filePath } = await dialog.showSaveDialog({
                title: 'Export Orders',
                defaultPath,
                filters: [
                    { name: 'Excel Files', extensions: ['xlsx'] },
                    { name: 'All Files', extensions: ['*'] },
                ],
            });
            if (!filePath) {
                // User cancelled
                return {
                    success: false,
                    error: 'Export cancelled by user',
                    timestamp: getCurrentLocalDateTime(),
                };
            }
            // Export to Excel
            await exportOrdersToExcel(filteredData, filePath, params?.dateFrom && params?.dateTo
                ? {
                    startDate: params.dateFrom,
                    endDate: params.dateTo,
                }
                : undefined);
            console.log(`✅ Orders exported successfully to ${filePath}`);
            return {
                success: true,
                data: { filePath },
                timestamp: getCurrentLocalDateTime(),
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to export orders';
            console.error('❌ Export orders error:', error);
            return {
                success: false,
                error: errorMessage,
                timestamp: getCurrentLocalDateTime(),
            };
        }
    }
    /**
     * ===== ADD-ON INTEGRATION HANDLERS =====
     */
    /**
     * Add order item with add-ons
     */
    async addOrderItemWithAddons(event, data) {
        return await this.addonExtensions.addOrderItemWithAddons(data);
    }
    /**
     * Add add-ons to existing order item
     */
    async addAddonsToOrderItem(event, data) {
        return await this.addonExtensions.addAddonsToExistingOrderItem(data);
    }
    /**
     * Remove add-on from order item
     */
    async removeAddonFromOrderItem(event, data) {
        return await this.addonExtensions.removeAddonFromOrderItem(data);
    }
    /**
     * Get add-ons for order item
     */
    async getOrderItemAddons(event, orderItemId) {
        return await this.addonExtensions.getOrderItemAddons(orderItemId);
    }
    /**
     * Remove order item with add-ons cleanup
     */
    async removeOrderItemWithAddons(event, data) {
        return await this.addonExtensions.removeOrderItemWithAddons(data.orderId, data.itemId, data.userId);
    }
    /**
     * Unregister all IPC handlers
     */
    unregisterHandlers() {
        // Use the BaseController's mechanism for unregistering handlers
        super.unregisterHandlers();
        AdvancedLogger.info('OrderController handlers unregistered');
    }
}
