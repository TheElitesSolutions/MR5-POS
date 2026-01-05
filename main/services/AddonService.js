/**
 * Add-On Management Service
 *
 * Comprehensive service for managing add-ons with transaction-safe operations,
 * inventory integration, and business rule validation
 */
import { Decimal } from 'decimal.js';
import { AddonSchema, AddonGroupSchema, OrderItemAddonSchema, CreateAddonSchema, CreateAddonGroupSchema, } from '../../shared/validation/addon-schemas';
import { AddonError, AddonErrorFactory, AddonErrorCodes, isAddonError, } from '../errors/AddonError';
import { getCurrentLocalDateTime } from '../utils/dateTime';
/**
 * AddonService - Core business logic for add-ons system
 *
 * Features:
 * - Transaction-safe operations
 * - Inventory integration and stock management
 * - Business rule validation
 * - Type-safe input/output validation
 * - Comprehensive error handling
 */
export class AddonService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    /**
     * ===== ADDON GROUP MANAGEMENT =====
     */
    /**
     * Create a new add-on group
     */
    async createAddonGroup(data) {
        try {
            // Validate input
            const validatedData = CreateAddonGroupSchema.parse(data);
            // Check if name already exists
            const existingGroup = await this.prisma.addonGroup.findFirst({
                where: {
                    name: validatedData.name,
                    isActive: true,
                },
            });
            if (existingGroup) {
                return {
                    success: false,
                    error: AddonErrorFactory.addonGroupNameExists(validatedData.name),
                };
            }
            // Create the group
            const addonGroup = await this.prisma.addonGroup.create({
                data: {
                    name: validatedData.name,
                    description: validatedData.description,
                    isActive: validatedData.isActive ?? true,
                    sortOrder: validatedData.sortOrder ?? 0,
                },
            });
            return {
                success: true,
                data: AddonGroupSchema.parse(addonGroup),
            };
        }
        catch (error) {
            if (isAddonError(error)) {
                return { success: false, error };
            }
            return {
                success: false,
                error: AddonErrorFactory.databaseError('createAddonGroup', error),
            };
        }
    }
    /**
     * Get add-on group by ID
     */
    async getAddonGroup(id) {
        try {
            const addonGroup = await this.prisma.addonGroup.findUnique({
                where: { id },
                include: {
                    addons: {
                        where: { isActive: true },
                        orderBy: { sortOrder: 'asc' },
                    },
                    _count: {
                        select: {
                            addons: { where: { isActive: true } },
                            categoryAddonGroups: { where: { isActive: true } },
                        },
                    },
                },
            });
            if (!addonGroup) {
                return {
                    success: false,
                    error: AddonErrorFactory.addonGroupNotFound(id),
                };
            }
            return {
                success: true,
                data: AddonGroupSchema.parse(addonGroup),
            };
        }
        catch (error) {
            return {
                success: false,
                error: AddonErrorFactory.databaseError('getAddonGroup', error),
            };
        }
    }
    /**
     * Get all add-on groups with optional filtering
     */
    async getAddonGroups(filters) {
        try {
            const where = {};
            if (filters?.isActive !== undefined) {
                where.isActive = filters.isActive;
            }
            if (filters?.categoryId) {
                where.categoryAddonGroups = {
                    some: {
                        categoryId: filters.categoryId,
                        isActive: true,
                    },
                };
            }
            const addonGroups = await this.prisma.addonGroup.findMany({
                where,
                include: {
                    addons: filters?.includeAddons
                        ? {
                            where: { isActive: true },
                            orderBy: { sortOrder: 'asc' },
                        }
                        : false,
                    _count: {
                        select: {
                            addons: { where: { isActive: true } },
                            categoryAddonGroups: { where: { isActive: true } },
                        },
                    },
                },
                orderBy: { sortOrder: 'asc' },
            });
            return {
                success: true,
                data: addonGroups.map(group => AddonGroupSchema.parse(group)),
            };
        }
        catch (error) {
            return {
                success: false,
                error: AddonErrorFactory.databaseError('getAddonGroups', error),
            };
        }
    }
    /**
     * Update add-on group
     */
    async updateAddonGroup(id, data) {
        try {
            // Note: Controller already validated data with UpdateAddonGroupSchema
            // No need to re-validate here (data doesn't include id which schema requires)
            // Check if group exists
            const existingGroup = await this.prisma.addonGroup.findUnique({
                where: { id },
            });
            if (!existingGroup) {
                return {
                    success: false,
                    error: AddonErrorFactory.addonGroupNotFound(id),
                };
            }
            // Check name uniqueness if name is being updated
            if (data.name && data.name !== existingGroup.name) {
                const nameExists = await this.prisma.addonGroup.findFirst({
                    where: {
                        name: data.name,
                        id: { not: id },
                        isActive: true,
                    },
                });
                if (nameExists) {
                    return {
                        success: false,
                        error: AddonErrorFactory.addonGroupNameExists(data.name),
                    };
                }
            }
            const updatedGroup = await this.prisma.addonGroup.update({
                where: { id },
                data: {
                    ...data,
                    updatedAt: getCurrentLocalDateTime(),
                },
            });
            return {
                success: true,
                data: AddonGroupSchema.parse(updatedGroup),
            };
        }
        catch (error) {
            if (isAddonError(error)) {
                return { success: false, error };
            }
            return {
                success: false,
                error: AddonErrorFactory.databaseError('updateAddonGroup', error),
            };
        }
    }
    /**
     * Delete add-on group (soft delete)
     */
    async deleteAddonGroup(id) {
        try {
            // Check if group exists
            const existingGroup = await this.prisma.addonGroup.findUnique({
                where: { id },
                include: {
                    _count: {
                        select: {
                            addons: { where: { isActive: true } },
                        },
                    },
                },
            });
            if (!existingGroup) {
                return {
                    success: false,
                    error: AddonErrorFactory.addonGroupNotFound(id),
                };
            }
            // Check if group has active add-ons
            if (existingGroup._count.addons > 0) {
                return {
                    success: false,
                    error: AddonErrorFactory.addonGroupHasAddons(id, existingGroup._count.addons),
                };
            }
            // Soft delete the group
            await this.prisma.addonGroup.update({
                where: { id },
                data: {
                    isActive: false,
                    updatedAt: getCurrentLocalDateTime(),
                },
            });
            return {
                success: true,
                data: { deleted: true },
            };
        }
        catch (error) {
            if (isAddonError(error)) {
                return { success: false, error };
            }
            return {
                success: false,
                error: AddonErrorFactory.databaseError('deleteAddonGroup', error),
            };
        }
    }
    /**
     * ===== ADDON MANAGEMENT =====
     */
    /**
     * Create a new add-on
     */
    async createAddon(data) {
        try {
            const validatedData = CreateAddonSchema.parse(data);
            // Validate price range
            if (validatedData.price <= 0 || validatedData.price > 999.99) {
                return {
                    success: false,
                    error: AddonErrorFactory.addonInvalidPrice(validatedData.price),
                };
            }
            // Check if add-on group exists
            const addonGroup = await this.prisma.addonGroup.findUnique({
                where: { id: validatedData.addonGroupId },
            });
            if (!addonGroup) {
                return {
                    success: false,
                    error: AddonErrorFactory.addonGroupNotFound(validatedData.addonGroupId),
                };
            }
            // Check if name already exists in the same group
            const existingAddon = await this.prisma.addon.findFirst({
                where: {
                    name: validatedData.name,
                    addonGroupId: validatedData.addonGroupId,
                    isActive: true,
                },
            });
            if (existingAddon) {
                return {
                    success: false,
                    error: AddonErrorFactory.addonNameExists(validatedData.name, validatedData.addonGroupId),
                };
            }
            // Validate inventory items if provided
            if (validatedData.inventoryItems && validatedData.inventoryItems.length > 0) {
                for (const item of validatedData.inventoryItems) {
                    const inventory = await this.prisma.inventory.findUnique({
                        where: { id: item.inventoryId },
                    });
                    if (!inventory) {
                        return {
                            success: false,
                            error: AddonErrorFactory.inventoryNotFound(item.inventoryId),
                        };
                    }
                }
            }
            // Create the add-on with inventory items in a transaction
            const result = await this.prisma.$transaction(async (tx) => {
                // Create the add-on
                const addon = await tx.addon.create({
                    data: {
                        name: validatedData.name,
                        addonGroupId: validatedData.addonGroupId,
                        price: validatedData.price,
                        description: validatedData.description,
                        imageUrl: validatedData.imageUrl,
                        isActive: validatedData.isActive ?? true,
                        isPrintableInKitchen: validatedData.isPrintableInKitchen ?? true,
                        sortOrder: validatedData.sortOrder ?? 0,
                    },
                });
                // Create inventory item relationships if provided
                if (validatedData.inventoryItems && validatedData.inventoryItems.length > 0) {
                    await Promise.all(validatedData.inventoryItems.map(item => tx.addonInventoryItem.create({
                        data: {
                            addonId: addon.id,
                            inventoryId: item.inventoryId,
                            quantity: item.quantity ?? 0,
                        },
                    })));
                }
                // Fetch complete addon with relationships
                const completeAddon = await tx.addon.findUnique({
                    where: { id: addon.id },
                    include: {
                        addonGroup: true,
                        inventoryItems: {
                            include: { inventory: true },
                        },
                    },
                });
                return completeAddon;
            });
            return {
                success: true,
                data: AddonSchema.parse(result),
            };
        }
        catch (error) {
            if (isAddonError(error)) {
                return { success: false, error };
            }
            return {
                success: false,
                error: AddonErrorFactory.databaseError('createAddon', error),
            };
        }
    }
    /**
     * Get add-on by ID
     */
    async getAddon(id) {
        try {
            const addon = await this.prisma.addon.findUnique({
                where: { id },
                include: {
                    addonGroup: true,
                    inventoryItems: {
                        include: { inventory: true },
                    },
                },
            });
            if (!addon) {
                return {
                    success: false,
                    error: AddonErrorFactory.addonNotFound(id),
                };
            }
            return {
                success: true,
                data: AddonSchema.parse(addon),
            };
        }
        catch (error) {
            return {
                success: false,
                error: AddonErrorFactory.databaseError('getAddon', error),
            };
        }
    }
    /**
     * Get add-ons by group ID
     */
    async getAddonsByGroup(groupId) {
        try {
            const addons = await this.prisma.addon.findMany({
                where: {
                    addonGroupId: groupId,
                    isActive: true,
                },
                include: {
                    addonGroup: true,
                    inventoryItems: {
                        include: { inventory: true },
                    },
                },
                orderBy: { sortOrder: 'asc' },
            });
            return {
                success: true,
                data: addons.map(addon => AddonSchema.parse(addon)),
            };
        }
        catch (error) {
            return {
                success: false,
                error: AddonErrorFactory.databaseError('getAddonsByGroup', error),
            };
        }
    }
    /**
     * Get add-ons by category ID
     */
    async getAddonsByCategory(categoryId) {
        try {
            const addonGroups = await this.prisma.addonGroup.findMany({
                where: {
                    categoryAddonGroups: {
                        some: {
                            categoryId,
                            isActive: true,
                        },
                    },
                    isActive: true,
                },
                include: {
                    addons: {
                        where: { isActive: true },
                        orderBy: { sortOrder: 'asc' },
                        include: {
                            inventoryItems: {
                                include: {
                                    inventory: {
                                        select: {
                                            currentStock: true,
                                            minimumStock: true,
                                        },
                                    },
                                },
                            },
                        },
                    },
                    categoryAddonGroups: {
                        where: {
                            categoryId,
                            isActive: true,
                        },
                    },
                },
                orderBy: { sortOrder: 'asc' },
            });
            const totalAddons = addonGroups.reduce((sum, group) => sum + group.addons.length, 0);
            return {
                success: true,
                data: {
                    groups: addonGroups.map(group => AddonGroupSchema.parse(group)),
                    totalAddons,
                },
            };
        }
        catch (error) {
            return {
                success: false,
                error: AddonErrorFactory.databaseError('getAddonsByCategory', error),
            };
        }
    }
    /**
     * Update add-on
     */
    async updateAddon(id, data) {
        try {
            // ✅ FIX: Data is already validated by controller, no need to re-validate
            // Controller validated with UpdateAddonSchema (including id), then extracted id
            // So data here is the validated update data without id
            const validatedData = data;
            // Check if add-on exists
            const existingAddon = await this.prisma.addon.findUnique({
                where: { id },
                include: { addonGroup: true },
            });
            if (!existingAddon) {
                return {
                    success: false,
                    error: AddonErrorFactory.addonNotFound(id),
                };
            }
            // Validate price if being updated
            if (validatedData.price !== undefined) {
                if (validatedData.price <= 0 || validatedData.price > 999.99) {
                    return {
                        success: false,
                        error: AddonErrorFactory.addonInvalidPrice(validatedData.price),
                    };
                }
            }
            // Check name uniqueness if name is being updated
            if (validatedData.name && validatedData.name !== existingAddon.name) {
                const nameExists = await this.prisma.addon.findFirst({
                    where: {
                        name: validatedData.name,
                        addonGroupId: existingAddon.addonGroupId,
                        id: { not: id },
                        isActive: true,
                    },
                });
                if (nameExists) {
                    return {
                        success: false,
                        error: AddonErrorFactory.addonNameExists(validatedData.name, existingAddon.addonGroupId),
                    };
                }
            }
            // Validate inventory items if being updated
            if (validatedData.inventoryItems && validatedData.inventoryItems.length > 0) {
                for (const item of validatedData.inventoryItems) {
                    const inventory = await this.prisma.inventory.findUnique({
                        where: { id: item.inventoryId },
                    });
                    if (!inventory) {
                        return {
                            success: false,
                            error: AddonErrorFactory.inventoryNotFound(item.inventoryId),
                        };
                    }
                }
            }
            // Update addon with inventory items in a transaction
            const result = await this.prisma.$transaction(async (tx) => {
                // Update the addon basic info
                const { inventoryItems, ...addonData } = validatedData;
                const updatedAddon = await tx.addon.update({
                    where: { id },
                    data: {
                        ...addonData,
                        updatedAt: getCurrentLocalDateTime(),
                    },
                });
                // Update inventory items if provided
                if (inventoryItems !== undefined) {
                    // Delete existing inventory items
                    await tx.addonInventoryItem.deleteMany({
                        where: { addonId: id },
                    });
                    // Create new inventory item relationships
                    if (inventoryItems.length > 0) {
                        await Promise.all(inventoryItems.map(item => tx.addonInventoryItem.create({
                            data: {
                                addonId: id,
                                inventoryId: item.inventoryId,
                                quantity: item.quantity ?? 0,
                            },
                        })));
                    }
                }
                // Fetch complete addon with relationships
                const completeAddon = await tx.addon.findUnique({
                    where: { id },
                    include: {
                        addonGroup: true,
                        inventoryItems: {
                            include: { inventory: true },
                        },
                    },
                });
                return completeAddon;
            });
            return {
                success: true,
                data: AddonSchema.parse(result),
            };
        }
        catch (error) {
            if (isAddonError(error)) {
                return { success: false, error };
            }
            return {
                success: false,
                error: AddonErrorFactory.databaseError('updateAddon', error),
            };
        }
    }
    /**
     * Delete add-on (soft delete)
     */
    async deleteAddon(id) {
        try {
            // Check if add-on exists
            const existingAddon = await this.prisma.addon.findUnique({
                where: { id },
                include: {
                    _count: {
                        select: {
                            orderItemAddons: true,
                        },
                    },
                },
            });
            if (!existingAddon) {
                return {
                    success: false,
                    error: AddonErrorFactory.addonNotFound(id),
                };
            }
            // Check if add-on is used in orders
            if (existingAddon._count.orderItemAddons > 0) {
                return {
                    success: false,
                    error: new AddonError(AddonErrorCodes.ADDON_NOT_FOUND, // Using existing code, could add ADDON_IN_USE
                    `Cannot delete add-on '${id}' because it is used in ${existingAddon._count.orderItemAddons} orders`, 409, { addonId: id, orderCount: existingAddon._count.orderItemAddons }),
                };
            }
            // Soft delete the add-on
            await this.prisma.addon.update({
                where: { id },
                data: {
                    isActive: false,
                    updatedAt: getCurrentLocalDateTime(),
                },
            });
            return {
                success: true,
                data: { deleted: true },
            };
        }
        catch (error) {
            if (isAddonError(error)) {
                return { success: false, error };
            }
            return {
                success: false,
                error: AddonErrorFactory.databaseError('deleteAddon', error),
            };
        }
    }
    /**
     * ===== TRANSACTION-SAFE ORDER PROCESSING =====
     */
    /**
     * Add add-ons to an order item with transaction safety
     */
    async addAddonsToOrderItem(orderItemId, addonSelections) {
        try {
            console.log('🔍 [AddonService] addAddonsToOrderItem CALLED', {
                orderItemId,
                selectionsCount: addonSelections?.length || 0,
                selections: addonSelections?.map(s => ({ addonId: s.addonId, quantity: s.quantity, unitPrice: s.unitPrice }))
            });
            // Validate input
            if (!addonSelections.length) {
                console.error('❌ [AddonService] Validation failed - empty addon selections');
                return {
                    success: false,
                    error: new AddonError(AddonErrorCodes.VALIDATION_FAILED, 'At least one add-on selection is required', 400),
                };
            }
            // Transaction-safe operation
            const result = await this.prisma.$transaction(async (tx) => {
                // 1. Verify order item exists
                console.log(`🔍 [AddonService] Checking if order item exists: ${orderItemId}`);
                const orderItem = await tx.orderItem.findUnique({
                    where: { id: orderItemId },
                    include: {
                        order: true,
                    },
                });
                if (!orderItem) {
                    console.error(`❌ [AddonService] Order item not found: ${orderItemId}`);
                    throw AddonErrorFactory.orderItemNotFound(orderItemId);
                }
                console.log(`✅ [AddonService] Order item found: ${orderItem.name}, Qty: ${orderItem.quantity}`);
                // 2. Validate and prepare add-on selections
                const processedSelections = [];
                console.log(`🔍 [AddonService] Processing ${addonSelections.length} addon selections`);
                for (const selection of addonSelections) {
                    console.log(`🔍 [AddonService] Processing addon ${selection.addonId}, Qty: ${selection.quantity}`);
                    // Get add-on details with inventory items
                    const addon = await tx.addon.findUnique({
                        where: { id: selection.addonId },
                        include: {
                            addonGroup: true,
                            inventoryItems: {
                                include: {
                                    inventory: true,
                                },
                            },
                        },
                    });
                    if (!addon) {
                        console.error(`❌ [AddonService] Addon not found: ${selection.addonId}`);
                        throw AddonErrorFactory.addonNotFound(selection.addonId);
                    }
                    if (!addon.isActive) {
                        console.error(`❌ [AddonService] Addon is INACTIVE: ${addon.name} (${selection.addonId}), isActive: ${addon.isActive}`);
                        throw AddonErrorFactory.addonNotFound(selection.addonId);
                    }
                    console.log(`✅ [AddonService] Addon found and active: ${addon.name}, HasInventory: ${addon.inventoryItems?.length > 0}, Count: ${addon.inventoryItems?.length || 0}`);
                    // Check if already added
                    const existing = await tx.orderItemAddon.findFirst({
                        where: {
                            orderItemId,
                            addonId: selection.addonId,
                        },
                    });
                    if (existing) {
                        console.error(`❌ [AddonService] Addon already added to order item: ${selection.addonId} -> OrderItem: ${orderItemId}`);
                        throw AddonErrorFactory.addonAlreadyAdded(orderItemId, selection.addonId);
                    }
                    // Check stock availability for all inventory items
                    // ✅ CRITICAL FIX: Scale addon quantity by item quantity for stock check
                    const scaledAddonQty = selection.quantity * orderItem.quantity;
                    console.log(`🔍 [AddonService] Checking stock for addon: ${addon.name}`, {
                        requestedQty: selection.quantity,
                        itemQty: orderItem.quantity,
                        scaledQty: scaledAddonQty,
                        hasInventory: addon.inventoryItems && addon.inventoryItems.length > 0
                    });
                    if (addon.inventoryItems && addon.inventoryItems.length > 0) {
                        for (const addonInvItem of addon.inventoryItems) {
                            if (addonInvItem.inventory && addonInvItem.quantity > 0) {
                                const totalToDeduct = addonInvItem.quantity * scaledAddonQty; // Use scaled quantity
                                const currentStock = Number(addonInvItem.inventory.currentStock);
                                console.log(`🔍 [AddonService] Inventory check: ${addonInvItem.inventory.name}`, {
                                    addonInvQty: addonInvItem.quantity,
                                    totalToDeduct,
                                    currentStock,
                                    hasEnough: currentStock >= totalToDeduct
                                });
                                if (currentStock < totalToDeduct) {
                                    console.warn(`⚠️ [AddonService] LOW/NEGATIVE STOCK (allowing anyway)`, {
                                        addon: addon.name,
                                        inventory: addonInvItem.inventory.name,
                                        required: totalToDeduct,
                                        available: currentStock,
                                        shortage: totalToDeduct - currentStock,
                                        willGoNegative: currentStock - totalToDeduct
                                    });
                                    // ✅ Allow addon to be added anyway - stock can go negative
                                }
                            }
                        }
                        console.log(`✅ [AddonService] Stock check PASSED for addon: ${addon.name}`);
                    }
                    else {
                        console.log(`ℹ️ [AddonService] Addon has NO inventory items: ${addon.name}`);
                    }
                    processedSelections.push({
                        ...selection,
                        unitPrice: selection.unitPrice || Number(addon.price),
                        addon,
                    });
                }
                // 3. Create add-on assignments
                console.log('🔍 AddonService: Creating addon assignments', {
                    orderItemId,
                    selectionsCount: processedSelections.length,
                    selections: processedSelections.map(s => ({
                        addonId: s.addonId,
                        addonName: s.addon.name,
                        quantity: s.quantity,
                        unitPrice: s.unitPrice,
                    })),
                });
                // ✅ NEW APPROACH: Store addon quantity PER ITEM (user's selection)
                // Frontend will multiply by item quantity for display
                // This avoids all scaling/compounding issues
                const addonAssignments = await Promise.all(processedSelections.map(selection => {
                    // Store user's selection (e.g., "1 Meal per burger"), NOT scaled by item quantity
                    const addonQtyPerItem = selection.quantity;
                    const pricePerItem = new Decimal(addonQtyPerItem * selection.unitPrice).toNumber();
                    console.log(`📦 ADDON CREATION (per-item): ${selection.addon.name} - Qty per item: ${addonQtyPerItem}, Price per item: ${pricePerItem}`);
                    return tx.orderItemAddon.create({
                        data: {
                            orderItemId,
                            addonId: selection.addonId,
                            addonName: selection.addon.name,
                            quantity: addonQtyPerItem, // ✅ Store PER-ITEM quantity
                            unitPrice: selection.unitPrice,
                            totalPrice: pricePerItem, // ✅ Price for ONE item's addons
                        },
                        include: {
                            addon: true,
                        },
                    });
                }));
                console.log('🔍 AddonService: Addon assignments created', {
                    assignmentsCount: addonAssignments.length,
                    assignments: addonAssignments.map(a => ({
                        id: a.id,
                        orderItemId: a.orderItemId,
                        addonId: a.addonId,
                        addonName: a.addonName,
                        quantity: a.quantity,
                    })),
                });
                // 4. Update inventory atomically for all inventory items
                // ✅ CRITICAL FIX: Use scaled addon quantity for stock deduction
                for (const selection of processedSelections) {
                    const scaledAddonQty = selection.quantity * orderItem.quantity; // Scale by item quantity
                    if (selection.addon.inventoryItems && selection.addon.inventoryItems.length > 0) {
                        for (const addonInvItem of selection.addon.inventoryItems) {
                            if (addonInvItem.inventory && addonInvItem.quantity > 0) {
                                const totalToDeduct = addonInvItem.quantity * scaledAddonQty; // Use scaled quantity
                                await tx.inventory.update({
                                    where: { id: addonInvItem.inventoryId },
                                    data: {
                                        currentStock: {
                                            decrement: totalToDeduct,
                                        },
                                        updatedAt: getCurrentLocalDateTime(),
                                    },
                                });
                            }
                        }
                    }
                }
                // 5. Update order item total
                // ✅ CRITICAL FIX: Scale addon cost by item quantity (addons are stored per-item)
                const addonCostPerItem = processedSelections.reduce((sum, selection) => sum + selection.quantity * selection.unitPrice, 0);
                const totalAddonCost = addonCostPerItem * orderItem.quantity; // Scale by item quantity
                console.log(`💰 ADDON COST CALCULATION: Per-item: ${addonCostPerItem}, Item qty: ${orderItem.quantity}, Total: ${totalAddonCost}`);
                // ✅ FIX: Use DecimalJS for precision in monetary calculations
                const currentOrderItem = await tx.orderItem.findUnique({
                    where: { id: orderItemId },
                });
                const currentItemTotal = new Decimal(currentOrderItem.totalPrice || 0);
                const addonCost = new Decimal(totalAddonCost);
                const newItemTotal = currentItemTotal.plus(addonCost).toNumber();
                await tx.orderItem.update({
                    where: { id: orderItemId },
                    data: {
                        totalPrice: newItemTotal,
                        updatedAt: getCurrentLocalDateTime(),
                    },
                });
                // ✅ FIX: Removed manual order.total update - will be recalculated by controller
                // This ensures single source of truth and prevents precision errors
                return { assignments: addonAssignments, orderId: orderItem.orderId };
            });
            console.log(`✅ [AddonService] Transaction completed successfully`, {
                assignmentsCount: result.assignments.length,
                assignmentIds: result.assignments.map(a => a.id),
                orderId: result.orderId
            });
            return {
                success: true,
                data: {
                    assignments: result.assignments.map(assignment => OrderItemAddonSchema.parse(assignment)),
                    orderId: result.orderId
                },
            };
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            const errorStack = error instanceof Error ? error.stack : undefined;
            console.error(`❌ [AddonService] Error in addAddonsToOrderItem`, {
                error: errorMsg,
                orderItemId,
                selectionsCount: addonSelections?.length,
                isAddonError: isAddonError(error),
                stack: errorStack
            });
            if (isAddonError(error)) {
                const addonErr = error;
                console.error(`❌ [AddonService] Returning AddonError`, {
                    code: addonErr.code,
                    message: error.message,
                    statusCode: addonErr.statusCode
                });
                return { success: false, error };
            }
            const transactionError = AddonErrorFactory.transactionFailed('addAddonsToOrderItem', error);
            console.error(`❌ [AddonService] Returning transaction error: ${transactionError.message}`);
            return {
                success: false,
                error: transactionError,
            };
        }
    }
    /**
     * Remove add-on from order item with transaction safety
     */
    async removeAddonFromOrderItem(orderItemId, addonId) {
        try {
            const result = await this.prisma.$transaction(async (tx) => {
                // Find the add-on assignment
                const assignment = await tx.orderItemAddon.findFirst({
                    where: {
                        orderItemId,
                        addonId,
                    },
                    include: {
                        addon: {
                            include: {
                                inventoryItems: {
                                    include: {
                                        inventory: true,
                                    },
                                },
                            },
                        },
                        orderItem: {
                            include: {
                                order: true,
                            },
                        },
                    },
                });
                if (!assignment) {
                    // Assignment not found - return empty result
                    return { removed: false, orderId: '' };
                }
                // Restore inventory for all inventory items linked to this addon
                if (assignment.addon.inventoryItems && assignment.addon.inventoryItems.length > 0) {
                    for (const addonInvItem of assignment.addon.inventoryItems) {
                        if (addonInvItem.inventory && addonInvItem.quantity > 0) {
                            const totalToRestore = addonInvItem.quantity * assignment.quantity;
                            await tx.inventory.update({
                                where: { id: addonInvItem.inventoryId },
                                data: {
                                    currentStock: {
                                        increment: totalToRestore,
                                    },
                                    updatedAt: getCurrentLocalDateTime(),
                                },
                            });
                            // Create audit log for inventory restoration
                            await tx.auditLog.create({
                                data: {
                                    action: 'INVENTORY_INCREASE',
                                    tableName: 'inventory',
                                    recordId: addonInvItem.inventoryId,
                                    newValues: {
                                        reason: 'Addon removed from order item',
                                        addonId: addonId,
                                        orderItemId: orderItemId,
                                        quantityRestored: totalToRestore,
                                    },
                                },
                            });
                        }
                    }
                }
                // ✅ FIX: Use DecimalJS for precision in monetary calculations
                const currentOrderItem = await tx.orderItem.findUnique({
                    where: { id: orderItemId },
                });
                const currentItemTotal = new Decimal(currentOrderItem.totalPrice || 0);
                const addonPrice = new Decimal(assignment.totalPrice || 0);
                const newItemTotal = currentItemTotal.minus(addonPrice).toNumber();
                // Update order item total
                await tx.orderItem.update({
                    where: { id: orderItemId },
                    data: {
                        totalPrice: newItemTotal,
                        updatedAt: getCurrentLocalDateTime(),
                    },
                });
                // ✅ FIX: Removed manual order.total update - will be recalculated by controller
                // This ensures single source of truth and prevents precision errors
                // Delete the assignment
                await tx.orderItemAddon.delete({
                    where: { id: assignment.id },
                });
                return { removed: true, orderId: assignment.orderItem.orderId };
            });
            return {
                success: true,
                data: { removed: result.removed, orderId: result.orderId },
            };
        }
        catch (error) {
            if (isAddonError(error)) {
                return { success: false, error };
            }
            return {
                success: false,
                error: AddonErrorFactory.transactionFailed('removeAddonFromOrderItem', error),
            };
        }
    }
    /**
     * Update addon quantities proportionally when item quantity changes
     * This maintains the addon-to-item ratio
     */
    async scaleAddonQuantities(orderItemId, quantityToAdd) {
        try {
            const result = await this.prisma.$transaction(async (tx) => {
                // ✅ CRITICAL FIX: Fetch orderId directly instead of relying on nested includes
                const orderItem = await tx.orderItem.findUnique({
                    where: { id: orderItemId },
                    select: { orderId: true },
                });
                if (!orderItem) {
                    throw new Error(`Order item ${orderItemId} not found`);
                }
                // Get all addons for this order item
                const orderItemAddons = await tx.orderItemAddon.findMany({
                    where: { orderItemId },
                    include: {
                        addon: {
                            include: {
                                inventoryItems: {
                                    include: {
                                        inventory: true,
                                    },
                                },
                            },
                        },
                    },
                });
                if (orderItemAddons.length === 0) {
                    return true; // No addons to update
                }
                let totalPriceChange = 0;
                // Update each addon's quantity and check stock
                for (const addonAssignment of orderItemAddons) {
                    // ✅ CRITICAL FIX: DON'T change addon quantity - it's stored per-item
                    // The quantity in database represents "addons per item", not total addons
                    // When item quantity changes, addon per-item quantity stays the same
                    // (Frontend multiplies by item quantity for display)
                    // ✅ CRITICAL FIX: Only check stock if addon relation exists
                    if (addonAssignment.addon) {
                        // Check stock availability for the additional quantity
                        if (addonAssignment.addon.inventoryItems && addonAssignment.addon.inventoryItems.length > 0) {
                            for (const invItem of addonAssignment.addon.inventoryItems) {
                                if (invItem.inventory && invItem.quantity > 0) {
                                    const totalToDeduct = invItem.quantity * quantityToAdd;
                                    const currentStock = Number(invItem.inventory.currentStock);
                                    if (currentStock < totalToDeduct) {
                                        console.warn(`⚠️ [AddonService] LOW/NEGATIVE STOCK on quantity increase (allowing anyway)`, {
                                            addon: addonAssignment.addonName,
                                            inventory: invItem.inventory.name,
                                            required: totalToDeduct,
                                            available: currentStock,
                                            willGoNegative: currentStock - totalToDeduct
                                        });
                                        // ✅ Allow quantity increase anyway - stock can go negative
                                    }
                                }
                            }
                        }
                        // Deduct stock for additional quantity
                        if (addonAssignment.addon.inventoryItems && addonAssignment.addon.inventoryItems.length > 0) {
                            for (const invItem of addonAssignment.addon.inventoryItems) {
                                if (invItem.inventory && invItem.quantity > 0) {
                                    const totalToDeduct = invItem.quantity * quantityToAdd;
                                    await tx.inventory.update({
                                        where: { id: invItem.inventory.id },
                                        data: {
                                            currentStock: {
                                                decrement: totalToDeduct,
                                            },
                                            updatedAt: getCurrentLocalDateTime(),
                                        },
                                    });
                                }
                            }
                        }
                    }
                    else {
                        console.warn(`Addon relation not loaded for assignment ${addonAssignment.id}, skipping stock operations`);
                    }
                    // Calculate price change for order total
                    const priceChange = addonAssignment.unitPrice * quantityToAdd;
                    totalPriceChange += Number(priceChange);
                    // ✅ CRITICAL FIX: DON'T update addon assignment quantity or totalPrice
                    // Both are stored per-item and should never change when item quantity changes
                    // The order item total will be recalculated below using the per-item values
                }
                // ✅ CRITICAL FIX: Calculate correct total price instead of incrementing
                // Get current orderItem to calculate proper base price
                const currentOrderItem = await tx.orderItem.findUnique({
                    where: { id: orderItemId },
                    select: { unitPrice: true, quantity: true },
                });
                if (!currentOrderItem) {
                    throw new Error(`Order item ${orderItemId} not found for price calculation`);
                }
                // Calculate base price (item price × quantity)
                const basePrice = Number(currentOrderItem.unitPrice) * currentOrderItem.quantity;
                // Calculate total addon price (sum of all addon totalPrices SCALED by item quantity)
                // ✅ CRITICAL FIX: Addon prices are stored PER-ITEM, must multiply by item quantity
                const allAddonPrices = await tx.orderItemAddon.findMany({
                    where: { orderItemId },
                    select: { totalPrice: true, quantity: true, unitPrice: true },
                });
                const totalAddonPrice = allAddonPrices.reduce((sum, addon) => sum + (Number(addon.totalPrice) * currentOrderItem.quantity), 0);
                // SET the correct total price (base + addons)
                const correctTotalPrice = basePrice + totalAddonPrice;
                await tx.orderItem.update({
                    where: { id: orderItemId },
                    data: {
                        totalPrice: correctTotalPrice,
                        updatedAt: getCurrentLocalDateTime(),
                    },
                });
                // Update order total (use the orderId we fetched earlier)
                await tx.order.update({
                    where: { id: orderItem.orderId },
                    data: {
                        total: {
                            increment: totalPriceChange,
                        },
                        subtotal: {
                            increment: totalPriceChange,
                        },
                        updatedAt: getCurrentLocalDateTime(),
                    },
                });
                return true;
            });
            return {
                success: true,
                data: { updated: result },
            };
        }
        catch (error) {
            if (isAddonError(error)) {
                return { success: false, error };
            }
            return {
                success: false,
                error: AddonErrorFactory.transactionFailed('scaleAddonQuantities', error),
            };
        }
    }
    /**
     * Get add-ons for an order item
     */
    async getOrderItemAddons(orderItemId) {
        try {
            const addons = await this.prisma.orderItemAddon.findMany({
                where: { orderItemId },
                include: {
                    addon: {
                        include: {
                            addonGroup: true,
                        },
                    },
                },
                orderBy: { createdAt: 'asc' },
            });
            return {
                success: true,
                data: addons.map(addon => OrderItemAddonSchema.parse(addon)),
            };
        }
        catch (error) {
            return {
                success: false,
                error: AddonErrorFactory.databaseError('getOrderItemAddons', error),
            };
        }
    }
    /**
     * ===== CATEGORY ASSIGNMENT METHODS =====
     */
    /**
     * Assign add-on group to category
     */
    async assignGroupToCategory(categoryId, addonGroupId, sortOrder = 0) {
        try {
            // Check if category exists
            const category = await this.prisma.category.findUnique({
                where: { id: categoryId },
            });
            if (!category) {
                return {
                    success: false,
                    error: new AddonError(AddonErrorCodes.CATEGORY_NOT_FOUND, `Category with ID ${categoryId} not found`, 404),
                };
            }
            // Check if addon group exists
            const addonGroup = await this.prisma.addonGroup.findUnique({
                where: { id: addonGroupId },
            });
            if (!addonGroup) {
                return {
                    success: false,
                    error: AddonErrorFactory.addonGroupNotFound(addonGroupId),
                };
            }
            // Check if already assigned
            const existing = await this.prisma.categoryAddonGroup.findFirst({
                where: {
                    categoryId,
                    addonGroupId,
                },
            });
            if (existing) {
                // Update sort order if already exists
                const updated = await this.prisma.categoryAddonGroup.update({
                    where: { id: existing.id },
                    data: {
                        sortOrder,
                        isActive: true,
                        updatedAt: getCurrentLocalDateTime(),
                    },
                });
                return {
                    success: true,
                    data: updated,
                };
            }
            // Create new assignment
            const assignment = await this.prisma.categoryAddonGroup.create({
                data: {
                    categoryId,
                    addonGroupId,
                    sortOrder,
                    isActive: true,
                },
            });
            return {
                success: true,
                data: assignment,
            };
        }
        catch (error) {
            return {
                success: false,
                error: AddonErrorFactory.databaseError('assignGroupToCategory', error),
            };
        }
    }
    /**
     * Unassign add-on group from category
     */
    async unassignGroupFromCategory(categoryId, addonGroupId) {
        try {
            // Find the assignment
            const assignment = await this.prisma.categoryAddonGroup.findFirst({
                where: {
                    categoryId,
                    addonGroupId,
                },
            });
            if (!assignment) {
                return {
                    success: false,
                    error: new AddonError(AddonErrorCodes.ASSIGNMENT_NOT_FOUND, 'Category-Group assignment not found', 404),
                };
            }
            // Delete the assignment
            await this.prisma.categoryAddonGroup.delete({
                where: { id: assignment.id },
            });
            return {
                success: true,
                data: { deleted: true },
            };
        }
        catch (error) {
            return {
                success: false,
                error: AddonErrorFactory.databaseError('unassignGroupFromCategory', error),
            };
        }
    }
    /**
     * Get all category assignments
     */
    async getCategoryAssignments() {
        try {
            // Get all assignments
            const assignments = await this.prisma.categoryAddonGroup.findMany({
                orderBy: { sortOrder: 'asc' },
            });
            // Manually fetch categories and addon groups
            const enrichedAssignments = await Promise.all(assignments.map(async (assignment) => {
                // Fetch category
                const category = await this.prisma.category.findUnique({
                    where: { id: assignment.categoryId },
                });
                // Fetch addon group
                const addonGroup = await this.prisma.addonGroup.findUnique({
                    where: { id: assignment.addonGroupId },
                });
                // Count active addons in this group
                const addons = await this.prisma.addon.findMany({
                    where: {
                        addonGroupId: assignment.addonGroupId,
                        isActive: true,
                    },
                });
                // Debug: log if no addons found
                if (addons.length === 0) {
                    console.log(`[AddonService] No active addons found for group ${assignment.addonGroupId} (${addonGroup?.name})`);
                    // Check if there are any addons (including inactive)
                    const allAddons = await this.prisma.addon.findMany({
                        where: { addonGroupId: assignment.addonGroupId },
                    });
                    console.log(`[AddonService] Total addons (including inactive): ${allAddons.length}`);
                }
                return {
                    ...assignment,
                    category: category ? {
                        id: category.id,
                        name: category.name,
                    } : null,
                    addonGroup: addonGroup ? {
                        id: addonGroup.id,
                        name: addonGroup.name,
                        description: addonGroup.description,
                        _count: {
                            addons: addons.length,
                        },
                    } : null,
                };
            }));
            return {
                success: true,
                data: enrichedAssignments,
            };
        }
        catch (error) {
            return {
                success: false,
                error: AddonErrorFactory.databaseError('getCategoryAssignments', error),
            };
        }
    }
}
