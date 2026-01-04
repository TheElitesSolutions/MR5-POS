import { ExtendedPrismaClient } from '../prisma';
import { AppError } from '../error-handler';
import {
  IPCResponse,
  Order,
  OrderItem,
  OrderItemStatus,
  OrderStatus,
  OrderType,
  PaymentMethod,
  Table,
} from '../types';
import {
  addDecimals,
  decimalToNumber,
  multiplyDecimals,
  validateCurrencyAmount,
  toDecimal,
  Decimal,
} from '../utils/decimal';
import { Decimal as DecimalJS } from 'decimal.js';
import { logger } from '../utils/logger';
import { TableModel } from './Table';
import { getCurrentLocalDateTime, dateToLocalDateTime } from '../utils/dateTime';

/**
 * Safely convert a date to local datetime string
 * Handles both Date objects and string inputs
 */
function toISOString(date: Date | string | null | undefined): string {
  if (!date) return getCurrentLocalDateTime();
  if (typeof date === 'string') return date;
  if (date instanceof Date) return dateToLocalDateTime(date); // FIXED: Use local time, not UTC
  return getCurrentLocalDateTime();
}

/**
 * Maps application OrderStatus to Prisma OrderStatus
 */
function mapAppOrderStatusToPrismaOrderStatus(
  status: OrderStatus
): string {
  // This handles the conversion between application enum and Prisma enum
  switch (status) {
    case OrderStatus.DRAFT:
      return 'DRAFT';
    case OrderStatus.PENDING:
      return 'PENDING';
    case OrderStatus.PREPARING:
      return 'CONFIRMED';
    case OrderStatus.READY:
      return 'READY';
    case OrderStatus.SERVED:
      return 'SERVED';
    case OrderStatus.COMPLETED:
      return 'COMPLETED';
    case OrderStatus.CANCELLED:
      return 'CANCELLED';
    default:
      return 'PENDING';
  }
}

/**
 * Maps Prisma OrderStatus to application OrderStatus
 */
function mapPrismaOrderStatusToAppOrderStatus(
  status: string
): OrderStatus {
  // This handles the conversion between Prisma enum and application enum
  switch (status) {
    case 'DRAFT':
      return OrderStatus.DRAFT;
    case 'PENDING':
      return OrderStatus.PENDING;
    case 'CONFIRMED':
      return OrderStatus.PREPARING;
    case 'PREPARING':
      return OrderStatus.PREPARING;
    case 'READY':
      return OrderStatus.READY;
    case 'SERVED':
      return OrderStatus.SERVED;
    case 'COMPLETED':
      return OrderStatus.COMPLETED;
    case 'CANCELLED':
      return OrderStatus.CANCELLED;
    default:
      logger.warn(
        `Invalid order status: ${status}, defaulting to PENDING`,
        'OrderModel'
      );
      return OrderStatus.PENDING;
  }
}

/**
 * Maps application OrderItemStatus to Prisma OrderItemStatus
 */
function mapAppOrderItemStatusToPrismaOrderItemStatus(
  status: OrderItemStatus
): string {
  // This handles the conversion between application enum and Prisma enum
  switch (status) {
    case OrderItemStatus.PENDING:
      return 'PENDING';
    case OrderItemStatus.PREPARING:
      return 'PREPARING';
    case OrderItemStatus.READY:
      return 'READY';
    case OrderItemStatus.SERVED:
      return 'SERVED';
    case OrderItemStatus.CANCELLED:
      return 'CANCELLED';
    default:
      return 'PENDING';
  }
}

/**
 * Maps Prisma OrderItemStatus to application OrderItemStatus
 */
function mapPrismaOrderItemStatusToAppOrderItemStatus(
  status: string
): OrderItemStatus {
  // This handles the conversion between Prisma enum and application enum
  switch (status) {
    case 'PENDING':
      return OrderItemStatus.PENDING;
    case 'PREPARING':
      return OrderItemStatus.PREPARING;
    case 'READY':
      return OrderItemStatus.READY;
    case 'SERVED':
      return OrderItemStatus.SERVED;
    case 'CANCELLED':
      return OrderItemStatus.CANCELLED;
    default:
      logger.warn(
        `Invalid order item status: ${status}, defaulting to PENDING`,
        'OrderModel'
      );
      return OrderItemStatus.PENDING;
  }
}

/**
 * Maps application PaymentMethod to Prisma PaymentMethod
 */
function mapAppPaymentMethodToPrismaPaymentMethod(
  method: PaymentMethod | null | undefined
): string | null {
  if (!method) return null;
  // This handles the conversion between application enum and Prisma enum
  switch (method) {
    case PaymentMethod.CASH:
      return 'CASH';
    case PaymentMethod.CARD:
      return 'CARD';
    case PaymentMethod.DIGITAL_WALLET:
      return 'DIGITAL_WALLET';
    case PaymentMethod.CHECK:
      return 'CHECK';
    case PaymentMethod.OTHER:
      return 'OTHER';
    default:
      return 'CASH';
  }
}

/**
 * Maps Prisma PaymentMethod to application PaymentMethod
 */
function mapPrismaPaymentMethodToAppPaymentMethod(
  method: string | null
): PaymentMethod | null {
  if (!method) return null;
  // This handles the conversion between Prisma enum and application enum
  switch (method) {
    case 'CASH':
      return PaymentMethod.CASH;
    case 'CARD':
      return PaymentMethod.CARD;
    case 'DIGITAL_WALLET':
      return PaymentMethod.DIGITAL_WALLET;
    case 'CHECK':
      return PaymentMethod.CHECK;
    case 'OTHER':
      return PaymentMethod.OTHER;
    default:
      return PaymentMethod.CASH;
  }
}

/**
 * Map application OrderStatus to Prisma OrderStatus
 * This handles the differences between application enums and Prisma schema enums
 */
function mapAppStatusToPrismaStatus(status: OrderStatus): string {
  switch (status) {
    case OrderStatus.DRAFT:
      return 'DRAFT';
    case OrderStatus.PENDING:
      return 'PENDING';
    case OrderStatus.PREPARING:
      return 'CONFIRMED'; // Map PREPARING in application to CONFIRMED in Prisma
    case OrderStatus.READY:
      return 'READY';
    case OrderStatus.SERVED:
      return 'SERVED';
    case OrderStatus.COMPLETED:
      return 'COMPLETED';
    case OrderStatus.CANCELLED:
      return 'CANCELLED';
    default:
      return 'PENDING';
  }
}

export class OrderModel {
  private tableModel: TableModel;
  // ✅ FIX: Request deduplication to prevent duplicate items from concurrent requests
  private pendingAddItemRequests: Map<string, Promise<IPCResponse<OrderItem>>> = new Map();

  constructor(private prisma: ExtendedPrismaClient) {
    this.tableModel = new TableModel(prisma);
  }

  /**
   * Normalizes addon set for comparison
   * Converts addon array to sorted array of {addonId, quantity} objects
   */
  private normalizeAddonSet(addons: any[] | null | undefined): Array<{addonId: string, quantity: number}> {
    if (!addons || addons.length === 0) return [];

    return addons
      .map(a => ({ addonId: a.addonId, quantity: a.quantity }))
      .sort((a, b) => a.addonId.localeCompare(b.addonId));
  }

  /**
   * Creates a unique signature string for an addon set
   * Used for comparing addon combinations
   */
  private createAddonSignature(addons: any[] | null | undefined): string {
    const normalized = this.normalizeAddonSet(addons);
    if (normalized.length === 0) return 'NO_ADDONS';

    return normalized
      .map(a => `${a.addonId}:${a.quantity}`)
      .join('|');
  }

  /**
   * Checks if two addon sets are equal
   * Items with different addon combinations should NOT be merged
   */
  private addonsAreEqual(addons1: any[] | null | undefined, addons2: any[] | null | undefined): boolean {
    const sig1 = this.createAddonSignature(addons1);
    const sig2 = this.createAddonSignature(addons2);
    return sig1 === sig2;
  }

