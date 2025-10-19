/**
 * Order Controller Add-On Extensions
 *
 * Enhanced order processing methods with add-on support
 * Integrates with AddonService for transaction-safe addon operations
 */

import { IpcMainInvokeEvent } from 'electron';
import { IPCResponse, OrderItem } from '../types';
import { AddonService, AddonSelection } from '../services/AddonService';
import { AddonErrorHandler, isAddonError } from '../errors/AddonError';
import { logError, logInfo } from '../error-handler';
import { AdvancedLogger } from '../utils/advancedLogger';

/**
 * Safely convert a date to ISO string
 * Handles both Date objects and string inputs
 */
function toISOString(date: Date | string | null | undefined): string {
  if (!date) return new Date().toISOString();
  if (typeof date === 'string') return date;
  if (date instanceof Date) return date.toISOString();
  return new Date().toISOString();
}

// Enhanced order item interface with add-on support
export interface OrderItemWithAddons extends OrderItem {
  addons?: OrderItemAddon[];
  addonSelections?: AddonSelection[];
}

// Interface for order item add-on data
export interface OrderItemAddon {
  id: string;
  addonId: string;
  quantity: number;
  unitPrice?: number;
  totalPrice: number;
  addon: {
    id: string;
    name: string;
    description?: string;
    price: number;
    addonGroup: {
      id: string;
      name: string;
    };
  };
}

// Enhanced request interfaces
export interface AddOrderItemWithAddonsRequest {
  orderId: string;
  item: Partial<OrderItemWithAddons> & { unitPrice?: number };
  userId: string;
}

export interface UpdateOrderItemAddonsRequest {
  orderItemId: string;
  addonSelections: AddonSelection[];
  userId: string;
}

export interface RemoveOrderItemAddonRequest {
  orderItemId: string;
  addonId: string;
  userId: string;
}

/**
 * OrderController Add-on Extensions Class
 *
 * This class extends the existing OrderController functionality
 * with comprehensive add-on support
 */
export class OrderControllerAddonExtensions {
  private addonService: AddonService;
  private prisma: any;

  constructor(prisma: any, addonService: AddonService) {
    this.prisma = prisma;
    this.addonService = addonService;
  }

