/**
 * Table Service for mr5-POS Electron Application
 * Handles table management operations
 */
import { TableStatus, } from '../../shared/ipc-types';
import { AppError } from '../error-handler';
import { getCurrentLocalDateTime } from '../utils/dateTime';
import { BaseService } from './baseService';
export class TableService extends BaseService {
    /**
     * Map Prisma Table to TableDTO interface
     */
    mapPrismaTable(table) {
        return {
            id: table.id,
            name: table.name,
            status: table.status,
            createdAt: table.createdAt,
            updatedAt: table.updatedAt,
        };
    }
    /**
     * Get all tables
     */
    async findAll() {
        return this.wrapMethod(async () => {
            const tables = await this.prisma.table.findMany({
                orderBy: { name: 'asc' },
            });
            return tables.map((table) => this.mapPrismaTable(table));
        })();
    }
    /**
     * Get table by ID
     */
    async findById(id) {
        return this.wrapMethod(async () => {
            const table = await this.validateEntityExists(this.prisma.table, id, 'Table not found');
            return this.mapPrismaTable(table);
        })();
    }
    /**
     * Create a new table
     */
    async create(tableData) {
        return this.wrapMethod(async () => {
            // Check if table with same name already exists
            const existingTable = await this.prisma.table.findFirst({
                where: { name: tableData.name },
            });
            if (existingTable) {
                throw new AppError('A table with this name already exists');
            }
            // Create the table
            const table = await this.prisma.table.create({
                data: {
                    name: tableData.name,
                    status: tableData.status || 'AVAILABLE',
                },
            });
            return this.mapPrismaTable(table);
        })();
    }
    /**
     * Update an existing table
     */
    async update(id, updateData) {
        return this.wrapMethod(async () => {
            // Ensure the table exists
            await this.validateEntityExists(this.prisma.table, id, 'Table not found');
            // If name is being updated, check for duplicates
            if (updateData.updates.name !== undefined) {
                const existingTable = await this.prisma.table.findFirst({
                    where: {
                        name: updateData.updates.name,
                        id: { not: id },
                    },
                });
                if (existingTable) {
                    throw new AppError('A table with this name already exists');
                }
            }
            // Update the table
            const table = await this.prisma.table.update({
                where: { id },
                data: {
                    ...(updateData.updates.name !== undefined && {
                        name: updateData.updates.name,
                    }),
                    ...(updateData.updates.status && {
                        status: updateData.updates.status,
                    }),
                    updatedAt: getCurrentLocalDateTime(),
                },
            });
            return this.mapPrismaTable(table);
        })();
    }
    /**
     * Update table status
     */
    async updateStatus(statusRequest) {
        return this.wrapMethod(async () => {
            const { id, status } = statusRequest;
            // Ensure the table exists
            await this.validateEntityExists(this.prisma.table, id, 'Table not found');
            // Update status
            const table = await this.prisma.table.update({
                where: { id },
                data: { status },
            });
            return this.mapPrismaTable(table);
        })();
    }
    /**
     * Delete a table (preserves completed/cancelled orders, deletes active orders only)
     */
    async delete(id) {
        return this.wrapMethod(async () => {
            // Ensure the table exists
            await this.validateEntityExists(this.prisma.table, id, 'Table not found');
            // Use transaction to ensure data consistency
            await this.prisma.$transaction(async (tx) => {
                // PRESERVE COMPLETED/CANCELLED ORDERS: Set tableId = NULL (tableName stays intact)
                const preservedOrders = await tx.order.updateMany({
                    where: {
                        tableId: id,
                        status: { in: ['COMPLETED', 'CANCELLED'] },
                    },
                    data: { tableId: null }, // tableName is already stored, so it's preserved
                });
                // DELETE ACTIVE ORDERS: Get active order IDs first
                const activeOrders = await tx.order.findMany({
                    where: {
                        tableId: id,
                        status: { notIn: ['COMPLETED', 'CANCELLED'] },
                    },
                    select: { id: true },
                });
                // Delete order items for active orders
                if (activeOrders.length > 0) {
                    await tx.orderItem.deleteMany({
                        where: { orderId: { in: activeOrders.map(o => o.id) } },
                    });
                }
                // Delete active orders
                const deletedOrders = await tx.order.deleteMany({
                    where: {
                        tableId: id,
                        status: { notIn: ['COMPLETED', 'CANCELLED'] },
                    },
                });
                // Finally, delete the table itself
                await tx.table.delete({
                    where: { id },
                });
                // Log the operations for audit purposes
                console.log(`Table ${id} deleted: Preserved ${preservedOrders.count} completed/cancelled orders, deleted ${deletedOrders.count} active orders`);
            });
            return true;
        })();
    }
    /**
     * Get tables by status
     */
    async findByStatus(status) {
        return this.wrapMethod(async () => {
            const tables = await this.prisma.table.findMany({
                where: {
                    status,
                },
                orderBy: { name: 'asc' },
            });
            return tables.map((table) => this.mapPrismaTable(table));
        })();
    }
    /**
     * Get available tables
     */
    async findAvailable() {
        return this.findByStatus(TableStatus.AVAILABLE);
    }
    /**
     * Get occupied tables
     */
    async findOccupied() {
        return this.findByStatus(TableStatus.OCCUPIED);
    }
    /**
     * Get table statistics
     */
    async getStats() {
        return this.wrapMethod(async () => {
            // Get all tables without filtering by isActive since it doesn't exist
            const tables = await this.prisma.table.findMany();
            const stats = {
                total: tables.length,
                available: tables.filter((t) => t.status === TableStatus.AVAILABLE).length,
                occupied: tables.filter((t) => t.status === TableStatus.OCCUPIED).length,
                reserved: tables.filter((t) => t.status === TableStatus.RESERVED).length,
                outOfService: tables.filter((t) => t.status === TableStatus.OUT_OF_ORDER).length,
                totalTables: tables.length,
            };
            return stats;
        })();
    }
}
