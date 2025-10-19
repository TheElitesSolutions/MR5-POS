import { OrderItemStatus, PrismaClient } from '../prisma';
import { AppError } from '../error-handler';
import { IPCResponse, OrderItem } from '../types';
import {
  Decimal,
  decimalToNumber,
  multiplyDecimals,
  validateCurrencyAmount,
} from '../utils/decimal';
import { Decimal as DecimalJS } from 'decimal.js';
import { logger } from '../utils/logger';

/**
 * Helper to convert Date or string to ISO string
 * Handles both Prisma Date objects and SQLite TEXT dates
 */
function toISOString(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  return value.toISOString();
}

export class OrderItemModel {
  constructor(private prisma: PrismaClient) {}

  /**
   * Convert Prisma OrderItem to type-safe OrderItem interface
   */
  private mapPrismaOrderItem(item: any): any {
    return {
      id: item.id,
      orderId: item.orderId,
      menuItemId: item.menuItemId,
      quantity: item.quantity,
      unitPrice: decimalToNumber(item.unitPrice), // Convert Prisma.Decimal to plain number for IPC
      totalPrice: decimalToNumber(item.totalPrice), // Convert Prisma.Decimal to plain number for IPC
      notes: item.notes,
      status: item.status,
      createdAt: toISOString(item.createdAt),
      updatedAt: toISOString(item.updatedAt),
      menuItem: item.menuItem,
    };
  }

