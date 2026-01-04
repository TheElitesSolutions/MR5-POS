/**
 * Order Service for mr5-POS Electron Application
 * Handles order processing and management
 */

import {
  OrderItemStatus as PrismaOrderItemStatus,
  OrderStatus as PrismaOrderStatus,
  OrderType as PrismaOrderType,
  PaymentMethod as PrismaPaymentMethod,
} from '../prisma';
import { Decimal } from 'decimal.js';
import {
  CreateOrderRequest,
  OrderSearchParams,
  UpdateOrderRequest,
  UpdateOrderStatusRequest,
} from '../../shared/ipc-types';
import { AppError } from '../error-handler';
import {
  IPCResponse,
  OrderItemStatus,
  OrderStatus,
  OrderType,
  PaymentMethod,
} from '../types';
import { decimalToNumber } from '../utils/decimal';
import { getCurrentLocalDateTime, dateToLocalDateTime } from '../utils/dateTime';
import { BaseService } from './baseService';
import { InventoryService } from './inventoryService';

/**
 * Maps Prisma OrderStatus to application OrderStatus
 */
function mapPrismaOrderStatusToAppOrderStatus(
  prismaStatus: PrismaOrderStatus
): OrderStatus {
  switch (prismaStatus) {
    case 'DRAFT':
      return OrderStatus.DRAFT;
    case 'PENDING':
      return OrderStatus.PENDING;
    case 'CONFIRMED':
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
      return OrderStatus.PENDING;
  }
}

/**
 * Maps application OrderStatus to Prisma OrderStatus
 */
function mapAppOrderStatusToPrismaOrderStatus(
  appStatus: OrderStatus | string
): PrismaOrderStatus {
  const status =
    typeof appStatus === 'string' ? (appStatus as OrderStatus) : appStatus;

  switch (status) {
    case OrderStatus.DRAFT:
      return 'DRAFT' as PrismaOrderStatus;
    case OrderStatus.PENDING:
      return 'PENDING' as PrismaOrderStatus;
    case OrderStatus.PREPARING:
      return 'CONFIRMED' as PrismaOrderStatus;
    case OrderStatus.READY:
      return 'READY' as PrismaOrderStatus;
    case OrderStatus.SERVED:
      return 'SERVED' as PrismaOrderStatus;
    case OrderStatus.COMPLETED:
      return 'COMPLETED' as PrismaOrderStatus;
    case OrderStatus.CANCELLED:
      return 'CANCELLED' as PrismaOrderStatus;
    default:
      return 'PENDING' as PrismaOrderStatus;
  }
}

/**
 * Maps Prisma OrderItemStatus to application OrderItemStatus
 */
function mapPrismaOrderItemStatusToAppOrderItemStatus(
  prismaStatus: PrismaOrderItemStatus
): OrderItemStatus {
  switch (prismaStatus) {
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
      return OrderItemStatus.PENDING;
  }
}

/**
 * Maps application OrderItemStatus to Prisma OrderItemStatus
 */
function mapAppOrderItemStatusToPrismaOrderItemStatus(
  appStatus: OrderItemStatus
): PrismaOrderItemStatus {
  switch (appStatus) {
    case OrderItemStatus.PENDING:
      return 'PENDING' as PrismaOrderItemStatus;
    case OrderItemStatus.PREPARING:
      return 'PREPARING' as PrismaOrderItemStatus;
    case OrderItemStatus.READY:
      return 'READY' as PrismaOrderItemStatus;
    case OrderItemStatus.SERVED:
      return 'SERVED' as PrismaOrderItemStatus;
    case OrderItemStatus.CANCELLED:
      return 'CANCELLED' as PrismaOrderItemStatus;
    default:
      return 'PENDING' as PrismaOrderItemStatus;
  }
}

/**
 * Maps Prisma PaymentMethod to application PaymentMethod
 */
