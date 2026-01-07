/**
 * Menu Item Controller for mr5-POS Electron Application
 * Handles IPC communication for menu item operations
 */

import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { MENU_ITEM_CHANNELS } from '../../shared/ipc-channels';
import {
  CreateMenuItemRequest,
  DeleteMenuItemRequest,
  MenuItem,
  MenuStats,
  UpdateMenuItemRequest,
} from '../../shared/ipc-types';
import {
  CreateMenuItemSchema,
  UpdateMenuItemSchema,
} from '../../shared/validation-schemas';
import { validateWithSchema } from '../utils/validation-helpers';
import { logInfo } from '../error-handler';
import { prisma } from '../db/prisma-wrapper';
import { MenuItemService } from '../services/menuItemService';
import { SupabaseSyncService } from '../services/supabaseSync';
import { ServiceRegistry } from '../services/serviceRegistry';
import { IPCResponse } from '../types/index';
import { BaseController } from './baseController';
import { EnhancedLogger, LogCategory } from '../utils/enhanced-logger';
import { getCurrentLocalDateTime } from '../utils/dateTime';

export class MenuItemController extends BaseController {
  private menuItemService: MenuItemService;
  private syncService: SupabaseSyncService | null = null;

  constructor() {
    super();
    // Get the service from the registry
    const serviceRegistry = ServiceRegistry.getInstance(prisma as any);
    this.menuItemService = serviceRegistry.getServiceByClass(MenuItemService);

    // Try to get sync service if available
    try {
      const registry = serviceRegistry as any;
      if (registry.services?.has('SupabaseSyncService')) {
        this.syncService = registry.services.get('SupabaseSyncService');
      }
    } catch (error) {
      logInfo('Supabase sync service not available, real-time sync disabled');
    }

    logInfo('MenuItemController: Service dependency initialized');
    // this.initialize(); // Removed: StartupManager calls initialize() explicitly
  }

  protected registerHandlers(): void {
    this.registerHandler(
      MENU_ITEM_CHANNELS.GET_ALL,
      this.getAllMenuItems.bind(this)
    );

    this.registerHandler(
      MENU_ITEM_CHANNELS.GET_BY_ID,
      this.getMenuItemById.bind(this)
    );

    this.registerHandler(
      MENU_ITEM_CHANNELS.GET_BY_CATEGORY,
      this.getMenuItemsByCategory.bind(this)
    );

    this.registerHandler(
      MENU_ITEM_CHANNELS.GET_AVAILABLE,
      this.getAvailableMenuItems.bind(this)
    );

    this.registerHandler(
      MENU_ITEM_CHANNELS.CREATE,
      this.createMenuItem.bind(this)
    );

    this.registerHandler(
      MENU_ITEM_CHANNELS.UPDATE,
      this.updateMenuItem.bind(this)
    );

    this.registerHandler(
      MENU_ITEM_CHANNELS.DELETE,
      this.deleteMenuItem.bind(this)
    );

    this.registerHandler(
      MENU_ITEM_CHANNELS.SEARCH,
      this.searchMenuItems.bind(this)
    );

    this.registerHandler(
      MENU_ITEM_CHANNELS.GET_STATS,
      this.getMenuItemStats.bind(this)
    );

    // Category-specific handlers
    this.registerHandler(
      MENU_ITEM_CHANNELS.CREATE_CATEGORY,
      this.createCategory.bind(this)
    );

    this.registerHandler(
      MENU_ITEM_CHANNELS.UPDATE_CATEGORY,
      this.updateCategory.bind(this)
    );

    this.registerHandler(
      MENU_ITEM_CHANNELS.DELETE_CATEGORY,
      this.deleteCategory.bind(this)
    );

    this.registerHandler(
      MENU_ITEM_CHANNELS.GET_CATEGORIES,
      this.getCategories.bind(this)
    );

    this.registerHandler(
      MENU_ITEM_CHANNELS.GET_CATEGORY_STATS,
      this.getCategoryStats.bind(this)
    );
  }

