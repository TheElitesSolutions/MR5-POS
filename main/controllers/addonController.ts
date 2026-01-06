/**
 * Add-On Controller for mr5-POS
 *
 * Provides type-safe IPC handlers for add-on management operations
 * Integrates with AddonService and AddonCacheService for enhanced performance
 */

import { IpcMainInvokeEvent } from 'electron';
import { BaseController } from './baseController';
import { IPCResponse } from '../types';
import { AddonService } from '../services/AddonService';
import { AddonCacheService } from '../services/AddonCacheService';
import { OrderModel } from '../models/Order';
import {
  AddonError,
  AddonErrorHandler,
  isAddonError,
} from '../errors/AddonError';
import {
  CreateAddonSchema,
  UpdateAddonSchema,
  CreateAddonGroupSchema,
  UpdateAddonGroupSchema,
  CreateCategoryAddonGroupSchema,
  UpdateCategoryAddonGroupSchema,
} from '../../shared/validation/addon-schemas';
import { prisma } from '../db/prisma-wrapper';
import { logInfo, logError } from '../error-handler';
import type { z } from 'zod';
import { getCurrentLocalDateTime } from '../utils/dateTime';

// Type definitions for API requests
type CreateAddonRequest = z.infer<typeof CreateAddonSchema>;
type UpdateAddonRequest = z.infer<typeof UpdateAddonSchema> & { id: string };
type CreateAddonGroupRequest = z.infer<typeof CreateAddonGroupSchema>;
type UpdateAddonGroupRequest = z.infer<typeof UpdateAddonGroupSchema> & {
  id: string;
};
type CreateCategoryAddonGroupRequest = z.infer<
  typeof CreateCategoryAddonGroupSchema
>;
type UpdateCategoryAddonGroupRequest = z.infer<
  typeof UpdateCategoryAddonGroupSchema
> & { id: string };

export interface AddonSelection {
  addonId: string;
  quantity: number;
  unitPrice?: number;
}

export interface AddAddonsToOrderItemRequest {
  orderItemId: string;
  addonSelections: AddonSelection[];
}