  /**
   * Helper method to manually fetch order items with all relationships
   * Needed because the Prisma wrapper doesn't support include clauses
   */
  private async fetchOrderItemsWithRelations(orderId: string): Promise<any[]> {
    // Fetch items for this order
    const items = await this.prisma.orderItem.findMany({
      where: { orderId },
    });

    // Fetch menu items and addons for each order item
    const itemsWithRelations = await Promise.all(
      items.map(async (item: any) => {
        const menuItem = await this.prisma.menuItem.findUnique({
          where: { id: item.menuItemId },
        });

        // ✅ DEBUG: Log what fields are actually returned from database
        console.log('🔍 [fetchOrderItemsWithRelations] menuItem from DB:', {
          id: menuItem?.id,
          name: menuItem?.name,
          isPrintableInKitchen: menuItem?.isPrintableInKitchen,
          'typeof isPrintableInKitchen': typeof menuItem?.isPrintableInKitchen,
          'all keys': menuItem ? Object.keys(menuItem) : 'null',
        });

        // ✅ CRITICAL FIX: Wrap addon fetching in try-catch to prevent silent data loss
        // If addon fetching fails, return item with empty addons array instead of failing entirely
        let addonsWithDetails: any[] = [];
        try {
          // Fetch addons for this order item
          const addons = await this.prisma.orderItemAddon.findMany({
            where: { orderItemId: item.id },
          });

          // Fetch addon details for each addon
          addonsWithDetails = await Promise.all(
            addons.map(async (addon: any) => {
              try {
                const addonDetails = await this.prisma.addon.findUnique({
                  where: { id: addon.addonId },
                  include: { addonGroup: true }, // ✅ Use include to fetch addonGroup in single query
                });

                return {
                  ...addon,
                  addon: addonDetails || null,
                  addonName: addonDetails?.name || addon.addonName || 'Unknown Addon',
                };
              } catch (addonError) {
                logger.error(
                  `Failed to fetch addon details for addon ${addon.id} on item ${item.id}: ${addonError}`,
                  'OrderModel'
                );
                // Return addon assignment without details instead of failing
                return {
                  ...addon,
                  addon: null,
                  addonName: addon.addonName || 'Unknown Addon',
                };
              }
            })
          );
        } catch (error) {
          logger.error(
            `Failed to fetch addons for order item ${item.id}: ${error}`,
            'OrderModel'
          );
          // Return item with empty addons array on error (prevents order processing failure)
          addonsWithDetails = [];
        }

        return { ...item, menuItem, addons: addonsWithDetails };
      })
    );

    return itemsWithRelations;
  }

  /**
   * Map Prisma OrderStatus to application OrderStatus
   * This handles the differences between Prisma schema enums and application enums
   */
  private mapPrismaOrderStatusToAppStatus(
    status: string
  ): OrderStatus {
    // Map Prisma OrderStatus to application OrderStatus
    switch (status) {
      case 'DRAFT':
        return OrderStatus.DRAFT;
      case 'PENDING':
        return OrderStatus.PENDING;
      case 'CONFIRMED':
        return OrderStatus.PREPARING; // Map CONFIRMED to PREPARING in application
      case 'PREPARING':
        return OrderStatus.PREPARING;
      case 'READY':
        return OrderStatus.READY;
      case 'SERVED':
        return OrderStatus.SERVED;
      case 'COMPLETED':
        return OrderStatus.COMPLETED;
      case 'CANCELLED':
        return OrderStatus.CANCELLED;
      default:
        logger.warn(
          `Invalid order status: ${status}, defaulting to PENDING`,
          'OrderModel'
        );
        return OrderStatus.PENDING;
    }
  }

  /**
   * Map Prisma OrderItemStatus to application OrderItemStatus
   * This handles the differences between Prisma schema enums and application enums
   */
  private mapPrismaOrderItemStatusToAppStatus(status: string): OrderItemStatus {
    // Map Prisma OrderItemStatus to application OrderItemStatus
    switch (status) {
      case 'PENDING':
        return OrderItemStatus.PENDING;
      case 'PREPARING':
        return OrderItemStatus.PREPARING;
      case 'READY':
        return OrderItemStatus.READY;
      case 'SERVED':
        return OrderItemStatus.SERVED;
      case 'CANCELLED':
        return OrderItemStatus.CANCELLED;
      default:
        logger.warn(
          `Invalid order item status: ${status}, defaulting to PENDING`,
          'OrderModel'
        );
        return OrderItemStatus.PENDING;
    }
  }

  /**
   * Validate OrderType to ensure it matches a valid enum value
   */
  private validateOrderType(type: string): OrderType {
    switch (type) {
      case OrderType.DINE_IN:
        return OrderType.DINE_IN;
      case OrderType.TAKEOUT:
        return OrderType.TAKEOUT;
      case OrderType.DELIVERY:
        return OrderType.DELIVERY;
      default:
        logger.warn(
          `Invalid order type: ${type}, defaulting to DINE_IN`,
          'OrderModel'
        );
        return OrderType.DINE_IN;
    }
  }

  /**
   * Convert Prisma OrderItem to type-safe OrderItem interface with bulletproof serialization
   */
  private mapPrismaOrderItem(item: any): OrderItem {
    try {
      console.log(`🔍 OrderModel.mapPrismaOrderItem: Mapping item ${item.id}:`, {
        itemId: item.id,
        hasAddons: !!item.addons,
        addonsCount: item.addons?.length || 0,
        addonsData: item.addons,
      });

      // Map status from Prisma enum to application enum
      const mappedStatus = this.mapPrismaOrderItemStatusToAppStatus(
        item.status
      );

      const mapped: OrderItem = {
        id: item.id,
        orderId: item.orderId,
        menuItemId: item.menuItemId,
        name:
          item.name ||
          (item.menuItem ? item.menuItem.name : '') ||
          'Unknown Item',
        // ✅ CRITICAL FIX: Include menuItemName for frontend compatibility
        menuItemName:
          item.name ||
          (item.menuItem ? item.menuItem.name : '') ||
          'Unknown Item',
        price: decimalToNumber(item.unitPrice || item.price || 0),
        unitPrice: decimalToNumber(item.unitPrice || item.price || 0), // ✅ FIX: Include unitPrice
        totalPrice: decimalToNumber(item.totalPrice || 0), // ✅ FIX: Include totalPrice
        quantity: item.quantity,
        notes: item.notes || '',
        status: mappedStatus,
        createdAt: item.createdAt instanceof Date
          ? dateToLocalDateTime(item.createdAt)
          : (item.createdAt || getCurrentLocalDateTime()),
        updatedAt: item.updatedAt instanceof Date
          ? dateToLocalDateTime(item.updatedAt)
          : (item.updatedAt || getCurrentLocalDateTime()),
        // ✅ CRITICAL FIX: ALWAYS include addons array (even if empty) to prevent data loss
        // Using conditional spread operator was silently dropping addon data when falsy
        addons: (item.addons || []).map((addon: any) => ({
          id: addon.id,
          orderItemId: addon.orderItemId,
          addonId: addon.addonId,
          addonName: addon.addonName,
          quantity: addon.quantity,
          unitPrice: decimalToNumber(addon.unitPrice || 0),
          totalPrice: decimalToNumber(addon.totalPrice || 0),
          createdAt: addon.createdAt,
          updatedAt: addon.updatedAt,
          addon: addon.addon ? {
            id: addon.addon.id,
            name: addon.addon.name,
            description: addon.addon.description,
            price: decimalToNumber(addon.addon.price || 0),
            addonGroup: addon.addon.addonGroup ? {
              id: addon.addon.addonGroup.id,
              name: addon.addon.addonGroup.name,
            } : undefined,
          } : undefined,
        })),
        // ✅ FIX: Include menuItem object for kitchen ticket filtering
        menuItem: item.menuItem ? {
          id: item.menuItem.id,
          name: item.menuItem.name,
          isPrintableInKitchen: item.menuItem.isPrintableInKitchen !== undefined
            ? item.menuItem.isPrintableInKitchen
            : true, // default to true for backward compatibility
          price: decimalToNumber(item.menuItem.price || 0),
          categoryId: item.menuItem.categoryId,
        } : undefined,
      };

      console.log(`🔍 OrderModel.mapPrismaOrderItem: Mapped result for ${item.id}:`, {
        itemId: mapped.id,
        hasAddonsInMapped: !!(mapped as any).addons,
        addonsCountInMapped: ((mapped as any).addons?.length || 0),
      });

      // ✅ VALIDATION: Detect potential addon data loss
      const basePrice = (item.unitPrice || item.price || 0) * item.quantity;
      const expectedAddonPrice = (item.totalPrice || 0) - basePrice;
      if (mapped.addons.length === 0 && expectedAddonPrice > 0.01) {
        logger.warn(
          `Item ${item.id} has empty addons array but totalPrice suggests addons exist - potential data loss`,
          'OrderModel',
          {
            itemId: item.id,
            menuItemId: item.menuItemId,
            basePrice,
            totalPrice: item.totalPrice,
            expectedAddonPrice,
            hasAddonsProperty: item.hasOwnProperty('addons'),
            addonsValue: item.addons,
          }
        );
      }

      // Bulletproof serialization: strip any remaining non-serializable properties
      const serialized = JSON.parse(JSON.stringify(mapped));
      
      console.log(`🔍 OrderModel.mapPrismaOrderItem: After serialization for ${item.id}:`, {
        itemId: serialized.id,
        hasAddonsAfterSerialization: !!serialized.addons,
        addonsCountAfterSerialization: (serialized.addons?.length || 0),
      });

      return serialized;
    } catch (error) {
      logger.error(
        `Failed to map order item ${item?.id || 'unknown'}: ${error}`,
        'OrderModel'
      );
      // Return a safe fallback object
      return {
        id: item?.id || 'unknown',
        orderId: item?.orderId || 'unknown',
        menuItemId: item?.menuItemId || 'unknown',
        name: item?.name || '',
        price: 0,
        quantity: item?.quantity || 1,
        notes: item?.notes || '',
        status: OrderItemStatus.PENDING,
        createdAt: getCurrentLocalDateTime(),
        updatedAt: getCurrentLocalDateTime(),
      };
    }
  }