  async findById(id: string): Promise<IPCResponse<OrderItem | null>> {
    try {
      const orderItem = await this.prisma.orderItem.findUnique({
        where: { id },
        include: {
          menuItem: true,
          order: true,
        },
      });

      return {
        success: true,
        data: orderItem ? this.mapPrismaOrderItem(orderItem) : null,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error(
        `Failed to get order item by ID ${id}: ${
          error instanceof Error ? error.message : error
        }`,
        'OrderItemModel'
      );
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to get order item',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async findByOrderId(orderId: string): Promise<IPCResponse<OrderItem[]>> {
    try {
      const orderItems = await this.prisma.orderItem.findMany({
        where: { orderId },
        include: {
          menuItem: true,
        },
        orderBy: { createdAt: 'asc' },
      });

      return {
        success: true,
        data: orderItems.map(item => this.mapPrismaOrderItem(item)),
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error(
        `Failed to get order items for order ${orderId}: ${
          error instanceof Error ? error.message : error
        }`,
        'OrderItemModel'
      );
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to get order items',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async create(itemData: {
    orderId: string;
    menuItemId: string;
    quantity: number;
    unitPrice: Decimal;
    notes?: string;
  }): Promise<IPCResponse<OrderItem>> {
    try {
      // Validate monetary amounts
      if (!validateCurrencyAmount(itemData.unitPrice)) {
        throw new AppError('Invalid unit price', true);
      }

      if (itemData.quantity <= 0) {
        throw new AppError('Quantity must be greater than 0', true);
      }

      const totalPrice = multiplyDecimals(
        itemData.unitPrice,
        new DecimalJS(itemData.quantity)
      );

      const orderItem = await this.prisma.orderItem.create({
        data: {
          orderId: itemData.orderId,
          menuItemId: itemData.menuItemId,
          quantity: itemData.quantity,
          unitPrice: itemData.unitPrice,
          totalPrice: totalPrice,
          status: OrderItemStatus.PENDING,
          notes: itemData.notes || null,
        },
        include: {
          menuItem: true,
        },
      });

      logger.info(
        'Order item created successfully',
        `orderItemId: ${orderItem.id}, orderId: ${itemData.orderId}`
      );

      return {
        success: true,
        data: this.mapPrismaOrderItem(orderItem),
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error(
        `Failed to create order item: ${
          error instanceof Error ? error.message : error
        }`,
        'OrderItemModel'
      );
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to create order item',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async update(
    id: string,
    updateData: {
      quantity?: number;
      unitPrice?: Decimal;
      notes?: string;
      status?: OrderItemStatus;
    }
  ): Promise<IPCResponse<OrderItem>> {
    try {
      // Validate monetary amounts if provided
      if (
        updateData.unitPrice &&
        !validateCurrencyAmount(updateData.unitPrice)
      ) {
        throw new AppError('Invalid unit price', true);
      }

      if (updateData.quantity && updateData.quantity <= 0) {
        throw new AppError('Quantity must be greater than 0', true);
      }

      // Get current item to calculate new total price if needed
      const currentItem = await this.prisma.orderItem.findUnique({
        where: { id },
      });

      if (!currentItem) {
        throw new AppError('Order item not found', true);
      }

      let totalPrice = currentItem.totalPrice;

      // Recalculate total price if quantity or unit price changed
      if (updateData.quantity || updateData.unitPrice) {
        const newQuantity = updateData.quantity || currentItem.quantity;
        const newUnitPrice = updateData.unitPrice || currentItem.unitPrice;
        totalPrice = multiplyDecimals(
          newUnitPrice,
          new DecimalJS(newQuantity)
        );
      }

      const orderItem = await this.prisma.orderItem.update({
        where: { id },
        data: {
          ...updateData,
          totalPrice,
        },
        include: {
          menuItem: true,
        },
      });

      logger.info('Order item updated successfully', `orderItemId: ${id}`);

      return {
        success: true,
        data: this.mapPrismaOrderItem(orderItem),
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error(
        `Failed to update order item ${id}: ${
          error instanceof Error ? error.message : error
        }`,
        'OrderItemModel'
      );
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to update order item',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async updateStatus(
    id: string,
    status: OrderItemStatus
  ): Promise<IPCResponse<OrderItem>> {
    try {
      const orderItem = await this.prisma.orderItem.update({
        where: { id },
        data: { status },
        include: {
          menuItem: true,
        },
      });

      logger.info(
        'Order item status updated',
        `orderItemId: ${id}, newStatus: ${status}`
      );

      return {
        success: true,
        data: this.mapPrismaOrderItem(orderItem),
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error(
        `Failed to update order item status for ${id} to ${status}: ${
          error instanceof Error ? error.message : error
        }`,
        'OrderItemModel'
      );
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to update order item status',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async delete(id: string): Promise<IPCResponse<boolean>> {
    try {
      await this.prisma.orderItem.delete({
        where: { id },
      });

      logger.info('Order item deleted successfully', `orderItemId: ${id}`);

      return {
        success: true,
        data: true,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error(
        `Failed to delete order item ${id}: ${
          error instanceof Error ? error.message : error
        }`,
        'OrderItemModel'
      );
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to delete order item',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async findByStatus(
    status: OrderItemStatus
  ): Promise<IPCResponse<OrderItem[]>> {
    try {
      const orderItems = await this.prisma.orderItem.findMany({
        where: { status },
        include: {
          menuItem: true,
          order: {
            include: {
              table: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      });

      return {
        success: true,
        data: orderItems.map(item => this.mapPrismaOrderItem(item)),
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error(
        `Failed to get order items by status ${status}: ${
          error instanceof Error ? error.message : error
        }`,
        'OrderItemModel'
      );
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to get order items by status',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async getKitchenQueue(): Promise<IPCResponse<OrderItem[]>> {
    try {
      const orderItems = await this.prisma.orderItem.findMany({
        where: {
          status: {
            in: [OrderItemStatus.PENDING, OrderItemStatus.PREPARING],
          },
        },
        include: {
          menuItem: true,
          order: {
            include: {
              table: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      });

      return {
        success: true,
        data: orderItems.map(item => this.mapPrismaOrderItem(item)),
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error(
        `Failed to get kitchen queue: ${
          error instanceof Error ? error.message : error
        }`,
        'OrderItemModel'
      );
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to get kitchen queue',
        timestamp: new Date().toISOString(),
      };
    }
  }
}
