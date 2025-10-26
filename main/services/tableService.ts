/**
 * Table Service for mr5-POS Electron Application
 * Handles table management operations
 */

import { TableStatus as PrismaTableStatus } from '../prisma';
import {
  CreateTableRequest,
  TableStatus,
  UpdateTableRequest,
  UpdateTableStatusRequest,
} from '../../shared/ipc-types';
import { AppError } from '../error-handler';
import { IPCResponse } from '../types';
import { getCurrentLocalDateTime } from '../utils/dateTime';
import { BaseService } from './baseService';

// Define our own Table interface that matches what we're returning
interface TableDTO {
  id: string;
  name: string;
  status: TableStatus;
  createdAt: Date;
  updatedAt: Date;
}

// Type alias for database table records
type PrismaTable = any;

export class TableService extends BaseService {
  /**
   * Map Prisma Table to TableDTO interface
   */
  private mapPrismaTable(table: any): TableDTO {
    return {
      id: table.id,
      name: table.name,
      status: table.status as TableStatus,
      createdAt: table.createdAt,
      updatedAt: table.updatedAt,
    };
  }

  /**
   * Get all tables
   */
  async findAll(): Promise<IPCResponse<TableDTO[]>> {
    return this.wrapMethod(async () => {
      const tables = await this.prisma.table.findMany({
        orderBy: { name: 'asc' },
      });

      return tables.map((table: PrismaTable) => this.mapPrismaTable(table));
    })();
  }

  /**
   * Get table by ID
   */
  async findById(id: string): Promise<IPCResponse<TableDTO>> {
    return this.wrapMethod(async () => {
      const table = await this.validateEntityExists(
        this.prisma.table,
        id,
        'Table not found'
      );

      return this.mapPrismaTable(table as PrismaTable);
    })();
  }

  /**
   * Create a new table
   */
  async create(tableData: CreateTableRequest): Promise<IPCResponse<TableDTO>> {
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
  async update(
    id: string,
    updateData: UpdateTableRequest
  ): Promise<IPCResponse<TableDTO>> {
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
  async updateStatus(
    statusRequest: UpdateTableStatusRequest
  ): Promise<IPCResponse<TableDTO>> {
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
  async delete(id: string): Promise<IPCResponse<boolean>> {
    return this.wrapMethod(async () => {
      // Ensure the table exists
      await this.validateEntityExists(this.prisma.table, id, 'Table not found');

      // Use transaction to ensure data consistency
      await this.prisma.$transaction(async tx => {
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
        console.log(
          `Table ${id} deleted: Preserved ${preservedOrders.count} completed/cancelled orders, deleted ${deletedOrders.count} active orders`
        );
      });

      return true;
    })();
  }

  /**
   * Get tables by status
   */
  async findByStatus(status: TableStatus): Promise<IPCResponse<TableDTO[]>> {
    return this.wrapMethod(async () => {
      const tables = await this.prisma.table.findMany({
        where: {
          status,
        },
        orderBy: { name: 'asc' },
      });

      return tables.map((table: PrismaTable) => this.mapPrismaTable(table));
    })();
  }

  /**
   * Get available tables
   */
  async findAvailable(): Promise<IPCResponse<TableDTO[]>> {
    return this.findByStatus(TableStatus.AVAILABLE);
  }

  /**
   * Get occupied tables
   */
  async findOccupied(): Promise<IPCResponse<TableDTO[]>> {
    return this.findByStatus(TableStatus.OCCUPIED);
  }

  /**
   * Get table statistics
   */
  async getStats(): Promise<
    IPCResponse<{
      total: number;
      available: number;
      occupied: number;
      reserved: number;
      outOfService: number;
      totalTables: number;
    }>
  > {
    return this.wrapMethod(async () => {
      // Get all tables without filtering by isActive since it doesn't exist
      const tables = await this.prisma.table.findMany();

      const stats = {
        total: tables.length,
        available: tables.filter(
          (t: PrismaTable) => t.status === TableStatus.AVAILABLE
        ).length,
        occupied: tables.filter(
          (t: PrismaTable) => t.status === TableStatus.OCCUPIED
        ).length,
        reserved: tables.filter(
          (t: PrismaTable) => t.status === TableStatus.RESERVED
        ).length,
        outOfService: tables.filter(
          (t: PrismaTable) => t.status === TableStatus.OUT_OF_ORDER
        ).length,
        totalTables: tables.length,
      };

      return stats;
    })();
  }
}
