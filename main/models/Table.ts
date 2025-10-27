import { ExtendedPrismaClient } from '../prisma';
import {
  IPCResponse,
  Table,
  TableStatus,
  Order,
  OrderItem,
  OrderItemStatus,
} from '../types';
import { logger } from '../utils/logger';
import { getCurrentLocalDateTime } from '../utils/dateTime';

export class TableModel {
  constructor(private prisma: ExtendedPrismaClient) {}

  /**
   * Convert Prisma Table to type-safe Table interface
   */
  private mapPrismaTable(table: any): Table {
    // Validate that the table status is one of the valid enum values
    const validStatus = this.validateTableStatus(table.status);

    // Create activeOrder object if order data exists
    let activeOrder: Order | null = null;
    if (table.orderId) {
      // Create Order object with available data from SQL query
      activeOrder = {
        id: table.orderId,
        orderNumber: table.orderNumber || `ORD-${table.orderId.slice(-8)}`,
        tableId: table.id,
        items: [], // Will be populated with item count for display purposes
        status: table.orderStatus || 'PENDING',
        type: table.orderType || 'DINE_IN',
        total: parseFloat(table.orderTotal || '0'),
        tax: 0, // Will be calculated when needed
        subtotal: parseFloat(table.orderTotal || '0'),
        createdAt: table.orderCreatedAt || getCurrentLocalDateTime(),
        updatedAt:
          table.orderUpdatedAt ||
          table.orderCreatedAt ||
          getCurrentLocalDateTime(),
      } as Order;

      // Create mock items array with correct length for UI display
      // This allows the frontend to show correct item count without full item details
      const itemCount = parseInt(table.itemCount || '0');
      activeOrder.items = Array(itemCount)
        .fill(null)
        .map((_, index) => ({
          id: `placeholder-${index}`,
          orderId: table.orderId,
          menuItemId: '',
          name: 'Loading...',
          price: 0,
          quantity: 1,
          notes: '',
          status: OrderItemStatus.PENDING,
          createdAt: getCurrentLocalDateTime(),
          updatedAt: getCurrentLocalDateTime(),
        }));
    }

    return {
      id: table.id,
      name: table.name,
      status: validStatus,
      isPayLater: Boolean(table.isPayLater),
      // Remove isActive field
      // Only include properties defined in the Table interface
      createdAt: table.createdAt instanceof Date ? table.createdAt : new Date(table.createdAt),
      updatedAt: table.updatedAt instanceof Date ? table.updatedAt : new Date(table.updatedAt),
      activeOrder,
    };
  }

  /**
   * Validate that a status string matches a valid TableStatus enum value
   * @param status The status string to validate
   * @returns A valid TableStatus enum value
   */
  private validateTableStatus(status: string): TableStatus {
    // Check if the status matches any of the enum values
    switch (status) {
      case TableStatus.AVAILABLE:
        return TableStatus.AVAILABLE;
      case TableStatus.OCCUPIED:
        return TableStatus.OCCUPIED;
      case TableStatus.RESERVED:
        return TableStatus.RESERVED;
      case TableStatus.OUT_OF_ORDER:
        return TableStatus.OUT_OF_ORDER;
      default:
        // Default to AVAILABLE if an invalid status is provided
        logger.warn(
          `Invalid table status: ${status}, defaulting to AVAILABLE`,
          'TableModel'
        );
        return TableStatus.AVAILABLE;
    }
  }

