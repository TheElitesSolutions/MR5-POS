import { AppError } from '../error-handler';
import { addDecimals, compareDecimals, decimalToNumber, multiplyDecimals, validateCurrencyAmount, } from '../utils/decimal';
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
export class InventoryModel {
    constructor(prisma) {
        this.prisma = prisma;
    }
    /**
     * Convert Prisma Inventory to type-safe Inventory interface with frontend-compatible property names
     */
    mapPrismaInventory(inventory) {
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
    async findAll(filters) {
        try {
            const where = {};
            if (filters?.category) {
                where.category = filters.category;
            }
            if (filters?.supplier) {
                where.supplier = filters.supplier;
            }
            if (filters?.expired) {
                where.expiryDate = {
                    lte: getCurrentLocalDateTime(),
                };
            }
            let inventory = await this.prisma.inventory.findMany({
                where,
                orderBy: { itemName: 'asc' },
            });
            // Filter out system-generated category placeholder items
            inventory = inventory.filter(item => item.supplier !== 'System-Generated Category' &&
                !item.itemName.includes('Category Placeholder'));
            // Filter for low stock items if requested
            if (filters?.lowStock) {
                inventory = inventory.filter(item => compareDecimals(item.currentStock, item.minimumStock) <= 0);
            }
            return {
                success: true,
                data: inventory.map(item => this.mapPrismaInventory(item)),
                timestamp: getCurrentLocalDateTime(),
            };
        }
        catch (error) {
            logger.error(`Failed to get inventory items: ${error instanceof Error ? error.message : error}`, 'InventoryModel');
            return {
                success: false,
                error: error instanceof Error
                    ? error.message
                    : 'Failed to get inventory items',
                timestamp: getCurrentLocalDateTime(),
            };
        }
    }
    async findById(id) {
        try {
            const inventory = await this.prisma.inventory.findUnique({
                where: { id },
            });
            return {
                success: true,
                data: inventory ? this.mapPrismaInventory(inventory) : null,
                timestamp: getCurrentLocalDateTime(),
            };
        }
        catch (error) {
            logger.error(`Failed to get inventory item by ID ${id}: ${error instanceof Error ? error.message : error}`, 'InventoryModel');
            return {
                success: false,
                error: error instanceof Error
                    ? error.message
                    : 'Failed to get inventory item',
                timestamp: getCurrentLocalDateTime(),
            };
        }
    }
    async findByName(itemName) {
        try {
            const inventory = await this.prisma.inventory.findFirst({
                where: { itemName: { equals: itemName } },
            });
            return {
                success: true,
                data: inventory ? this.mapPrismaInventory(inventory) : null,
                timestamp: getCurrentLocalDateTime(),
            };
        }
        catch (error) {
            logger.error(`Failed to get inventory item by name ${itemName}: ${error instanceof Error ? error.message : error}`, 'InventoryModel');
            return {
                success: false,
                error: error instanceof Error
                    ? error.message
                    : 'Failed to get inventory item',
                timestamp: getCurrentLocalDateTime(),
            };
        }
    }
    async create(inventoryData) {
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
                throw new AppError(`Inventory item '${inventoryData.itemName}' already exists`, true);
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
                    lastRestocked: getCurrentLocalDateTime(),
                }, // Type assertion to bypass schema mismatch issues
            });
            logger.info('Inventory item created successfully', `inventoryId: ${inventory.id}, itemName: ${inventory.itemName}`);
            return {
                success: true,
                data: this.mapPrismaInventory(inventory),
                timestamp: getCurrentLocalDateTime(),
            };
        }
        catch (error) {
            if (error instanceof AppError) {
                throw error;
            }
            logger.error(`Failed to create inventory item: ${error instanceof Error ? error.message : error}`, 'InventoryModel');
            return {
                success: false,
                error: error instanceof Error
                    ? error.message
                    : 'Failed to create inventory item',
                timestamp: getCurrentLocalDateTime(),
            };
        }
    }
    async update(id, updateData) {
        try {
            // Validate monetary amounts if provided
            if (updateData.costPerUnit &&
                !validateCurrencyAmount(updateData.costPerUnit)) {
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
                    throw new AppError(`Inventory item '${updateData.itemName}' already exists`, true);
                }
            }
            const inventory = await this.prisma.inventory.update({
                where: { id },
                data: updateData, // Type assertion to bypass schema mismatch
            });
            logger.info('Inventory item updated successfully', `inventoryId: ${id}`);
            return {
                success: true,
                data: this.mapPrismaInventory(inventory),
                timestamp: getCurrentLocalDateTime(),
            };
        }
        catch (error) {
            if (error instanceof AppError) {
                throw error;
            }
            logger.error(`Failed to update inventory item ${id}: ${error instanceof Error ? error.message : error}`, 'InventoryModel');
            return {
                success: false,
                error: error instanceof Error
                    ? error.message
                    : 'Failed to update inventory item',
                timestamp: getCurrentLocalDateTime(),
            };
        }
    }
    async adjustStock(id, adjustment, reason) {
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
            logger.info('Inventory stock adjusted', `inventoryId: ${id}, adjustment: ${adjustment}, reason: ${reason}, newStock: ${newStock}`);
            return {
                success: true,
                data: this.mapPrismaInventory(inventory),
                timestamp: getCurrentLocalDateTime(),
            };
        }
        catch (error) {
            if (error instanceof AppError) {
                throw error;
            }
            logger.error(`Failed to adjust stock for inventory item ${id}: ${error instanceof Error ? error.message : error}`, 'InventoryModel');
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to adjust stock',
                timestamp: getCurrentLocalDateTime(),
            };
        }
    }
    async restockItem(id, quantity, costPerUnit) {
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
            const updateData = {
                currentStock: newStock,
                lastRestocked: getCurrentLocalDateTime(),
            };
            if (costPerUnit) {
                updateData.costPerUnit = costPerUnit;
            }
            const inventory = await this.prisma.inventory.update({
                where: { id },
                data: updateData,
            });
            logger.info('Inventory item restocked', `inventoryId: ${id}, quantity: ${quantity}, newStock: ${newStock}`);
            return {
                success: true,
                data: this.mapPrismaInventory(inventory),
                timestamp: getCurrentLocalDateTime(),
            };
        }
        catch (error) {
            if (error instanceof AppError) {
                throw error;
            }
            logger.error(`Failed to restock inventory item ${id}: ${error instanceof Error ? error.message : error}`, 'InventoryModel');
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to restock item',
                timestamp: getCurrentLocalDateTime(),
            };
        }
    }
    async getLowStockItems() {
        try {
            const allItems = await this.prisma.inventory.findMany();
            const lowStockItems = allItems.filter(item => compareDecimals(item.currentStock, item.minimumStock) <= 0);
            return {
                success: true,
                data: lowStockItems.map(item => this.mapPrismaInventory(item)),
                timestamp: getCurrentLocalDateTime(),
            };
        }
        catch (error) {
            logger.error(`Failed to get low stock items: ${error instanceof Error ? error.message : error}`, 'InventoryModel');
            return {
                success: false,
                error: error instanceof Error
                    ? error.message
                    : 'Failed to get low stock items',
                timestamp: getCurrentLocalDateTime(),
            };
        }
    }
    /**
     * Get low stock items (alias for getLowStockItems)
     */
    async getLowStock() {
        return this.getLowStockItems();
    }
    async getExpiredItems() {
        try {
            // Using raw query to bypass TypeScript schema mismatch for expiryDate
            const expiredItems = await this.prisma.$queryRaw `
        SELECT * FROM inventory
        WHERE expiryDate <= ${getCurrentLocalDateTime()}
        ORDER BY expiryDate ASC
      `;
            return {
                success: true,
                data: expiredItems.map(item => this.mapPrismaInventory(item)),
                timestamp: getCurrentLocalDateTime(),
            };
        }
        catch (error) {
            logger.error(`Failed to get expired items: ${error instanceof Error ? error.message : error}`, 'InventoryModel');
            return {
                success: false,
                error: error instanceof Error
                    ? error.message
                    : 'Failed to get expired items',
                timestamp: getCurrentLocalDateTime(),
            };
        }
    }
    async getExpiringItems(daysAhead = 7) {
        try {
            const futureDate = new Date();
            futureDate.setDate(futureDate.getDate() + daysAhead);
            // Using raw query to bypass TypeScript schema mismatch for expiryDate
            const expiringItems = await this.prisma.$queryRaw `
        SELECT * FROM inventory
        WHERE expiryDate >= ${getCurrentLocalDateTime()}
        AND expiryDate <= ${futureDate.toISOString()}
        ORDER BY expiryDate ASC
      `;
            return {
                success: true,
                data: expiringItems.map(item => this.mapPrismaInventory(item)),
                timestamp: getCurrentLocalDateTime(),
            };
        }
        catch (error) {
            logger.error(`Failed to get expiring items: ${error instanceof Error ? error.message : error}`, 'InventoryModel');
            return {
                success: false,
                error: error instanceof Error
                    ? error.message
                    : 'Failed to get expiring items',
                timestamp: getCurrentLocalDateTime(),
            };
        }
    }
    async getInventoryValue() {
        try {
            const allItems = await this.prisma.inventory.findMany();
            let totalValue = new DecimalJS(0);
            const categoryBreakdown = {};
            for (const item of allItems) {
                // Use cost instead of costPerUnit for consistency with schema
                // Use either costPerUnit or fall back to a default value
                const costPerUnit = item.costPerUnit || new DecimalJS(0);
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
                const categoryData = categoryBreakdown[categoryKey]; // Non-null assertion - we know it exists after the check above
                categoryData.itemCount++;
                categoryData.totalValue = addDecimals(categoryData.totalValue, itemValue);
            }
            return {
                success: true,
                data: {
                    totalValue,
                    categoryBreakdown,
                },
                timestamp: getCurrentLocalDateTime(),
            };
        }
        catch (error) {
            logger.error(`Failed to calculate inventory value: ${error instanceof Error ? error.message : error}`, 'InventoryModel');
            return {
                success: false,
                error: error instanceof Error
                    ? error.message
                    : 'Failed to calculate inventory value',
                timestamp: getCurrentLocalDateTime(),
            };
        }
    }
    async delete(id) {
        try {
            await this.prisma.inventory.delete({
                where: { id },
            });
            logger.info('Inventory item deleted successfully', `inventoryId: ${id}`);
            return {
                success: true,
                data: true,
                timestamp: getCurrentLocalDateTime(),
            };
        }
        catch (error) {
            logger.error(`Failed to delete inventory item ${id}: ${error instanceof Error ? error.message : error}`, 'InventoryModel');
            return {
                success: false,
                error: error instanceof Error
                    ? error.message
                    : 'Failed to delete inventory item',
                timestamp: getCurrentLocalDateTime(),
            };
        }
    }
    async getCategories() {
        try {
            // Use type assertion to resolve schema mismatch
            const items = await this.prisma.inventory.findMany({
                select: { category: true },
                orderBy: { category: 'asc' },
            });
            // Get unique categories and filter out empty/null values
            const uniqueCategories = Array.from(new Set(items
                .map(item => item.category)
                .filter(category => category && category.trim() !== '')));
            return {
                success: true,
                data: uniqueCategories,
                timestamp: getCurrentLocalDateTime(),
            };
        }
        catch (error) {
            logger.error(`Failed to get inventory categories: ${error instanceof Error ? error.message : error}`, 'InventoryModel');
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to get categories',
                timestamp: getCurrentLocalDateTime(),
            };
        }
    }
    async getByCategory(category) {
        try {
            const items = await this.prisma.inventory.findMany({
                where: {
                    category: category,
                },
                orderBy: { itemName: 'asc' },
            });
            return {
                success: true,
                data: items,
                timestamp: getCurrentLocalDateTime(),
            };
        }
        catch (error) {
            logger.error(`Failed to get inventory by category: ${error instanceof Error ? error.message : error}`, 'InventoryModel');
            return {
                success: false,
                error: error instanceof Error
                    ? error.message
                    : 'Failed to get inventory by category',
                timestamp: getCurrentLocalDateTime(),
            };
        }
    }
    async updateCategoryName(oldName, newName) {
        try {
            logger.info(`Updating category name from "${oldName}" to "${newName}"`, 'InventoryModel');
            // Update all inventory items that use this category
            const updateResult = await this.prisma.inventory.updateMany({
                where: {
                    category: oldName,
                },
                data: {
                    category: newName,
                },
            });
            logger.info(`Successfully updated ${updateResult.count} inventory items from category "${oldName}" to "${newName}"`, 'InventoryModel');
            return {
                success: true,
                data: true,
                timestamp: getCurrentLocalDateTime(),
            };
        }
        catch (error) {
            logger.error(`Failed to update category name from "${oldName}" to "${newName}": ${error instanceof Error ? error.message : error}`, 'InventoryModel');
            return {
                success: false,
                error: error instanceof Error
                    ? error.message
                    : 'Failed to update category name',
                timestamp: getCurrentLocalDateTime(),
            };
        }
    }
}