  public override unregisterHandlers(): void {
    Object.values(MENU_ITEM_CHANNELS).forEach(channel => {
      logInfo(`Unregistering handler for channel: ${channel}`);
      try {
        ipcMain.removeHandler(channel);
      } catch (error) {
        // Ignore errors when unregistering handlers
      }
    });
  }

  /**
   * Get all menu items
   */
  private async getAllMenuItems(
    _event: IpcMainInvokeEvent,
    params?: {
      page?: number;
      pageSize?: number;
      search?: string;
      category?: string;
    }
  ): Promise<
    IPCResponse<{
      items: MenuItem[];
      total: number;
      page: number;
      pageSize: number;
    }>
  > {
    try {
      console.log(
        'MenuItemController: getAllMenuItems called with params:',
        params
      );

      // Set defaults for pagination
      const page = params?.page || 1;
      const pageSize = params?.pageSize || 12;
      const offset = (page - 1) * pageSize;

      // Convert params to filters for the service
      const filters = {
        ...(params?.category && { category: params.category }),
        limit: pageSize,
        offset: offset,
      };

      const result = await this.menuItemService.findAll(filters);
      console.log('MenuItemController: menuItemService.findAll result:', {
        success: result.success,
        dataLength: result.data?.length,
        error: result.error,
        firstItem: result.data?.[0],
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch menu items');
      }

      const items = (result.data as unknown as MenuItem[]) || [];

      // Get total count (for now, we'll use a simple approach)
      // In a production app, you'd want a separate count query
      const allItemsResult = await this.menuItemService.findAll({
        ...(params?.category && { category: params.category }),
      });
      const total = allItemsResult.success
        ? allItemsResult.data?.length || 0
        : 0;

      const paginatedResponse = {
        items,
        total,
        page,
        pageSize,
      };

      console.log('MenuItemController: Final paginated response:', {
        success: true,
        itemsLength: paginatedResponse.items.length,
        total: paginatedResponse.total,
        page: paginatedResponse.page,
        pageSize: paginatedResponse.pageSize,
      });

      return this.createSuccessResponse(paginatedResponse);
    } catch (error) {
      console.error('MenuItemController: getAllMenuItems error:', error);
      return this.createErrorResponse(
        error instanceof Error ? error : String(error)
      );
    }
  }

  /**
   * Get menu item by ID
   */
  private async getMenuItemById(
    _event: IpcMainInvokeEvent,
    id: string
  ): Promise<IPCResponse<MenuItem>> {
    try {
      const result = await this.menuItemService.findById(id);
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Menu item not found');
      }
      // Type assertion to handle the mismatch between main/types and shared/ipc-types
      return this.createSuccessResponse(result.data as unknown as MenuItem);
    } catch (error) {
      return this.createErrorResponse(
        error instanceof Error ? error : String(error)
      );
    }
  }

  /**
   * Get menu items by category
   */
  private async getMenuItemsByCategory(
    _event: IpcMainInvokeEvent,
    category: string
  ): Promise<IPCResponse<MenuItem[]>> {
    try {
      const result = await this.menuItemService.findByCategory(category);
      // Type assertion to handle the mismatch between main/types and shared/ipc-types
      return this.createSuccessResponse(
        (result.data as unknown as MenuItem[]) || []
      );
    } catch (error) {
      return this.createErrorResponse(
        error instanceof Error ? error : String(error)
      );
    }
  }