export interface RemoveAddonFromOrderItemRequest {
  orderItemId: string;
  addonId: string;
}

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
  private addonService: AddonService;
  private cacheService: AddonCacheService;
  private orderModel: OrderModel;

  constructor() {
    super();
    this.addonService = new AddonService(prisma);
    this.orderModel = new OrderModel(prisma as any);

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
  public override initialize(): void {
    this.registerHandlers();
    logInfo(
      'AddonController initialized with all IPC handlers',
      'AddonController'
    );
  }

  /**
   * Register all IPC handlers for add-on operations
   */
  protected registerHandlers(): void {
    // Add-on Group Management
    this.registerHandler(
      'addon:createGroup',
      this.withErrorHandling(this.createAddonGroup.bind(this))
    );
    this.registerHandler(
      'addon:getGroup',
      this.withErrorHandling(this.getAddonGroup.bind(this))
    );
    this.registerHandler(
      'addon:getGroups',
      this.withErrorHandling(this.getAddonGroups.bind(this))
    );
    this.registerHandler(
      'addon:updateGroup',
      this.withErrorHandling(this.updateAddonGroup.bind(this))
    );
    this.registerHandler(
      'addon:deleteGroup',
      this.withErrorHandling(this.deleteAddonGroup.bind(this))
    );

    // Add-on Management
    this.registerHandler(
      'addon:create',
      this.withErrorHandling(this.createAddon.bind(this))
    );
    this.registerHandler(
      'addon:get',
      this.withErrorHandling(this.getAddon.bind(this))
    );
    this.registerHandler(
      'addon:getByGroup',
      this.withErrorHandling(this.getAddonsByGroup.bind(this))
    );
    this.registerHandler(
      'addon:getByCategory',
      this.withErrorHandling(this.getAddonsByCategory.bind(this))
    );
    this.registerHandler(
      'addon:update',
      this.withErrorHandling(this.updateAddon.bind(this))
    );
    this.registerHandler(
      'addon:delete',
      this.withErrorHandling(this.deleteAddon.bind(this))
    );

    // Category Assignment Management
    this.registerHandler(
      'addon:assignToCategory',
      this.withErrorHandling(this.assignGroupToCategory.bind(this))
    );
    this.registerHandler(
      'addon:unassignFromCategory',
      this.withErrorHandling(this.unassignGroupFromCategory.bind(this))
    );
    this.registerHandler(
      'addon:getCategoryAssignments',
      this.withErrorHandling(this.getCategoryAssignments.bind(this))
    );
    // ✅ NEW: Get addon groups with their addons for a specific category
    this.registerHandler(
      'addon:getCategoryAddonGroups',
      this.withErrorHandling(this.getCategoryAddonGroups.bind(this))
    );

    // Order Integration
    this.registerHandler(
      'addon:addToOrderItem',
      this.withErrorHandling(this.addAddonsToOrderItem.bind(this))
    );
    this.registerHandler(
      'addon:removeFromOrderItem',
      this.withErrorHandling(this.removeAddonFromOrderItem.bind(this))
    );
    this.registerHandler(
      'addon:getOrderItemAddons',
      this.withErrorHandling(this.getOrderItemAddons.bind(this))
    );
    this.registerHandler(
      'addon:scaleAddonQuantities',
      this.withErrorHandling(this.scaleAddonQuantities.bind(this))
    );

    // Cache Management
    this.registerHandler(
      'addon:invalidateCache',
      this.withErrorHandling(this.invalidateCache.bind(this))
    );
    this.registerHandler(
      'addon:getCacheStats',
      this.withErrorHandling(this.getCacheStats.bind(this))
    );
    this.registerHandler(
      'addon:warmUpCache',
      this.withErrorHandling(this.warmUpCache.bind(this))
    );

    logInfo('Registered all addon IPC handlers', 'AddonController');
  }

  /**
   * ===== ADD-ON GROUP MANAGEMENT HANDLERS =====
   */

  /**
   * Create new add-on group
   */
  private async createAddonGroup(
    _event: IpcMainInvokeEvent,
    data: CreateAddonGroupRequest
  ): Promise<IPCResponse> {
    try {
      // Validate input
      const validatedData = CreateAddonGroupSchema.parse(data);

      const result = await this.addonService.createAddonGroup(validatedData);

      if (!result.success) {
        return this.createErrorResponse((result as any).error.message);
      }

      // Invalidate related caches
      await this.cacheService.invalidateAddonGroupCache();

      return this.createSuccessResponse(
        result.data,
        'Add-on group created successfully'
      );
    } catch (error) {
      logError(error, 'AddonController.createAddonGroup');
      return this.createErrorResponse(
        error instanceof Error ? error.message : 'Failed to create add-on group'
      );
    }
  }

  /**
   * Get add-on group by ID
   */
  private async getAddonGroup(
    _event: IpcMainInvokeEvent,
    id: string
  ): Promise<IPCResponse> {
    try {
      if (!id || typeof id !== 'string') {
        return this.createErrorResponse('Valid add-on group ID is required');
      }

      const result = await this.addonService.getAddonGroup(id);

      if (!result.success) {
        return this.createErrorResponse((result as any).error.message);
      }

      return this.createSuccessResponse(result.data);
    } catch (error) {
      logError(error, 'AddonController.getAddonGroup');
      return this.createErrorResponse(
        error instanceof Error ? error.message : 'Failed to get add-on group'
      );
    }
  }

  /**
   * Get all add-on groups with optional filtering
   */
  private async getAddonGroups(
    _event: IpcMainInvokeEvent,
    filters?: {
      isActive?: boolean;
      categoryId?: string;
      includeAddons?: boolean;
      useCache?: boolean;
    }
  ): Promise<IPCResponse> {
    try {
      const useCache = filters?.useCache !== false; // Default to true

      const result = await this.cacheService.getAddonGroups(
        {
          isActive: filters?.isActive,
          categoryId: filters?.categoryId,
          includeAddons: filters?.includeAddons,
        },
        useCache
      );

      if (!result.success) {
        return this.createErrorResponse((result as any).error.message);
      }

      return this.createSuccessResponse(result.data);
    } catch (error) {
      logError(error, 'AddonController.getAddonGroups');
      return this.createErrorResponse(
        error instanceof Error ? error.message : 'Failed to get add-on groups'
      );
    }
  }

  /**
   * Update add-on group
   */
  private async updateAddonGroup(
    _event: IpcMainInvokeEvent,
    request: UpdateAddonGroupRequest
  ): Promise<IPCResponse> {
    try {
      // Validate full request first (schema requires id)
      const validatedData = UpdateAddonGroupSchema.parse(request);
      const { id, ...updateData } = validatedData;

      if (!id || typeof id !== 'string') {
        return this.createErrorResponse('Valid add-on group ID is required');
      }

      const result = await this.addonService.updateAddonGroup(
        id,
        updateData
      );

      if (!result.success) {
        return this.createErrorResponse((result as any).error.message);
      }

      // Invalidate related caches
      await this.cacheService.invalidateAddonGroupCache(id);

      return this.createSuccessResponse(
        result.data,
        'Add-on group updated successfully'
      );
    } catch (error) {
      logError(error, 'AddonController.updateAddonGroup');
      return this.createErrorResponse(
        error instanceof Error ? error.message : 'Failed to update add-on group'
      );
    }
  }

  /**
   * Delete add-on group (soft delete)
   */
  private async deleteAddonGroup(
    _event: IpcMainInvokeEvent,
    id: string
  ): Promise<IPCResponse> {
    try {
      if (!id || typeof id !== 'string') {
        return this.createErrorResponse('Valid add-on group ID is required');
      }

      const result = await this.addonService.deleteAddonGroup(id);

      if (!result.success) {
        return this.createErrorResponse((result as any).error.message);
      }

      // Invalidate related caches
      await this.cacheService.invalidateAddonGroupCache(id);

      return this.createSuccessResponse(
        result.data,
        'Add-on group deleted successfully'
      );
    } catch (error) {
      logError(error, 'AddonController.deleteAddonGroup');
      return this.createErrorResponse(
        error instanceof Error ? error.message : 'Failed to delete add-on group'
      );
    }
  }

  /**
   * ===== ADD-ON MANAGEMENT HANDLERS =====
   */

  /**
   * Create new add-on
   */
  private async createAddon(
    _event: IpcMainInvokeEvent,
    data: CreateAddonRequest
  ): Promise<IPCResponse> {
    try {
      const validatedData = CreateAddonSchema.parse(data);

      const result = await this.addonService.createAddon(validatedData);

      if (!result.success) {
        return this.createErrorResponse((result as any).error.message);
      }

      // Invalidate related caches
      await this.cacheService.invalidateAddonGroupCache(
        validatedData.addonGroupId
      );

      return this.createSuccessResponse(
        result.data,
        'Add-on created successfully'
      );
    } catch (error) {
      logError(error, 'AddonController.createAddon');
      return this.createErrorResponse(
        error instanceof Error ? error.message : 'Failed to create add-on'
      );
    }
  }

  /**
   * Get add-on by ID
   */
  private async getAddon(
    _event: IpcMainInvokeEvent,
    id: string
  ): Promise<IPCResponse> {
    try {
      if (!id || typeof id !== 'string') {
        return this.createErrorResponse('Valid add-on ID is required');
      }

      const result = await this.addonService.getAddon(id);

      if (!result.success) {
        return this.createErrorResponse((result as any).error.message);
      }

      return this.createSuccessResponse(result.data);
    } catch (error) {
      logError(error, 'AddonController.getAddon');
      return this.createErrorResponse(
        error instanceof Error ? error.message : 'Failed to get add-on'
      );
    }
  }

  /**
   * Get add-ons by group ID
   */
  private async getAddonsByGroup(
    _event: IpcMainInvokeEvent,
    groupId: string
  ): Promise<IPCResponse> {
    try {
      if (!groupId || typeof groupId !== 'string') {
        return this.createErrorResponse('Valid group ID is required');
      }

      const result = await this.addonService.getAddonsByGroup(groupId);

      if (!result.success) {
        return this.createErrorResponse((result as any).error.message);
      }

      return this.createSuccessResponse(result.data);
    } catch (error) {
      logError(error, 'AddonController.getAddonsByGroup');
      return this.createErrorResponse(
        error instanceof Error
          ? error.message
          : 'Failed to get add-ons by group'
      );
    }
  }

  /**
   * Get add-ons by category ID (with caching)
   */
  private async getAddonsByCategory(
    _event: IpcMainInvokeEvent,
    categoryId: string,
    useCache: boolean = true
  ): Promise<IPCResponse> {
    try {
      if (!categoryId || typeof categoryId !== 'string') {
        return this.createErrorResponse('Valid category ID is required');
      }

      const result = await this.cacheService.getCategoryAddons(
        categoryId,
        useCache
      );

      if (!result.success) {
        return this.createErrorResponse((result as any).error.message);
      }

      return this.createSuccessResponse(result.data);
    } catch (error) {
      logError(error, 'AddonController.getAddonsByCategory');
      return this.createErrorResponse(
        error instanceof Error
          ? error.message
          : 'Failed to get add-ons by category'
      );
    }
  }

  /**
   * Update add-on
   */
  private async updateAddon(
    _event: IpcMainInvokeEvent,
    request: UpdateAddonRequest
  ): Promise<IPCResponse> {
    try {
      // ✅ FIX: Validate the full request (including id) first
      const validatedData = UpdateAddonSchema.parse(request);
      const { id, ...updateData } = validatedData;

      if (!id || typeof id !== 'string') {
        return this.createErrorResponse('Valid add-on ID is required');
      }

      const result = await this.addonService.updateAddon(id, updateData);

      if (!result.success) {
        return this.createErrorResponse((result as any).error.message);
      }

      // Invalidate related caches
      await this.cacheService.invalidateAddonGroupCache();

      return this.createSuccessResponse(
        result.data,
        'Add-on updated successfully'
      );
    } catch (error) {
      logError(error, 'AddonController.updateAddon');
      return this.createErrorResponse(
        error instanceof Error ? error.message : 'Failed to update add-on'
      );
    }
  }

  /**
   * Delete add-on (soft delete)
   */
  private async deleteAddon(
    _event: IpcMainInvokeEvent,
    id: string
  ): Promise<IPCResponse> {
    try {
      if (!id || typeof id !== 'string') {
        return this.createErrorResponse('Valid add-on ID is required');
      }

      const result = await this.addonService.deleteAddon(id);

      if (!result.success) {
        return this.createErrorResponse((result as any).error.message);
      }

      // Invalidate related caches
      await this.cacheService.invalidateAddonGroupCache();

      return this.createSuccessResponse(
        result.data,
        'Add-on deleted successfully'
      );
    } catch (error) {
      logError(error, 'AddonController.deleteAddon');
      return this.createErrorResponse(
        error instanceof Error ? error.message : 'Failed to delete add-on'
      );
    }
  }

  /**
   * ===== ORDER INTEGRATION HANDLERS =====
   */

  /**
   * Add add-ons to order item with transaction safety
   */
  private async addAddonsToOrderItem(
    _event: IpcMainInvokeEvent,
    request: AddAddonsToOrderItemRequest
  ): Promise<IPCResponse> {
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
        return this.createErrorResponse(
          'At least one add-on selection is required'
        );
      }

      const result = await this.addonService.addAddonsToOrderItem(
        orderItemId,
        addonSelections
      );

      if (!result.success) {
        const errorMessage = (result as any).error.message;
        const errorCode = (result as any).error?.code;
        const errorStatusCode = (result as any).error?.statusCode;
        console.error('❌ [AddonController] Service returned error', {
          errorMessage,
          errorCode,
          errorStatusCode
        });
        return this.createErrorResponse(errorMessage);
      }

      console.log(`✅ [AddonController] Successfully added ${result.data?.assignments?.length || 0} addons`);

      // CRITICAL FIX: Recalculate order totals after adding addons
      const orderId = result.data?.orderId;
      if (orderId) {
        await this.orderModel.recalculateOrderTotals(orderId);
        console.log(`✅ [AddonController] Order totals recalculated for order ${orderId}`);
      }

      return this.createSuccessResponse(
        result.data,
        'Add-ons added to order item successfully'
      );
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      console.error('❌ [AddonController] Exception in addAddonsToOrderItem', {
        error: errorMsg,
        stack: errorStack
      });
      logError(error, 'AddonController.addAddonsToOrderItem');
      return this.createErrorResponse(
        error instanceof Error
          ? error.message
          : 'Failed to add add-ons to order item'
      );
    }
  }

  /**
   * Remove add-on from order item with transaction safety
   */
  private async removeAddonFromOrderItem(
    _event: IpcMainInvokeEvent,
    request: RemoveAddonFromOrderItemRequest
  ): Promise<IPCResponse> {
    try {
      const { orderItemId, addonId } = request;

      if (!orderItemId || typeof orderItemId !== 'string') {
        return this.createErrorResponse('Valid order item ID is required');
      }

      if (!addonId || typeof addonId !== 'string') {
        return this.createErrorResponse('Valid add-on ID is required');
      }

      const result = await this.addonService.removeAddonFromOrderItem(
        orderItemId,
        addonId
      );

      if (!result.success) {
        return this.createErrorResponse((result as any).error.message);
      }

      // CRITICAL FIX: Recalculate order totals after removing addon
      const orderId = result.data?.orderId;
      if (orderId) {
        await this.orderModel.recalculateOrderTotals(orderId);
        console.log(`✅ [AddonController] Order totals recalculated after addon removal for order ${orderId}`);
      }

      return this.createSuccessResponse(
        result.data,
        'Add-on removed from order item successfully'
      );
    } catch (error) {
      logError(error, 'AddonController.removeAddonFromOrderItem');
      return this.createErrorResponse(
        error instanceof Error
          ? error.message
          : 'Failed to remove add-on from order item'
      );
    }
  }

  /**
   * Get add-ons for order item
   */
  private async getOrderItemAddons(
    _event: IpcMainInvokeEvent,
    orderItemId: string
  ): Promise<IPCResponse> {
    try {
      if (!orderItemId || typeof orderItemId !== 'string') {
        return this.createErrorResponse('Valid order item ID is required');
      }

      const result = await this.addonService.getOrderItemAddons(orderItemId);

      if (!result.success) {
        return this.createErrorResponse((result as any).error.message);
      }

      return this.createSuccessResponse(result.data);
    } catch (error) {
      logError(error, 'AddonController.getOrderItemAddons');
      return this.createErrorResponse(
        error instanceof Error
          ? error.message
          : 'Failed to get order item add-ons'
      );
    }
  }

  /**
   * Scale addon quantities proportionally when item quantity changes
   */
  private async scaleAddonQuantities(
    _event: IpcMainInvokeEvent,
    request: { orderItemId: string; quantityToAdd: number }
  ): Promise<IPCResponse> {
    try {
      const { orderItemId, quantityToAdd } = request;

      if (!orderItemId || typeof orderItemId !== 'string') {
        return this.createErrorResponse('Valid order item ID is required');
      }

      if (typeof quantityToAdd !== 'number' || quantityToAdd === 0) {
        return this.createErrorResponse('Valid quantity to add is required');
      }

      const result = await this.addonService.scaleAddonQuantities(
        orderItemId,
        quantityToAdd
      );

      if (!result.success) {
        return this.createErrorResponse((result as any).error.message);
      }

      // ✅ CRITICAL FIX: Recalculate order totals after scaling addon quantities
      // Since we removed the buggy increment operation from the service,
      // we need to recalculate the entire order total here
      const orderItem = await prisma.orderItem.findUnique({
        where: { id: orderItemId },
        select: { orderId: true },
      });

      if (orderItem?.orderId) {
        await this.orderModel.recalculateOrderTotals(orderItem.orderId);
        console.log(`✅ [AddonController] Order totals recalculated for order ${orderItem.orderId} after scaling addon quantities`);
      }

      return this.createSuccessResponse(
        result.data,
        'Addon quantities scaled successfully'
      );
    } catch (error) {
      logError(error, 'AddonController.scaleAddonQuantities');
      return this.createErrorResponse(
        error instanceof Error
          ? error.message
          : 'Failed to scale addon quantities'
      );
    }
  }

  /**
   * ===== CACHE MANAGEMENT HANDLERS =====
   */

  /**
   * Invalidate specific or all caches
   */
  private async invalidateCache(
    _event: IpcMainInvokeEvent,
    options?: { type?: 'category' | 'groups' | 'all'; id?: string }
  ): Promise<IPCResponse> {
    try {
      const { type = 'all', id } = options || {};

      switch (type) {
        case 'category':
          if (id) {
            await this.cacheService.invalidateCategoryCache(id);
          } else {
            return this.createErrorResponse(
              'Category ID is required for category cache invalidation'
            );
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

      return this.createSuccessResponse(
        { invalidated: true },
        'Cache invalidated successfully'
      );
    } catch (error) {
      logError(error, 'AddonController.invalidateCache');
      return this.createErrorResponse(
        error instanceof Error ? error.message : 'Failed to invalidate cache'
      );
    }
  }

  /**
   * Get cache statistics
   */
  private async getCacheStats(
    _event: IpcMainInvokeEvent
  ): Promise<IPCResponse> {
    try {
      const stats = await this.cacheService.getCacheStats();
      return this.createSuccessResponse(stats);
    } catch (error) {
      logError(error, 'AddonController.getCacheStats');
      return this.createErrorResponse(
        error instanceof Error ? error.message : 'Failed to get cache stats'
      );
    }
  }

  /**
   * Warm up cache for popular categories
   */
  private async warmUpCache(
    _event: IpcMainInvokeEvent,
    categoryIds: string[]
  ): Promise<IPCResponse> {
    try {
      if (!Array.isArray(categoryIds)) {
        return this.createErrorResponse('Category IDs array is required');
      }

      await this.cacheService.warmUpCache(categoryIds);

      return this.createSuccessResponse(
        { warmedUp: true },
        `Cache warmed up for ${categoryIds.length} categories`
      );
    } catch (error) {
      logError(error, 'AddonController.warmUpCache');
      return this.createErrorResponse(
        error instanceof Error ? error.message : 'Failed to warm up cache'
      );
    }
  }

  /**
   * ===== CATEGORY ASSIGNMENT HANDLERS =====
   */

  /**
   * Assign addon group to category
   */
  private async assignGroupToCategory(
    _event: IpcMainInvokeEvent,
    categoryId: string,
    addonGroupId: string,
    sortOrder?: number
  ): Promise<IPCResponse> {
    try {
      if (!categoryId || !addonGroupId) {
        return this.createErrorResponse('Category ID and Addon Group ID are required');
      }

      const result = await this.addonService.assignGroupToCategory(
        categoryId,
        addonGroupId,
        sortOrder || 0
      );

      if (!result.success) {
        return this.createErrorResponse((result as any).error.message);
      }

      // Invalidate related caches
      await this.cacheService.invalidateAddonGroupCache();

      return this.createSuccessResponse(
        result.data,
        'Add-on group assigned to category successfully'
      );
    } catch (error) {
      logError(error, 'AddonController.assignGroupToCategory');
      return this.createErrorResponse(
        error instanceof Error
          ? error.message
          : 'Failed to assign group to category'
      );
    }
  }

  /**
   * Unassign addon group from category
   */
  private async unassignGroupFromCategory(
    _event: IpcMainInvokeEvent,
    categoryId: string,
    addonGroupId: string
  ): Promise<IPCResponse> {
    try {
      if (!categoryId || !addonGroupId) {
        return this.createErrorResponse('Category ID and Addon Group ID are required');
      }

      const result = await this.addonService.unassignGroupFromCategory(
        categoryId,
        addonGroupId
      );

      if (!result.success) {
        return this.createErrorResponse((result as any).error.message);
      }

      // Invalidate related caches
      await this.cacheService.invalidateAddonGroupCache();

      return this.createSuccessResponse(
        result.data,
        'Add-on group unassigned from category successfully'
      );
    } catch (error) {
      logError(error, 'AddonController.unassignGroupFromCategory');
      return this.createErrorResponse(
        error instanceof Error
          ? error.message
          : 'Failed to unassign group from category'
      );
    }
  }

  /**
   * Get category assignments
   */
  private async getCategoryAssignments(
    _event: IpcMainInvokeEvent,
    categoryId?: string
  ): Promise<IPCResponse> {
    try {
      const result = await this.addonService.getCategoryAssignments();

      if (!result.success) {
        return this.createErrorResponse((result as any).error.message);
      }

      // Filter by categoryId if provided
      let assignments = result.data;
      if (categoryId) {
        assignments = assignments.filter(a => a.categoryId === categoryId);
      }

      return this.createSuccessResponse(assignments);
    } catch (error) {
      logError(error, 'AddonController.getCategoryAssignments');
      return this.createErrorResponse(
        error instanceof Error
          ? error.message
          : 'Failed to get category assignments'
      );
    }
  }

  /**
   * ✅ NEW: Get addon groups with their addons for a specific category
   * Used by the POS addon selection step
   */
  private async getCategoryAddonGroups(
    _event: IpcMainInvokeEvent,
    params: { categoryId: string; includeInactive?: boolean }
  ): Promise<IPCResponse> {
    try {
      const { categoryId, includeInactive = false } = params;

      if (!categoryId || typeof categoryId !== 'string') {
        return this.createErrorResponse('Valid category ID is required');
      }

      // Get addon groups assigned to this category
      const assignments = await this.addonService.getCategoryAssignments();
      
      if (!assignments.success) {
        return this.createErrorResponse((assignments as any).error.message);
      }

      // Filter to only this category and active assignments
      const categoryAssignments = assignments.data.filter(
        a => a.categoryId === categoryId && (includeInactive || a.isActive)
      );

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
              : addonsResult.data.filter((a: any) => a.isActive);
            allAddons.push(...filteredAddons);
          }
        }
      }

      return this.createSuccessResponse({
        groups,
        addons: allAddons,
      });
    } catch (error) {
      logError(error, 'AddonController.getCategoryAddonGroups');
      return this.createErrorResponse(
        error instanceof Error
          ? error.message
          : 'Failed to get category addon groups'
      );
    }
  }

  /**
   * Enhanced error handling wrapper
   */
  private withErrorHandling<T extends any[], R>(
    handler: (...args: T) => Promise<IPCResponse<R>>
  ): (...args: T) => Promise<IPCResponse<R>> {
    return async (...args: T): Promise<IPCResponse<R>> => {
      try {
        return await handler(...args);
      } catch (error) {
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
  public async shutdown(): Promise<void> {
    try {
      await this.cacheService.disconnect();
      this.unregisterHandlers();
      logInfo('AddonController shutdown completed', 'AddonController');
    } catch (error) {
      logError(error, 'AddonController.shutdown');
    }
  }
}