  /**
   * Convert Prisma Order to type-safe Order interface with bulletproof serialization
   */
  private mapPrismaOrder(order: any, table?: Table | null): Order {
    try {
      // Debug logging for order items
      console.log(`📋 OrderModel.mapPrismaOrder - Processing order ${order.id}:`, {
        orderId: order.id,
        orderNumber: order.orderNumber,
        hasItems: !!order.items,
        itemsCount: order.items?.length || 0,
        items: order.items?.slice(0, 2).map((item: any) => ({
          id: item.id,
          menuItemId: item.menuItemId,
          name: item.name || item.menuItem?.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
          hasAddons: !!item.addons,
          addonsCount: item.addons?.length || 0
        }))
      });

      // Map status from Prisma enum to application enum
      const mappedStatus = this.mapPrismaOrderStatusToAppStatus(order.status);

      // Extract properties safely with fallbacks
      const total = order.total ? decimalToNumber(order.total) : 0;
      const tax = order.tax ? decimalToNumber(order.tax) : 0;
      const subtotal = order.subtotal ? decimalToNumber(order.subtotal) : 0;
      const tip = order.tip ? decimalToNumber(order.tip) : null;

      // Handle paymentMethod safely
      let paymentMethod: PaymentMethod | null = null;
      if (order.paymentMethod) {
        paymentMethod = order.paymentMethod as PaymentMethod;
      }

      // Handle completedAt safely
      let completedAt: string | null = null;
      if (order.completedAt) {
        completedAt = order.completedAt instanceof Date
          ? dateToLocalDateTime(order.completedAt)
          : order.completedAt;
      }

      const mapped: Order = {
        id: order.id,
        orderNumber: order.orderNumber || `ORD-${order.id.slice(-8)}`,
        tableId: order.tableId,
        tableName: order.tableName || table?.name || undefined, // Denormalized table name
        table: table || undefined, // Include table information
        customerId: order.customerId || undefined,
        userId: order.userId || '',
        status: mappedStatus,
        type: order.type || OrderType.DINE_IN,
        total,
        tax,
        subtotal,
        discount: order.discount ? decimalToNumber(order.discount) : undefined,
        notes: order.notes || undefined,
        createdAt: order.createdAt instanceof Date
          ? dateToLocalDateTime(order.createdAt)
          : (order.createdAt || getCurrentLocalDateTime()),
        updatedAt: order.updatedAt instanceof Date
          ? dateToLocalDateTime(order.updatedAt)
          : (order.updatedAt || getCurrentLocalDateTime()),
        // Customer fields for takeout/delivery orders
        customerName: order.customerName || null,
        customerPhone: order.customerPhone || null,
        deliveryAddress: order.deliveryAddress || null,
        // Use type assertion to handle deliveryFee (we've added this to the interface in types/index.ts)
        ...(order.deliveryFee
          ? { deliveryFee: decimalToNumber(order.deliveryFee) }
          : {}),
        items: order.items
          ? order.items.map((item: any) => this.mapPrismaOrderItem(item))
          : [],
      };

      // Bulletproof serialization: strip any remaining non-serializable properties
      return JSON.parse(JSON.stringify(mapped));
    } catch (error) {
      logger.error(
        `Failed to map order ${order?.id || 'unknown'}: ${error}`,
        'OrderModel'
      );
      // Return a safe fallback object
      return {
        id: order?.id || 'unknown',
        orderNumber:
          order?.orderNumber || `ORD-${order?.id?.slice(-8) || 'unknown'}`,
        tableId: order?.tableId || null,
        status: OrderStatus.PENDING,
        type: OrderType.DINE_IN,
        total: 0,
        tax: 0,
        subtotal: 0,
        discount: 0,
        notes: '',
        // Optional fields for takeout/delivery orders
        customerName: order?.customerName || undefined,
        customerPhone: order?.customerPhone || undefined,
        deliveryAddress: order?.deliveryAddress || undefined,
        createdAt: getCurrentLocalDateTime(),
        updatedAt: getCurrentLocalDateTime(),
        customerId: order?.customerId || undefined,
        userId: order?.userId || '',
        items: [],
      };
    }
  }

  /**
   * Retrieves all orders from the database
   *
   * @returns Promise resolving to IPCResponse containing array of Order objects
   *
   * @example
   * ```typescript
   * const result = await orderModel.findAll();
   * if (result.success) {
   *   console.log(`Found ${result.data.length} orders`);
   * }
   * ```
   */
  async findAll(): Promise<IPCResponse<Order[]>> {
    try {
      const orders = await this.prisma.order.findMany({
        orderBy: {
          createdAt: 'desc',
        },
      });

      // WORKAROUND: Prisma wrapper doesn't support include, so fetch related data manually
      const ordersWithItems = await Promise.all(
        orders.map(async (order: any) => {
          const items = await this.fetchOrderItemsWithRelations(order.id);
          return { ...order, items };
        })
      );

      return {
        success: true,
        data: ordersWithItems.map(order => this.mapPrismaOrder(order)),
        timestamp: getCurrentLocalDateTime(),
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to fetch orders',
        timestamp: getCurrentLocalDateTime(),
      };
    }
  }

  /**
   * Retrieves a single order by its unique ID
   *
   * @param id - The unique identifier of the order
   * @returns Promise resolving to IPCResponse containing Order object or null if not found
   *
   * @example
   * ```typescript
   * const result = await orderModel.findById('order-123');
   * if (result.success && result.data) {
   *   console.log(`Order ${result.data.orderNumber} found`);
   * }
   * ```
   */
  async findById(id: string): Promise<IPCResponse<Order | null>> {
    try {
      // WORKAROUND: Prisma wrapper doesn't support include, so fetch manually
      const order = await this.prisma.order.findUnique({
        where: { id },
      });

      if (!order) {
        return {
          success: true,
          data: null,
          timestamp: getCurrentLocalDateTime(),
        };
      }

      // Use helper method to fetch items with all relationships
      const itemsWithRelations = await this.fetchOrderItemsWithRelations(id);

      // Fetch table information if tableId exists
      let table: Table | null = null;
      if (order.tableId) {
        const tableResponse = await this.tableModel.getTableById(order.tableId);
        if (tableResponse.success && tableResponse.data) {
          table = tableResponse.data;
        }
      }

      // Attach items to order
      const orderWithItems = {
        ...order,
        items: itemsWithRelations,
      };

      // Debug logging
      console.log(`🔍 OrderModel.findById: Fetched order ${id}:`, {
        hasOrder: !!order,
        hasItems: !!itemsWithRelations,
        hasTable: !!table,
        tableName: table?.name || 'N/A',
        itemsCount: itemsWithRelations.length,
        items: itemsWithRelations.map((i: any) => ({
          id: i.id,
          menuItemId: i.menuItemId,
          quantity: i.quantity,
          name: i.name || i.menuItem?.name,
        })),
      });

      return {
        success: true,
        data: orderWithItems ? this.mapPrismaOrder(orderWithItems, table) : null,
        timestamp: getCurrentLocalDateTime(),
      };
    } catch (error) {
      logger.error(
        `Failed to get order by ID ${id}: ${
          error instanceof Error ? error.message : error
        }`,
        'OrderModel'
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get order',
        timestamp: getCurrentLocalDateTime(),
      };
    }
  }

