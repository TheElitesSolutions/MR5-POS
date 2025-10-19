import { PrismaClient } from '../prisma';
import { AppError } from '../error-handler';
import { IPCResponse, Inventory } from '../types';
import {
  Decimal,
  addDecimals,
  compareDecimals,
  decimalToNumber,
  multiplyDecimals,
  validateCurrencyAmount,
  toDecimal,
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

export class InventoryModel {
  constructor(private prisma: PrismaClient) {}

  /**
   * Convert Prisma Inventory to type-safe Inventory interface with frontend-compatible property names
   */
  private mapPrismaInventory(inventory: any): any {
    return {
      id: inventory.id,
      name: inventory.itemName, // Frontend expects 'name'
      itemName: inventory.itemName, // Keep original for backward compatibility
      category: inventory.category,
      currentQuantity: decimalToNumber(inventory.currentStock), // Frontend expects 'currentQuantity'
      currentStock: decimalToNumber(inventory.currentStock), // Keep original for backward compatibility
      minimumQuantity: decimalToNumber(inventory.minimumStock), // Frontend expects 'minimumQuantity'
      minimumStock: decimalToNumber(inventory.minimumStock), // Keep original for backward compatibility
      unit: inventory.unit,
      costPerUnit: decimalToNumber(inventory.costPerUnit), // Convert Prisma.Decimal to plain number for IPC
      supplier: inventory.supplier,
      lastRestocked: toISOString(inventory.lastRestocked),
      expiryDate: toISOString(inventory.expiryDate),
      createdAt: toISOString(inventory.createdAt),
      updatedAt: toISOString(inventory.updatedAt),
    };
  }

  async findAll(filters?: {
    category?: string;
    lowStock?: boolean;
    expired?: boolean;
    supplier?: string;
  }): Promise<IPCResponse<Inventory[]>> {
    try {
      const where: any = {};

      if (filters?.category) {
        where.category = filters.category;
      }

      if (filters?.supplier) {
        where.supplier = filters.supplier;
      }

      if (filters?.expired) {
        where.expiryDate = {
          lte: new Date().toISOString(),
        };
      }

      let inventory = await this.prisma.inventory.findMany({
        where,
        orderBy: { itemName: 'asc' },
      });

      // Filter out system-generated category placeholder items
      inventory = inventory.filter(
        item => item.supplier !== 'System-Generated Category' && 
                !item.itemName.includes('Category Placeholder')
      );

      // Filter for low stock items if requested
      if (filters?.lowStock) {
        inventory = inventory.filter(
          item => compareDecimals(item.currentStock, item.minimumStock) <= 0
        );
      }

      return {
        success: true,
        data: inventory.map(item => this.mapPrismaInventory(item)),
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error(
        `Failed to get inventory items: ${
          error instanceof Error ? error.message : error
        }`,
        'InventoryModel'
      );
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to get inventory items',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async findById(id: string): Promise<IPCResponse<Inventory | null>> {
    try {
      const inventory = await this.prisma.inventory.findUnique({
        where: { id },
      });

      return {
        success: true,
        data: inventory ? this.mapPrismaInventory(inventory) : null,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error(
        `Failed to get inventory item by ID ${id}: ${
          error instanceof Error ? error.message : error
        }`,
        'InventoryModel'
      );
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to get inventory item',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async findByName(itemName: string): Promise<IPCResponse<Inventory | null>> {
    try {
      const inventory = await this.prisma.inventory.findFirst({
        where: { itemName: { equals: itemName } },
      });

      return {
        success: true,
        data: inventory ? this.mapPrismaInventory(inventory) : null,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error(
        `Failed to get inventory item by name ${itemName}: ${
          error instanceof Error ? error.message : error
        }`,
        'InventoryModel'
      );
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to get inventory item',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async create(inventoryData: {
    itemName: string;
    category: string;
    currentStock: Decimal;
    minimumStock: Decimal;
    unit: string;
    costPerUnit: Decimal;
    supplier?: string;
    expiryDate?: Date;
  }): Promise<IPCResponse<Inventory>> {
    try {
      // Validate monetary amounts and stock quantities
      if (!validateCurrencyAmount(inventoryData.costPerUnit)) {
        throw new AppError('Invalid cost per unit', true);
      }

      if (inventoryData.currentStock.lt(0)) {
        throw new AppError('Current stock cannot be negative', true);
      }

      if (inventoryData.minimumStock.lt(0)) {
        throw new AppError('Minimum stock cannot be negative', true);
      }

      // Check if item already exists
      const existingItem = await this.prisma.inventory.findFirst({
        where: { itemName: { equals: inventoryData.itemName } },
      });

      if (existingItem) {
        throw new AppError(
          `Inventory item '${inventoryData.itemName}' already exists`,
          true
        );
      }

      // Create inventory item with proper categoryId
      const inventory = await this.prisma.inventory.create({
        data: {
          itemName: inventoryData.itemName,
          category: inventoryData.category,
          currentStock: inventoryData.currentStock,
          minimumStock: inventoryData.minimumStock,
          unit: inventoryData.unit,
          costPerUnit: inventoryData.costPerUnit,
          supplier: inventoryData.supplier || null,
          expiryDate: inventoryData.expiryDate || null,
          lastRestocked: new Date().toISOString(),
        } as any, // Type assertion to bypass schema mismatch issues
      });

      logger.info(
        'Inventory item created successfully',
        `inventoryId: ${inventory.id}, itemName: ${inventory.itemName}`
      );

      return {
        success: true,
        data: this.mapPrismaInventory(inventory),
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error(
        `Failed to create inventory item: ${
          error instanceof Error ? error.message : error
        }`,
        'InventoryModel'
      );
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to create inventory item',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async update(
    id: string,
    updateData: {
      itemName?: string;
      category?: string;
      currentStock?: Decimal;
      minimumStock?: Decimal;
      unit?: string;
      costPerUnit?: Decimal;
      supplier?: string;
      expiryDate?: Date;
    }
  ): Promise<IPCResponse<Inventory>> {
    try {
      // Validate monetary amounts if provided
      if (
        updateData.costPerUnit &&
        !validateCurrencyAmount(updateData.costPerUnit)
      ) {
        throw new AppError('Invalid cost per unit', true);
      }

      if (updateData.currentStock && updateData.currentStock.lt(0)) {
        throw new AppError('Current stock cannot be negative', true);
      }

      if (updateData.minimumStock && updateData.minimumStock.lt(0)) {
        throw new AppError('Minimum stock cannot be negative', true);
      }

      // Check if updating item name conflicts with existing item
      if (updateData.itemName) {
        const existingItem = await this.prisma.inventory.findFirst({
          where: {
            itemName: updateData.itemName,
            id: { not: id },
          },
        });

        if (existingItem) {
          throw new AppError(
            `Inventory item '${updateData.itemName}' already exists`,
            true
          );
        }
      }

      const inventory = await this.prisma.inventory.update({
        where: { id },
        data: updateData as any, // Type assertion to bypass schema mismatch
      });

      logger.info('Inventory item updated successfully', `inventoryId: ${id}`);

      return {
        success: true,
        data: this.mapPrismaInventory(inventory),
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error(
        `Failed to update inventory item ${id}: ${
          error instanceof Error ? error.message : error
        }`,
        'InventoryModel'
      );
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to update inventory item',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async adjustStock(
    id: string,
    adjustment: Decimal,
    reason: string
  ): Promise<IPCResponse<Inventory>> {
    try {
      const currentItem = await this.prisma.inventory.findUnique({
        where: { id },
      });

      if (!currentItem) {
        throw new AppError('Inventory item not found', true);
      }

      const newStock = addDecimals(currentItem.currentStock, adjustment);

      if (newStock.lt(0)) {
        throw new AppError('Insufficient stock for this adjustment', true);
      }

      const inventory = await this.prisma.inventory.update({
        where: { id },
        data: {
          currentStock: newStock,
        },
      });

      logger.info(
        'Inventory stock adjusted',
        `inventoryId: ${id}, adjustment: ${adjustment}, reason: ${reason}, newStock: ${newStock}`
      );

      return {
        success: true,
        data: this.mapPrismaInventory(inventory),
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error(
        `Failed to adjust stock for inventory item ${id}: ${
          error instanceof Error ? error.message : error
        }`,
        'InventoryModel'
      );
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to adjust stock',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async restockItem(
    id: string,
    quantity: Decimal,
    costPerUnit?: Decimal
  ): Promise<IPCResponse<Inventory>> {
    try {
      if (quantity.lte(0)) {
        throw new AppError('Restock quantity must be greater than 0', true);
      }

      if (costPerUnit && !validateCurrencyAmount(costPerUnit)) {
        throw new AppError('Invalid cost per unit', true);
      }

      const currentItem = await this.prisma.inventory.findUnique({
        where: { id },
      });

      if (!currentItem) {
        throw new AppError('Inventory item not found', true);
      }

      const newStock = addDecimals(currentItem.currentStock, quantity);

      const updateData: any = {
        currentStock: newStock,
        lastRestocked: new Date().toISOString(),
      };

      if (costPerUnit) {
        updateData.costPerUnit = costPerUnit;
      }

      const inventory = await this.prisma.inventory.update({
        where: { id },
        data: updateData,
      });

      logger.info(
        'Inventory item restocked',
        `inventoryId: ${id}, quantity: ${quantity}, newStock: ${newStock}`
      );

      return {
        success: true,
        data: this.mapPrismaInventory(inventory),
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error(
        `Failed to restock inventory item ${id}: ${
          error instanceof Error ? error.message : error
        }`,
        'InventoryModel'
      );
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to restock item',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async getLowStockItems(): Promise<IPCResponse<Inventory[]>> {
    try {
      const allItems = await this.prisma.inventory.findMany();

      const lowStockItems = allItems.filter(
        item => compareDecimals(item.currentStock, item.minimumStock) <= 0
      );

      return {
        success: true,
        data: lowStockItems.map(item => this.mapPrismaInventory(item)),
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error(
        `Failed to get low stock items: ${
          error instanceof Error ? error.message : error
        }`,
        'InventoryModel'
      );
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to get low stock items',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Get low stock items (alias for getLowStockItems)
   */
  async getLowStock(): Promise<IPCResponse<Inventory[]>> {
    return this.getLowStockItems();
  }

  async getExpiredItems(): Promise<IPCResponse<Inventory[]>> {
    try {
      // Using raw query to bypass TypeScript schema mismatch for expiryDate
      const expiredItems = await this.prisma.$queryRaw<Array<any>>`
        SELECT * FROM inventory
        WHERE expiryDate <= ${new Date().toISOString()}
        ORDER BY expiryDate ASC
      `;

      return {
        success: true,
        data: expiredItems.map(item => this.mapPrismaInventory(item)),
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error(
        `Failed to get expired items: ${
          error instanceof Error ? error.message : error
        }`,
        'InventoryModel'
      );
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to get expired items',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async getExpiringItems(
    daysAhead: number = 7
  ): Promise<IPCResponse<Inventory[]>> {
    try {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + daysAhead);

      // Using raw query to bypass TypeScript schema mismatch for expiryDate
      const expiringItems = await this.prisma.$queryRaw<Array<any>>`
        SELECT * FROM inventory
        WHERE expiryDate >= ${new Date().toISOString()}
        AND expiryDate <= ${futureDate.toISOString()}
        ORDER BY expiryDate ASC
      `;

      return {
        success: true,
        data: expiringItems.map(item => this.mapPrismaInventory(item)),
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error(
        `Failed to get expiring items: ${
          error instanceof Error ? error.message : error
        }`,
        'InventoryModel'
      );
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to get expiring items',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async getInventoryValue(): Promise<
    IPCResponse<{
      totalValue: Decimal;
      categoryBreakdown: Record<
        string,
        { itemCount: number; totalValue: Decimal }
      >;
    }>
  > {
    try {
      const allItems = await this.prisma.inventory.findMany();

      let totalValue = new DecimalJS(0);
      const categoryBreakdown: Record<
        string,
        { itemCount: number; totalValue: Decimal }
      > = {};

      for (const item of allItems) {
        // Use cost instead of costPerUnit for consistency with schema
        // Use either costPerUnit or fall back to a default value
        const costPerUnit = (item as any).costPerUnit || new DecimalJS(0);
        const itemValue = multiplyDecimals(item.currentStock, costPerUnit);
        totalValue = addDecimals(totalValue, itemValue);

        // Use category field
        const categoryKey = item.category;
        if (!categoryBreakdown[categoryKey]) {
          categoryBreakdown[categoryKey] = {
            itemCount: 0,
            totalValue: new DecimalJS(0),
          };
        }

        // Store reference to avoid TypeScript "possibly undefined" errors
        const categoryData = categoryBreakdown[categoryKey]!; // Non-null assertion - we know it exists after the check above
        categoryData.itemCount++;
        categoryData.totalValue = addDecimals(
          categoryData.totalValue,
          itemValue
        );
      }

      return {
        success: true,
        data: {
          totalValue,
          categoryBreakdown,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error(
        `Failed to calculate inventory value: ${
          error instanceof Error ? error.message : error
        }`,
        'InventoryModel'
      );
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to calculate inventory value',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async delete(id: string): Promise<IPCResponse<boolean>> {
    try {
      await this.prisma.inventory.delete({
        where: { id },
      });

      logger.info('Inventory item deleted successfully', `inventoryId: ${id}`);

      return {
        success: true,
        data: true,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error(
        `Failed to delete inventory item ${id}: ${
          error instanceof Error ? error.message : error
        }`,
        'InventoryModel'
      );
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to delete inventory item',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async getCategories(): Promise<IPCResponse<string[]>> {
    try {
      // Use type assertion to resolve schema mismatch
      const items = await this.prisma.inventory.findMany({
        select: { category: true } as any,
        orderBy: { category: 'asc' } as any,
      });

      // Get unique categories and filter out empty/null values
      const uniqueCategories = Array.from(
        new Set(
          items
            .map(item => item.category as any as string)
            .filter(category => category && category.trim() !== '')
        )
      );

      return {
        success: true,
        data: uniqueCategories,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error(
        `Failed to get inventory categories: ${
          error instanceof Error ? error.message : error
        }`,
        'InventoryModel'
      );
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to get categories',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async getByCategory(category: string): Promise<IPCResponse<InventoryItem[]>> {
    try {
      const items = await this.prisma.inventory.findMany({
        where: {
          category: category as any,
        },
        orderBy: { itemName: 'asc' } as any,
      });

      return {
        success: true,
        data: items as any as InventoryItem[],
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error(
        `Failed to get inventory by category: ${
          error instanceof Error ? error.message : error
        }`,
        'InventoryModel'
      );
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to get inventory by category',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async updateCategoryName(
    oldName: string,
    newName: string
  ): Promise<IPCResponse<boolean>> {
    try {
      logger.info(
        `Updating category name from "${oldName}" to "${newName}"`,
        'InventoryModel'
      );

      // Update all inventory items that use this category
      const updateResult = await this.prisma.inventory.updateMany({
        where: {
          category: oldName,
        } as any,
        data: {
          category: newName,
        } as any,
      });

      logger.info(
        `Successfully updated ${updateResult.count} inventory items from category "${oldName}" to "${newName}"`,
        'InventoryModel'
      );

      return {
        success: true,
        data: true,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error(
        `Failed to update category name from "${oldName}" to "${newName}": ${
          error instanceof Error ? error.message : error
        }`,
        'InventoryModel'
      );
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to update category name',
        timestamp: new Date().toISOString(),
      };
    }
  }
}
