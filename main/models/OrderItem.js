import { OrderItemStatus } from '../prisma';
import { AppError } from '../error-handler';
import { decimalToNumber, multiplyDecimals, validateCurrencyAmount, } from '../utils/decimal';
import { Decimal as DecimalJS } from 'decimal.js';
import { logger } from '../utils/logger';
import { getCurrentLocalDateTime } from '../utils/dateTime';
/**
 * Helper to convert Date or string to ISO string
 * Handles both Prisma Date objects and SQLite TEXT dates
 */
function toISOString(value) {
    if (!value)
        return null;
    if (typeof value === 'string')
        return value;
    return value.toISOString();
}
export class OrderItemModel {
    constructor(prisma) {
        this.prisma = prisma;
    }
    /**
     * Convert Prisma OrderItem to type-safe OrderItem interface
     */
    mapPrismaOrderItem(item) {
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
    async findById(id) {
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
                timestamp: getCurrentLocalDateTime(),
            };
        }
        catch (error) {
            logger.error(`Failed to get order item by ID ${id}: ${error instanceof Error ? error.message : error}`, 'OrderItemModel');
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to get order item',
                timestamp: getCurrentLocalDateTime(),
            };
        }
    }
    async findByOrderId(orderId) {
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
                timestamp: getCurrentLocalDateTime(),
            };
        }
        catch (error) {
            logger.error(`Failed to get order items for order ${orderId}: ${error instanceof Error ? error.message : error}`, 'OrderItemModel');
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to get order items',
                timestamp: getCurrentLocalDateTime(),
            };
        }
    }
    async create(itemData) {
        try {
            // Validate monetary amounts
            if (!validateCurrencyAmount(itemData.unitPrice)) {
                throw new AppError('Invalid unit price', true);
            }
            if (itemData.quantity <= 0) {
                throw new AppError('Quantity must be greater than 0', true);
            }
            const totalPrice = multiplyDecimals(itemData.unitPrice, new DecimalJS(itemData.quantity));
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
            logger.info('Order item created successfully', `orderItemId: ${orderItem.id}, orderId: ${itemData.orderId}`);
            return {
                success: true,
                data: this.mapPrismaOrderItem(orderItem),
                timestamp: getCurrentLocalDateTime(),
            };
        }
        catch (error) {
            if (error instanceof AppError) {
                throw error;
            }
            logger.error(`Failed to create order item: ${error instanceof Error ? error.message : error}`, 'OrderItemModel');
            return {
                success: false,
                error: error instanceof Error
                    ? error.message
                    : 'Failed to create order item',
                timestamp: getCurrentLocalDateTime(),
            };
        }
    }
    async update(id, updateData) {
        try {
            // Validate monetary amounts if provided
            if (updateData.unitPrice &&
                !validateCurrencyAmount(updateData.unitPrice)) {
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
                totalPrice = multiplyDecimals(newUnitPrice, new DecimalJS(newQuantity));
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
                timestamp: getCurrentLocalDateTime(),
            };
        }
        catch (error) {
            if (error instanceof AppError) {
                throw error;
            }
            logger.error(`Failed to update order item ${id}: ${error instanceof Error ? error.message : error}`, 'OrderItemModel');
            return {
                success: false,
                error: error instanceof Error
                    ? error.message
                    : 'Failed to update order item',
                timestamp: getCurrentLocalDateTime(),
            };
        }
    }
    async updateStatus(id, status) {
        try {
            const orderItem = await this.prisma.orderItem.update({
                where: { id },
                data: { status },
                include: {
                    menuItem: true,
                },
            });
            logger.info('Order item status updated', `orderItemId: ${id}, newStatus: ${status}`);
            return {
                success: true,
                data: this.mapPrismaOrderItem(orderItem),
                timestamp: getCurrentLocalDateTime(),
            };
        }
        catch (error) {
            logger.error(`Failed to update order item status for ${id} to ${status}: ${error instanceof Error ? error.message : error}`, 'OrderItemModel');
            return {
                success: false,
                error: error instanceof Error
                    ? error.message
                    : 'Failed to update order item status',
                timestamp: getCurrentLocalDateTime(),
            };
        }
    }
    async delete(id) {
        try {
            await this.prisma.orderItem.delete({
                where: { id },
            });
            logger.info('Order item deleted successfully', `orderItemId: ${id}`);
            return {
                success: true,
                data: true,
                timestamp: getCurrentLocalDateTime(),
            };
        }
        catch (error) {
            logger.error(`Failed to delete order item ${id}: ${error instanceof Error ? error.message : error}`, 'OrderItemModel');
            return {
                success: false,
                error: error instanceof Error
                    ? error.message
                    : 'Failed to delete order item',
                timestamp: getCurrentLocalDateTime(),
            };
        }
    }
    async findByStatus(status) {
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
                timestamp: getCurrentLocalDateTime(),
            };
        }
        catch (error) {
            logger.error(`Failed to get order items by status ${status}: ${error instanceof Error ? error.message : error}`, 'OrderItemModel');
            return {
                success: false,
                error: error instanceof Error
                    ? error.message
                    : 'Failed to get order items by status',
                timestamp: getCurrentLocalDateTime(),
            };
        }
    }
    async getKitchenQueue() {
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
                timestamp: getCurrentLocalDateTime(),
            };
        }
        catch (error) {
            logger.error(`Failed to get kitchen queue: ${error instanceof Error ? error.message : error}`, 'OrderItemModel');
            return {
                success: false,
                error: error instanceof Error
                    ? error.message
                    : 'Failed to get kitchen queue',
                timestamp: getCurrentLocalDateTime(),
            };
        }
    }
}
