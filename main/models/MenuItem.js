import { AppError } from '../error-handler';
import { decimalToNumber, validateCurrencyAmount } from '../utils/decimal';
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
/**
 * Map Prisma MenuItem to application MenuItem DTO
 */
export function mapPrismaMenuItemToDTO(prismaMenuItem) {
    return {
        id: prismaMenuItem.id,
        name: prismaMenuItem.name,
        description: prismaMenuItem.description,
        price: decimalToNumber(prismaMenuItem.price),
        category: prismaMenuItem.category || 'Default Category',
        isAvailable: prismaMenuItem.isActive !== undefined ? prismaMenuItem.isActive : true,
        isCustomizable: !!prismaMenuItem.isCustomizable,
        isPrintableInKitchen: prismaMenuItem.isPrintableInKitchen !== undefined
            ? !!prismaMenuItem.isPrintableInKitchen
            : true,
        isVisibleOnWebsite: prismaMenuItem.isVisibleOnWebsite !== undefined
            ? !!prismaMenuItem.isVisibleOnWebsite
            : true,
        imageUrl: prismaMenuItem.imageUrl,
        preparationTime: prismaMenuItem.preparationTime,
        ingredients: [],
        allergens: prismaMenuItem.allergens,
        createdAt: toISOString(prismaMenuItem.createdAt),
        updatedAt: toISOString(prismaMenuItem.updatedAt),
    };
}
export class MenuItemModel {
    constructor(prisma) {
        this.prisma = prisma;
    }
    /**
     * Convert Prisma MenuItem to type-safe MenuItem interface with bulletproof serialization
     */
    mapPrismaMenuItem(item) {
        try {
            // Map to renderer-compatible format matching renderer MenuItem interface
            const mapped = {
                id: item.id,
                name: item.name,
                description: item.description || '',
                price: decimalToNumber(item.price), // number (renderer expects number)
                category: 'Unknown Category', // string (renderer expects string, not object)
                isAvailable: item.isActive,
                isActive: item.isActive,
                isCustomizable: item.isCustomizable || false, // ✅ NEW: Add isCustomizable field
                isPrintableInKitchen: item.isPrintableInKitchen !== undefined ? !!item.isPrintableInKitchen : true,
                isVisibleOnWebsite: item.isVisibleOnWebsite !== undefined ? !!item.isVisibleOnWebsite : true,
                ingredients: [], // MenuItemIngredient[] (renderer expects this array)
            };
            // Bulletproof serialization: strip any non-serializable properties
            return JSON.parse(JSON.stringify(mapped));
        }
        catch (error) {
            logger.error(`Failed to map menu item ${item.id}: ${error}`, 'MenuItemModel');
            // Return a safe fallback object
            return {
                id: item.id || 'unknown',
                name: item.name || 'Unknown Item',
                description: '',
                price: 0,
                category: 'Unknown Category',
                isAvailable: true,
                isActive: true,
                isCustomizable: false, // ✅ NEW: Default to false for fallback
                isPrintableInKitchen: true,
                isVisibleOnWebsite: true,
                ingredients: [],
            };
        }
    }
    async findAll(filters) {
        try {
            const where = { isActive: true };
            if (filters?.category) {
                where.categoryId = filters.category;
            }
            const findOptions = {
                where,
                // Note: category relation may not exist in current schema
                orderBy: { name: 'asc' },
            };
            if (filters?.limit) {
                findOptions.take = filters.limit;
            }
            if (filters?.offset) {
                findOptions.skip = filters.offset;
            }
            const menuItems = await this.prisma.menuItem.findMany(findOptions);
            return {
                success: true,
                data: menuItems.map(item => this.mapPrismaMenuItem(item)),
                timestamp: getCurrentLocalDateTime(),
            };
        }
        catch (error) {
            logger.error(`Failed to get all menu items: ${error instanceof Error ? error.message : error}`, 'MenuItemModel');
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to get menu items',
                timestamp: getCurrentLocalDateTime(),
            };
        }
    }
    async findById(id) {
        try {
            const menuItem = await this.prisma.menuItem.findUnique({
                where: { id },
                // Note: category relation may not exist in current schema
            });
            if (!menuItem) {
                return {
                    success: false,
                    error: 'Menu item not found',
                    timestamp: getCurrentLocalDateTime(),
                };
            }
            return {
                success: true,
                data: this.mapPrismaMenuItem(menuItem),
                timestamp: getCurrentLocalDateTime(),
            };
        }
        catch (error) {
            logger.error(`Failed to get menu item by ID ${id}: ${error instanceof Error ? error.message : error}`, 'MenuItemModel');
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to get menu item',
                timestamp: getCurrentLocalDateTime(),
            };
        }
    }
    async create(itemData) {
        try {
            // Ensure we have a valid price and convert to Decimal if needed
            let price;
            if (itemData.price !== undefined) {
                // Convert to Decimal if it's a regular number
                if (typeof itemData.price === 'number') {
                    const { Decimal } = require('decimal.js');
                    price = new Decimal(itemData.price);
                }
                else {
                    // It's already a Decimal object
                    price = itemData.price;
                }
                // Now validate the price
                if (!validateCurrencyAmount(price)) {
                    throw new AppError('Invalid price amount', true);
                }
            }
            else {
                // Default price is 0
                const { Decimal } = require('decimal.js');
                price = new Decimal(0);
            }
            // Create the menu item with properly formatted data
            const menuItem = await this.prisma.menuItem.create({
                data: {
                    name: itemData.name || 'New Item',
                    description: itemData.description || null,
                    price: price, // Now price is always a Decimal
                    category: itemData.category || 'default',
                    imageUrl: itemData.imageUrl || null,
                    preparationTime: itemData.preparationTime || null,
                    allergens: itemData.allergens || [],
                    isActive: itemData.isAvailable !== undefined ? itemData.isAvailable : true,
                    ...(itemData.isCustomizable !== undefined && {
                        isCustomizable: itemData.isCustomizable ? 1 : 0,
                    }),
                    ...(itemData.isPrintableInKitchen !== undefined && {
                        isPrintableInKitchen: itemData.isPrintableInKitchen ? 1 : 0,
                    }),
                    ...(itemData.isVisibleOnWebsite !== undefined && {
                        isVisibleOnWebsite: itemData.isVisibleOnWebsite ? 1 : 0,
                    }),
                },
            });
            return {
                success: true,
                data: this.mapPrismaMenuItem(menuItem),
                timestamp: getCurrentLocalDateTime(),
            };
        }
        catch (error) {
            logger.error(`Failed to create menu item: ${error instanceof Error ? error.message : error}`, 'MenuItemModel');
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to create menu item',
                timestamp: getCurrentLocalDateTime(),
            };
        }
    }
    async update(id, updateData) {
        try {
            // Process price field if provided
            if (updateData.price !== undefined) {
                // Convert to Decimal if it's a regular number
                if (typeof updateData.price === 'number') {
                    const { Decimal } = require('decimal.js');
                    updateData.price = new Decimal(updateData.price);
                }
                // Now validate the price (we know it's defined at this point)
                if (!validateCurrencyAmount(updateData.price)) {
                    throw new AppError('Invalid price amount', true);
                }
            }
            const menuItem = await this.prisma.menuItem.update({
                where: { id },
                data: {
                    ...(updateData.name && { name: updateData.name }),
                    ...(updateData.description !== undefined && {
                        description: updateData.description,
                    }),
                    ...(updateData.price !== undefined && { price: updateData.price }),
                    ...(updateData.category && { category: updateData.category }),
                    ...(updateData.imageUrl !== undefined && {
                        imageUrl: updateData.imageUrl,
                    }),
                    ...(updateData.preparationTime !== undefined && {
                        preparationTime: updateData.preparationTime,
                    }),
                    ...(updateData.allergens && { allergens: updateData.allergens }),
                    ...(updateData.isAvailable !== undefined && {
                        isActive: updateData.isAvailable,
                    }),
                    ...(updateData.isCustomizable !== undefined && {
                        isCustomizable: updateData.isCustomizable ? 1 : 0,
                    }),
                    ...(updateData.isPrintableInKitchen !== undefined && {
                        isPrintableInKitchen: updateData.isPrintableInKitchen ? 1 : 0,
                    }),
                    ...(updateData.isVisibleOnWebsite !== undefined && {
                        isVisibleOnWebsite: updateData.isVisibleOnWebsite ? 1 : 0,
                    }),
                },
            });
            return {
                success: true,
                data: this.mapPrismaMenuItem(menuItem),
                timestamp: getCurrentLocalDateTime(),
            };
        }
        catch (error) {
            logger.error(`Failed to update menu item ${id}: ${error instanceof Error ? error.message : error}`, 'MenuItemModel');
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to update menu item',
                timestamp: getCurrentLocalDateTime(),
            };
        }
    }
    async delete(id) {
        try {
            await this.prisma.menuItem.update({
                where: { id },
                data: { isActive: false },
            });
            return {
                success: true,
                data: true,
                timestamp: getCurrentLocalDateTime(),
            };
        }
        catch (error) {
            logger.error(`Failed to delete menu item ${id}: ${error instanceof Error ? error.message : error}`, 'MenuItemModel');
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to delete menu item',
                timestamp: getCurrentLocalDateTime(),
            };
        }
    }
    async findByCategory(category) {
        try {
            const menuItems = await this.prisma.menuItem.findMany({
                where: {
                    categoryId: category,
                    isActive: true,
                },
                // Note: category relation may not exist in current schema
                orderBy: { name: 'asc' },
            });
            return {
                success: true,
                data: menuItems.map(item => this.mapPrismaMenuItem(item)),
                timestamp: getCurrentLocalDateTime(),
            };
        }
        catch (error) {
            logger.error(`Failed to get menu items by category: ${error instanceof Error ? error.message : error}`, 'MenuItemModel');
            return {
                success: false,
                error: error instanceof Error
                    ? error.message
                    : 'Failed to get menu items by category',
                timestamp: getCurrentLocalDateTime(),
            };
        }
    }
    async findAvailable() {
        try {
            const menuItems = await this.prisma.menuItem.findMany({
                where: {
                    isActive: true,
                },
                include: {
                    category: true,
                },
                orderBy: { name: 'asc' },
            });
            return {
                success: true,
                data: menuItems.map(item => this.mapPrismaMenuItem(item)),
                timestamp: getCurrentLocalDateTime(),
            };
        }
        catch (error) {
            logger.error(`Failed to get available menu items: ${error instanceof Error ? error.message : error}`, 'MenuItemModel');
            return {
                success: false,
                error: error instanceof Error
                    ? error.message
                    : 'Failed to get available menu items',
                timestamp: getCurrentLocalDateTime(),
            };
        }
    }
    async search(query) {
        try {
            const menuItems = await this.prisma.menuItem.findMany({
                where: {
                    AND: [
                        { isActive: true },
                        {
                            OR: [
                                { name: { contains: query } },
                                { description: { contains: query } },
                            ],
                        },
                    ],
                },
                include: {
                    category: true,
                },
                orderBy: { name: 'asc' },
            });
            return {
                success: true,
                data: menuItems.map(item => this.mapPrismaMenuItem(item)),
                timestamp: getCurrentLocalDateTime(),
            };
        }
        catch (error) {
            logger.error(`Failed to search menu items with query "${query}": ${error instanceof Error ? error.message : error}`, 'MenuItemModel');
            return {
                success: false,
                error: error instanceof Error
                    ? error.message
                    : 'Failed to search menu items',
                timestamp: getCurrentLocalDateTime(),
            };
        }
    }
    async getStats() {
        try {
            const stats = await this.prisma.menuItem.aggregate({
                _count: { id: true },
                _avg: { price: true },
                _min: { price: true },
                _max: { price: true },
                where: { isActive: true },
            });
            // Define proper types for the aggregation results
            const totalItems = stats._count.id || 0;
            const averagePrice = stats._avg.price
                ? decimalToNumber(stats._avg.price)
                : 0;
            const minPrice = stats._min.price ? decimalToNumber(stats._min.price) : 0;
            const maxPrice = stats._max.price ? decimalToNumber(stats._max.price) : 0;
            return {
                success: true,
                data: {
                    totalItems,
                    averagePrice,
                    minPrice,
                    maxPrice,
                },
                timestamp: getCurrentLocalDateTime(),
            };
        }
        catch (error) {
            logger.error(`Failed to get menu statistics: ${error instanceof Error ? error.message : error}`, 'MenuItemModel');
            return {
                success: false,
                error: error instanceof Error
                    ? error.message
                    : 'Failed to get menu statistics',
                timestamp: getCurrentLocalDateTime(),
            };
        }
    }
}