  /**
   * Enhanced addOrderItem with add-on support
   *
   * This method extends the existing addOrderItem functionality to handle
   * add-on selections during the item addition process
   */
  async addOrderItemWithAddons(
    data: AddOrderItemWithAddonsRequest
  ): Promise<IPCResponse<any>> {
    try {
      logInfo(
        `Adding item with add-ons to order: ${data.orderId}`,
        'OrderController'
      );

      // Start atomic transaction for order item + add-ons + inventory
      const result = await this.prisma.$transaction(async (tx: any) => {
        // Step 1: Add the base order item (using existing logic)
        const menuItemId = data.item.menuItemId!;
        const quantity = data.item.quantity || 1;

        // Get the menu item to determine pricing
        const menuItem = await tx.menuItem.findUnique({
          where: { id: menuItemId },
        });

        if (!menuItem) {
          throw new Error(`Menu item ${menuItemId} not found`);
        }

        const unitPrice = data.item.unitPrice || menuItem.price;
        const baseItemPrice = Number(unitPrice) * quantity;

        // ✅ CRITICAL FIX: Don't merge items in backend - let frontend handle matching
        // The frontend already has sophisticated addon comparison logic
        // Backend should ALWAYS create new items - frontend decides when to update existing ones
        // This prevents issues where items with different addons get merged
        
        // Always create new item
        const orderItem = await tx.orderItem.create({
          data: {
            orderId: data.orderId,
            menuItemId: menuItemId,
            quantity: quantity,
            unitPrice: unitPrice,
            totalPrice: baseItemPrice,
            notes: data.item.notes || null,
          },
          include: { menuItem: true },
        });


        // Step 2: Process base item inventory deduction
        await this.deductMenuItemInventory(tx, menuItemId, quantity);

        // Step 3: Process add-on selections if provided
        let totalAddonPrice = 0;
        let addonAssignments: any[] = [];

        if (data.item.addonSelections && data.item.addonSelections.length > 0) {
          logInfo(
            `Processing ${data.item.addonSelections.length} add-on selections`,
            'OrderController'
          );

          for (const selection of data.item.addonSelections) {
            // Get add-on details
            const addon = await tx.addon.findUnique({
              where: { id: selection.addonId },
              include: {
                inventory: true,
                addonGroup: true,
              },
            });

            if (!addon || !addon.isActive) {
              throw new Error(
                `Add-on ${selection.addonId} not found or inactive`
              );
            }

            // Check stock availability if linked to inventory
            if (addon.inventory) {
              if (addon.inventory.currentStock < selection.quantity) {
                throw new Error(
                  `Insufficient stock for add-on ${addon.name}. Available: ${addon.inventory.currentStock}, Required: ${selection.quantity}`
                );
              }
            }

            // Calculate add-on pricing
            const addonUnitPrice = selection.unitPrice || addon.price;
            const addonTotalPrice = selection.quantity * addonUnitPrice;
            totalAddonPrice += addonTotalPrice;

            // Create add-on assignment
            const assignment = await tx.orderItemAddon.create({
              data: {
                id: `order-item-addon-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                orderItemId: orderItem.id,
                addonId: selection.addonId,
                quantity: selection.quantity,
                unitPrice: addonUnitPrice,
                totalPrice: addonTotalPrice,
              },
              include: {
                addon: {
                  include: {
                    addonGroup: true,
                  },
                },
              },
            });

            addonAssignments.push(assignment);

            // Deduct add-on inventory if linked
            if (addon.inventory) {
              await tx.inventory.update({
                where: { id: addon.inventory.id },
                data: {
                  currentStock: {
                    decrement: selection.quantity,
                  },
                  updatedAt: new Date().toISOString(),
                },
              });

              logInfo(
                `Deducted add-on inventory: ${addon.name} - ${selection.quantity}`,
                'OrderController'
              );
            }
          }
        }

        // Step 4: Update order item total price with add-ons
        const finalItemPrice = Number(orderItem.totalPrice) + totalAddonPrice;

        orderItem = await tx.orderItem.update({
          where: { id: orderItem.id },
          data: {
            totalPrice: finalItemPrice,
            updatedAt: new Date(),
          },
          include: { menuItem: true },
        });

        // Step 5: Update order totals
        const allItems = await tx.orderItem.findMany({
          where: { orderId: data.orderId },
        });
        const orderSubtotal = allItems.reduce(
          (sum: number, item: any) => sum + Number(item.totalPrice),
          0
        );

        await tx.order.update({
          where: { id: data.orderId },
          data: {
            subtotal: orderSubtotal,
            total: orderSubtotal, // Assuming no tax for simplicity
            updatedAt: new Date(),
          },
        });

        logInfo(
          `Order item with add-ons added successfully`,
          'OrderController'
        );

        // Return comprehensive result
        return {
          orderItem: {
            id: orderItem.id,
            orderId: orderItem.orderId,
            menuItemId: orderItem.menuItemId,
            quantity: orderItem.quantity,
            unitPrice: Number(orderItem.unitPrice),
            totalPrice: Number(orderItem.totalPrice),
            notes: orderItem.notes,
            status: orderItem.status,
            createdAt: toISOString(orderItem.createdAt),
            updatedAt: toISOString(orderItem.updatedAt),
            menuItem: orderItem.menuItem
              ? {
                  id: orderItem.menuItem.id,
                  name: orderItem.menuItem.name,
                  description: orderItem.menuItem.description,
                  price: Number(orderItem.menuItem.price),
                  categoryId: orderItem.menuItem.categoryId,
                  isActive: orderItem.menuItem.isActive,
                }
              : undefined,
          },
          addons: addonAssignments.map(assignment => ({
            id: assignment.id,
            addonId: assignment.addonId,
            quantity: assignment.quantity,
            unitPrice: Number(assignment.unitPrice),
            totalPrice: Number(assignment.totalPrice),
            addon: {
              id: assignment.addon.id,
              name: assignment.addon.name,
              description: assignment.addon.description,
              price: Number(assignment.addon.price),
              addonGroup: {
                id: assignment.addon.addonGroup.id,
                name: assignment.addon.addonGroup.name,
              },
            },
          })),
          summary: {
            baseItemPrice: Number(orderItem.totalPrice) - totalAddonPrice,
            totalAddonPrice: totalAddonPrice,
            finalItemPrice: Number(orderItem.totalPrice),
            orderSubtotal: orderSubtotal,
          },
        };
      });

      return {
        success: true,
        data: result,
        message: 'Order item with add-ons added successfully',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logError(error, 'OrderController.addOrderItemWithAddons');

      if (isAddonError(error)) {
        const formattedError = AddonErrorHandler.formatForApi(error);
        return {
          success: false,
          error: formattedError.error.message,
          timestamp: formattedError.error.timestamp,
        };
      }

      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to add order item with add-ons',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Add add-ons to existing order item
   */
  async addAddonsToExistingOrderItem(
    data: UpdateOrderItemAddonsRequest
  ): Promise<IPCResponse<any>> {
    try {
      logInfo(
        `Adding add-ons to existing order item: ${data.orderItemId}`,
        'OrderController'
      );

      const result = await this.addonService.addAddonsToOrderItem(
        data.orderItemId,
        data.addonSelections
      );

      if (!result.success) {
        return {
          success: false,
          error: (result as any).error.message,
          timestamp: new Date().toISOString(),
        };
      }

      return {
        success: true,
        data: result.data,
        message: 'Add-ons added to order item successfully',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logError(error, 'OrderController.addAddonsToExistingOrderItem');
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to add add-ons to order item',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Remove add-on from order item
   */
  async removeAddonFromOrderItem(
    data: RemoveOrderItemAddonRequest
  ): Promise<IPCResponse<any>> {
    try {
      logInfo(
        `Removing add-on from order item: ${data.orderItemId}`,
        'OrderController'
      );

      const result = await this.addonService.removeAddonFromOrderItem(
        data.orderItemId,
        data.addonId
      );

      if (!result.success) {
        return {
          success: false,
          error: (result as any).error.message,
          timestamp: new Date().toISOString(),
        };
      }

      return {
        success: true,
        data: result.data,
        message: 'Add-on removed from order item successfully',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logError(error, 'OrderController.removeAddonFromOrderItem');
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to remove add-on from order item',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Get add-ons for order item
   */
  async getOrderItemAddons(orderItemId: string): Promise<IPCResponse<any>> {
    try {
      const result = await this.addonService.getOrderItemAddons(orderItemId);

      if (!result.success) {
        return {
          success: false,
          error: (result as any).error.message,
          timestamp: new Date().toISOString(),
        };
      }

      return {
        success: true,
        data: result.data,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logError(error, 'OrderController.getOrderItemAddons');
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to get order item add-ons',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Helper method to deduct menu item inventory
   * Replicates the existing inventory deduction logic
   */
  private async deductMenuItemInventory(
    tx: any,
    menuItemId: string,
    quantity: number
  ): Promise<void> {
    // Get the ingredients for this menu item
    const ingredients = await tx.menuItemInventory.findMany({
      where: { menuItemId },
      include: { inventory: true },
    });

    if (ingredients && ingredients.length > 0) {
      // Calculate required inventory for each ingredient
      const inventoryUpdates: Map<string, number> = new Map();

      for (const inventoryLink of ingredients) {
        const inventoryId = inventoryLink.inventoryId;
        const requiredQuantity = inventoryLink.quantity * quantity;

        // Add to existing quantity or create new entry
        const currentTotal = inventoryUpdates.get(inventoryId) || 0;
        inventoryUpdates.set(inventoryId, currentTotal + requiredQuantity);
      }

      // Process inventory updates atomically
      for (const [
        inventoryId,
        requiredQuantity,
      ] of Array.from(inventoryUpdates.entries())) {
        // Get current inventory
        const inventoryItem = await tx.inventory.findUnique({
          where: { id: inventoryId },
        });

        if (!inventoryItem) {
          console.warn(
            `Inventory item ${inventoryId} not found during item addition`
          );
          continue;
        }

        // Calculate new stock level
        const currentStock = Number(inventoryItem.currentStock);
        const newStock = currentStock - requiredQuantity;

        // Check if we have enough stock
        if (newStock < 0) {
          throw new Error(
            `Insufficient stock for item: ${inventoryItem.itemName}. Available: ${currentStock}, Required: ${requiredQuantity}`
          );
        }

        // Update inventory atomically
        await tx.inventory.update({
          where: { id: inventoryId },
          data: { currentStock: newStock },
        });

        // Log the transaction for audit
        await tx.auditLog.create({
          data: {
            action: 'INVENTORY_DECREASE',
            tableName: 'inventory',
            recordId: inventoryId,
            newValues: {
              reason: 'Menu item added to order',
              menuItemId: menuItemId,
              previousStock: currentStock,
              used: requiredQuantity,
              newStock: newStock,
            },
          },
        });
      }
    }
  }

  /**
   * Enhanced remove order item with add-on cleanup
   */
  async removeOrderItemWithAddons(
    orderId: string,
    itemId: string,
    userId: string
  ): Promise<IPCResponse<boolean>> {
    try {
      logInfo(`Removing order item with add-ons: ${itemId}`, 'OrderController');

      const result = await this.prisma.$transaction(async (tx: any) => {
        // Step 1: Get order item with add-ons
        const orderItem = await tx.orderItem.findUnique({
          where: { id: itemId },
          include: {
            menuItem: true,
            orderItemAddons: {
              include: {
                addon: {
                  include: {
                    inventory: true,
                  },
                },
              },
            },
          },
        });

        if (!orderItem) {
          throw new Error('Order item not found');
        }

        // Step 2: Restore add-on inventory
        for (const addonAssignment of orderItem.orderItemAddons) {
          if (addonAssignment.addon.inventory) {
            await tx.inventory.update({
              where: { id: addonAssignment.addon.inventory.id },
              data: {
                currentStock: {
                  increment: addonAssignment.quantity,
                },
                updatedAt: new Date().toISOString(),
              },
            });

            logInfo(
              `Restored add-on inventory: ${addonAssignment.addon.name} + ${addonAssignment.quantity}`,
              'OrderController'
            );
          }
        }

        // Step 3: Remove add-on assignments
        await tx.orderItemAddon.deleteMany({
          where: { orderItemId: itemId },
        });

        // Step 4: Restore menu item inventory (using existing logic)
        const menuItemId = orderItem.menuItemId;
        const quantity = orderItem.quantity;

        // Get menu item ingredients
        const ingredients = await tx.menuItemInventory.findMany({
          where: { menuItemId },
          include: { inventory: true },
        });

        if (ingredients && ingredients.length > 0) {
          for (const link of ingredients) {
            const inventoryId = link.inventoryId;
            const amountToRestore = link.quantity * quantity;

            await tx.inventory.update({
              where: { id: inventoryId },
              data: {
                currentStock: {
                  increment: amountToRestore,
                },
                updatedAt: new Date().toISOString(),
              },
            });
          }
        }

        // Step 5: Remove order item
        await tx.orderItem.delete({
          where: { id: itemId },
        });

        // Step 6: Update order totals
        const remainingItems = await tx.orderItem.findMany({
          where: { orderId },
        });

        const orderSubtotal = remainingItems.reduce(
          (sum: number, item: any) => sum + Number(item.totalPrice),
          0
        );

        await tx.order.update({
          where: { id: orderId },
          data: {
            subtotal: orderSubtotal,
            total: orderSubtotal,
            updatedAt: new Date(),
          },
        });

        return true;
      });

      return {
        success: true,
        data: result,
        message: 'Order item and add-ons removed successfully',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logError(error, 'OrderController.removeOrderItemWithAddons');
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to remove order item with add-ons',
        timestamp: new Date().toISOString(),
      };
    }
  }
}