  /**
   * Get available menu items
   */
  private async getAvailableMenuItems(
    _event: IpcMainInvokeEvent,
    params?: {
      page?: number;
      pageSize?: number;
      search?: string;
    }
  ): Promise<
    IPCResponse<{
      items: MenuItem[];
      total: number;
      page: number;
      pageSize: number;
    }>
  > {
    try {
      console.log(
        'MenuItemController: getAvailableMenuItems called with params:',
        params
      );

      // Set defaults for pagination
      const page = params?.page || 1;
      const pageSize = params?.pageSize || 12;
      const offset = (page - 1) * pageSize;

      const result = await this.menuItemService.findAvailable();
      console.log('MenuItemController: findAvailable result:', {
        success: result.success,
        dataLength: result.data?.length,
        error: result.error,
        firstItem: result.data?.[0],
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch available menu items');
      }

      const allItems = (result.data as unknown as MenuItem[]) || [];

      // Apply pagination to the available items
      const items = allItems.slice(offset, offset + pageSize);
      const total = allItems.length;

      const paginatedResponse = {
        items,
        total,
        page,
        pageSize,
      };

      console.log('MenuItemController: getAvailableMenuItems final response:', {
        success: true,
        itemsLength: paginatedResponse.items.length,
        total: paginatedResponse.total,
        page: paginatedResponse.page,
        pageSize: paginatedResponse.pageSize,
      });

      return this.createSuccessResponse(paginatedResponse);
    } catch (error) {
      console.error('MenuItemController: getAvailableMenuItems error:', error);
      return this.createErrorResponse(
        error instanceof Error ? error : String(error)
      );
    }
  }

  /**
   * Create a new menu item
   */
  private async createMenuItem(
    _event: IpcMainInvokeEvent,
    itemData: unknown
  ): Promise<IPCResponse<MenuItem>> {
    try {
      // Runtime validation with Zod
      const validation = validateWithSchema(
        CreateMenuItemSchema,
        itemData,
        'CreateMenuItem'
      );

      if (!validation.success) {
        logInfo(`CreateMenuItem: Validation failed - ${validation.error}`);
        return this.createErrorResponse(new Error(validation.error));
      }

      const validatedData = validation.data!;
      const result = await this.menuItemService.create(validatedData as CreateMenuItemRequest);
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to create menu item');
      }

      // Trigger real-time sync to Supabase (non-blocking)
      if (this.syncService && result.data.id) {
        this.syncService.syncMenuItem(result.data.id).catch(err => {
          logInfo(
            `Background sync failed for item ${result.data?.id}: ${err.message}`
          );
        });
      }

      // Type assertion to handle the mismatch between main/types and shared/ipc-types
      return this.createSuccessResponse(result.data as unknown as MenuItem);
    } catch (error) {
      console.error('MenuItemController: createMenuItem error:', error);
      return this.createErrorResponse(
        error instanceof Error ? error : String(error)
      );
    }
  }

