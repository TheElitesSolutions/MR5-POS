/**
 * Add-On Controller for mr5-POS
 *
 * Provides type-safe IPC handlers for add-on management operations
 * Integrates with AddonService and AddonCacheService for enhanced performance
 */
import { BaseController } from './baseController';
import { AddonService } from '../services/AddonService';
import { AddonCacheService } from '../services/AddonCacheService';
import { AddonErrorHandler, isAddonError, } from '../errors/AddonError';
import { CreateAddonSchema, UpdateAddonSchema, CreateAddonGroupSchema, UpdateAddonGroupSchema, } from '../../shared/validation/addon-schemas';
import { prisma } from '../db/prisma-wrapper';
import { logInfo, logError } from '../error-handler';
/**
 * AddonController - Type-safe IPC handlers for add-on operations
 *
 * Features:
 * - Comprehensive input validation using Zod schemas
 * - Transaction-safe operations via AddonService
 * - Performance caching via AddonCacheService
 * - Standardized error handling and responses
 * - Full integration with MR5 IPC patterns
 */
export class AddonController extends BaseController {
    constructor() {
        super();
        this.addonService = new AddonService(prisma);
        // Initialize cache service with configuration
        this.cacheService = new AddonCacheService(this.addonService, {
            ttl: {
                categoryAddons: 300, // 5 minutes
                addonGroups: 600, // 10 minutes
                addons: 300, // 5 minutes
            },
            enabled: process.env.NODE_ENV !== 'test', // Disable caching in tests
        });
        // Initialize handlers
        // this.initialize(); // Removed: StartupManager calls initialize() explicitly
    }
    /**
     * Initialize the controller and register all IPC handlers
     */
    initialize() {
        this.registerHandlers();
        logInfo('AddonController initialized with all IPC handlers', 'AddonController');
    }
    /**
     * Register all IPC handlers for add-on operations
     */
    registerHandlers() {
        // Add-on Group Management
        this.registerHandler('addon:createGroup', this.withErrorHandling(this.createAddonGroup.bind(this)));
        this.registerHandler('addon:getGroup', this.withErrorHandling(this.getAddonGroup.bind(this)));
        this.registerHandler('addon:getGroups', this.withErrorHandling(this.getAddonGroups.bind(this)));
        this.registerHandler('addon:updateGroup', this.withErrorHandling(this.updateAddonGroup.bind(this)));
        this.registerHandler('addon:deleteGroup', this.withErrorHandling(this.deleteAddonGroup.bind(this)));
        // Add-on Management
        this.registerHandler('addon:create', this.withErrorHandling(this.createAddon.bind(this)));
        this.registerHandler('addon:get', this.withErrorHandling(this.getAddon.bind(this)));
        this.registerHandler('addon:getByGroup', this.withErrorHandling(this.getAddonsByGroup.bind(this)));
        this.registerHandler('addon:getByCategory', this.withErrorHandling(this.getAddonsByCategory.bind(this)));
        this.registerHandler('addon:update', this.withErrorHandling(this.updateAddon.bind(this)));
        this.registerHandler('addon:delete', this.withErrorHandling(this.deleteAddon.bind(this)));
        // Category Assignment Management
        this.registerHandler('addon:assignToCategory', this.withErrorHandling(this.assignGroupToCategory.bind(this)));
        this.registerHandler('addon:unassignFromCategory', this.withErrorHandling(this.unassignGroupFromCategory.bind(this)));
        this.registerHandler('addon:getCategoryAssignments', this.withErrorHandling(this.getCategoryAssignments.bind(this)));
        // ✅ NEW: Get addon groups with their addons for a specific category
        this.registerHandler('addon:getCategoryAddonGroups', this.withErrorHandling(this.getCategoryAddonGroups.bind(this)));
        // Order Integration
        this.registerHandler('addon:addToOrderItem', this.withErrorHandling(this.addAddonsToOrderItem.bind(this)));
        this.registerHandler('addon:removeFromOrderItem', this.withErrorHandling(this.removeAddonFromOrderItem.bind(this)));
        this.registerHandler('addon:getOrderItemAddons', this.withErrorHandling(this.getOrderItemAddons.bind(this)));
        this.registerHandler('addon:scaleAddonQuantities', this.withErrorHandling(this.scaleAddonQuantities.bind(this)));
        // Cache Management
        this.registerHandler('addon:invalidateCache', this.withErrorHandling(this.invalidateCache.bind(this)));
        this.registerHandler('addon:getCacheStats', this.withErrorHandling(this.getCacheStats.bind(this)));
        this.registerHandler('addon:warmUpCache', this.withErrorHandling(this.warmUpCache.bind(this)));
        logInfo('Registered all addon IPC handlers', 'AddonController');
    }
    /**
     * ===== ADD-ON GROUP MANAGEMENT HANDLERS =====
     */
    /**
     * Create new add-on group
     */
    async createAddonGroup(_event, data) {
        try {
            // Validate input
            const validatedData = CreateAddonGroupSchema.parse(data);
            const result = await this.addonService.createAddonGroup(validatedData);
            if (!result.success) {
                return this.createErrorResponse(result.error.message);
            }
            // Invalidate related caches
            await this.cacheService.invalidateAddonGroupCache();
            return this.createSuccessResponse(result.data, 'Add-on group created successfully');
        }
        catch (error) {
            logError(error, 'AddonController.createAddonGroup');
            return this.createErrorResponse(error instanceof Error ? error.message : 'Failed to create add-on group');
        }
    }
    /**
     * Get add-on group by ID
     */
    async getAddonGroup(_event, id) {
        try {
            if (!id || typeof id !== 'string') {
                return this.createErrorResponse('Valid add-on group ID is required');
            }
            const result = await this.addonService.getAddonGroup(id);
            if (!result.success) {
                return this.createErrorResponse(result.error.message);
            }
            return this.createSuccessResponse(result.data);
        }
        catch (error) {
            logError(error, 'AddonController.getAddonGroup');
            return this.createErrorResponse(error instanceof Error ? error.message : 'Failed to get add-on group');
        }
    }
    /**
     * Get all add-on groups with optional filtering
     */
    async getAddonGroups(_event, filters) {
        try {
            const useCache = filters?.useCache !== false; // Default to true
            const result = await this.cacheService.getAddonGroups({
                isActive: filters?.isActive,
                categoryId: filters?.categoryId,
                includeAddons: filters?.includeAddons,
            }, useCache);
            if (!result.success) {
                return this.createErrorResponse(result.error.message);
            }
            return this.createSuccessResponse(result.data);
        }
        catch (error) {
            logError(error, 'AddonController.getAddonGroups');
            return this.createErrorResponse(error instanceof Error ? error.message : 'Failed to get add-on groups');
        }
    }
    /**
     * Update add-on group
     */
    async updateAddonGroup(_event, request) {
        try {
            // Validate full request first (schema requires id)
            const validatedData = UpdateAddonGroupSchema.parse(request);
            const { id, ...updateData } = validatedData;
            if (!id || typeof id !== 'string') {
                return this.createErrorResponse('Valid add-on group ID is required');
            }
            const result = await this.addonService.updateAddonGroup(id, updateData);
            if (!result.success) {
                return this.createErrorResponse(result.error.message);
            }
            // Invalidate related caches
            await this.cacheService.invalidateAddonGroupCache(id);
            return this.createSuccessResponse(result.data, 'Add-on group updated successfully');
        }
        catch (error) {
            logError(error, 'AddonController.updateAddonGroup');
            return this.createErrorResponse(error instanceof Error ? error.message : 'Failed to update add-on group');
        }
    }
    /**
     * Delete add-on group (soft delete)
     */
    async deleteAddonGroup(_event, id) {
        try {
            if (!id || typeof id !== 'string') {
                return this.createErrorResponse('Valid add-on group ID is required');
            }
            const result = await this.addonService.deleteAddonGroup(id);
            if (!result.success) {
                return this.createErrorResponse(result.error.message);
            }
            // Invalidate related caches
            await this.cacheService.invalidateAddonGroupCache(id);
            return this.createSuccessResponse(result.data, 'Add-on group deleted successfully');
        }
        catch (error) {
            logError(error, 'AddonController.deleteAddonGroup');
            return this.createErrorResponse(error instanceof Error ? error.message : 'Failed to delete add-on group');
        }
    }
    /**
     * ===== ADD-ON MANAGEMENT HANDLERS =====
     */
    /**
     * Create new add-on
     */
    async createAddon(_event, data) {
        try {
            const validatedData = CreateAddonSchema.parse(data);
            const result = await this.addonService.createAddon(validatedData);
            if (!result.success) {
                return this.createErrorResponse(result.error.message);
            }
            // Invalidate related caches
            await this.cacheService.invalidateAddonGroupCache(validatedData.addonGroupId);
            return this.createSuccessResponse(result.data, 'Add-on created successfully');
        }
        catch (error) {
            logError(error, 'AddonController.createAddon');
            return this.createErrorResponse(error instanceof Error ? error.message : 'Failed to create add-on');
        }
    }
    /**
     * Get add-on by ID
     */
    async getAddon(_event, id) {
        try {
            if (!id || typeof id !== 'string') {
                return this.createErrorResponse('Valid add-on ID is required');
            }
            const result = await this.addonService.getAddon(id);
            if (!result.success) {
                return this.createErrorResponse(result.error.message);
            }
            return this.createSuccessResponse(result.data);
        }
        catch (error) {
            logError(error, 'AddonController.getAddon');
            return this.createErrorResponse(error instanceof Error ? error.message : 'Failed to get add-on');
        }
    }
    /**
     * Get add-ons by group ID
     */
    async getAddonsByGroup(_event, groupId) {
        try {
            if (!groupId || typeof groupId !== 'string') {
                return this.createErrorResponse('Valid group ID is required');
            }
            const result = await this.addonService.getAddonsByGroup(groupId);
            if (!result.success) {
                return this.createErrorResponse(result.error.message);
            }
            return this.createSuccessResponse(result.data);
        }
        catch (error) {
            logError(error, 'AddonController.getAddonsByGroup');
            return this.createErrorResponse(error instanceof Error
                ? error.message
                : 'Failed to get add-ons by group');
        }
    }
    /**
     * Get add-ons by category ID (with caching)
     */
    async getAddonsByCategory(_event, categoryId, useCache = true) {
        try {
            if (!categoryId || typeof categoryId !== 'string') {
                return this.createErrorResponse('Valid category ID is required');
            }
            const result = await this.cacheService.getCategoryAddons(categoryId, useCache);
            if (!result.success) {
                return this.createErrorResponse(result.error.message);
            }
            return this.createSuccessResponse(result.data);
        }
        catch (error) {
            logError(error, 'AddonController.getAddonsByCategory');
            return this.createErrorResponse(error instanceof Error
                ? error.message
                : 'Failed to get add-ons by category');
        }
    }
    /**
     * Update add-on
     */
    async updateAddon(_event, request) {
        try {
            // ✅ FIX: Validate the full request (including id) first
            const validatedData = UpdateAddonSchema.parse(request);
            const { id, ...updateData } = validatedData;
            if (!id || typeof id !== 'string') {
                return this.createErrorResponse('Valid add-on ID is required');
            }
            const result = await this.addonService.updateAddon(id, updateData);
            if (!result.success) {
                return this.createErrorResponse(result.error.message);
            }
            // Invalidate related caches
            await this.cacheService.invalidateAddonGroupCache();
            return this.createSuccessResponse(result.data, 'Add-on updated successfully');
        }
        catch (error) {
            logError(error, 'AddonController.updateAddon');
            return this.createErrorResponse(error instanceof Error ? error.message : 'Failed to update add-on');
        }
    }
    /**
     * Delete add-on (soft delete)
     */
    async deleteAddon(_event, id) {
        try {
            if (!id || typeof id !== 'string') {
                return this.createErrorResponse('Valid add-on ID is required');
            }
            const result = await this.addonService.deleteAddon(id);
            if (!result.success) {
                return this.createErrorResponse(result.error.message);
            }
            // Invalidate related caches
            await this.cacheService.invalidateAddonGroupCache();
            return this.createSuccessResponse(result.data, 'Add-on deleted successfully');
        }
        catch (error) {
            logError(error, 'AddonController.deleteAddon');
            return this.createErrorResponse(error instanceof Error ? error.message : 'Failed to delete add-on');
        }
    }
    /**
     * ===== ORDER INTEGRATION HANDLERS =====
     */
    /**
     * Add add-ons to order item with transaction safety
     */
    async addAddonsToOrderItem(_event, request) {
        try {
            console.log('🔍 [AddonController] addAddonsToOrderItem IPC called', {
                orderItemId: request.orderItemId,
                selectionsCount: request.addonSelections?.length || 0,
                selections: request.addonSelections?.map(s => ({
                    addonId: s.addonId,
                    quantity: s.quantity,
                    unitPrice: s.unitPrice
                }))
            });
            const { orderItemId, addonSelections } = request;
            if (!orderItemId || typeof orderItemId !== 'string') {
                console.error('❌ [AddonController] Invalid order item ID');
                return this.createErrorResponse('Valid order item ID is required');
            }
            if (!Array.isArray(addonSelections) || addonSelections.length === 0) {
                console.error('❌ [AddonController] Invalid addon selections');
                return this.createErrorResponse('At least one add-on selection is required');
            }
            const result = await this.addonService.addAddonsToOrderItem(orderItemId, addonSelections);
            if (!result.success) {
                const errorMessage = result.error.message;
                const errorCode = result.error?.code;
                const errorStatusCode = result.error?.statusCode;
                console.error('❌ [AddonController] Service returned error', {
                    errorMessage,
                    errorCode,
                    errorStatusCode
                });
                return this.createErrorResponse(errorMessage);
            }
            console.log(`✅ [AddonController] Successfully added ${result.data?.length || 0} addons`);
            return this.createSuccessResponse(result.data, 'Add-ons added to order item successfully');
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            const errorStack = error instanceof Error ? error.stack : undefined;
            console.error('❌ [AddonController] Exception in addAddonsToOrderItem', {
                error: errorMsg,
                stack: errorStack
            });
            logError(error, 'AddonController.addAddonsToOrderItem');
            return this.createErrorResponse(error instanceof Error
                ? error.message
                : 'Failed to add add-ons to order item');
        }
    }
    /**
     * Remove add-on from order item with transaction safety
     */
    async removeAddonFromOrderItem(_event, request) {
        try {
            const { orderItemId, addonId } = request;
            if (!orderItemId || typeof orderItemId !== 'string') {
                return this.createErrorResponse('Valid order item ID is required');
            }
            if (!addonId || typeof addonId !== 'string') {
                return this.createErrorResponse('Valid add-on ID is required');
            }
            const result = await this.addonService.removeAddonFromOrderItem(orderItemId, addonId);
            if (!result.success) {
                return this.createErrorResponse(result.error.message);
            }
            return this.createSuccessResponse(result.data, 'Add-on removed from order item successfully');
        }
        catch (error) {
            logError(error, 'AddonController.removeAddonFromOrderItem');
            return this.createErrorResponse(error instanceof Error
                ? error.message
                : 'Failed to remove add-on from order item');
        }
    }
    /**
     * Get add-ons for order item
     */
    async getOrderItemAddons(_event, orderItemId) {
        try {
            if (!orderItemId || typeof orderItemId !== 'string') {
                return this.createErrorResponse('Valid order item ID is required');
            }
            const result = await this.addonService.getOrderItemAddons(orderItemId);
            if (!result.success) {
                return this.createErrorResponse(result.error.message);
            }
            return this.createSuccessResponse(result.data);
        }
        catch (error) {
            logError(error, 'AddonController.getOrderItemAddons');
            return this.createErrorResponse(error instanceof Error
                ? error.message
                : 'Failed to get order item add-ons');
        }
    }
    /**
     * Scale addon quantities proportionally when item quantity changes
     */
    async scaleAddonQuantities(_event, request) {
        try {
            const { orderItemId, quantityToAdd } = request;
            if (!orderItemId || typeof orderItemId !== 'string') {
                return this.createErrorResponse('Valid order item ID is required');
            }
            if (typeof quantityToAdd !== 'number' || quantityToAdd === 0) {
                return this.createErrorResponse('Valid quantity to add is required');
            }
            const result = await this.addonService.scaleAddonQuantities(orderItemId, quantityToAdd);
            if (!result.success) {
                return this.createErrorResponse(result.error.message);
            }
            return this.createSuccessResponse(result.data, 'Addon quantities scaled successfully');
        }
        catch (error) {
            logError(error, 'AddonController.scaleAddonQuantities');
            return this.createErrorResponse(error instanceof Error
                ? error.message
                : 'Failed to scale addon quantities');
        }
    }
    /**
     * ===== CACHE MANAGEMENT HANDLERS =====
     */
    /**
     * Invalidate specific or all caches
     */
    async invalidateCache(_event, options) {
        try {
            const { type = 'all', id } = options || {};
            switch (type) {
                case 'category':
                    if (id) {
                        await this.cacheService.invalidateCategoryCache(id);
                    }
                    else {
                        return this.createErrorResponse('Category ID is required for category cache invalidation');
                    }
                    break;
                case 'groups':
                    await this.cacheService.invalidateAddonGroupCache(id);
                    break;
                case 'all':
                default:
                    await this.cacheService.invalidateAllCaches();
                    break;
            }
            return this.createSuccessResponse({ invalidated: true }, 'Cache invalidated successfully');
        }
        catch (error) {
            logError(error, 'AddonController.invalidateCache');
            return this.createErrorResponse(error instanceof Error ? error.message : 'Failed to invalidate cache');
        }
    }
    /**
     * Get cache statistics
     */
    async getCacheStats(_event) {
        try {
            const stats = await this.cacheService.getCacheStats();
            return this.createSuccessResponse(stats);
        }
        catch (error) {
            logError(error, 'AddonController.getCacheStats');
            return this.createErrorResponse(error instanceof Error ? error.message : 'Failed to get cache stats');
        }
    }
    /**
     * Warm up cache for popular categories
     */
    async warmUpCache(_event, categoryIds) {
        try {
            if (!Array.isArray(categoryIds)) {
                return this.createErrorResponse('Category IDs array is required');
            }
            await this.cacheService.warmUpCache(categoryIds);
            return this.createSuccessResponse({ warmedUp: true }, `Cache warmed up for ${categoryIds.length} categories`);
        }
        catch (error) {
            logError(error, 'AddonController.warmUpCache');
            return this.createErrorResponse(error instanceof Error ? error.message : 'Failed to warm up cache');
        }
    }
    /**
     * ===== CATEGORY ASSIGNMENT HANDLERS =====
     */
    /**
     * Assign addon group to category
     */
    async assignGroupToCategory(_event, categoryId, addonGroupId, sortOrder) {
        try {
            if (!categoryId || !addonGroupId) {
                return this.createErrorResponse('Category ID and Addon Group ID are required');
            }
            const result = await this.addonService.assignGroupToCategory(categoryId, addonGroupId, sortOrder || 0);
            if (!result.success) {
                return this.createErrorResponse(result.error.message);
            }
            // Invalidate related caches
            await this.cacheService.invalidateAddonGroupCache();
            return this.createSuccessResponse(result.data, 'Add-on group assigned to category successfully');
        }
        catch (error) {
            logError(error, 'AddonController.assignGroupToCategory');
            return this.createErrorResponse(error instanceof Error
                ? error.message
                : 'Failed to assign group to category');
        }
    }
    /**
     * Unassign addon group from category
     */
    async unassignGroupFromCategory(_event, categoryId, addonGroupId) {
        try {
            if (!categoryId || !addonGroupId) {
                return this.createErrorResponse('Category ID and Addon Group ID are required');
            }
            const result = await this.addonService.unassignGroupFromCategory(categoryId, addonGroupId);
            if (!result.success) {
                return this.createErrorResponse(result.error.message);
            }
            // Invalidate related caches
            await this.cacheService.invalidateAddonGroupCache();
            return this.createSuccessResponse(result.data, 'Add-on group unassigned from category successfully');
        }
        catch (error) {
            logError(error, 'AddonController.unassignGroupFromCategory');
            return this.createErrorResponse(error instanceof Error
                ? error.message
                : 'Failed to unassign group from category');
        }
    }
    /**
     * Get category assignments
     */
    async getCategoryAssignments(_event, categoryId) {
        try {
            const result = await this.addonService.getCategoryAssignments();
            if (!result.success) {
                return this.createErrorResponse(result.error.message);
            }
            // Filter by categoryId if provided
            let assignments = result.data;
            if (categoryId) {
                assignments = assignments.filter(a => a.categoryId === categoryId);
            }
            return this.createSuccessResponse(assignments);
        }
        catch (error) {
            logError(error, 'AddonController.getCategoryAssignments');
            return this.createErrorResponse(error instanceof Error
                ? error.message
                : 'Failed to get category assignments');
        }
    }
    /**
     * ✅ NEW: Get addon groups with their addons for a specific category
     * Used by the POS addon selection step
     */
    async getCategoryAddonGroups(_event, params) {
        try {
            const { categoryId, includeInactive = false } = params;
            if (!categoryId || typeof categoryId !== 'string') {
                return this.createErrorResponse('Valid category ID is required');
            }
            // Get addon groups assigned to this category
            const assignments = await this.addonService.getCategoryAssignments();
            if (!assignments.success) {
                return this.createErrorResponse(assignments.error.message);
            }
            // Filter to only this category and active assignments
            const categoryAssignments = assignments.data.filter(a => a.categoryId === categoryId && (includeInactive || a.isActive));
            if (categoryAssignments.length === 0) {
                // No addon groups assigned to this category
                return this.createSuccessResponse({ groups: [], addons: [] });
            }
            // Get the addon group IDs
            const addonGroupIds = categoryAssignments.map(a => a.addonGroupId);
            // Fetch the addon groups with their addons
            const groups = [];
            const allAddons = [];
            for (const groupId of addonGroupIds) {
                const groupResult = await this.addonService.getAddonGroup(groupId);
                if (groupResult.success && groupResult.data) {
                    groups.push(groupResult.data);
                    // Get addons for this group
                    const addonsResult = await this.addonService.getAddonsByGroup(groupId);
                    if (addonsResult.success && addonsResult.data) {
                        const filteredAddons = includeInactive
                            ? addonsResult.data
                            : addonsResult.data.filter((a) => a.isActive);
                        allAddons.push(...filteredAddons);
                    }
                }
            }
            return this.createSuccessResponse({
                groups,
                addons: allAddons,
            });
        }
        catch (error) {
            logError(error, 'AddonController.getCategoryAddonGroups');
            return this.createErrorResponse(error instanceof Error
                ? error.message
                : 'Failed to get category addon groups');
        }
    }
    /**
     * Enhanced error handling wrapper
     */
    withErrorHandling(handler) {
        return async (...args) => {
            try {
                return await handler(...args);
            }
            catch (error) {
                // Use our enhanced error handling
                if (isAddonError(error)) {
                    const formattedError = AddonErrorHandler.formatForApi(error);
                    return {
                        success: false,
                        error: formattedError.error.message,
                        timestamp: formattedError.error.timestamp,
                    };
                }
                const genericError = AddonErrorHandler.formatForApi(error);
                return {
                    success: false,
                    error: genericError.error.message,
                    timestamp: genericError.error.timestamp,
                };
            }
        };
    }
    /**
     * Cleanup resources when shutting down
     */
    async shutdown() {
        try {
            await this.cacheService.disconnect();
            this.unregisterHandlers();
            logInfo('AddonController shutdown completed', 'AddonController');
        }
        catch (error) {
            logError(error, 'AddonController.shutdown');
        }
    }
}