  /**
   * Get all tables with their current status
   */
  async getAllTables(): Promise<IPCResponse<Table[]>> {
    try {
      // Optimized query using LEFT JOIN and subquery to avoid multiple scalar subqueries
      // This significantly improves performance by fetching order data in a single JOIN
      // instead of executing 8+ separate subqueries per table
      const tables = await this.prisma.$queryRaw`
        SELECT
          t.*,
          t.updatedAt as lastStatusChange,
          o.id as orderId,
          o.status as orderStatus,
          o.orderNumber,
          o.type as orderType,
          o.total as orderTotal,
          o.createdAt as orderCreatedAt,
          o.updatedAt as orderUpdatedAt,
          COALESCE(oi.itemCount, 0) as itemCount
        FROM tables t
        LEFT JOIN (
          SELECT
            id,
            tableId,
            status,
            orderNumber,
            type,
            total,
            createdAt,
            updatedAt
          FROM orders
          WHERE status IN ('PENDING', 'PREPARING', 'READY')
          ORDER BY createdAt DESC
        ) o ON o.tableId = t.id
          AND o.id = (
            SELECT id
            FROM orders
            WHERE tableId = t.id
            AND status IN ('PENDING', 'PREPARING', 'READY')
            ORDER BY createdAt DESC
            LIMIT 1
          )
        LEFT JOIN (
          SELECT
            orderId,
            COUNT(*) as itemCount
          FROM order_items
          GROUP BY orderId
        ) oi ON oi.orderId = o.id
        ORDER BY t.name ASC
      `;

      // Cast the result to any[] to allow mapping
      const tablesArray = tables as any[];

      return {
        success: true,
        data: tablesArray.map(table => this.mapPrismaTable(table)),
        timestamp: getCurrentLocalDateTime(),
      };
    } catch (error) {
      logger.error(
        `Failed to get all tables: ${
          error instanceof Error ? error.message : error
        }`,
        'TableModel'
      );
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to retrieve tables',
        timestamp: getCurrentLocalDateTime(),
      };
    }
  }

  /**
   * Get table by ID
   */
  async getTableById(id: string): Promise<IPCResponse<Table | null>> {
    try {
      const table = await this.prisma.table.findUnique({
        where: { id },
        include: {
          orders: {
            where: {
              status: {
                in: ['PENDING', 'PREPARING', 'READY'],
              },
            },
            orderBy: {
              createdAt: 'desc',
            },
            take: 1,
          },
        },
      });

      return {
        success: true,
        data: table ? this.mapPrismaTable(table) : null,
        timestamp: getCurrentLocalDateTime(),
      };
    } catch (error) {
      logger.error(
        `Failed to get table by ID ${id}: ${
          error instanceof Error ? error.message : error
        }`,
        'TableModel'
      );
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to retrieve table',
        timestamp: getCurrentLocalDateTime(),
      };
    }
  }

  /**
   * Create new table
   */
  async createTable(tableData: {
    name: string;
    status?: TableStatus;
    isPayLater?: boolean;
  }): Promise<IPCResponse<Table>> {
    try {
      // Check if table name already exists
      const existingTable = await this.prisma.table.findFirst({
        where: { name: tableData.name },
      });

      if (existingTable) {
        return {
          success: false,
          error: `Table name "${tableData.name}" already exists`,
          timestamp: getCurrentLocalDateTime(),
        };
      }

      const table = await this.prisma.table.create({
        data: {
          name: tableData.name,
          status: tableData.status || TableStatus.AVAILABLE,
          isPayLater: tableData.isPayLater ? 1 : 0,
        },
      });

      logger.info(
        'Table created successfully',
        `tableId: ${table.id}, tableName: ${table.name}`
      );

      return {
        success: true,
        data: this.mapPrismaTable(table),
        timestamp: getCurrentLocalDateTime(),
      };
    } catch (error) {
      logger.error(
        `Failed to create table ${tableData.name}: ${
          error instanceof Error ? error.message : error
        }`,
        'TableModel'
      );
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to create table',
        timestamp: getCurrentLocalDateTime(),
      };
    }
  }

  /**
   * Update table status
   */
  async updateTableStatus(
    id: string,
    status: TableStatus
  ): Promise<IPCResponse<Table>> {
    try {
      const table = await this.prisma.table.update({
        where: { id },
        data: {
          status,
          updatedAt: getCurrentLocalDateTime(),
        },
        include: {
          orders: {
            where: {
              status: {
                in: ['PENDING', 'PREPARING', 'READY'],
              },
            },
            orderBy: {
              createdAt: 'desc',
            },
            take: 1,
          },
        },
      });

      logger.info(
        'Table status updated',
        `tableId: ${id}, newStatus: ${status}`
      );

      return {
        success: true,
        data: this.mapPrismaTable(table),
        timestamp: getCurrentLocalDateTime(),
      };
    } catch (error) {
      logger.error(
        `Failed to update table status for ${id} to ${status}: ${
          error instanceof Error ? error.message : error
        }`,
        'TableModel'
      );
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to update table status',
        timestamp: getCurrentLocalDateTime(),
      };
    }
  }

  /**
   * Update table details
   */
  async updateTable(
    id: string,
    updateData: {
      name?: string;
      status?: TableStatus;
      isPayLater?: boolean;
      // Remove isActive field
    }
  ): Promise<IPCResponse<Table>> {
    try {
      // If updating name, check if it already exists (excluding current table)
      if (updateData.name) {
        const existingTable = await this.prisma.table.findFirst({
          where: {
            name: updateData.name,
            id: { not: id },
          },
        });

        if (existingTable) {
          return {
            success: false,
            error: `Table name "${updateData.name}" already exists`,
            timestamp: getCurrentLocalDateTime(),
          };
        }
      }

      // Convert boolean to integer for SQLite
      const dataToUpdate: any = { ...updateData };
      if (dataToUpdate.isPayLater !== undefined) {
        dataToUpdate.isPayLater = dataToUpdate.isPayLater ? 1 : 0;
      }

      const table = await this.prisma.table.update({
        where: { id },
        data: dataToUpdate,
        include: {
          orders: {
            where: {
              status: {
                in: ['PENDING', 'PREPARING', 'READY'],
              },
            },
            orderBy: {
              createdAt: 'desc',
            },
            take: 1,
          },
        },
      });

      return {
        success: true,
        data: this.mapPrismaTable(table),
        timestamp: getCurrentLocalDateTime(),
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to update table',
        timestamp: getCurrentLocalDateTime(),
      };
    }
  }

  /**
   * Delete table (preserves completed/cancelled orders, deletes active orders only)
   */
  async deleteTable(id: string): Promise<IPCResponse<boolean>> {
    try {
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

        // Log the operations
        logger.info(
          `Table ${id} deleted: Preserved ${preservedOrders.count} completed/cancelled orders, deleted ${deletedOrders.count} active orders`,
          'TableModel'
        );
      });

      return {
        success: true,
        data: true,
        timestamp: getCurrentLocalDateTime(),
      };
    } catch (error) {
      logger.error(
        `Failed to delete table ${id}: ${
          error instanceof Error ? error.message : error
        }`,
        'TableModel'
      );
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to delete table',
        timestamp: getCurrentLocalDateTime(),
      };
    }
  }

  /**
   * Get available tables
   */
  async getAvailableTables(): Promise<IPCResponse<Table[]>> {
    try {
      const tables = await this.prisma.table.findMany({
        where: {
          status: 'AVAILABLE',
        },
        orderBy: {
          name: 'asc',
        },
      });

      return {
        success: true,
        data: tables.map(table => this.mapPrismaTable(table)),
        timestamp: getCurrentLocalDateTime(),
      };
    } catch (error) {
      logger.error(
        `Failed to get available tables: ${
          error instanceof Error ? error.message : error
        }`,
        'TableModel'
      );
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to retrieve available tables',
        timestamp: getCurrentLocalDateTime(),
      };
    }
  }

  /**
   * Get table statistics
   */
  async getTableStats(): Promise<
    IPCResponse<{
      total: number;
      available: number;
      occupied: number;
      outOfOrder: number;
      reserved: number;
    }>
  > {
    try {
      const [total, available, occupied, outOfOrder, reserved] =
        await Promise.all([
          this.prisma.table.count({}),
          this.prisma.table.count({
            where: { status: 'AVAILABLE' },
          }),
          this.prisma.table.count({ where: { status: 'OCCUPIED' } }),
          this.prisma.table.count({
            where: { status: 'OUT_OF_ORDER' },
          }),
          this.prisma.table.count({ where: { status: 'RESERVED' } }),
        ]);

      return {
        success: true,
        data: {
          total,
          available,
          occupied,
          outOfOrder,
          reserved,
        },
        timestamp: getCurrentLocalDateTime(),
      };
    } catch (error) {
      logger.error(
        `Failed to get table statistics: ${
          error instanceof Error ? error.message : error
        }`,
        'TableModel'
      );
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to retrieve table statistics',
        timestamp: getCurrentLocalDateTime(),
      };
    }
  }

  /**
   * Toggle the isPayLater field for a table
   */
  async togglePayLater(id: string): Promise<IPCResponse<Table>> {
    try {
      // Get current table state
      const currentTable = await this.prisma.table.findUnique({
        where: { id },
      });

      if (!currentTable) {
        return {
          success: false,
          error: 'Table not found',
          timestamp: getCurrentLocalDateTime(),
        };
      }

      // Toggle the isPayLater field
      const newPayLaterValue = currentTable.isPayLater ? 0 : 1;

      const table = await this.prisma.table.update({
        where: { id },
        data: {
          isPayLater: newPayLaterValue,
          updatedAt: getCurrentLocalDateTime(),
        },
        include: {
          orders: {
            where: {
              status: {
                in: ['PENDING', 'PREPARING', 'READY'],
              },
            },
            orderBy: {
              createdAt: 'desc',
            },
            take: 1,
          },
        },
      });

      logger.info(
        'Table pay later status toggled',
        `tableId: ${id}, newValue: ${newPayLaterValue}`
      );

      return {
        success: true,
        data: this.mapPrismaTable(table),
        timestamp: getCurrentLocalDateTime(),
      };
    } catch (error) {
      logger.error(
        `Failed to toggle pay later status for table ${id}: ${
          error instanceof Error ? error.message : error
        }`,
        'TableModel'
      );
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to toggle pay later status',
        timestamp: getCurrentLocalDateTime(),
      };
    }
  }
}