  /**
   * Creates a new order in the database
   *
   * @param orderData - Order creation parameters
   * @param orderData.orderNumber - Unique order number identifier
   * @param orderData.tableId - ID of the table this order is for
   * @param orderData.customerId - Optional customer ID
   * @param orderData.userId - ID of the user creating the order
   * @param orderData.type - Order type (DINE_IN, TAKEAWAY, DELIVERY)
   * @param orderData.subtotal - Order subtotal before tax and discount
   * @param orderData.tax - Tax amount
   * @param orderData.discount - Optional discount amount
   * @param orderData.total - Final order total
   * @param orderData.notes - Optional order notes
   *
   * @returns Promise resolving to IPCResponse containing created Order object
   * @throws {AppError} If validation fails or database error occurs
   *
   * @example
   * ```typescript
   * const result = await orderModel.create({
   *   orderNumber: 'ORD-001',
   *   tableId: 'table-1',
   *   userId: 'user-123',
   *   type: 'DINE_IN',
   *   subtotal: new DecimalJS(100),
   *   tax: new DecimalJS(10),
   *   total: new DecimalJS(110)
   * });
   * ```
   */
  async create(orderData: {
    orderNumber: string;
    tableId: string;
    customerId?: string;
    userId: string;
    type?: OrderType;
    subtotal: Decimal;
    tax: Decimal;
    discount?: Decimal;
    total: Decimal;
    notes?: string;
  }): Promise<IPCResponse<Order>> {
    try {
      // Validate monetary amounts
      if (
        !validateCurrencyAmount(orderData.subtotal) ||
        !validateCurrencyAmount(orderData.tax) ||
        !validateCurrencyAmount(orderData.total)
      ) {
        throw new AppError('Invalid monetary amounts', true);
      }

      // Handle userId fallback - use default user if the provided userId doesn't exist
      let validUserId = orderData.userId;
      if (orderData.userId === 'current-user' || orderData.userId === 'owner') {
        // Try to find the owner user or any active user as fallback
        const fallbackUser = await this.prisma.user.findFirst({
          where: {
            OR: [
              { username: 'owner' },
              { role: 'OWNER' },
              { role: 'MANAGER' },
              { isActive: true },
            ],
          },
          orderBy: { role: 'asc' }, // Prioritize OWNER, then MANAGER, etc.
        });

        if (fallbackUser) {
          validUserId = fallbackUser.id;
        } else {
          throw new AppError('No valid user found in the system', true);
        }
      } else {
        // Verify the provided userId exists
        const userExists = await this.prisma.user.findUnique({
          where: { id: orderData.userId },
        });

        if (!userExists) {
          // Fallback to owner user
          const fallbackUser = await this.prisma.user.findFirst({
            where: { role: 'OWNER' },
          });

          if (fallbackUser) {
            validUserId = fallbackUser.id;
            logger.warn(
              `Invalid userId provided (${orderData.userId}), using fallback user: ${fallbackUser.username}`
            );
          } else {
            throw new AppError(
              'Invalid user ID and no fallback user available',
              true
            );
          }
        }
      }

      // Fetch table name for denormalization
      let tableName: string | null = null;
      if (orderData.tableId) {
        const tableResponse = await this.tableModel.getTableById(orderData.tableId);
        if (tableResponse.success && tableResponse.data) {
          tableName = tableResponse.data.name;
        }
      }

      // Build the order data object with direct foreign key IDs
      // NOTE: The Prisma wrapper doesn't support 'connect' syntax - use direct IDs
      const orderCreateData: any = {
        orderNumber: orderData.orderNumber,
        tableId: orderData.tableId || null, // Direct foreign key ID
        tableName: tableName, // Store denormalized table name
        customerId: orderData.customerId || null, // Direct foreign key ID
        userId: validUserId, // Direct foreign key ID
        type: orderData.type || OrderType.DINE_IN,
        status: 'PENDING',
        subtotal: orderData.subtotal,
        tax: orderData.tax,
        discount: orderData.discount || new DecimalJS(0),
        total: orderData.total,
        notes: orderData.notes || null,
      }

      const order = await this.prisma.order.create({
        data: orderCreateData,
        include: {
          table: true,
          customer: true,
          user: true,
          items: {
            include: {
              menuItem: true,
              addons: {
                include: {
                  addon: {
                    include: {
                      addonGroup: true
                    }
                  }
                }
              }
            },
          },
          payments: true,
        },
      });

      return {
        success: true,
        data: this.mapPrismaOrder(order),
        timestamp: getCurrentLocalDateTime(),
      };
    } catch (error) {
      logger.error(
        `Failed to create order: ${
          error instanceof Error ? error.message : error
        }`,
        'OrderModel'
      );
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to create order',
        timestamp: getCurrentLocalDateTime(),
      };
    }
  }

  async update(id: string, updateData: any): Promise<IPCResponse<Order>> {
    try {
      const order = await this.prisma.order.update({
        where: { id },
        data: updateData,
        include: {
          table: true,
          customer: true,
          user: true,
          items: {
            include: {
              menuItem: true,
              addons: {
                include: {
                  addon: {
                    include: {
                      addonGroup: true
                    }
                  }
                }
              }
            },
          },
          payments: true,
        },
      });

      return {
        success: true,
        data: this.mapPrismaOrder(order),
        timestamp: getCurrentLocalDateTime(),
      };
    } catch (error) {
      logger.error(
        `Failed to update order ${id}: ${
          error instanceof Error ? error.message : error
        }`,
        'OrderModel'
      );
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to update order',
        timestamp: getCurrentLocalDateTime(),
      };
    }
  }

  async cancel(id: string, reason?: string): Promise<IPCResponse<Order>> {
    try {
      // Use transaction to ensure atomicity of cancellation + stock restoration
      const order = await this.prisma.$transaction(async (tx: any) => {
        // 1. Get order with all items and addons
        const existingOrder = await tx.order.findUnique({
          where: { id },
          include: {
            items: {
              include: {
                menuItem: true,
                orderItemAddons: {
                  include: {
                    addon: {
                      include: {
                        inventoryItems: {
                          include: {
                            inventory: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        });

        if (!existingOrder) {
          throw new AppError('Order not found', true);
        }

        // Check if order is already cancelled or completed
        if (existingOrder.status === 'CANCELLED') {
          throw new AppError('Order is already cancelled', true);
        }

        if (existingOrder.status === 'COMPLETED') {
          throw new AppError('Cannot cancel a completed order', true);
        }

        // 2. Restore inventory for all order items
        for (const orderItem of existingOrder.items) {
          // 2a. Restore menu item inventory
          const menuItemInventory = await tx.menuItemInventory.findMany({
            where: { menuItemId: orderItem.menuItemId },
            include: { inventory: true },
          });

          if (menuItemInventory && menuItemInventory.length > 0) {
            for (const link of menuItemInventory) {
              const amountToRestore = link.quantity * orderItem.quantity;

              await tx.inventory.update({
                where: { id: link.inventoryId },
                data: {
                  currentStock: {
                    increment: amountToRestore,
                  },
                  updatedAt: getCurrentLocalDateTime(),
                },
              });

              // Audit log for menu item inventory restoration
              await tx.auditLog.create({
                data: {
                  action: 'INVENTORY_INCREASE',
                  tableName: 'inventory',
                  recordId: link.inventoryId,
                  newValues: {
                    reason: 'Order cancelled',
                    orderId: id,
                    orderItemId: orderItem.id,
                    menuItemId: orderItem.menuItemId,
                    quantityRestored: amountToRestore,
                  },
                },
              });
            }
          }

          // 2b. Restore addon inventory
          if (orderItem.orderItemAddons && orderItem.orderItemAddons.length > 0) {
            for (const addonAssignment of orderItem.orderItemAddons) {
              const addon = addonAssignment.addon;

              if (addon.inventoryItems && addon.inventoryItems.length > 0) {
                for (const addonInvItem of addon.inventoryItems) {
                  if (addonInvItem.inventory && addonInvItem.quantity > 0) {
                    const totalToRestore = addonInvItem.quantity * addonAssignment.quantity;

                    await tx.inventory.update({
                      where: { id: addonInvItem.inventoryId },
                      data: {
                        currentStock: {
                          increment: totalToRestore,
                        },
                        updatedAt: getCurrentLocalDateTime(),
                      },
                    });

                    // Audit log for addon inventory restoration
                    await tx.auditLog.create({
                      data: {
                        action: 'INVENTORY_INCREASE',
                        tableName: 'inventory',
                        recordId: addonInvItem.inventoryId,
                        newValues: {
                          reason: 'Order cancelled - addon restored',
                          orderId: id,
                          orderItemId: orderItem.id,
                          addonId: addon.id,
                          quantityRestored: totalToRestore,
                        },
                      },
                    });
                  }
                }
              }
            }
          }
        }

        // 3. Cancel the order
        const cancelledOrder = await tx.order.update({
          where: { id },
          data: {
            status: 'CANCELLED',
            notes: reason || null,
            updatedAt: getCurrentLocalDateTime(),
          },
          include: {
            table: true,
            customer: true,
            user: true,
            items: true,
            payments: true,
          },
        });

        logger.info(
          `Order cancelled successfully with stock restoration`,
          `orderId: ${id}, itemsRestored: ${existingOrder.items.length}`
        );

        return cancelledOrder;
      });

      return {
        success: true,
        data: this.mapPrismaOrder(order),
        timestamp: getCurrentLocalDateTime(),
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error(
        `Failed to cancel order ${id}: ${
          error instanceof Error ? error.message : error
        }`,
        'OrderModel'
      );
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to cancel order',
        timestamp: getCurrentLocalDateTime(),
      };
    }
  }

  async complete(id: string): Promise<IPCResponse<Order>> {
    try {
      const order = await this.prisma.order.update({
        where: { id },
        data: {
          status: 'COMPLETED',
        },
        include: {
          table: true,
          customer: true,
          user: true,
          items: true,
          payments: true,
        },
      });

      return {
        success: true,
        data: this.mapPrismaOrder(order),
        timestamp: getCurrentLocalDateTime(),
      };
    } catch (error) {
      logger.error(
        `Failed to complete order ${id}: ${
          error instanceof Error ? error.message : error
        }`,
        'OrderModel'
      );
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to complete order',
        timestamp: getCurrentLocalDateTime(),
      };
    }
  }

  async findByTable(tableId: string): Promise<IPCResponse<Order[]>> {
    try {
      const orders = await this.prisma.order.findMany({
        where: { tableId },
        orderBy: { createdAt: 'desc' },
      });

      // Manually fetch items with relationships
      const ordersWithItems = await Promise.all(
        orders.map(async (order: any) => {
          const items = await this.fetchOrderItemsWithRelations(order.id);
          return { ...order, items };
        })
      );

      return {
        success: true,
        data: ordersWithItems.map(order => this.mapPrismaOrder(order)),
        timestamp: getCurrentLocalDateTime(),
      };
    } catch (error) {
      logger.error(
        `Failed to get orders by table ${tableId}: ${
          error instanceof Error ? error.message : error
        }`,
        'OrderModel'
      );
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to get orders by table',
        timestamp: getCurrentLocalDateTime(),
      };
    }
  }

  async findByType(type: OrderType): Promise<IPCResponse<Order[]>> {
    try {
      const orders = await this.prisma.order.findMany({
        where: { type },
        orderBy: { createdAt: 'desc' },
      });

      // Manually fetch items with relationships
      const ordersWithItems = await Promise.all(
        orders.map(async (order: any) => {
          const items = await this.fetchOrderItemsWithRelations(order.id);
          return { ...order, items };
        })
      );

      return {
        success: true,
        data: ordersWithItems.map(order => this.mapPrismaOrder(order)),
        timestamp: getCurrentLocalDateTime(),
      };
    } catch (error) {
      logger.error(
        `Failed to get orders by type ${type}: ${
          error instanceof Error ? error.message : error
        }`,
        'OrderModel'
      );
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to get orders by type',
        timestamp: getCurrentLocalDateTime(),
      };
    }
  }

  async findByStatus(status: OrderStatus): Promise<IPCResponse<Order[]>> {
    try {
      // Convert application status to Prisma status
      const prismaStatus = mapAppStatusToPrismaStatus(status);

      const orders = await this.prisma.order.findMany({
        where: { status: prismaStatus },
        orderBy: { createdAt: 'desc' },
      });

      // Manually fetch items with relationships
      const ordersWithItems = await Promise.all(
        orders.map(async (order: any) => {
          const items = await this.fetchOrderItemsWithRelations(order.id);
          return { ...order, items };
        })
      );

      return {
        success: true,
        data: ordersWithItems.map(order => this.mapPrismaOrder(order)),
        timestamp: getCurrentLocalDateTime(),
      };
    } catch (error) {
      logger.error(
        `Failed to get orders by status ${status}: ${
          error instanceof Error ? error.message : error
        }`,
        'OrderModel'
      );
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to get orders by status',
        timestamp: getCurrentLocalDateTime(),
      };
    }
  }

  async updateStatus(
    id: string,
    status: OrderStatus
  ): Promise<IPCResponse<Order>> {
    try {
      // Convert application status to Prisma status
      const prismaStatus = mapAppOrderStatusToPrismaOrderStatus(status);

      const order = await this.prisma.order.update({
        where: { id },
        data: {
          status: prismaStatus,
        },
        include: {
          items: true,
          table: true,
          customer: true,
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              username: true,
            },
          },
          payments: true,
        },
      });

      return {
        success: true,
        data: this.mapPrismaOrder(order),
        timestamp: getCurrentLocalDateTime(),
      };
    } catch (error) {
      logger.error(
        `Failed to update order status for ${id} to ${status}: ${
          error instanceof Error ? error.message : error
        }`,
        'OrderModel'
      );
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to update order status',
        timestamp: getCurrentLocalDateTime(),
      };
    }
  }

  async findAllWithOptions(options?: {
    status?: OrderStatus;
    type?: OrderType;
    tableId?: string;
    userId?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<IPCResponse<Order[]>> {
    try {
      const where: any = {};

      if (options?.status) where.status = options.status;
      if (options?.type) where.type = options.type;
      if (options?.tableId) where.tableId = options.tableId;
      if (options?.userId) where.userId = options.userId;

      if (options?.startDate || options?.endDate) {
        where.createdAt = {};
        // Convert Date objects to ISO strings for SQLite compatibility
        if (options.startDate) {
          where.createdAt.gte = options.startDate instanceof Date
            ? options.startDate.toISOString()
            : options.startDate;
        }
        if (options.endDate) {
          where.createdAt.lte = options.endDate instanceof Date
            ? options.endDate.toISOString()
            : options.endDate;
        }
      }

      const findOptions: any = {
        where,
        include: {
          items: {
            include: {
              menuItem: true,
              // ✅ CRITICAL FIX: Include addons when fetching order items
              addons: {
                include: {
                  addon: {
                    include: {
                      addonGroup: true,
                    },
                  },
                },
              },
            },
          },
          table: true,
          customer: true,
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              username: true,
            },
          },
          payments: true,
        },
        orderBy: { createdAt: 'desc' },
      };

      if (options?.limit) {
        findOptions.take = options.limit;
      }
      if (options?.offset) {
        findOptions.skip = options.offset;
      }

      const orders = await this.prisma.order.findMany(findOptions);

      // WORKAROUND: Prisma wrapper doesn't support include, so fetch related data manually
      const ordersWithItems = await Promise.all(
        orders.map(async (order: any) => {
          const items = await this.fetchOrderItemsWithRelations(order.id);
          return { ...order, items };
        })
      );

      console.log(`📋 OrderModel.findAllWithOptions: Fetched ${ordersWithItems.length} orders with items`);

      return {
        success: true,
        data: ordersWithItems.map(order => this.mapPrismaOrder(order)),
        timestamp: getCurrentLocalDateTime(),
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to fetch orders',
        timestamp: getCurrentLocalDateTime(),
      };
    }
  }

  async addItem(
    orderId: string,
    item: {
      menuItemId: string;
      quantity: number;
      unitPrice?: Decimal; // unitPrice optional; will default to menu item price
      notes?: string;
    }
  ): Promise<IPCResponse<OrderItem>> {
    // ✅ FIX: Request deduplication - create unique key for this request
    const requestKey = `${orderId}:${item.menuItemId}:${item.notes || 'none'}`;

    // ✅ FIX: If same request is already in progress, return the existing promise
    const existingRequest = this.pendingAddItemRequests.get(requestKey);
    if (existingRequest) {
      logger.info(`🔒 [RACE CONDITION PREVENTED] Duplicate addItem request detected for key: ${requestKey}`);
      return existingRequest;
    }

    // ✅ FIX: Create the promise for this request
    const requestPromise = (async () => {
      try {
        // ✅ FIX: Use SERIALIZABLE isolation to prevent race conditions
        // SQLite uses SERIALIZABLE by default with WAL mode, but we add maxWait/timeout for safety
        const result = await this.prisma.$transaction(async tx => {
          // First get the menu item
          const menuItem = await tx.menuItem.findUnique({
            where: { id: item.menuItemId },
          });

        if (!menuItem) {
          throw new AppError('Menu item not found', true);
        }

        // ✅ CRITICAL FIX: Query inventory items directly (relation doesn't exist in Prisma schema)
        const inventoryItems = await (tx as any).menuItemInventory.findMany({
          where: { menuItemId: item.menuItemId },
          include: { inventory: true },
        });

        // Determine unit price: use provided one if valid, otherwise fallback to menu item's price
        // ✅ CRITICAL FIX: Convert menuItem.price to Decimal (it comes from SQLite as a number)
        const resolvedUnitPrice: Decimal =
          item.unitPrice && validateCurrencyAmount(item.unitPrice)
            ? (item.unitPrice as Decimal)
            : toDecimal(menuItem.price);

        // Validate resolved unit price
        if (!validateCurrencyAmount(resolvedUnitPrice)) {
          throw new AppError('Invalid unit price', true);
        }

        // Normalize notes for comparison (null vs empty string vs undefined should be treated the same)
        const normalizedNotes = item.notes?.trim() || null;

        // ✅ FIX: Fetch ALL candidate items with same menuItemId, unitPrice, and notes
        // Then compare addon sets to find exact match
        const candidateItems = await tx.orderItem.findMany({
          where: {
            orderId,
            menuItemId: item.menuItemId,
            unitPrice: resolvedUnitPrice,
            notes: normalizedNotes,
          },
          include: {
            menuItem: true,
            addons: {
              include: { addon: true }
            }
          },
        });

        // Normalize incoming addon selections for comparison
        const incomingAddons = item.addonSelections?.map(sel => ({
          addonId: sel.addonId,
          quantity: sel.quantity,
        })) || [];

        // Find item with IDENTICAL addon set
        // Items with different addon combinations should NEVER be merged
        let existingItem = null;
        if (candidateItems.length > 0) {
          existingItem = candidateItems.find(candidate => {
            const candidateAddons = candidate.addons || [];
            const isEqual = this.addonsAreEqual(candidateAddons, incomingAddons);
            return isEqual;
          });
        }

        // CRITICAL FIX: Deduct stock BEFORE modifying order items
        if (inventoryItems && inventoryItems.length > 0) {
          logger.info(
            `🔍 STOCK DEDUCTION: Processing for ${menuItem.name} (quantity: ${item.quantity})`
          );

          const inventoryUpdates: Map<string, number> = new Map();

          // Calculate total required quantities per inventory item
          for (const inventoryLink of inventoryItems) {
            const inventoryId = inventoryLink.inventoryId;
            const requiredQuantity =
              Number(inventoryLink.quantity) * item.quantity;

            const currentTotal = inventoryUpdates.get(inventoryId) || 0;
            inventoryUpdates.set(inventoryId, currentTotal + requiredQuantity);
          }

          // Check stock availability and deduct atomically within the same transaction
          for (const [
            inventoryId,
            requiredQuantity,
          ] of Array.from(inventoryUpdates.entries())) {
            const inventoryItem = await tx.inventory.findUnique({
              where: { id: inventoryId },
            });

            if (!inventoryItem) {
              throw new AppError(
                `Inventory item ${inventoryId} not found`,
                true
              );
            }

            const currentStock = Number(inventoryItem.currentStock);
            const newStock = currentStock - requiredQuantity;

            if (newStock < 0) {
              throw new AppError(
                `Insufficient stock for ${inventoryItem.itemName}. Available: ${currentStock}, Required: ${requiredQuantity}`,
                true
              );
            }

            // Deduct stock atomically within transaction
            await tx.inventory.update({
              where: { id: inventoryId },
              data: { currentStock: newStock },
            });

            // Log the deduction for audit
            await tx.auditLog.create({
              data: {
                action: 'INVENTORY_DECREASE',
                tableName: 'inventory',
                recordId: inventoryId,
                newValues: {
                  reason: 'Item added to order via OrderModel.addItem',
                  orderId: orderId,
                  menuItemId: item.menuItemId,
                  menuItemName: menuItem.name,
                  previousStock: currentStock,
                  used: requiredQuantity,
                  newStock: newStock,
                  unit: inventoryItem.unit,
                  timestamp: getCurrentLocalDateTime(),
                },
              },
            });

            logger.info(
              `✅ STOCK DEDUCTED: ${inventoryItem.itemName} (${currentStock} → ${newStock} ${inventoryItem.unit})`
            );
          }
        }

        let resultOrderItem;

        if (existingItem) {
          // Update quantity of existing item instead of creating duplicate
          const newQuantity = existingItem.quantity + item.quantity;
          const newTotalPrice = multiplyDecimals(
            resolvedUnitPrice,
            new DecimalJS(newQuantity)
          );

          const updatedItem = await tx.orderItem.update({
            where: { id: existingItem.id },
            data: {
              quantity: newQuantity,
              totalPrice: newTotalPrice,
            },
            include: {
              menuItem: true,
              addons: {
                include: {
                  addon: {
                    include: {
                      addonGroup: true
                    }
                  }
                }
              }
            },
          });

          resultOrderItem = {
            ...updatedItem,
            name: menuItem.name,
            menuItemName: menuItem.name,
          };
        } else {
          // Create new item if no matching item exists
          const totalPrice = multiplyDecimals(
            resolvedUnitPrice,
            new DecimalJS(item.quantity)
          );

          const orderItemData = {
            orderId,
            menuItemId: item.menuItemId,
            quantity: item.quantity,
            unitPrice: resolvedUnitPrice,
            totalPrice: totalPrice,
            notes: normalizedNotes,
          };

          const orderItem = await tx.orderItem.create({
            data: orderItemData as any,
            include: {
              menuItem: true,
              addons: {
                include: {
                  addon: {
                    include: {
                      addonGroup: true
                    }
                  }
                }
              }
            },
          });

          resultOrderItem = {
            ...orderItem,
            name: menuItem.name,
            menuItemName: menuItem.name,
          };
        }

        return resultOrderItem;
      }, {
        maxWait: 5000, // Maximum time to wait for transaction to start (5 seconds)
        timeout: 10000, // Maximum time for transaction to complete (10 seconds)
      });

      // Recalculate order totals (outside transaction is fine)
      await this.recalculateOrderTotals(orderId);

      return {
        success: true,
        data: this.mapPrismaOrderItem(result),
        timestamp: getCurrentLocalDateTime(),
      };
    } catch (error) {
      logger.error(
        `Failed to add item to order: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to add item to order',
        timestamp: getCurrentLocalDateTime(),
      };
    } finally {
      // ✅ FIX: Always clean up the pending request from the Map
      this.pendingAddItemRequests.delete(requestKey);
    }
    })();

    // ✅ FIX: Store the promise in the Map before starting execution
    this.pendingAddItemRequests.set(requestKey, requestPromise);

    // ✅ FIX: Return the promise (deduplication will return same promise for concurrent requests)
    return requestPromise;
  }

  async removeItem(orderItemId: string): Promise<IPCResponse<boolean>> {
    try {
      // FIXED: Use transaction to ensure atomicity between order changes and stock restoration
      const result = await this.prisma.$transaction(async tx => {
        // Get the order item with its menu item
        const orderItem = await tx.orderItem.findUnique({
          where: { id: orderItemId },
          include: {
            menuItem: true,
          },
        });

        if (!orderItem) {
          throw new AppError('Order item not found', true);
        }

        // ✅ CRITICAL FIX: Query inventory items directly (relation doesn't exist in Prisma schema)
        const inventoryItems = await (tx as any).menuItemInventory.findMany({
          where: { menuItemId: orderItem.menuItemId },
          include: { inventory: true },
        });

        // CRITICAL FIX: Restore stock BEFORE removing the order item
        if (inventoryItems && inventoryItems.length > 0) {
          logger.info(
            `🔄 STOCK RESTORATION: Processing for ${orderItem.menuItem.name} (quantity: ${orderItem.quantity})`
          );

          const inventoryUpdates: Map<string, number> = new Map();

          // Calculate total quantities to restore per inventory item
          for (const inventoryLink of inventoryItems) {
            const inventoryId = inventoryLink.inventoryId;
            const restoreQuantity =
              Number(inventoryLink.quantity) * orderItem.quantity;

            const currentTotal = inventoryUpdates.get(inventoryId) || 0;
            inventoryUpdates.set(inventoryId, currentTotal + restoreQuantity);
          }

          // Restore stock atomically within the same transaction
          for (const [
            inventoryId,
            restoreQuantity,
          ] of Array.from(inventoryUpdates.entries())) {
            const inventoryItem = await tx.inventory.findUnique({
              where: { id: inventoryId },
            });

            if (!inventoryItem) {
              logger.warn(
                `Inventory item ${inventoryId} not found during restoration`
              );
              continue;
            }

            const currentStock = Number(inventoryItem.currentStock);
            const newStock = currentStock + restoreQuantity;

            // Restore stock atomically within transaction
            await tx.inventory.update({
              where: { id: inventoryId },
              data: { currentStock: newStock },
            });

            // Log the restoration for audit
            await tx.auditLog.create({
              data: {
                action: 'INVENTORY_INCREASE',
                tableName: 'inventory',
                recordId: inventoryId,
                newValues: {
                  reason: 'Item removed from order via OrderModel.removeItem',
                  orderId: orderItem.orderId,
                  orderItemId: orderItemId,
                  menuItemId: orderItem.menuItemId,
                  menuItemName: orderItem.menuItem?.name,
                  previousStock: currentStock,
                  restored: restoreQuantity,
                  newStock: newStock,
                  unit: inventoryItem.unit,
                  timestamp: getCurrentLocalDateTime(),
                },
              },
            });

            logger.info(
              `✅ STOCK RESTORED: ${inventoryItem.itemName} (${currentStock} → ${newStock} ${inventoryItem.unit})`
            );
          }
        }

        // Remove the order item after stock restoration
        await tx.orderItem.delete({
          where: { id: orderItemId },
        });

        return orderItem.orderId;
      });

      // Recalculate order totals (outside transaction is fine)
      await this.recalculateOrderTotals(result);

      return {
        success: true,
        data: true,
        timestamp: getCurrentLocalDateTime(),
      };
    } catch (error) {
      logger.error(
        `Failed to remove item from order: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to remove item from order',
        timestamp: getCurrentLocalDateTime(),
      };
    }
  }

  /**
   * Update the quantity of an order item
   * @param orderItemId ID of the order item to update
   * @param newQuantity New quantity for the order item
   * @returns The updated order item
   */
  async updateItemQuantity(
    orderItemId: string,
    newQuantity: number
  ): Promise<IPCResponse<any>> {
    try {
      if (newQuantity <= 0) {
        return {
          success: false,
          error: 'Quantity must be greater than zero',
          timestamp: getCurrentLocalDateTime(),
        };
      }

      // FIXED: Use transaction to ensure atomicity between quantity changes and stock adjustments
      const result = await this.prisma.$transaction(async tx => {
        // Find the order item with its current values
        const orderItem = await tx.orderItem.findUnique({
          where: { id: orderItemId },
          include: {
            menuItem: true,
          },
        });

        if (!orderItem) {
          throw new AppError('Order item not found', true);
        }

        // ✅ CRITICAL FIX: Query inventory items directly (relation doesn't exist in Prisma schema)
        const inventoryItems = await (tx as any).menuItemInventory.findMany({
          where: { menuItemId: orderItem.menuItemId },
          include: { inventory: true },
        });

        const currentQuantity = orderItem.quantity;
        const quantityDifference = newQuantity - currentQuantity;
        const inventoryUpdates: Map<string, number> = new Map();

        // CRITICAL FIX: Adjust stock based on quantity change
        if (
          quantityDifference !== 0 &&
          inventoryItems &&
          inventoryItems.length > 0
        ) {
          logger.info(
            `🔄 STOCK ADJUSTMENT: Processing for ${orderItem.menuItem.name} (${currentQuantity} → ${newQuantity})`
          );

          // Calculate stock adjustments needed per inventory item
          for (const inventoryLink of inventoryItems) {
            const inventoryId = inventoryLink.inventoryId;
            const adjustmentQuantity =
              Number(inventoryLink.quantity) * Math.abs(quantityDifference);

            const currentTotal = inventoryUpdates.get(inventoryId) || 0;
            inventoryUpdates.set(
              inventoryId,
              currentTotal + adjustmentQuantity
            );
          }

          // Apply stock adjustments atomically within the same transaction
          for (const [
            inventoryId,
            adjustmentQuantity,
          ] of Array.from(inventoryUpdates.entries())) {
            const inventoryItem = await tx.inventory.findUnique({
              where: { id: inventoryId },
            });

            if (!inventoryItem) {
              logger.warn(
                `Inventory item ${inventoryId} not found during quantity update`
              );
              continue;
            }

            const currentStock = Number(inventoryItem.currentStock);
            let newStock: number;
            let action: string;
            let reason: string;

            if (quantityDifference > 0) {
              // Quantity increased - deduct additional stock
              newStock = currentStock - adjustmentQuantity;
              action = 'INVENTORY_DECREASE';
              reason = 'Order item quantity increased';

              if (newStock < 0) {
                throw new AppError(
                  `Insufficient stock for ${inventoryItem.itemName}. Available: ${currentStock}, Required: ${adjustmentQuantity}`,
                  true
                );
              }
            } else {
              // Quantity decreased - restore excess stock
              newStock = currentStock + adjustmentQuantity;
              action = 'INVENTORY_INCREASE';
              reason = 'Order item quantity decreased';
            }

            // Apply stock adjustment atomically within transaction
            await tx.inventory.update({
              where: { id: inventoryId },
              data: { currentStock: newStock },
            });

            // Log the adjustment for audit
            await tx.auditLog.create({
              data: {
                action: action,
                tableName: 'inventory',
                recordId: inventoryId,
                newValues: {
                  reason: reason,
                  orderId: orderItem.orderId,
                  orderItemId: orderItemId,
                  menuItemId: orderItem.menuItemId,
                  menuItemName: orderItem.menuItem?.name,
                  previousStock: currentStock,
                  adjustment:
                    quantityDifference > 0
                      ? -adjustmentQuantity
                      : adjustmentQuantity,
                  newStock: newStock,
                  oldQuantity: currentQuantity,
                  newQuantity: newQuantity,
                  unit: inventoryItem.unit,
                  timestamp: getCurrentLocalDateTime(),
                },
              },
            });

            const actionEmoji = quantityDifference > 0 ? '📉' : '📈';
            logger.info(
              `${actionEmoji} STOCK ADJUSTED: ${inventoryItem.itemName} (${currentStock} → ${newStock} ${inventoryItem.unit})`
            );
          }
        }

        // NEW: Adjust addon stock based on quantity change
        if (quantityDifference !== 0) {
          // Fetch all addons for this order item
          const orderItemAddons = await tx.orderItemAddon.findMany({
            where: { orderItemId },
            include: {
              addon: {
                include: {
                  inventoryItems: {
                    include: {
                      inventory: true,
                    },
                  },
                },
              },
            },
          });

          if (orderItemAddons && orderItemAddons.length > 0) {
            logger.info(
              `🔄 ADDON STOCK ADJUSTMENT: Processing ${orderItemAddons.length} addons for order item quantity change (${currentQuantity} → ${newQuantity})`
            );

            for (const addonAssignment of orderItemAddons) {
              const addon = addonAssignment.addon;

              if (addon.inventoryItems && addon.inventoryItems.length > 0) {
                for (const addonInvItem of addon.inventoryItems) {
                  if (addonInvItem.inventory && addonInvItem.quantity > 0) {
                    // Calculate adjustment: addon quantity per item * quantity difference
                    const addonQuantityPerItem = addonInvItem.quantity * addonAssignment.quantity;
                    const totalAdjustment = addonQuantityPerItem * Math.abs(quantityDifference);

                    const currentStock = Number(addonInvItem.inventory.currentStock);
                    let newStock: number;
                    let action: string;
                    let reason: string;

                    if (quantityDifference > 0) {
                      // Quantity increased - deduct additional addon stock
                      newStock = currentStock - totalAdjustment;
                      action = 'INVENTORY_DECREASE';
                      reason = 'Order item quantity increased - addon stock deducted';

                      if (newStock < 0) {
                        throw new AppError(
                          `Insufficient addon stock for ${addon.name}. Available: ${currentStock}, Required: ${totalAdjustment}`,
                          true
                        );
                      }
                    } else {
                      // Quantity decreased - restore excess addon stock
                      newStock = currentStock + totalAdjustment;
                      action = 'INVENTORY_INCREASE';
                      reason = 'Order item quantity decreased - addon stock restored';
                    }

                    // Apply addon stock adjustment
                    await tx.inventory.update({
                      where: { id: addonInvItem.inventoryId },
                      data: {
                        currentStock: newStock,
                        updatedAt: getCurrentLocalDateTime(),
                      },
                    });

                    // Audit log for addon inventory adjustment
                    await tx.auditLog.create({
                      data: {
                        action: action,
                        tableName: 'inventory',
                        recordId: addonInvItem.inventoryId,
                        newValues: {
                          reason: reason,
                          orderId: orderItem.orderId,
                          orderItemId: orderItemId,
                          addonId: addon.id,
                          addonName: addon.name,
                          previousStock: currentStock,
                          adjustment: quantityDifference > 0 ? -totalAdjustment : totalAdjustment,
                          newStock: newStock,
                          oldItemQuantity: currentQuantity,
                          newItemQuantity: newQuantity,
                          addonQuantityPerItem: addonQuantityPerItem,
                          timestamp: getCurrentLocalDateTime(),
                        },
                      },
                    });

                    const actionEmoji = quantityDifference > 0 ? '📉' : '📈';
                    logger.info(
                      `${actionEmoji} ADDON STOCK ADJUSTED: ${addon.name} → ${addonInvItem.inventory.itemName} (${currentStock} → ${newStock})`
                    );
                  }
                }
              }
            }
          }
        }

        // Calculate unit price if not already set
        let unitPrice = orderItem.unitPrice;
        if (!unitPrice && orderItem.menuItem) {
          unitPrice = orderItem.menuItem.price;
        }

        // ✅ FIX: Fetch addons for totalPrice calculation
        const addons = await tx.orderItemAddon.findMany({
          where: { orderItemId },
          include: {
            addon: {
              include: { addonGroup: true }
            }
          }
        });

        // ✅ NEW APPROACH: addon.quantity represents PER-ITEM quantity (never changes)
        // Calculate total addon cost by multiplying per-item cost by NEW item quantity
        let addonTotalPerItem = new DecimalJS(0);
        for (const addon of addons) {
          const addonUnitPrice = new DecimalJS(addon.unitPrice || 0);
          const addonQtyPerItem = new DecimalJS(addon.quantity || 0); // This is per-item, never changes
          const addonCostPerItem = addonUnitPrice.mul(addonQtyPerItem);
          addonTotalPerItem = addDecimals(addonTotalPerItem, addonCostPerItem);
        }

        // Scale addon cost by NEW item quantity (addons qty in DB stays constant)
        const addonTotalScaled = new DecimalJS(addonTotalPerItem).mul(newQuantity);

        // ✅ CRITICAL: Do NOT modify addon quantities in database - they represent per-item quantities
        // Frontend will multiply addon.quantity × item.quantity for display

        logger.debug(
          `📦 ADDON CALCULATION: Per-item cost: ${addonTotalPerItem}, Item qty: ${newQuantity}, Total: ${addonTotalScaled}`
        );

        logger.info(
          `💰 PRICE CALCULATION: Item ${orderItem.menuItem?.name || 'Unknown'} - Base: ${unitPrice} × ${newQuantity} = ${new DecimalJS(newQuantity).mul(unitPrice || 0)}, Addons: ${addonTotalPerItem} × ${newQuantity} = ${addonTotalScaled}, Total: ${new DecimalJS(newQuantity).mul(unitPrice || 0).add(addonTotalScaled)}`
        );

        // ✅ FIX: Update the order item with correct total including scaled addons
        const updatedItem = await tx.orderItem.update({
          where: { id: orderItemId },
          data: {
            quantity: newQuantity,
            totalPrice: new DecimalJS(newQuantity).mul(unitPrice || 0).add(addonTotalScaled),
          },
          include: {
            menuItem: true,
            addons: {
              include: {
                addon: {
                  include: { addonGroup: true }
                }
              }
            }
          },
        });

        // Log the quantity change for audit
        await tx.auditLog.create({
          data: {
            action: 'QUANTITY_CHANGED',
            tableName: 'order_items',
            recordId: orderItemId,
            newValues: {
              orderId: orderItem.orderId,
              itemId: orderItemId,
              menuItemName: orderItem.menuItem?.name || 'Unknown Item',
              oldQuantity: orderItem.quantity,
              newQuantity: newQuantity,
              stockAdjusted: inventoryUpdates.size > 0,
              timestamp: getCurrentLocalDateTime(),
            },
          },
        });

        return { updatedItem, orderId: orderItem.orderId };
      });

      // ✅ FIX: Wait for recalculation to complete before returning
      await this.recalculateOrderTotals(result.orderId);

      // ✅ FIX: Fetch fresh order with updated totals to avoid race condition
      // Frontend was calling getById() immediately, racing with recalculation
      const freshOrder = await this.findById(result.orderId);
      if (!freshOrder.success) {
        throw new Error('Failed to fetch updated order after quantity change');
      }

      return {
        success: true,
        data: freshOrder.data,  // ✅ Return fresh order with correct totals
        timestamp: getCurrentLocalDateTime(),
      };
    } catch (error) {
      logger.error(
        `Failed to update order item quantity: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to update order item quantity',
        timestamp: getCurrentLocalDateTime(),
      };
    }
  }

  public async recalculateOrderTotals(orderId: string): Promise<void> {
    // ✅ FIX: Include addons for visibility/debugging
    // Note: item.totalPrice should already include addon prices after Fix #1
    const orderItems = await this.prisma.orderItem.findMany({
      where: { orderId },
      include: {
        addons: true, // Include for debugging/verification
      },
    });

    // Calculate subtotal using Decimal arithmetic
    // ✅ item.totalPrice now includes addon prices, so this calculation is correct
    let subtotal = new DecimalJS(0);
    for (const item of orderItems) {
      subtotal = addDecimals(subtotal, item.totalPrice);
    }

    logger.info(
      `📊 ORDER TOTAL RECALCULATION: Order ${orderId} - Subtotal: ${subtotal} (from ${orderItems.length} items)`
    );

    // No tax calculation - total equals subtotal as requested
    const tax = new DecimalJS(0);
    const total = subtotal; // Total is same as subtotal, no tax added

    await this.prisma.order.update({
      where: { id: orderId },
      data: { subtotal, tax, total },
    });
  }

  async getTodaysOrders(): Promise<IPCResponse<Order[]>> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const orders = await this.prisma.order.findMany({
        where: {
          createdAt: {
            gte: today.toISOString(),
            lt: tomorrow.toISOString(),
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      // Manually fetch items with relationships
      const ordersWithItems = await Promise.all(
        orders.map(async (order: any) => {
          const items = await this.fetchOrderItemsWithRelations(order.id);
          return { ...order, items };
        })
      );

      return {
        success: true,
        data: ordersWithItems.map(order => this.mapPrismaOrder(order)),
        timestamp: getCurrentLocalDateTime(),
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch today's orders",
        timestamp: getCurrentLocalDateTime(),
      };
    }
  }
}

/**
 * Map Prisma OrderItem to application OrderItem DTO
 */
export function mapPrismaOrderItemToDTO(prismaOrderItem: any): any {
  // Use type assertion to handle properties that might not exist in the Prisma model
  const orderItem = prismaOrderItem as any;

  return {
    id: orderItem.id,
    orderId: orderItem.orderId,
    menuItemId: orderItem.menuItemId,
    name:
      orderItem.name ||
      (orderItem.menuItem ? orderItem.menuItem.name : '') ||
      'Unknown Item', // Improved fallback with menu item name
    menuItemName:
      orderItem.menuItemName ||
      orderItem.name ||
      (orderItem.menuItem ? orderItem.menuItem.name : '') ||
      'Unknown Item', // Add menuItemName field for frontend compatibility
    quantity: orderItem.quantity,
    unitPrice: Number(orderItem.unitPrice),
    totalPrice: Number(orderItem.totalPrice),
    subtotal: orderItem.subtotal
      ? Number(orderItem.subtotal)
      : Number(orderItem.totalPrice), // Default to totalPrice if missing
    notes: orderItem.notes,
    status: mapPrismaOrderItemStatusToAppOrderItemStatus(orderItem.status),
    createdAt: toISOString(orderItem.createdAt),
    updatedAt: toISOString(orderItem.updatedAt),
    // ✅ FIX: Include menuItem object for kitchen ticket filtering
    menuItem: orderItem.menuItem ? {
      id: orderItem.menuItem.id,
      name: orderItem.menuItem.name,
      isPrintableInKitchen: orderItem.menuItem.isPrintableInKitchen !== undefined
        ? orderItem.menuItem.isPrintableInKitchen
        : true, // default to true for backward compatibility
      price: orderItem.menuItem.price,
      categoryId: orderItem.menuItem.categoryId,
    } : undefined,
  };
}

/**
 * Map Prisma Order to application Order DTO
 */
export function mapPrismaOrderToDTO(
  prismaOrder: any
): Order {
  // Use type assertion to handle properties that might not exist in the Prisma model
  const order = prismaOrder as any;

  return {
    id: order.id,
    orderNumber: order.orderNumber || `ORD-${order.id.slice(-8)}`,
    tableId: order.tableId,
    customerId: order.customerId,
    userId: order.userId || '',
    items: order.items ? order.items.map(mapPrismaOrderItemToDTO) : [],
    status: mapPrismaOrderStatusToAppOrderStatus(order.status),
    type: order.type || OrderType.DINE_IN,
    total: Number(order.total),
    tax: Number(order.tax),
    subtotal: Number(order.subtotal),
    discount: order.discount ? Number(order.discount) : undefined,
    notes: order.notes || undefined,
    customerName: order.customerName || undefined,
    customerPhone: order.customerPhone || undefined,
    deliveryAddress: order.deliveryAddress || undefined,
    createdAt: order.createdAt instanceof Date
      ? dateToLocalDateTime(order.createdAt)
      : (order.createdAt || getCurrentLocalDateTime()),
    updatedAt: order.updatedAt instanceof Date
      ? dateToLocalDateTime(order.updatedAt)
      : (order.updatedAt || getCurrentLocalDateTime()),
  };
}
