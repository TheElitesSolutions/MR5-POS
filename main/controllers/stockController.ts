// Stock Controller for Main Process IPC Handling
import { IpcMainInvokeEvent } from 'electron';
import { INVENTORY_CHANNELS } from '../../shared/ipc-channels';
import {
  CreateInventoryItemSchema,
  AdjustStockSchema,
} from '../../shared/validation-schemas';
import { validateWithSchema } from '../utils/validation-helpers';
import { logDebug, logInfo } from '../error-handler';
import { InventoryService } from '../services/inventoryService';
import { ServiceRegistry } from '../services/serviceRegistry';
import { InventoryModel } from '../models/Inventory';
import { prisma } from '../db/prisma-wrapper';
import { IPCResponse, InventoryItem, InventoryItem as Inventory } from '../types';
import { toDecimal } from '../utils/decimal';
import { BaseController } from './baseController';

/**
 * Stock Controller handles IPC communication for inventory/stock operations
 * Uses local InventoryModel with PostgreSQL database
 */
export class StockController extends BaseController {
  private inventoryModel: InventoryModel;
  private inventoryService: InventoryService;

  constructor() {
    super();
    this.inventoryModel = new InventoryModel(prisma as any);

    // Initialize inventory service
    const registry = ServiceRegistry.getInstance(prisma as any);
    this.inventoryService = registry.registerService(InventoryService);

    // this.initialize(); // Removed: StartupManager calls initialize() explicitly
  }

  /**
   * Transform frontend stock item data to backend inventory format
   */
  private transformStockItemData(frontendData: any): any {
    return {
      itemName: frontendData.name || frontendData.itemName,
      category: frontendData.category || 'Other',
      currentStock: toDecimal(
        frontendData.currentQuantity || frontendData.currentStock || 0
      ),
      minimumStock: toDecimal(
        frontendData.minimumQuantity || frontendData.minimumStock || 0
      ),
      unit: frontendData.unit || 'unit',
      costPerUnit: toDecimal(frontendData.costPerUnit || 0),
      supplier: frontendData.supplier || null,
      expiryDate: frontendData.expiryDate
        ? new Date(frontendData.expiryDate)
        : null,
    };
  }

  /**
   * Transform frontend partial update data to backend inventory format
   */
  private transformPartialStockItemData(frontendData: any): any {
    const transformed: any = {};

    if (frontendData.name !== undefined) {
      transformed.itemName = frontendData.name;
    }
    if (frontendData.itemName !== undefined) {
      transformed.itemName = frontendData.itemName;
    }
    if (frontendData.category !== undefined) {
      transformed.category = frontendData.category;
    }
    if (frontendData.currentQuantity !== undefined) {
      transformed.currentStock = toDecimal(frontendData.currentQuantity);
    }
    if (frontendData.currentStock !== undefined) {
      transformed.currentStock = toDecimal(frontendData.currentStock);
    }
    if (frontendData.minimumQuantity !== undefined) {
      transformed.minimumStock = toDecimal(frontendData.minimumQuantity);
    }
    if (frontendData.minimumStock !== undefined) {
      transformed.minimumStock = toDecimal(frontendData.minimumStock);
    }
    if (frontendData.unit !== undefined) {
      transformed.unit = frontendData.unit;
    }
    if (frontendData.costPerUnit !== undefined) {
      transformed.costPerUnit = toDecimal(frontendData.costPerUnit);
    }
    if (frontendData.supplier !== undefined) {
      transformed.supplier = frontendData.supplier;
    }
    if (frontendData.expiryDate !== undefined) {
      transformed.expiryDate = frontendData.expiryDate
        ? new Date(frontendData.expiryDate)
        : null;
    }

    return transformed;
  }

