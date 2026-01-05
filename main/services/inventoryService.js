/**
 * Inventory Service for mr5-POS Electron Application
 * Handles inventory management and stock tracking
 */
import { Decimal } from 'decimal.js';
import { AppError } from '../error-handler';
import { BaseService } from './baseService';
import { AdvancedLogger } from '../utils/advancedLogger';
import { decimalToNumber } from '../utils/decimal';
import { getCurrentLocalDateTime } from '../utils/dateTime';
/**
 * Service for managing inventory and stock levels
 */
export class InventoryService extends BaseService {
    /**
     * Increase stock when an item is removed from an order
     * @param orderItemId The ID of the order item being removed
     * @returns Success status
     */
    async increaseStockForOrderItem(orderItemId) {
        try {
            AdvancedLogger.info(`Restoring inventory for removed order item: ${orderItemId}`);
            // First fetch the order item to get menu item ID and quantity
            const orderItem = await this.prisma.orderItem.findUnique({
                where: { id: orderItemId },
                include: { menuItem: true },
            });
            if (!orderItem) {
                throw new AppError(`Order item ${orderItemId} not found`, true);
            }
            const menuItemId = orderItem.menuItemId;
            const quantity = orderItem.quantity;
            // Get the ingredients for this menu item
            const prismaAny = this.prisma;
            const ingredients = await prismaAny.menuItemInventory.findMany({
                where: { menuItemId },
                include: { inventory: true },
            });
            if (!ingredients || ingredients.length === 0) {
                AdvancedLogger.info(`Menu item ${orderItem.menuItem?.name || menuItemId} has no linked inventory items to restore`);
                return this.createSuccessResponse({ success: true });
            }
            // Calculate inventory to restore
            const inventoryUpdates = new Map();
            // Process the ingredients
            for (const inventoryLink of ingredients) {
                const inventoryId = inventoryLink.inventoryId;
                const restoreQuantity = new Decimal(inventoryLink.quantity).mul(quantity);
                inventoryUpdates.set(inventoryId, restoreQuantity);
                AdvancedLogger.info(`Calculated inventory restoration for removed item`, {
                    inventoryId,
                    itemName: inventoryLink.inventory.itemName,
                    restorePerUnit: inventoryLink.quantity.toString(),
                    orderQuantity: quantity,
                    totalToRestore: restoreQuantity.toString(),
                });
            }
            // Execute inventory updates in a transaction
            await this.executeTransaction(async (tx) => {
                // Process each inventory update
                for (const [inventoryId, restoreQuantity,] of Array.from(inventoryUpdates.entries())) {
                    // Get current inventory
                    const inventoryItem = await tx.inventory.findUnique({
                        where: { id: inventoryId },
                    });
                    if (!inventoryItem) {
                        AdvancedLogger.warn(`Inventory item ${inventoryId} not found during restoration`);
                        continue;
                    }
                    // Calculate new stock level (increase)
                    const newStock = inventoryItem.currentStock.add(restoreQuantity);
                    // Update inventory
                    await tx.inventory.update({
                        where: { id: inventoryId },
                        data: { currentStock: newStock },
                    });
                    AdvancedLogger.info(`Restored inventory for ${inventoryItem.itemName}`, {
                        inventoryId,
                        previousStock: inventoryItem.currentStock.toString(),
                        restored: restoreQuantity.toString(),
                        newStock: newStock.toString(),
                        unit: inventoryItem.unit,
                    });
                }
                // Log inventory changes
                await tx.auditLog.create({
                    data: {
                        action: 'INVENTORY_INCREASE',
                        tableName: 'inventory',
                        recordId: orderItemId,
                        newValues: {
                            inventoryUpdates: JSON.stringify(Object.fromEntries(inventoryUpdates)),
                            reason: 'Order item removed',
                        },
                        createdAt: getCurrentLocalDateTime(),
                    },
                });
            });
            return this.createSuccessResponse({ success: true });
        }
        catch (error) {
            return this.createErrorResponse(error);
        }
    }
    /**
     * Decrease stock for multiple inventory items based on menu items in an order
     * @param orderItems Array of order items with menu item IDs and quantities
     * @param orderId The ID of the order
     * @returns Success status and any low stock items detected
     */
    async decreaseStockForOrder(orderItems, orderId) {
        try {
            // Get all menu items with their related ingredients
            const menuItemsWithIngredients = await Promise.all(orderItems.map(async (item) => {
                const menuItemData = await this.prisma.menuItem.findUnique({
                    where: { id: item.menuItemId },
                });
                if (!menuItemData) {
                    throw new AppError(`Menu item ${item.menuItemId} not found`, true);
                }
                // Get the ingredients for this menu item
                // Use type assertion to work around TypeScript error
                const prismaAny = this.prisma;
                const ingredients = await prismaAny.menuItemInventory.findMany({
                    where: { menuItemId: item.menuItemId },
                    include: { inventory: true },
                });
                return {
                    menuItem: menuItemData,
                    ingredients,
                    quantity: item.quantity,
                };
            }));
            AdvancedLogger.info(`Processing inventory for order ${orderId}`, {
                orderItems: orderItems.length,
                menuItems: menuItemsWithIngredients.length,
            });
            // Calculate required inventory for each item
            const inventoryUpdates = new Map();
            // Process each order item
            for (const { 
            // Renamed to avoid unused variable warning
            menuItem: _menuItem, ingredients, quantity, } of menuItemsWithIngredients) {
                // Skip if menu item has no inventory items linked
                if (!ingredients || ingredients.length === 0) {
                    continue;
                }
                // Process each inventory item linked to this menu item
                for (const inventoryLink of ingredients) {
                    const inventoryId = inventoryLink.inventoryId;
                    const requiredQuantity = new Decimal(inventoryLink.quantity).mul(quantity);
                    // Add to existing quantity or create new entry
                    const currentTotal = inventoryUpdates.get(inventoryId) || new Decimal(0);
                    inventoryUpdates.set(inventoryId, currentTotal.add(requiredQuantity));
                    // _menuItem is used here to avoid unused variable warning
                    AdvancedLogger.info(`Calculated inventory usage for item`, {
                        inventoryId,
                        itemName: inventoryLink.inventory.itemName,
                        requiredPerUnit: inventoryLink.quantity.toString(),
                        orderQuantity: quantity,
                        totalRequired: requiredQuantity.toString(),
                    });
                }
            }
            // If no inventory updates needed, return early
            if (inventoryUpdates.size === 0) {
                AdvancedLogger.info(`No inventory updates needed for order ${orderId}`);
                return this.createSuccessResponse({
                    success: true,
                    lowStockItems: [],
                });
            }
            // Execute inventory updates in a transaction
            const lowStockItems = [];
            await this.executeTransaction(async (tx) => {
                // Process each inventory update
                for (const [inventoryId, requiredQuantity,] of Array.from(inventoryUpdates.entries())) {
                    // Get current inventory
                    const inventoryItem = await tx.inventory.findUnique({
                        where: { id: inventoryId },
                    });
                    if (!inventoryItem) {
                        AdvancedLogger.warn(`Inventory item ${inventoryId} not found during order processing`);
                        continue;
                    }
                    // Calculate new stock level
                    const newStock = inventoryItem.currentStock.sub(requiredQuantity);
                    // Check if we have enough stock
                    if (newStock.lt(0)) {
                        throw new AppError(`Insufficient stock for item: ${inventoryItem.itemName}`, true);
                    }
                    // Update inventory
                    await tx.inventory.update({
                        where: { id: inventoryId },
                        data: { currentStock: newStock },
                    });
                    AdvancedLogger.info(`Updated inventory for ${inventoryItem.itemName}`, {
                        inventoryId,
                        previousStock: inventoryItem.currentStock.toString(),
                        used: requiredQuantity.toString(),
                        newStock: newStock.toString(),
                        unit: inventoryItem.unit,
                    });
                    // Check if this item is now below minimum stock level
                    if (newStock.lte(inventoryItem.minimumStock)) {
                        lowStockItems.push({
                            id: inventoryItem.id,
                            itemName: inventoryItem.itemName,
                            category: inventoryItem.category,
                            currentStock: newStock,
                            minimumStock: inventoryItem.minimumStock,
                            unit: inventoryItem.unit,
                            costPerUnit: inventoryItem.costPerUnit,
                            supplier: inventoryItem.supplier,
                            lastRestocked: inventoryItem.lastRestocked,
                            expiryDate: inventoryItem.expiryDate,
                            createdAt: inventoryItem.createdAt,
                            updatedAt: inventoryItem.updatedAt,
                        });
                        AdvancedLogger.warn(`Low stock detected for ${inventoryItem.itemName}`, {
                            inventoryId,
                            currentStock: newStock.toString(),
                            minimumStock: inventoryItem.minimumStock.toString(),
                            unit: inventoryItem.unit,
                        });
                    }
                }
                // Log inventory changes
                await tx.auditLog.create({
                    data: {
                        action: 'INVENTORY_DECREASE',
                        tableName: 'inventory',
                        recordId: orderId,
                        newValues: {
                            inventoryUpdates: JSON.stringify(Object.fromEntries(inventoryUpdates)),
                        },
                        createdAt: getCurrentLocalDateTime(),
                    },
                });
            });
            return this.createSuccessResponse({
                success: true,
                lowStockItems: lowStockItems,
            });
        }
        catch (error) {
            return this.createErrorResponse(error);
        }
    }
    /**
     * Check if there's sufficient stock for an order without decreasing stock
     * @param orderItems Array of order items with menu item IDs and quantities
     * @returns Availability status and any unavailable items
     */
    async checkStockAvailability(orderItems) {
        try {
            // Get all menu items with their related ingredients
            const menuItemsWithIngredients = await Promise.all(orderItems.map(async (item) => {
                const menuItemData = await this.prisma.menuItem.findUnique({
                    where: { id: item.menuItemId },
                });
                if (!menuItemData) {
                    throw new AppError(`Menu item ${item.menuItemId} not found`, true);
                }
                // Get the ingredients for this menu item
                // Use type assertion to work around TypeScript error
                const prismaAny = this.prisma;
                const ingredients = await prismaAny.menuItemInventory.findMany({
                    where: { menuItemId: item.menuItemId },
                    include: { inventory: true },
                });
                return {
                    menuItem: menuItemData,
                    ingredients,
                    quantity: item.quantity,
                };
            }));
            // Calculate required inventory for each item
            const inventoryRequirements = new Map();
            // Process each order item
            for (const { 
            // Renamed to avoid unused variable warning
            menuItem: _menuItem, ingredients, quantity, } of menuItemsWithIngredients) {
                // Skip if menu item has no inventory items linked
                if (!ingredients || ingredients.length === 0)
                    continue;
                // Process each inventory item linked to this menu item
                for (const inventoryLink of ingredients) {
                    const inventoryId = inventoryLink.inventoryId;
                    const requiredQuantity = new Decimal(inventoryLink.quantity).mul(quantity);
                    // Add to existing quantity or create new entry
                    const current = inventoryRequirements.get(inventoryId);
                    if (current) {
                        current.required = current.required.add(requiredQuantity);
                    }
                    else {
                        inventoryRequirements.set(inventoryId, {
                            required: requiredQuantity,
                            item: {
                                id: inventoryLink.inventory.id,
                                name: inventoryLink.inventory.itemName,
                                unit: inventoryLink.inventory.unit,
                                stock: inventoryLink.inventory.currentStock,
                            },
                        });
                    }
                }
            }
            // Check if we have enough stock for all items
            const unavailableItems = [];
            for (const [_inventoryId, data] of Array.from(inventoryRequirements.entries())) {
                if (data.required.gt(data.item.stock)) {
                    unavailableItems.push({
                        id: data.item.id,
                        name: data.item.name,
                        required: decimalToNumber(data.required),
                        available: decimalToNumber(data.item.stock),
                        unit: data.item.unit,
                    });
                }
            }
            return this.createSuccessResponse({
                available: unavailableItems.length === 0,
                unavailableItems,
            });
        }
        catch (error) {
            return this.createErrorResponse(error);
        }
    }
    /**
     * Get all inventory items that are below their minimum stock level
     * @returns Array of low stock inventory items
     */
    async getLowStockItems() {
        try {
            // Use raw SQL to compare currentStock with minimumStock column
            // Exclude system-generated category placeholder items
            const lowStockItems = await this.prisma.$queryRawUnsafe(`SELECT * FROM inventory 
         WHERE currentStock <= minimumStock 
         AND supplier != 'System-Generated Category'
         AND itemName NOT LIKE '%Category Placeholder%'
         ORDER BY itemName ASC`);
            // Cast inventory items to match the expected interface
            return this.createSuccessResponse(lowStockItems.map(item => ({
                id: item.id,
                itemName: item.itemName,
                category: item.category,
                currentStock: item.currentStock,
                minimumStock: item.minimumStock,
                unit: item.unit,
                costPerUnit: item.costPerUnit,
                supplier: item.supplier,
                lastRestocked: item.lastRestocked,
                expiryDate: item.expiryDate,
                createdAt: item.createdAt,
                updatedAt: item.updatedAt,
            })));
        }
        catch (error) {
            return this.createErrorResponse(error);
        }
    }
    /**
     * Get ingredients for a specific menu item
     * @param menuItemId ID of the menu item
     * @returns Array of menu item ingredients with inventory details
     */
    async getMenuItemIngredients(menuItemId) {
        try {
            // Use type assertion to work around TypeScript error
            const prismaAny = this.prisma;
            const ingredients = await prismaAny.menuItemInventory.findMany({
                where: { menuItemId },
                include: { inventory: true },
            });
            return this.createSuccessResponse(ingredients);
        }
        catch (error) {
            return this.createErrorResponse(error);
        }
    }
    /**
     * Link a menu item to inventory items with specified quantities
     * @param menuItemId ID of the menu item
     * @param ingredients Array of inventory items and quantities
     * @returns Updated menu item with inventory links
     */
    async updateMenuItemIngredients(menuItemId, ingredients) {
        try {
            // Validate menu item exists
            const menuItem = await this.prisma.menuItem.findUnique({
                where: { id: menuItemId },
            });
            if (!menuItem) {
                throw new AppError(`Menu item with ID ${menuItemId} not found`, true);
            }
            // Validate all inventory items exist
            const inventoryIds = ingredients.map(ing => ing.inventoryId);
            const inventoryItems = await this.prisma.inventory.findMany({
                where: { id: { in: inventoryIds } },
            });
            if (inventoryItems.length !== new Set(inventoryIds).size) {
                throw new AppError('One or more inventory items not found', true);
            }
            // Update menu item ingredients in a transaction
            const result = await this.executeTransaction(async (tx) => {
                // Delete existing links
                // Use type assertion to work around TypeScript error
                const txAny = tx;
                await txAny.menuItemInventory.deleteMany({
                    where: { menuItemId },
                });
                // Create new links
                if (ingredients.length > 0) {
                    // Use type assertion to work around TypeScript error
                    await txAny.menuItemInventory.createMany({
                        data: ingredients.map(ing => ({
                            menuItemId,
                            inventoryId: ing.inventoryId,
                            quantity: new Decimal(ing.quantity),
                        })),
                    });
                }
                // Return updated menu item with inventory links
                return await this.prisma.menuItem.findUnique({
                    where: { id: menuItemId },
                });
            });
            // Get the updated ingredients to return with the result
            // Use type assertion to work around TypeScript error
            const prismaAny = this.prisma;
            const updatedIngredients = await prismaAny.menuItemInventory.findMany({
                where: { menuItemId },
                include: { inventory: true },
            });
            return this.createSuccessResponse({
                ...result,
                ingredients: updatedIngredients,
            });
        }
        catch (error) {
            return this.createErrorResponse(error);
        }
    }
}