  /**
   * Update an existing menu item
   */
  private async updateMenuItem(
    _event: IpcMainInvokeEvent,
    updateData: unknown
  ): Promise<IPCResponse<MenuItem>> {
    try {
      // Runtime validation with Zod
      const validation = validateWithSchema(
        UpdateMenuItemSchema,
        updateData,
        'UpdateMenuItem'
      );

      if (!validation.success) {
        logInfo(`UpdateMenuItem: Validation failed - ${validation.error}`);
        return this.createErrorResponse(new Error(validation.error));
      }

      const validatedData = validation.data!;
      const result = await this.menuItemService.update(validatedData as UpdateMenuItemRequest);
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to update menu item');
      }

      // Trigger real-time sync to Supabase (non-blocking)
      const updateDataWithId = updateData as any;
      if (this.syncService && updateDataWithId.id) {
        this.syncService.syncMenuItem(updateDataWithId.id).catch((err: any) => {
          logInfo(
            `Background sync failed for item ${updateDataWithId.id}: ${err.message}`
          );
        });
      }

      // Type assertion to handle the mismatch between main/types and shared/ipc-types
      return this.createSuccessResponse(result.data as unknown as MenuItem);
    } catch (error) {
      return this.createErrorResponse(
        error instanceof Error ? error : String(error)
      );
    }
  }

  /**
   * Delete a menu item
   */
  private async deleteMenuItem(
    _event: IpcMainInvokeEvent,
    request: string | DeleteMenuItemRequest
  ): Promise<IPCResponse<boolean>> {
    try {
      // CRITICAL FIX: Handle both string (legacy) and object (current) parameter types
      // The API sends DeleteMenuItemRequest object, but type signature expected string
      // This mismatch was causing id to be "[object Object]", resulting in empty WHERE clause
      const id = typeof request === 'string' ? request : request.id;

      if (!id) {
        throw new Error('Menu item ID is required for deletion');
      }

      const result = await this.menuItemService.delete(id);

      // Trigger real-time sync to Supabase (non-blocking)
      // This will remove the item from Supabase
      if (this.syncService && id) {
        this.syncService.syncMenuItem(id).catch(err => {
          logInfo(
            `Background sync failed for deleted item ${id}: ${err.message}`
          );
        });
      }

      return this.createSuccessResponse(!!result.data);
    } catch (error) {
      return this.createErrorResponse(
        error instanceof Error ? error : String(error)
      );
    }
  }

  /**
   * Search menu items
   */
  private async searchMenuItems(
    _event: IpcMainInvokeEvent,
    query: string
  ): Promise<IPCResponse<MenuItem[]>> {
    try {
      const result = await this.menuItemService.search(query);
      // Type assertion to handle the mismatch between main/types and shared/ipc-types
      return this.createSuccessResponse(
        (result.data as unknown as MenuItem[]) || []
      );
    } catch (error) {
      return this.createErrorResponse(
        error instanceof Error ? error : String(error)
      );
    }
  }

  /**
   * Get menu item statistics
   */
  private async getMenuItemStats(
    _event: IpcMainInvokeEvent
  ): Promise<IPCResponse<MenuStats>> {
    try {
      const result = await this.menuItemService.getStats();
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to get menu stats');
      }
      // Type assertion to handle the mismatch between main/types and shared/ipc-types
      return this.createSuccessResponse(result.data as unknown as MenuStats);
    } catch (error) {
      return this.createErrorResponse(
        error instanceof Error ? error : String(error)
      );
    }
  }

  /**
   * Create a new category
   */
  private async createCategory(
    _event: IpcMainInvokeEvent,
    data: { name: string; color?: string }
  ): Promise<IPCResponse<any>> {
    try {
      // Create a category directly in the database
      const category = await prisma.category.create({
        data: {
          name: data.name,
          description: `Category for ${data.name} items`,
          color: data.color || null,
          sortOrder: 0,
          isActive: true,
        },
      });

      // Trigger real-time sync to Supabase (non-blocking)
      if (this.syncService && category.id) {
        this.syncService.syncCategory(category.id).catch(err => {
          logInfo(
            `Background sync failed for category ${category.id}: ${err.message}`
          );
        });
      }

      return this.createSuccessResponse(category);
    } catch (error) {
      return this.createErrorResponse(
        error instanceof Error ? error : String(error)
      );
    }
  }

  /**
   * Update an existing category
   */
  private async updateCategory(
    _event: IpcMainInvokeEvent,
    data: { id: string; name: string; color?: string }
  ): Promise<IPCResponse<any>> {
    try {
      const category = await prisma.category.update({
        where: { id: data.id },
        data: {
          name: data.name,
          ...(data.color !== undefined && { color: data.color || null }),
        },
      });

      // Trigger real-time sync to Supabase (non-blocking)
      if (this.syncService && category.id) {
        this.syncService.syncCategory(category.id).catch(err => {
          logInfo(
            `Background sync failed for category ${category.id}: ${err.message}`
          );
        });
      }

      return this.createSuccessResponse(category);
    } catch (error) {
      return this.createErrorResponse(
        error instanceof Error ? error : String(error)
      );
    }
  }

  /**
   * Delete a category
   */
  private async deleteCategory(
    _event: IpcMainInvokeEvent,
    id: string
  ): Promise<IPCResponse<boolean>> {
    try {
      // Check if category has menu items
      const itemCount = await prisma.menuItem.count({
        where: { categoryId: id },
      });

      if (itemCount > 0) {
        return this.createErrorResponse(
          new Error('Cannot delete category with menu items')
        );
      }

      await prisma.category.delete({
        where: { id },
      });

      // Trigger real-time sync to Supabase (non-blocking)
      // This will remove the category from Supabase
      if (this.syncService && id) {
        this.syncService.syncCategory(id).catch(err => {
          logInfo(
            `Background sync failed for deleted category ${id}: ${err.message}`
          );
        });
      }

      return this.createSuccessResponse(true);
    } catch (error) {
      return this.createErrorResponse(
        error instanceof Error ? error : String(error)
      );
    }
  }

  /**
   * Get all categories
   */
  private async getCategories(
    _event: IpcMainInvokeEvent
  ): Promise<IPCResponse<any[]>> {
    try {
      console.log('MenuItemController: getCategories called');
      const categories = await prisma.category.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      });
      console.log('MenuItemController: getCategories result:', {
        categoriesLength: categories?.length,
        categories: categories?.map(c => ({
          id: c.id,
          name: c.name,
          isActive: c.isActive,
        })),
      });

      return this.createSuccessResponse(categories);
    } catch (error) {
      console.error('MenuItemController: getCategories error:', error);
      return this.createErrorResponse(
        error instanceof Error ? error : String(error)
      );
    }
  }

  /**
   * Get category statistics (total items, active items, average price)
   */
  private async getCategoryStats(
    _event: IpcMainInvokeEvent
  ): Promise<IPCResponse<any[]>> {
    const logger = EnhancedLogger.getInstance();

    try {
      logger.info('========================================', LogCategory.BUSINESS, 'MenuItemController');
      logger.info('🔍 getCategoryStats called', LogCategory.BUSINESS, 'MenuItemController', {
        timestamp: getCurrentLocalDateTime(),
      });

      // Get all active categories
      const categories = await prisma.category.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      });

      logger.info('📊 Active Categories Found', LogCategory.BUSINESS, 'MenuItemController', {
        count: categories.length,
        categories: categories.map(c => ({
          id: c.id,
          name: c.name,
          isActive: c.isActive,
        })),
      });

      // Get counts and stats for each category
      const categoryStats = await Promise.all(
        categories.map(async (category, index) => {
          logger.info(`🔍 Processing Category ${index + 1}/${categories.length}`, LogCategory.BUSINESS, 'MenuItemController', {
            name: category.name,
            id: category.id,
          });

          // Get total items count
          const totalItems = await prisma.menuItem.count({
            where: {
              categoryId: category.id,
            },
          });

          // Get active/available items count
          const activeItems = await prisma.menuItem.count({
            where: {
              categoryId: category.id,
              isActive: true,
            },
          });

          // Get sample items for debugging
          const sampleItems = await prisma.menuItem.findMany({
            where: {
              categoryId: category.id,
            },
            select: {
              id: true,
              name: true,
              isActive: true,
            },
            take: 5,
          });

          // Get average price
          const priceAggregate = await prisma.menuItem.aggregate({
            where: {
              categoryId: category.id,
            },
            _avg: {
              price: true,
            },
          });
          const avgPrice = priceAggregate._avg.price
            ? Number(priceAggregate._avg.price)
            : 0;

          const result = {
            categoryId: category.id,
            categoryName: category.name,
            totalItems,
            activeItems,
            avgPrice,
          };

          logger.info(`✅ Category Stats Calculated`, LogCategory.BUSINESS, 'MenuItemController', {
            category: category.name,
            totalItems,
            activeItems,
            avgPrice: avgPrice.toFixed(2),
            sampleItems: sampleItems.map(i => `${i.name}(${i.isActive ? 'active' : 'inactive'})`).join(', '),
            result,
          });

          return result;
        })
      );

      logger.info('✅ Final Category Stats Summary', LogCategory.BUSINESS, 'MenuItemController', {
        totalCategories: categoryStats.length,
        summary: categoryStats.map(s => `${s.categoryName}: ${s.activeItems}/${s.totalItems}`).join(' | '),
        fullStats: categoryStats,
      });
      logger.info('========================================', LogCategory.BUSINESS, 'MenuItemController');

      return this.createSuccessResponse(categoryStats);
    } catch (error) {
      logger.error('❌ getCategoryStats error', LogCategory.BUSINESS, 'MenuItemController', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return this.createErrorResponse(
        error instanceof Error ? error : String(error)
      );
    }
  }
}