  /**
   * Setup IPC handlers for stock operations
   */
  protected registerHandlers(): void {
    // Get all inventory items
    this.registerHandler(
      INVENTORY_CHANNELS.GET_ALL,
      async (_event: IpcMainInvokeEvent): Promise<IPCResponse<Inventory[]>> => {
        try {
          logDebug('Fetching all inventory items', 'StockController');

          const result = await this.inventoryModel.findAll();

          return this.createSuccessResponse(result.data || []);
        } catch (error) {
          return this.createErrorResponse(
            error instanceof Error ? error : new Error(String(error))
          );
        }
      }
    );

    // Get inventory item by ID
    this.registerHandler(
      INVENTORY_CHANNELS.GET_BY_ID,
      async (
        _event: IpcMainInvokeEvent,
        itemId: string
      ): Promise<IPCResponse<Inventory | null>> => {
        try {
          logDebug(`Fetching inventory item ${itemId}`, 'StockController');

          const result = await this.inventoryModel.findById(itemId);

          return this.createSuccessResponse(result.data ?? null);
        } catch (error) {
          return this.createErrorResponse(
            error instanceof Error ? error : new Error(String(error))
          );
        }
      }
    );

    // Update inventory item
    this.registerHandler(
      INVENTORY_CHANNELS.UPDATE,
      async (
        _event: IpcMainInvokeEvent,
        updatePayload: { id: string; updates: any }
      ): Promise<IPCResponse<Inventory>> => {
        try {
          const { id: itemId, updates: itemData } = updatePayload;

          logDebug(`Updating inventory item ${itemId}`, 'StockController');
          logDebug(
            `Update data: ${JSON.stringify(itemData)}`,
            'StockController'
          );

          // Transform frontend data to backend format
          const transformedData = this.transformPartialStockItemData(itemData);
          logDebug(
            `Transformed update data: ${JSON.stringify({
              ...transformedData,
              ...(transformedData.currentStock && {
                currentStock: transformedData.currentStock.toString(),
              }),
              ...(transformedData.minimumStock && {
                minimumStock: transformedData.minimumStock.toString(),
              }),
              ...(transformedData.costPerUnit && {
                costPerUnit: transformedData.costPerUnit.toString(),
              }),
            })}`,
            'StockController'
          );

          const result = await this.inventoryModel.update(
            itemId,
            transformedData
          );

          return this.createSuccessResponse(result.data as Inventory);
        } catch (error) {
          return this.createErrorResponse(
            error instanceof Error ? error : new Error(String(error))
          );
        }
      }
    );

    // Create inventory item
    this.registerHandler(
      INVENTORY_CHANNELS.CREATE,
      async (
        _event: IpcMainInvokeEvent,
        itemData: unknown
      ): Promise<IPCResponse<Inventory>> => {
        try {
          // Runtime validation with Zod
          const validation = validateWithSchema(
            CreateInventoryItemSchema,
            itemData,
            'CreateInventoryItem'
          );

          if (!validation.success) {
            logInfo(`CreateInventoryItem: Validation failed - ${validation.error}`);
            return this.createErrorResponse(new Error(validation.error));
          }

          const validatedData = validation.data!;

          logDebug(
            `Creating inventory item: ${JSON.stringify(validatedData)}`,
            'StockController'
          );

          // Transform frontend data to backend format
          const transformedData = this.transformStockItemData(validatedData);
          logDebug(
            `Transformed create data: ${JSON.stringify({
              ...transformedData,
              currentStock: transformedData.currentStock.toString(),
              minimumStock: transformedData.minimumStock.toString(),
              costPerUnit: transformedData.costPerUnit.toString(),
            })}`,
            'StockController'
          );

      const result = await this.inventoryModel.create(transformedData);

      // Check if model operation was successful
      if (!result.success || !result.data) {
        return this.createErrorResponse(
          new Error(result.error || 'Failed to create inventory item')
        );
      }

      return this.createSuccessResponse(result.data as Inventory);
        } catch (error) {
          return this.createErrorResponse(
            error instanceof Error ? error : new Error(String(error))
          );
        }
      }
    );

    // Delete inventory item
    this.registerHandler(
      INVENTORY_CHANNELS.DELETE,
      async (
        _event: IpcMainInvokeEvent,
        itemId: string
      ): Promise<IPCResponse<boolean>> => {
        try {
          logDebug(`Deleting inventory item ${itemId}`, 'StockController');

          const result = await this.inventoryModel.delete(itemId);

          return this.createSuccessResponse(result.success);
        } catch (error) {
          return this.createErrorResponse(
            error instanceof Error ? error : new Error(String(error))
          );
        }
      }
    );

    // Adjust stock level
    this.registerHandler(
      INVENTORY_CHANNELS.ADJUST_STOCK,
      async (
        _event: IpcMainInvokeEvent,
        adjustmentData: unknown
      ): Promise<IPCResponse<Inventory>> => {
        try {
          // Runtime validation with Zod
          const validation = validateWithSchema(
            AdjustStockSchema,
            adjustmentData,
            'AdjustStock'
          );

          if (!validation.success) {
            logInfo(`AdjustStock: Validation failed - ${validation.error}`);
            return this.createErrorResponse(new Error(validation.error));
          }

          const validatedData = validation.data!;
          const { id: itemId, adjustment } = validatedData;
          logDebug(
            `Adjusting stock for item ${itemId} by ${adjustment.quantity}`,
            'StockController'
          );

          const result = await this.inventoryModel.adjustStock(
            itemId,
            toDecimal(adjustment.quantity),
            adjustment.reason || 'Stock adjustment'
          );

          return this.createSuccessResponse(result.data as Inventory);
        } catch (error) {
          return this.createErrorResponse(
            error instanceof Error ? error : new Error(String(error))
          );
        }
      }
    );

    // Get low stock items
    this.registerHandler(
      INVENTORY_CHANNELS.GET_LOW_STOCK,
      async (_event: IpcMainInvokeEvent): Promise<IPCResponse<Inventory[]>> => {
        try {
          logDebug('Fetching low stock items', 'StockController');

          const result = await this.inventoryModel.getLowStock();

          return this.createSuccessResponse(result.data || []);
        } catch (error) {
          return this.createErrorResponse(
            error instanceof Error ? error : new Error(String(error))
          );
        }
      }
    );

    // Get categories
    this.registerHandler(
      INVENTORY_CHANNELS.GET_CATEGORIES,
      async (_event: IpcMainInvokeEvent): Promise<IPCResponse<string[]>> => {
        try {
          logDebug('Fetching inventory categories', 'StockController');

          const result = await this.inventoryModel.getCategories();

          return this.createSuccessResponse(result.data || []);
        } catch (error) {
          return this.createErrorResponse(
            error instanceof Error ? error : new Error(String(error))
          );
        }
      }
    );

    // Get inventory items by category
    this.registerHandler(
      'inventory:getByCategory',
      async (
        _event: IpcMainInvokeEvent,
        category: string
      ): Promise<IPCResponse<InventoryItem[]>> => {
        try {
          logDebug(`Fetching inventory items for category: ${category}`, 'StockController');

          const result = await this.inventoryModel.getByCategory(category);

          return this.createSuccessResponse(result.data || []);
        } catch (error) {
          return this.createErrorResponse(
            error instanceof Error ? error : new Error(String(error))
          );
        }
      }
    );

    // Update category name
    this.registerHandler(
      INVENTORY_CHANNELS.UPDATE_CATEGORY_NAME,
      async (
        _event: IpcMainInvokeEvent,
        { oldName, newName }: { oldName: string; newName: string }
      ): Promise<IPCResponse<boolean>> => {
        try {
          logDebug(
            `Updating category name from "${oldName}" to "${newName}"`,
            'StockController'
          );

          const result = await this.inventoryModel.updateCategoryName(
            oldName,
            newName
          );

          return this.createSuccessResponse(result.data || false);
        } catch (error) {
          return this.createErrorResponse(
            error instanceof Error ? error : new Error(String(error))
          );
        }
      }
    );

    // Get low stock items
    this.registerHandler(
      INVENTORY_CHANNELS.GET_LOW_STOCK,
      async (_event: IpcMainInvokeEvent): Promise<IPCResponse<InventoryItem[]>> => {
        try {
          logDebug('Fetching low stock items', 'StockController');

          const result = await this.inventoryService.getLowStockItems();

          return this.createSuccessResponse((result.data || []) as InventoryItem[]);
        } catch (error) {
          return this.createErrorResponse(
            error instanceof Error ? error : new Error(String(error))
          );
        }
      }
    );

    // Get menu item ingredients
    this.registerHandler(
      INVENTORY_CHANNELS.GET_MENU_ITEM_INGREDIENTS,
      async (
        _event: IpcMainInvokeEvent,
        { menuItemId }: { menuItemId: string }
      ): Promise<IPCResponse<any>> => {
        try {
          logDebug(
            `Fetching ingredients for menu item ${menuItemId}`,
            'StockController'
          );

          // Use the inventory service to get the menu item's ingredients
          const result =
            await this.inventoryService.getMenuItemIngredients(menuItemId);

          if (!result.success) {
            throw new Error(
              result.error || 'Failed to get menu item ingredients'
            );
          }

          const menuItemInventory = result.data;

          return this.createSuccessResponse(menuItemInventory || []);
        } catch (error) {
          return this.createErrorResponse(
            error instanceof Error ? error : new Error(String(error))
          );
        }
      }
    );

    // Update menu item ingredients
    this.registerHandler(
      INVENTORY_CHANNELS.UPDATE_MENU_ITEM_INGREDIENTS,
      async (
        _event: IpcMainInvokeEvent,
        {
          menuItemId,
          ingredients,
        }: {
          menuItemId: string;
          ingredients: Array<{ inventoryId: string; quantity: number }>;
        }
      ): Promise<IPCResponse<any>> => {
        try {
          logDebug(
            `Updating ingredients for menu item ${menuItemId}`,
            'StockController'
          );

          const result = await this.inventoryService.updateMenuItemIngredients(
            menuItemId,
            ingredients
          );

          return this.createSuccessResponse(result.data || null);
        } catch (error) {
          return this.createErrorResponse(
            error instanceof Error ? error : new Error(String(error))
          );
        }
      }
    );

    // Check stock availability for order items
    this.registerHandler(
      INVENTORY_CHANNELS.CHECK_STOCK_AVAILABILITY,
      async (
        _event: IpcMainInvokeEvent,
        {
          orderItems,
        }: { orderItems: Array<{ menuItemId: string; quantity: number }> }
      ): Promise<
        IPCResponse<{
          available: boolean;
          unavailableItems: Array<{
            id: string;
            name: string;
            required: number;
            available: number;
            unit: string;
          }>;
        }>
      > => {
        try {
          logDebug(
            `Checking stock availability for ${orderItems.length} items`,
            'StockController'
          );

          const result =
            await this.inventoryService.checkStockAvailability(orderItems);

          return this.createSuccessResponse(
            result.data || { available: true, unavailableItems: [] }
          );
        } catch (error) {
          return this.createErrorResponse(
            error instanceof Error ? error : new Error(String(error))
          );
        }
      }
    );

    logInfo('Stock IPC handlers registered');
  }

  /**
   * Cleanup resources
   */
  public override cleanup(): void {
    this.unregisterHandlers();
  }

  /**
   * Unregister all IPC handlers
   */
  override unregisterHandlers(): void {
    // Remove all IPC handlers
    Object.values(INVENTORY_CHANNELS).forEach(channel => {
      this.unregisterHandler(channel);
    });

    logInfo('Stock IPC handlers unregistered');
  }
}