function mapPrismaPaymentMethodToAppPaymentMethod(
  prismaMethod: PrismaPaymentMethod | null
): PaymentMethod | undefined {
  if (!prismaMethod) return undefined;

  switch (prismaMethod) {
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
 * Maps application PaymentMethod to Prisma PaymentMethod
 */
function mapAppPaymentMethodToPrismaPaymentMethod(
  appMethod: PaymentMethod | undefined | null | string
): PrismaPaymentMethod | null {
  if (!appMethod) return null;

  // Convert string to PaymentMethod if needed
  const method =
    typeof appMethod === 'string' ? (appMethod as PaymentMethod) : appMethod;

  switch (method) {
    case PaymentMethod.CASH:
      return 'CASH' as PrismaPaymentMethod;
    case PaymentMethod.CARD:
      return 'CARD' as PrismaPaymentMethod;
    case PaymentMethod.DIGITAL_WALLET:
      return 'DIGITAL_WALLET' as PrismaPaymentMethod;
    case PaymentMethod.CHECK:
      return 'CHECK' as PrismaPaymentMethod;
    case PaymentMethod.OTHER:
      return 'OTHER' as PrismaPaymentMethod;
    default:
      return 'CASH' as PrismaPaymentMethod;
  }
}

/**
 * Maps Prisma OrderType to application OrderType
 */
function mapPrismaOrderTypeToAppOrderType(
  prismaType: PrismaOrderType
): OrderType {
  switch (prismaType) {
    case 'DINE_IN':
      return OrderType.DINE_IN;
    case 'TAKEOUT':
      return OrderType.TAKEOUT;
    case 'DELIVERY':
      return OrderType.DELIVERY;
    default:
      return OrderType.DINE_IN;
  }
}

/**
 * Maps application OrderType to Prisma OrderType
 */
function mapAppOrderTypeToPrismaOrderType(
  appType: OrderType | string
): PrismaOrderType {
  const type = typeof appType === 'string' ? (appType as OrderType) : appType;

  switch (type) {
    case OrderType.DINE_IN:
      return 'DINE_IN' as PrismaOrderType;
    case OrderType.TAKEOUT:
      return 'TAKEOUT' as PrismaOrderType;
    case OrderType.DELIVERY:
      return 'DELIVERY' as PrismaOrderType;
    default:
      return 'DINE_IN' as PrismaOrderType;
  }
}

// Define our own interfaces that match what we're returning
interface OrderDTO {
  id: string;
  orderNumber?: string | undefined;
  tableId?: string | undefined;
  table?: { id: string; number: number } | undefined;
  userId: string;
  user?: { id: string; firstName: string; lastName: string } | undefined;
  status: OrderStatus;
  type?: OrderType | undefined;
  subtotal: number;
  tax: number;
  deliveryFee: number;
  total: number;
  paymentMethod?: PaymentMethod | undefined;
  notes?: string | undefined;
  items: OrderItemDTO[];
  createdAt: Date | string; // Can be Date from Prisma or string from mapping
  updatedAt: Date | string; // Can be Date from Prisma or string from mapping
  completedAt?: Date | string | undefined; // Can be Date from Prisma or string from mapping
  // Customer fields for takeaway/delivery orders
  customerName?: string | undefined;
  customerPhone?: string | undefined;
  deliveryAddress?: string | undefined;
}

export interface OrderItemDTO {
  id: string;
  orderId: string;
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  subtotal: number;
  notes: string | null | undefined; // Made compatible with both null and undefined
}

interface OrderStatsDTO {
  totalOrders: number;
  statusCounts: Record<string, number>;
  sales: {
    total: number;
    subtotal: number;
    tax: number;
    count: number;
    average: number;
  };
  topItems: Array<{
    menuItemId: string;
    name: string;
    category: string;
    quantity: number;
    sales: number;
  }>;
}

// Define a type for PrismaOrder with included relations
interface PrismaOrderWithRelations {
  id: string;
  orderNumber: string;
  tableId: string;
  customerId: string | null;
  userId: string;
  status: PrismaOrderStatus;
  type: PrismaOrderType;
  subtotal: Decimal;
  tax: Decimal;
  discount: Decimal;
  deliveryFee: Decimal;
  total: Decimal;
  paymentMethod: PrismaPaymentMethod | null;
  notes: string | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  // Customer fields for takeaway/delivery orders
  customerName: string | null;
  customerPhone: string | null;
  deliveryAddress: string | null;
  items?: {
    id: string;
    orderId: string;
    menuItemId: string;
    name: string;
    quantity: number;
    unitPrice: Decimal;
    totalPrice: Decimal;
    notes: string | null;
    status: PrismaOrderItemStatus;
    createdAt: Date;
    updatedAt: Date;
    menuItem?: {
      id: string;
      name: string;
      description: string;
      price: Decimal;
      category: string;
      isAvailable: boolean;
      isActive: boolean;
    };
  }[];
  table?: { id: string; number: number } | null;
  user?: { id: string; firstName: string; lastName: string } | null;
}

// Define a type for order items with price and subtotal
interface OrderItemWithPrice {
  menuItemId: string;
  name: string;
  price: Decimal;
  quantity: number;
  subtotal: Decimal;
  notes: string | null;
  unitPrice: Decimal;
  totalPrice: Decimal;
  status: PrismaOrderItemStatus;
}

// Type for database records
interface PrismaOrder {
  id: string;
  tableId: string;
  userId: string;
  status: string;
  completedAt?: Date | null;
  [key: string]: any;
}

export class OrderService extends BaseService {
  /**
   * Map Prisma Order to OrderDTO interface
   */
  private mapPrismaOrder(order: PrismaOrderWithRelations): OrderDTO {
    const mappedType = order.type
      ? mapPrismaOrderTypeToAppOrderType(order.type)
      : undefined;

    console.log('🔍 DEBUG: Backend mapping order:', {
      id: order.id,
      orderNumber: order.orderNumber,
      prismaType: order.type,
      mappedType,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      deliveryAddress: order.deliveryAddress,
    });

    return {
      id: order.id,
      tableId: order.tableId || undefined,
      table: order.table || undefined,
      userId: order.userId,
      user: order.user || undefined,
      status: mapPrismaOrderStatusToAppOrderStatus(order.status),
      type: mappedType,
      subtotal: decimalToNumber(order.subtotal),
      tax: decimalToNumber(order.tax),
      deliveryFee: decimalToNumber(order.deliveryFee || new Decimal(0)),
      total: decimalToNumber(order.total),
      paymentMethod: order.paymentMethod
        ? mapPrismaPaymentMethodToAppPaymentMethod(order.paymentMethod)
        : undefined,
      notes: order.notes || undefined,
      items:
        order.items?.map(item => {
          const itemName = item.menuItem?.name || item.name || 'Unknown Item';
          console.log('🔍 DEBUG: Mapping order item:', {
            itemId: item.id,
            menuItemId: item.menuItemId,
            dbItemName: item.name,
            menuItemName: item.menuItem?.name,
            finalName: itemName,
          });

          return {
            id: item.id,
            orderId: item.orderId,
            menuItemId: item.menuItemId,
            name: itemName,
            price: decimalToNumber(item.unitPrice || new Decimal(0)),
            unitPrice: decimalToNumber(item.unitPrice || new Decimal(0)), // ✅ FIX: Add unitPrice for frontend
            quantity: item.quantity,
            subtotal: decimalToNumber(item.totalPrice || new Decimal(0)),
            totalPrice: decimalToNumber(item.totalPrice || new Decimal(0)), // ✅ FIX: Add totalPrice for frontend
            notes: item.notes,
          };
        }) || [],
      createdAt: order.createdAt instanceof Date
        ? dateToLocalDateTime(order.createdAt)
        : order.createdAt,
      updatedAt: order.updatedAt instanceof Date
        ? dateToLocalDateTime(order.updatedAt)
        : order.updatedAt,
      completedAt: order.completedAt
        ? (order.completedAt instanceof Date ? dateToLocalDateTime(order.completedAt) : order.completedAt)
        : undefined,
      // Customer fields for takeaway/delivery orders
      customerName: order.customerName || undefined,
      customerPhone: order.customerPhone || undefined,
      deliveryAddress: order.deliveryAddress || undefined,
    };
  }

  /**
   * Get all orders with optional filters
   */
  async findAll(filters?: {
    status?: OrderStatus;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<IPCResponse<OrderDTO[]>> {
    return this.wrapMethod(async () => {
      console.log('OrderService: findAll called with filters:', filters);

      // Use parameterized query approach
      console.log(
        'OrderService: building parameterized query for filters:',
        filters
      );

      // Start building the query
      let query = `
        SELECT 
          o.*,
          o."updatedAt" AS "completedAt", -- Using updatedAt as a fallback for completedAt
          
          -- Include table fields if available
          t.id AS table_id,
          t.name AS table_name,
          
          -- Include user fields
          u.id AS user_id,
          u."firstName" AS user_firstName,
          u."lastName" AS user_lastName
        FROM "orders" o
        LEFT JOIN "tables" t ON o."tableId" = t.id
        LEFT JOIN "users" u ON o."userId" = u.id
        WHERE 1=1
      `;

      // Parameters for the query
      const queryParams: any[] = [];
      let paramIndex = 1;

      // Add status filter if provided
      if (filters?.status) {
        const prismaStatus = mapAppOrderStatusToPrismaOrderStatus(
          filters.status
        );
        query += ` AND o.status = ?`;
        queryParams.push(prismaStatus);
      }

      // Add date range filter if provided
      if (filters?.startDate && filters?.endDate) {
        query += ` AND o.createdAt >= ? AND o.createdAt <= ?`;
        queryParams.push(filters.startDate.toISOString());
        queryParams.push(filters.endDate.toISOString());
      }

      // Add ORDER BY clause
      query += ` ORDER BY o.createdAt DESC`;

      // Add LIMIT/OFFSET if provided
      if (filters?.limit) {
        query += ` LIMIT ?`;
        queryParams.push(filters.limit);
      }
      if (filters?.offset) {
        query += ` OFFSET ?`;
        queryParams.push(filters.offset);
      }

      console.log(
        'OrderService: executing raw SQL query:',
        query,
        'with params:',
        queryParams
      );

      // Execute the raw query
      try {
        const orders = await this.prisma.$queryRawUnsafe(query, ...queryParams);

        // Cast the result to any[] to allow mapping
        const ordersArray = orders as any[];
        console.log(
          `OrderService: raw query returned ${ordersArray.length} orders`
        );

        // OPTIMIZATION: Fetch all order items in a single query instead of N+1
        const orderIds = ordersArray.map(o => o.id);

        // Single query to get all items for all orders
        const allItems = await this.prisma.orderItem.findMany({
          where: { orderId: { in: orderIds } },
          include: {
            menuItem: true,
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
        });

        // Group items by orderId in memory (O(n) operation)
        const itemsByOrderId = new Map<string, typeof allItems>();
        for (const item of allItems) {
          if (!itemsByOrderId.has(item.orderId)) {
            itemsByOrderId.set(item.orderId, []);
          }
          itemsByOrderId.get(item.orderId)!.push(item);
        }

        // Attach items to orders
        const ordersWithItems = ordersArray.map(order => ({
          ...order,
          items: itemsByOrderId.get(order.id) || [],
          table: order.table_id
            ? {
                id: order.table_id,
                name: order.table_name,
              }
            : null,
          user: {
            id: order.user_id,
            firstName: order.user_firstName,
            lastName: order.user_lastName,
          },
        }));

        return ordersWithItems.map(order =>
          this.mapPrismaOrder(order as unknown as PrismaOrderWithRelations)
        );
      } catch (error) {
        console.error('Error executing raw query in findAll:', error);
        throw error;
      }
    })();
  }

  /**
   * Get order by ID
   */
  async findById(id: string): Promise<IPCResponse<OrderDTO>> {
    return this.wrapMethod(async () => {
      const order = await this.prisma.order.findUnique({
        where: { id },
        include: {
          items: {
            include: {
              menuItem: true,
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
          table: {
            select: { id: true, name: true },
          },
          user: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      });

      if (!order) {
        throw new AppError('Order not found');
      }

      return this.mapPrismaOrder(order as unknown as PrismaOrderWithRelations);
    })();
  }

  /**
   * Create a new order
   */
  async create(orderData: CreateOrderRequest): Promise<IPCResponse<OrderDTO>> {
    return this.wrapMethod(async () => {
      // Allow empty orders for POS workflow - items can be added after creation
      const hasItems = orderData.items && orderData.items.length > 0;

      let menuItems: any[] = [];
      let orderItems: any[] = [];

      if (hasItems) {
        // Validate menu items and calculate totals only if items exist
        menuItems = await this.prisma.menuItem.findMany({
          where: {
            id: { in: orderData.items.map(item => item.menuItemId) },
          },
        });
      }

      if (hasItems) {
        if (
          menuItems.length !==
          Array.from(new Set(orderData.items.map(item => item.menuItemId))).length
        ) {
          throw new AppError('One or more menu items not found');
        }

        // Calculate order totals for items
        let subtotal = new Decimal(0);
        orderItems = orderData.items.map(item => {
          const menuItem = menuItems.find(mi => mi.id === item.menuItemId)!;
          const itemSubtotal = menuItem.price.mul(item.quantity);
          subtotal = subtotal.add(itemSubtotal);

          return {
            menuItemId: item.menuItemId,
            name: menuItem.name,
            price: menuItem.price,
            unitPrice: menuItem.price,
            quantity: item.quantity,
            subtotal: itemSubtotal,
            totalPrice: itemSubtotal,
            notes: item.notes || null,
            status: 'PENDING' as PrismaOrderItemStatus,
          };
        });
      }

      // Calculate order totals (will be 0 for empty orders)
      let subtotal = new Decimal(0);
      if (hasItems) {
        subtotal = orderItems.reduce(
          (sum, item) => sum.add(item.subtotal),
          new Decimal(0)
        );
      }

      // No tax calculation - this restaurant doesn't apply taxes
      const tax = new Decimal(0);

      // Handle delivery fee for delivery orders
      const deliveryFee = orderData.deliveryFee
        ? new Decimal(orderData.deliveryFee)
        : new Decimal(0);

      // Calculate total (no tax applied)
      const total = subtotal.add(deliveryFee);

      // Convert application OrderType to Prisma OrderType
      const prismaOrderType = orderData.type
        ? mapAppOrderTypeToPrismaOrderType(orderData.type)
        : ('DINE_IN' as PrismaOrderType);

      // Debug log for order creation request
      console.log('🔍 DEBUG: Creating order with data:', {
        type: orderData.type,
        prismaOrderType,
        tableId: orderData.tableId,
        hasItems,
        customerDetails: orderData.customerDetails,
      });

      // Check inventory availability first if we have items
      if (hasItems) {
        try {
          // Try to get the inventory service
          let inventoryService;
          try {
            inventoryService = this.registry.getServiceByClass(InventoryService);
          } catch (e) {
            // If service doesn't exist yet, register it
            inventoryService = this.registry.registerService(InventoryService);
          }

          // Check if we have enough stock for all items
          const stockCheck = await inventoryService.checkStockAvailability(
            orderData.items.map(item => ({
              menuItemId: item.menuItemId,
              quantity: item.quantity,
            }))
          );

          if (!stockCheck.success) {
            throw new AppError(
              stockCheck.error || 'Failed to check stock availability'
            );
          }

          if (stockCheck.data && !stockCheck.data.available) {
            const unavailableItems = stockCheck.data.unavailableItems;
            throw new AppError(
              `Insufficient stock for ${unavailableItems.length} item(s): ${unavailableItems
                .map(
                  i =>
                    `${i.name} (needs ${i.required} ${i.unit}, have ${i.available} ${i.unit})`
                )
                .join(', ')}`,
              true
            );
          }
        } catch (error) {
          if (error instanceof AppError) {
            throw error;
          }
          console.warn(
            '⚠️ WARNING: Could not check inventory availability:',
            error
          );
          // Continue with order creation even if inventory check fails
        }
      }

      // Create the order with items in a transaction - FIXED: Include inventory operations
      const order = await this.executeTransaction(async tx => {
        // Prepare order data - make tableId optional for non-DINE_IN orders
        // Create the order data object
        const orderCreateData: any = {
          orderNumber: `ORD-${Date.now()}`, // Generate an order number
          userId: orderData.userId,
          status: 'PENDING' as PrismaOrderStatus,
          subtotal,
          tax,
          deliveryFee,
          total,
          notes: orderData.notes || null,
          type: prismaOrderType,
          createdAt: getCurrentLocalDateTime(), // Explicitly set local time
          updatedAt: getCurrentLocalDateTime(), // Explicitly set local time
        };

        // Only include tableId if it's provided and not empty (for DINE_IN orders)
        if (orderData.tableId && orderData.tableId.trim() !== '') {
          orderCreateData.tableId = orderData.tableId;

          // Fetch and store table name for denormalization (historical preservation)
          const table = await tx.table.findUnique({
            where: { id: orderData.tableId },
            select: { name: true },
          });
          if (table) {
            orderCreateData.tableName = table.name;
          }
        }

        // Add customer information for takeaway/delivery orders
        // Handle both nested customerDetails and direct fields
        if (prismaOrderType !== 'DINE_IN') {
          if (orderData.customerDetails) {
            // Handle nested customerDetails object
            if (orderData.customerDetails.name) {
              orderCreateData.customerName = orderData.customerDetails.name;
            }
            if (orderData.customerDetails.phone) {
              orderCreateData.customerPhone = orderData.customerDetails.phone;
            }
            if (orderData.customerDetails.address) {
              orderCreateData.deliveryAddress =
                orderData.customerDetails.address;
            }
          } else {
            // Handle direct fields (new approach)
            if (orderData.customerName) {
              orderCreateData.customerName = orderData.customerName;
            }
            if (orderData.customerPhone) {
              orderCreateData.customerPhone = orderData.customerPhone;
            }
            if (orderData.deliveryAddress) {
              orderCreateData.deliveryAddress = orderData.deliveryAddress;
            }
          }
        }

        // Debug log for order create data
        console.log('🔍 DEBUG: Order create data prepared:', {
          ...orderCreateData,
          orderNumber: orderCreateData.orderNumber,
          tableId: orderCreateData.tableId,
          type: orderCreateData.type,
        });

        // Only add items if there are any
        if (hasItems && orderItems.length > 0) {
          orderCreateData.items = {
            createMany: {
              data: orderItems.map(item => ({
                menuItemId: item.menuItemId,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                totalPrice: item.totalPrice,
                subtotal: item.subtotal || item.totalPrice,
                notes: item.notes,
                status: item.status,
                createdAt: getCurrentLocalDateTime(), // Explicitly set local time
                updatedAt: getCurrentLocalDateTime(), // Explicitly set local time
              })),
            },
          };
        }

        // Create the order
        const newOrder = await tx.order.create({
          data: orderCreateData,
          include: {
            items: true,
            table: {
              select: { id: true, name: true },
            },
            user: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        });

        // Update table status if table ID is provided
        if (orderData.tableId) {
          await tx.table.update({
            where: { id: orderData.tableId },
            data: {
              status: 'OCCUPIED',
              currentOrderId: newOrder.id,
            },
          });
        }

        console.log('🔍 DEBUG: Order created successfully in transaction:', {
          id: newOrder.id,
          orderNumber: newOrder.orderNumber,
          tableId: newOrder.tableId,
          type: newOrder.type,
        });

        // CRITICAL FIX: Process inventory within the same transaction
        if (hasItems && orderItems.length > 0) {
          console.log(
            '🔍 ATOMIC: Processing inventory within order transaction'
          );

          // Get all menu items with their related ingredients
          const menuItemsWithIngredients = await Promise.all(
            orderItems.map(async item => {
              const menuItemData = await tx.menuItem.findUnique({
                where: { id: item.menuItemId },
              });

              if (!menuItemData) {
                throw new Error(`Menu item ${item.menuItemId} not found`);
              }

              // Get the ingredients for this menu item
              const ingredients = await (tx as any).menuItemInventory.findMany({
                where: { menuItemId: item.menuItemId },
                include: { inventory: true },
              });

              return {
                menuItem: menuItemData,
                ingredients,
                quantity: item.quantity,
              };
            })
          );

          // Calculate required inventory for each item
          const inventoryUpdates: Map<string, any> = new Map();

          // Process each order item
          for (const { ingredients, quantity } of menuItemsWithIngredients) {
            // Skip if menu item has no inventory items linked
            if (!ingredients || ingredients.length === 0) {
              continue;
            }

            // Process each inventory item linked to this menu item
            for (const inventoryLink of ingredients) {
              const inventoryId = inventoryLink.inventoryId;
              const requiredQuantity = inventoryLink.quantity * quantity;

              // Add to existing quantity or create new entry
              const currentTotal = inventoryUpdates.get(inventoryId) || 0;
              inventoryUpdates.set(
                inventoryId,
                currentTotal + requiredQuantity
              );

              console.log('🔍 ATOMIC: Calculated inventory usage:', {
                inventoryId,
                itemName: inventoryLink.inventory.itemName,
                requiredPerUnit: inventoryLink.quantity,
                orderQuantity: quantity,
                totalRequired: requiredQuantity,
              });
            }
          }

          // Process inventory updates within the same transaction
          for (const [
            inventoryId,
            requiredQuantity,
          ] of Array.from(inventoryUpdates.entries())) {
            // Get current inventory
            const inventoryItem = await tx.inventory.findUnique({
              where: { id: inventoryId },
            });

            if (!inventoryItem) {
              console.warn(
                `Inventory item ${inventoryId} not found during order processing`
              );
              continue;
            }

            // Calculate new stock level
            const currentStock = Number(inventoryItem.currentStock);
            const newStock = currentStock - requiredQuantity;

            // Check if we have enough stock
            if (newStock < 0) {
              throw new Error(
                `Insufficient stock for item: ${inventoryItem.itemName}. Available: ${currentStock}, Required: ${requiredQuantity}`
              );
            }

            // Update inventory atomically
            await tx.inventory.update({
              where: { id: inventoryId },
              data: { currentStock: newStock },
            });

            console.log('🔍 ATOMIC: Updated inventory atomically:', {
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
                  reason: 'Order creation',
                  orderId: newOrder.id,
                  previousStock: currentStock,
                  used: requiredQuantity,
                  newStock: newStock,
                },
              },
            });
          }

          console.log(
            '✅ ATOMIC: Order and inventory operations completed atomically'
          );
        }

        return newOrder;
      }).catch(error => {
        // Log transaction errors in detail
        console.error('❌ ERROR: Order transaction failed:', {
          error: error.message,
          code: error.code,
          meta: error.meta,
          stack: error.stack,
        });
        throw error;
      });

      console.log(
        '✅ ATOMIC FIX: Order and inventory operations completed atomically'
      );
      return this.mapPrismaOrder(order as unknown as PrismaOrderWithRelations);
    })();
  }

  /**
   * Update an existing order
   */
  async update(
    id: string,
    updateData: UpdateOrderRequest
  ): Promise<IPCResponse<OrderDTO>> {
    return this.wrapMethod(async () => {
      // Ensure the order exists
      const existingOrder = (await this.prisma.order.findUnique({
        where: { id },
        include: { items: true },
      })) as unknown as PrismaOrder;

      if (!existingOrder) {
        throw new AppError('Order not found');
      }

      // Prevent updates to completed or canceled orders
      if (['COMPLETED', 'CANCELLED'].includes(existingOrder.status)) {
        throw new AppError(
          `Cannot update a ${existingOrder.status.toLowerCase()} order`
        );
      }

      // Calculate new totals if items are updated
      let subtotal = existingOrder.subtotal;
      let orderItems: OrderItemWithPrice[] | undefined;

      if (updateData.updates.items) {
        // Validate menu items
        const menuItems = await this.prisma.menuItem.findMany({
          where: {
            id: { in: updateData.updates.items.map(item => item.menuItemId) },
          },
        });

        if (
          menuItems.length !==
          Array.from(new Set(updateData.updates.items.map(item => item.menuItemId)))
            .length
        ) {
          throw new AppError('One or more menu items not found');
        }

        // Calculate new subtotal
        subtotal = new Decimal(0);
        orderItems = updateData.updates.items.map(item => {
          const menuItem = menuItems.find(mi => mi.id === item.menuItemId)!;
          const itemSubtotal = menuItem.price.mul(item.quantity);
          subtotal = subtotal.add(itemSubtotal);

          return {
            menuItemId: item.menuItemId,
            name: menuItem.name,
            price: menuItem.price,
            unitPrice: menuItem.price,
            quantity: item.quantity,
            subtotal: itemSubtotal,
            totalPrice: itemSubtotal,
            notes: item.notes || null,
            status: 'PENDING' as PrismaOrderItemStatus,
          };
        });
      }

      // No tax calculation - this restaurant doesn't apply taxes
      const tax = new Decimal(0);

      // Handle delivery fee for delivery orders
      const deliveryFee =
        updateData.updates.deliveryFee !== undefined
          ? new Decimal(updateData.updates.deliveryFee)
          : existingOrder.deliveryFee || new Decimal(0);

      // Calculate total (no tax applied)
      const total = subtotal.add(deliveryFee);

      // Convert application OrderStatus to Prisma OrderStatus if provided
      const prismaOrderStatus = updateData.updates.status
        ? mapAppOrderStatusToPrismaOrderStatus(updateData.updates.status)
        : (existingOrder.status as PrismaOrderStatus);

      // Update the order in a transaction
      const order = await this.executeTransaction(async tx => {
        // If items are updated, delete existing items and create new ones
        if (orderItems) {
          await tx.orderItem.deleteMany({
            where: { orderId: id },
          });

          await tx.orderItem.createMany({
            data: orderItems.map(item => ({
              orderId: id,
              menuItemId: item.menuItemId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.totalPrice,
              subtotal: item.subtotal || item.totalPrice,
              notes: item.notes,
              status: item.status,
              createdAt: getCurrentLocalDateTime(), // Explicitly set local time
              updatedAt: getCurrentLocalDateTime(), // Explicitly set local time
            })),
          });
        }

        // Handle status changes
        const existingCompletedAt = existingOrder.completedAt || null;
        let completedAt = existingCompletedAt;
        if (
          prismaOrderStatus === 'COMPLETED' &&
          existingOrder.status !== 'COMPLETED'
        ) {
          completedAt = getCurrentLocalDateTime() as any;

          // If order is completed and has a table, update table status
          if (existingOrder.tableId) {
            await tx.table.update({
              where: { id: existingOrder.tableId },
              data: {
                status: 'AVAILABLE',
                currentOrderId: null,
              },
            });
          }
        }

        // Update the order
        const updatedOrder = await tx.order.update({
          where: { id },
          data: {
            status: prismaOrderStatus,
            subtotal,
            tax,
            deliveryFee,
            total,
            notes:
              updateData.updates.notes !== undefined
                ? updateData.updates.notes || null
                : existingOrder.notes,
            ...(completedAt !== existingCompletedAt ? { completedAt } : {}),
            updatedAt: getCurrentLocalDateTime(),
          },
          include: {
            items: true,
            table: {
              select: { id: true, name: true },
            },
            user: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        });

        return updatedOrder;
      });

      return this.mapPrismaOrder(order as unknown as PrismaOrderWithRelations);
    })();
  }

  /**
   * Update order status
   */
  async updateStatus(
    statusRequest: UpdateOrderStatusRequest
  ): Promise<IPCResponse<OrderDTO>> {
    // Extract variables to outer scope for error handler access
    const { id, status } = statusRequest;
    let existingOrder: PrismaOrder | null = null;

    return this.wrapMethod(async () => {
      // Ensure the order exists
      existingOrder = (await this.prisma.order.findUnique({
        where: { id },
        include: {
          items: true,
          table: {
            select: { id: true, name: true },
          },
          user: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      })) as unknown as PrismaOrder;

      if (!existingOrder) {
        throw new AppError('Order not found');
      }

      // Prevent updates to canceled orders
      if (existingOrder.status === 'CANCELLED') {
        throw new AppError('Cannot update a canceled order');
      }

      // Convert application OrderStatus to Prisma OrderStatus
      const prismaOrderStatus = mapAppOrderStatusToPrismaOrderStatus(status);

      // Handle status changes in a transaction with enhanced error handling
      const order = await this.executeTransaction(async tx => {
        const existingCompletedAt = existingOrder.completedAt || null;
        let completedAt = existingCompletedAt;

        // Enhanced error handling: Validate transaction state at start
        console.log(
          '🔍 TRANSACTION: Starting order status update transaction',
          {
            orderId: id,
            currentStatus: existingOrder.status,
            targetStatus: status,
            hasItems: existingOrder.items?.length || 0,
          }
        );

        if (
          prismaOrderStatus === 'COMPLETED' &&
          existingOrder.status !== 'COMPLETED'
        ) {
          completedAt = new Date();

          // If order is completed and has a table, update table status
          if (existingOrder.tableId) {
            await tx.table.update({
              where: { id: existingOrder.tableId },
              data: {
                status: 'AVAILABLE',
                currentOrderId: null,
              },
            });
          }
        } else if (
          prismaOrderStatus === 'CANCELLED' &&
          existingOrder.status !== 'CANCELLED'
        ) {
          // CRITICAL FIX: Restore stock for cancelled orders
          console.log(
            '🔄 STOCK RESTORATION: Processing cancelled order stock restoration',
            {
              orderId: id,
              existingStatus: existingOrder.status,
              newStatus: prismaOrderStatus,
            }
          );

          // Get all items in the cancelled order with their ingredients
          const orderItems = await tx.orderItem.findMany({
            where: { orderId: id },
            include: {
              menuItem: {
                include: {
                  inventoryItems: {
                    include: { inventory: true },
                  },
                },
              },
            },
          });

          console.log('🔄 STOCK RESTORATION: Found order items', {
            itemCount: orderItems.length,
            items: orderItems.map(item => ({
              id: item.id,
              menuItemName: item.menuItem?.name,
              quantity: item.quantity,
              ingredientCount: item.menuItem?.inventoryItems?.length || 0,
            })),
          });

          // Restore stock for each item atomically within the same transaction
          // Enhanced error handling: Track restoration progress for rollback info
          const restorationProgress: Array<{
            inventoryId: string;
            itemName: string;
            restoredAmount: number;
          }> = [];

          try {
            for (const orderItem of orderItems) {
              if (
                orderItem.menuItem?.inventoryItems &&
                orderItem.menuItem.inventoryItems.length > 0
              ) {
                for (const ingredientLink of orderItem.menuItem
                  .inventoryItems) {
                  const restoreQuantity =
                    Number(ingredientLink.quantity) * orderItem.quantity;

                  // Enhanced error handling: Validate quantities before processing
                  if (restoreQuantity <= 0) {
                    console.warn(
                      '⚠️ STOCK RESTORATION: Invalid restore quantity',
                      {
                        inventoryId: ingredientLink.inventoryId,
                        linkQuantity: Number(ingredientLink.quantity),
                        orderQuantity: orderItem.quantity,
                        calculated: restoreQuantity,
                      }
                    );
                    continue;
                  }

                  // Get current inventory within transaction to prevent race conditions
                  const currentInventory = await tx.inventory.findUnique({
                    where: { id: ingredientLink.inventoryId },
                  });

                  if (!currentInventory) {
                    const error = new Error(
                      `Inventory item not found: ${ingredientLink.inventoryId}`
                    );
                    console.error(
                      '❌ STOCK RESTORATION: Critical error - inventory not found',
                      {
                        inventoryId: ingredientLink.inventoryId,
                        orderId: id,
                        orderItemId: orderItem.id,
                        menuItemName: orderItem.menuItem?.name,
                      }
                    );
                    throw error; // This will trigger transaction rollback
                  }

                  const newStock =
                    Number(currentInventory.currentStock) + restoreQuantity;

                  // Enhanced error handling: Validate final stock levels
                  if (newStock < 0) {
                    const error = new Error(
                      `Invalid stock calculation during restoration: ${ingredientLink.inventory.itemName}`
                    );
                    console.error(
                      '❌ STOCK RESTORATION: Invalid stock calculation',
                      {
                        inventoryId: ingredientLink.inventoryId,
                        itemName: ingredientLink.inventory.itemName,
                        currentStock: Number(currentInventory.currentStock),
                        restoreAmount: restoreQuantity,
                        calculatedStock: newStock,
                      }
                    );
                    throw error; // This will trigger transaction rollback
                  }

                  // Update inventory atomically with error handling
                  try {
                    await tx.inventory.update({
                      where: { id: ingredientLink.inventoryId },
                      data: { currentStock: newStock },
                    });

                    // Track successful restoration for potential rollback information
                    restorationProgress.push({
                      inventoryId: ingredientLink.inventoryId,
                      itemName: ingredientLink.inventory.itemName,
                      restoredAmount: restoreQuantity,
                    });

                    console.log('✅ STOCK RESTORATION: Restored inventory', {
                      inventoryId: ingredientLink.inventoryId,
                      itemName: ingredientLink.inventory.itemName,
                      previousStock: Number(currentInventory.currentStock),
                      restored: restoreQuantity,
                      newStock: newStock,
                      unit: ingredientLink.inventory.unit,
                    });

                    // Enhanced audit logging for stock restoration
                    await tx.auditLog.create({
                      data: {
                        action: 'INVENTORY_RESTORE_CANCELLED_ORDER',
                        tableName: 'inventory',
                        recordId: ingredientLink.inventoryId,
                        newValues: {
                          reason:
                            'Order cancelled - automatic stock restoration',
                          orderId: id,
                          orderItemId: orderItem.id,
                          menuItemId: orderItem.menuItemId,
                          menuItemName: orderItem.menuItem?.name,
                          previousStock: Number(currentInventory.currentStock),
                          restoredQuantity: restoreQuantity,
                          newStock: newStock,
                          unit: ingredientLink.inventory.unit,
                          timestamp: getCurrentLocalDateTime(),
                        },
                      },
                    });
                  } catch (updateError) {
                    console.error(
                      '❌ STOCK RESTORATION: Failed to update inventory',
                      {
                        inventoryId: ingredientLink.inventoryId,
                        itemName: ingredientLink.inventory.itemName,
                        error:
                          updateError instanceof Error
                            ? updateError.message
                            : 'Unknown error',
                        restorationProgress: restorationProgress.length,
                      }
                    );
                    throw updateError; // This will trigger transaction rollback
                  }
                }
              }
            }
          } catch (restorationError) {
            // Enhanced error handling: Log restoration failure with progress info
            console.error(
              '❌ STOCK RESTORATION: Transaction failed, automatic rollback initiated',
              {
                orderId: id,
                error:
                  restorationError instanceof Error
                    ? restorationError.message
                    : 'Unknown error',
                completedRestorations: restorationProgress.length,
                progressDetails: restorationProgress,
              }
            );

            // Log the failure for audit
            await tx.auditLog.create({
              data: {
                action: 'INVENTORY_RESTORE_FAILED',
                tableName: 'orders',
                recordId: id,
                newValues: {
                  reason: 'Stock restoration failed during order cancellation',
                  error:
                    restorationError instanceof Error
                      ? restorationError.message
                      : 'Unknown error',
                  completedRestorations: restorationProgress.length,
                  failureTimestamp: getCurrentLocalDateTime(),
                },
              },
            });

            // Re-throw to trigger transaction rollback
            throw restorationError;
          }

          console.log('✅ STOCK RESTORATION: Completed for order', {
            orderId: id,
          });

          // If order has a table, update table status
          if (existingOrder.tableId) {
            await tx.table.update({
              where: { id: existingOrder.tableId },
              data: {
                status: 'AVAILABLE',
                currentOrderId: null,
              },
            });

            console.log('✅ TABLE STATUS: Updated to AVAILABLE', {
              tableId: existingOrder.tableId,
            });
          }
        }

        // Enhanced error handling: Log transaction completion status
        console.log('🔍 TRANSACTION: Updating order status', {
          orderId: id,
          statusChange: `${existingOrder.status} → ${prismaOrderStatus}`,
          hasCompletedAt: !!completedAt,
        });

        // Update the order with enhanced error handling
        try {
          const updatedOrder = await tx.order.update({
            where: { id },
            data: {
              status: prismaOrderStatus,
              ...(completedAt !== existingCompletedAt ? { completedAt } : {}),
              updatedAt: getCurrentLocalDateTime(),
            },
            include: {
              items: true,
              table: {
                select: { id: true, name: true },
              },
              user: {
                select: { id: true, firstName: true, lastName: true },
              },
            },
          });

          // Enhanced audit logging for order status changes
          await tx.auditLog.create({
            data: {
              action: 'ORDER_STATUS_UPDATED',
              tableName: 'orders',
              recordId: id,
              newValues: {
                previousStatus: existingOrder.status,
                newStatus: prismaOrderStatus,
                completedAt: completedAt?.toISOString(),
                tableId: existingOrder.tableId,
                itemCount: existingOrder.items?.length || 0,
                timestamp: getCurrentLocalDateTime(),
                ...(prismaOrderStatus === 'CANCELLED' && {
                  stockRestorationCompleted: true,
                  restoredItemsCount: (existingOrder.items || []).filter(
                    item => item.menuItem?.inventoryItems?.length
                  ).length,
                }),
              },
            },
          });

          console.log('✅ TRANSACTION: Order status updated successfully', {
            orderId: id,
            newStatus: prismaOrderStatus,
            tableUpdated: !!existingOrder.tableId,
          });

          return updatedOrder;
        } catch (updateError) {
          console.error('❌ TRANSACTION: Failed to update order status', {
            orderId: id,
            targetStatus: prismaOrderStatus,
            error:
              updateError instanceof Error
                ? updateError.message
                : 'Unknown error',
          });

          // Log the failure
          await tx.auditLog.create({
            data: {
              action: 'ORDER_STATUS_UPDATE_FAILED',
              tableName: 'orders',
              recordId: id,
              newValues: {
                targetStatus: prismaOrderStatus,
                currentStatus: existingOrder.status,
                error:
                  updateError instanceof Error
                    ? updateError.message
                    : 'Unknown error',
                timestamp: getCurrentLocalDateTime(),
              },
            },
          });

          throw updateError;
        }
      });

      console.log(
        '🎉 ORDER STATUS UPDATE: Transaction completed successfully',
        {
          orderId: id,
          finalStatus: order.status,
        }
      );

      return this.mapPrismaOrder(order as unknown as PrismaOrderWithRelations);
    })().catch(error => {
      // Enhanced error handling: Comprehensive error logging and rethrowing
      console.error('❌ ORDER STATUS UPDATE: Service method failed', {
        orderId: id,
        targetStatus: status,
        currentStatus: existingOrder?.status,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorStack: error instanceof Error ? error.stack : undefined,
      });

      // Convert to AppError for consistent error handling
      if (!(error instanceof AppError)) {
        throw new AppError(
          `Failed to update order status: ${error instanceof Error ? error.message : 'Unknown error'}`,
          false
        );
      }

      throw error;
    });
  }

  /**
   * Delete an order (soft delete by canceling)
   */
  async delete(id: string): Promise<IPCResponse<boolean>> {
    return this.wrapMethod(async () => {
      // Update order status to CANCELLED
      await this.updateStatus({
        id,
        status: OrderStatus.CANCELLED,
      });
      return true;
    })();
  }

  /**
   * Get orders by status
   */
  async findByStatus(status: OrderStatus): Promise<IPCResponse<OrderDTO[]>> {
    return this.wrapMethod(async () => {
      const prismaOrderStatus = mapAppOrderStatusToPrismaOrderStatus(status);

      // Use a try-catch to handle potential missing completedAt column
      let orders;
      try {
        orders = await this.prisma.order.findMany({
          where: {
            status: prismaOrderStatus,
          },
          orderBy: { createdAt: 'desc' },
          include: {
            items: {
              include: {
                menuItem: true,
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
            table: {
              select: { id: true, name: true },
            },
            user: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        });
      } catch (error) {
        // Check if the error is about the missing completedAt column
        if (error.message && error.message.includes('completedAt')) {
          console.warn(
            '[OrderService] Working around missing completedAt column:',
            error.message
          );

          // Try to add the missing column automatically
          try {
            console.log(
              '[OrderService] Attempting to add completedAt column...'
            );

            // Check if column exists first (SQLite-compatible way)
            const tableInfo = await this.prisma.$queryRawUnsafe<Array<{name: string}>>(
              'PRAGMA table_info(orders)'
            );

            const hasCompletedAt = tableInfo.some((col: any) => col.name === 'completedAt');

            if (!hasCompletedAt) {
              await this.prisma.$executeRawUnsafe(
                'ALTER TABLE orders ADD COLUMN completedAt TEXT'
              );
              console.log('[OrderService] ✅ Added completedAt column to orders table');
            } else {
              console.log('[OrderService] ℹ️ completedAt column already exists');
            }

            // Retry the original query now that the column exists
            orders = await this.prisma.order.findMany({
              where: {
                status: prismaOrderStatus,
              },
              orderBy: { createdAt: 'desc' },
              include: {
                items: {
                  include: {
                    menuItem: true,
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
                table: {
                  select: { id: true, name: true },
                },
                user: {
                  select: { id: true, firstName: true, lastName: true },
                },
              },
            });

            console.log(
              '[OrderService] ✅ Successfully fetched orders after adding column'
            );
            return orders.map(order =>
              this.mapPrismaOrder(order as unknown as PrismaOrderWithRelations)
            );
          } catch (migrationError) {
            console.warn(
              '[OrderService] Could not add column automatically:',
              migrationError.message
            );
            // Continue with the fallback query below
          }

          // Get orders without the completedAt column using raw SQL
          orders = await this.prisma.$queryRaw`
            SELECT o.*, 
                   u."firstName" as "userFirstName", 
                   u."lastName" as "userLastName",
                   t.name as "tableName"
            FROM orders o
            LEFT JOIN users u ON o."userId" = u.id
            LEFT JOIN tables t ON o."tableId" = t.id
            WHERE o.status = ${prismaOrderStatus}
            ORDER BY o."createdAt" DESC
          `;

          // For each order, fetch the related items separately
          for (const order of orders) {
            const items = await this.prisma.orderItem.findMany({
              where: { orderId: order.id },
              include: {
                menuItem: true,
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
            });
            order.items = items;

            // Structure the user data to match Prisma's normal format
            order.user = {
              id: order.userId,
              firstName: order.userFirstName,
              lastName: order.userLastName,
            };

            // Structure the table data
            if (order.tableId) {
              order.table = {
                id: order.tableId,
                name: order.tableName || `Table ${order.tableId}`,
              };
            }

            // Clean up extra fields
            delete order.userFirstName;
            delete order.userLastName;
            delete order.tableName;
          }
        } else {
          // If it's a different error, rethrow it
          throw error;
        }
      }

      return orders.map(order =>
        this.mapPrismaOrder(order as unknown as PrismaOrderWithRelations)
      );
    })();
  }

  /**
   * Get orders by table
   */
  async findByTable(tableId: string): Promise<IPCResponse<OrderDTO[]>> {
    return this.wrapMethod(async () => {
      const orders = await this.prisma.order.findMany({
        where: { tableId },
        orderBy: { createdAt: 'desc' },
        include: {
          items: {
            include: {
              menuItem: true,
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
          table: {
            select: { id: true, name: true },
          },
          user: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      });

      return orders.map(order =>
        this.mapPrismaOrder(order as unknown as PrismaOrderWithRelations)
      );
    })();
  }

  /**
   * Get orders by type (DINE_IN, TAKEOUT, DELIVERY)
   */
  async findByType(
    orderType: OrderType | string
  ): Promise<IPCResponse<OrderDTO[]>> {
    return this.wrapMethod(async () => {
      const prismaOrderType = mapAppOrderTypeToPrismaOrderType(
        orderType as OrderType
      );

      console.log('🔍 DEBUG: findByType called with:', {
        orderType,
        prismaOrderType,
      });

      const orders = await this.prisma.order.findMany({
        where: { type: prismaOrderType },
        orderBy: { createdAt: 'desc' },
        include: {
          items: {
            include: {
              menuItem: true,
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
          table: {
            select: { id: true, name: true },
          },
          user: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      });

      console.log('🔍 DEBUG: findByType query result:', {
        orderType,
        prismaOrderType,
        foundOrders: orders.length,
        // Use optional chaining to handle possible undefined properties
        orderDetails: orders.map(o => ({
          id: o.id,
          orderNumber: o.orderNumber,
          type: o.type,
          customerName: (o as any).customerName,
          customerPhone: (o as any).customerPhone,
          deliveryAddress: (o as any).deliveryAddress,
        })),
      });

      return orders.map(order =>
        this.mapPrismaOrder(order as unknown as PrismaOrderWithRelations)
      );
    })();
  }

  /**
   * Get orders by user
   */
  async findByUser(userId: string): Promise<IPCResponse<OrderDTO[]>> {
    return this.wrapMethod(async () => {
      const orders = await this.prisma.order.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        include: {
          items: {
            include: {
              menuItem: true,
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
          table: {
            select: { id: true, name: true },
          },
          user: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      });

      return orders.map(order =>
        this.mapPrismaOrder(order as unknown as PrismaOrderWithRelations)
      );
    })();
  }

  /**
   * Search orders
   */
  async search(params: OrderSearchParams): Promise<IPCResponse<OrderDTO[]>> {
    return this.wrapMethod(async () => {
      const where: any = {};

      if (params.status) {
        where.status = mapAppOrderStatusToPrismaOrderStatus(params.status);
      }

      if (params.tableId) {
        where.tableId = params.tableId;
      }

      if (params.userId) {
        where.userId = params.userId;
      }

      if (params.startDate && params.endDate) {
        where.createdAt = {
          gte: new Date(params.startDate),
          lte: new Date(params.endDate),
        };
      }

      if (params.minTotal) {
        where.total = {
          ...where.total,
          gte: new Decimal(params.minTotal),
        };
      }

      if (params.maxTotal) {
        where.total = {
          ...where.total,
          lte: new Decimal(params.maxTotal),
        };
      }

      if (params.paymentMethod) {
        where.paymentMethod = mapAppPaymentMethodToPrismaPaymentMethod(
          params.paymentMethod
        );
      }

      const orders = await this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: params.limit || 100,
        skip: params.offset || 0,
        include: {
          items: {
            include: {
              menuItem: true,
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
          table: {
            select: { id: true, name: true },
          },
          user: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      });

      return orders.map(order =>
        this.mapPrismaOrder(order as unknown as PrismaOrderWithRelations)
      );
    })();
  }

  /**
   * Get order statistics
   */
  async getStats(dateRange?: {
    startDate: string;
    endDate: string;
  }): Promise<IPCResponse<OrderStatsDTO>> {
    return this.wrapMethod(async () => {
      const where: any = {};

      if (dateRange?.startDate && dateRange?.endDate) {
        where.createdAt = {
          gte: new Date(dateRange.startDate),
          lte: new Date(dateRange.endDate),
        };
      }

      // Get order counts by status using raw SQL (SQLite compatible)
      let statusCountsQuery = 'SELECT status, COUNT(id) as count FROM orders';
      const queryParams: any[] = [];

      if (dateRange?.startDate && dateRange?.endDate) {
        statusCountsQuery += ' WHERE createdAt >= ? AND createdAt <= ?';
        queryParams.push(new Date(dateRange.startDate).toISOString());
        queryParams.push(new Date(dateRange.endDate).toISOString());
      }
      statusCountsQuery += ' GROUP BY status';

      const statusCounts = await this.prisma.$queryRawUnsafe<Array<{ status: string; count: bigint }>>(
        statusCountsQuery,
        ...queryParams
      );

      // Get total sales using raw SQL (SQLite compatible)
      let salesQuery = `
        SELECT
          SUM(subtotal) as subtotal,
          SUM(tax) as tax,
          SUM(total) as total,
          AVG(total) as avgTotal,
          COUNT(id) as count
        FROM orders
        WHERE status IN ('COMPLETED', 'SERVED')
      `;
      const salesParams: any[] = [];

      if (dateRange?.startDate && dateRange?.endDate) {
        salesQuery += ' AND createdAt >= ? AND createdAt <= ?';
        salesParams.push(new Date(dateRange.startDate).toISOString());
        salesParams.push(new Date(dateRange.endDate).toISOString());
      }

      const salesResults = await this.prisma.$queryRawUnsafe<Array<{
        subtotal: number | null;
        tax: number | null;
        total: number | null;
        avgTotal: number | null;
        count: bigint;
      }>>(salesQuery, ...salesParams);

      const salesResult = salesResults[0] || {
        subtotal: null,
        tax: null,
        total: null,
        avgTotal: null,
        count: BigInt(0),
      };

      console.log('🔍 OrderService.getStats - Raw Query Results:', {
        dateRange: { startDate: dateRange?.startDate, endDate: dateRange?.endDate },
        salesQuery,
        salesParams,
        salesResult,
        salesResultsCount: salesResults.length,
        statusCounts: statusCounts.length
      });

      // Get top selling items - filter by COMPLETED/SERVED for consistency with sales
      // First, get all COMPLETED/SERVED orders in the date range
      const completedOrders = await this.prisma.order.findMany({
        where: {
          status: {
            in: ['COMPLETED', 'SERVED'],
          },
          ...(dateRange?.startDate && dateRange?.endDate ? {
            createdAt: {
              gte: new Date(dateRange.startDate).toISOString(),
              lte: new Date(dateRange.endDate).toISOString(),
            },
          } : {}),
        },
        select: {
          id: true,
        },
      });

      const completedOrderIds = completedOrders.map((o: any) => o.id);

      console.log('🔍 OrderService.getStats - Completed Orders Filter:', {
        completedOrdersCount: completedOrderIds.length,
        completedOrderIds,
      });

      // Now get top items ONLY from those completed orders
      const topItems = completedOrderIds.length > 0 
        ? await this.prisma.orderItem.findMany({
            where: {
              orderId: {
                in: completedOrderIds,
              },
            },
            orderBy: {
              quantity: 'desc',
            },
            take: 5,
            include: {
              menuItem: true,
            },
          })
        : [];

      // Manually fetch categories for menu items since SQLite wrapper doesn't support nested includes
      const menuItemIds = topItems.map(item => item.menuItemId).filter(Boolean);
      let categoryMap = new Map<string, string>();
      
      if (menuItemIds.length > 0) {
        // Get menu items with their categoryIds
        const menuItems = await this.prisma.menuItem.findMany({
          where: {
            id: { in: menuItemIds }
          }
        });
        
        // Get unique category IDs
        const categoryIds = [...new Set(menuItems.map((mi: any) => mi.categoryId).filter(Boolean))];
        
        if (categoryIds.length > 0) {
          // Fetch all categories at once
          const categories = await this.prisma.category.findMany({
            where: {
              id: { in: categoryIds }
            }
          });
          
          // Create menu item to category name map
          const categoryIdToName = new Map(categories.map((c: any) => [c.id, c.name]));
          menuItems.forEach((mi: any) => {
            if (mi.categoryId && categoryIdToName.has(mi.categoryId)) {
              categoryMap.set(mi.id, categoryIdToName.get(mi.categoryId)!);
            }
          });
        }
      }

      console.log('🔍 OrderService.getStats - Top Items Query Results:', {
        topItemsCount: topItems.length,
        categoryMapSize: categoryMap.size,
        topItems: topItems.map(item => ({
          id: item.id,
          menuItemId: item.menuItemId,
          quantity: item.quantity,
          totalPrice: item.totalPrice,
          menuItemName: item.menuItem?.name,
          categoryFromMap: categoryMap.get(item.menuItemId),
          rawMenuItem: item.menuItem
        }))
      });

      // Format the statistics (raw SQL returns direct properties, not nested _sum/_count/_avg)
      const sum = {
        subtotal: salesResult.subtotal || 0,
        tax: salesResult.tax || 0,
        total: salesResult.total || 0,
      };
      const count = Number(salesResult.count) || 0;
      const avg = salesResult.avgTotal || 0;

      // Handle the aggregate result safely with proper type checking
      const totalValue =
        sum && typeof sum === 'object' && 'total' in sum
          ? sum.total
          : new Decimal(0);
      const subtotalValue =
        sum && typeof sum === 'object' && 'subtotal' in sum
          ? sum.subtotal
          : new Decimal(0);
      const taxValue =
        sum && typeof sum === 'object' && 'tax' in sum
          ? sum.tax
          : new Decimal(0);

      // Calculate total orders from ONLY completed and served statuses
      const completedOrdersCount = statusCounts
        .filter((s: any) => s.status === 'COMPLETED' || s.status === 'SERVED')
        .reduce((sum: number, s: any) => sum + Number(s.count || 0), 0);

      return {
        totalOrders: completedOrdersCount, // Only count completed/served orders for dashboard
        statusCounts: statusCounts.reduce(
          (obj: Record<string, number>, s: any) => {
            // Map Prisma status to application status for the keys
            const appStatus = mapPrismaOrderStatusToAppOrderStatus(
              s.status as PrismaOrderStatus
            ).toLowerCase();
            obj[appStatus] = Number(s.count || 0);
            return obj;
          },
          {} as Record<string, number>
        ),
        sales: {
          total: decimalToNumber(totalValue as Decimal),
          subtotal: decimalToNumber(subtotalValue as Decimal),
          tax: decimalToNumber(taxValue as Decimal),
          count: count,
          average: decimalToNumber(avg),
        },
        topItems: topItems.map(item => ({
          menuItemId: item.menuItemId,
          name: item.menuItem?.name || 'Unknown Item',
          category: categoryMap.get(item.menuItemId) || 'Uncategorized',
          quantity: item.quantity,
          sales: decimalToNumber(item.totalPrice),
        })),
      };
    })();
  }
}
