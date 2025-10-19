/**
 * Add-On Management Service
 *
 * Comprehensive service for managing add-ons with transaction-safe operations,
 * inventory integration, and business rule validation
 */

import { PrismaClient } from '../prisma';
import { Decimal } from 'decimal.js';
import {
  AddonSchema,
  AddonGroupSchema,
  CategoryAddonGroupSchema,
  OrderItemAddonSchema,
  CreateAddonSchema,
  UpdateAddonSchema,
  CreateAddonGroupSchema,
  UpdateAddonGroupSchema,
  CreateCategoryAddonGroupSchema,
  UpdateCategoryAddonGroupSchema,
} from '../../shared/validation/addon-schemas';
import {
  AddonError,
  AddonErrorFactory,
  AddonErrorCodes,
  isAddonError,
} from '../errors/AddonError';
import type { z } from 'zod';

// Type definitions
type AddonData = z.infer<typeof AddonSchema>;
type AddonGroupData = z.infer<typeof AddonGroupSchema>;
type CategoryAddonGroupData = z.infer<typeof CategoryAddonGroupSchema>;
type OrderItemAddonData = z.infer<typeof OrderItemAddonSchema>;

type CreateAddonData = z.infer<typeof CreateAddonSchema>;
type UpdateAddonData = z.infer<typeof UpdateAddonSchema>;
type CreateAddonGroupData = z.infer<typeof CreateAddonGroupSchema>;
type UpdateAddonGroupData = z.infer<typeof UpdateAddonGroupSchema>;
type CreateCategoryAddonGroupData = z.infer<
  typeof CreateCategoryAddonGroupSchema
>;
type UpdateCategoryAddonGroupData = z.infer<
  typeof UpdateCategoryAddonGroupSchema
>;

// Add-on selection interface for order processing
export interface AddonSelection {
  addonId: string;
  quantity: number;
  unitPrice?: number; // Optional - will be fetched if not provided
}

// Service result wrapper for consistent API responses
export interface ServiceResult<T> {
  success: true;
  data: T;
}

export interface ServiceError {
  success: false;
  error: AddonError;
}

export type ServiceResponse<T> = ServiceResult<T> | ServiceError;

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
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * ===== ADDON GROUP MANAGEMENT =====
   */

  /**
   * Create a new add-on group
   */
  async createAddonGroup(
    data: CreateAddonGroupData
  ): Promise<ServiceResponse<AddonGroupData>> {
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
    } catch (error) {
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
  async getAddonGroup(id: string): Promise<ServiceResponse<AddonGroupData>> {
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
    } catch (error) {
      return {
        success: false,
        error: AddonErrorFactory.databaseError('getAddonGroup', error),
      };
    }
  }

  /**
   * Get all add-on groups with optional filtering
   */
  async getAddonGroups(filters?: {
    isActive?: boolean;
    categoryId?: string;
    includeAddons?: boolean;
  }): Promise<ServiceResponse<AddonGroupData[]>> {
    try {
      const where: any = {};

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
    } catch (error) {
      return {
        success: false,
        error: AddonErrorFactory.databaseError('getAddonGroups', error),
      };
    }
  }

  /**
   * Update add-on group
   */
  async updateAddonGroup(
    id: string,
    data: UpdateAddonGroupData
  ): Promise<ServiceResponse<AddonGroupData>> {
    try {
      const validatedData = UpdateAddonGroupSchema.parse(data);

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
      if (validatedData.name && validatedData.name !== existingGroup.name) {
        const nameExists = await this.prisma.addonGroup.findFirst({
          where: {
            name: validatedData.name,
            id: { not: id },
            isActive: true,
          },
        });

        if (nameExists) {
          return {
            success: false,
            error: AddonErrorFactory.addonGroupNameExists(validatedData.name),
          };
        }
      }

      const updatedGroup = await this.prisma.addonGroup.update({
        where: { id },
        data: {
          ...validatedData,
          updatedAt: new Date(),
        },
      });

      return {
        success: true,
        data: AddonGroupSchema.parse(updatedGroup),
      };
    } catch (error) {
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
  async deleteAddonGroup(
    id: string
  ): Promise<ServiceResponse<{ deleted: boolean }>> {
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
          error: AddonErrorFactory.addonGroupHasAddons(
            id,
            existingGroup._count.addons
          ),
        };
      }

      // Soft delete the group
      await this.prisma.addonGroup.update({
        where: { id },
        data: {
          isActive: false,
          updatedAt: new Date(),
        },
      });

      return {
        success: true,
        data: { deleted: true },
      };
    } catch (error) {
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
  async createAddon(
    data: CreateAddonData
  ): Promise<ServiceResponse<AddonData>> {
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
          error: AddonErrorFactory.addonGroupNotFound(
            validatedData.addonGroupId
          ),
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
          error: AddonErrorFactory.addonNameExists(
            validatedData.name,
            validatedData.addonGroupId
          ),
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
            sortOrder: validatedData.sortOrder ?? 0,
          },
        });

        // Create inventory item relationships if provided
        if (validatedData.inventoryItems && validatedData.inventoryItems.length > 0) {
          await Promise.all(
            validatedData.inventoryItems.map(item =>
              tx.addonInventoryItem.create({
                data: {
                  addonId: addon.id,
                  inventoryId: item.inventoryId,
                  quantity: item.quantity ?? 0,
                },
              })
            )
          );
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
    } catch (error) {
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
  async getAddon(id: string): Promise<ServiceResponse<AddonData>> {
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
    } catch (error) {
      return {
        success: false,
        error: AddonErrorFactory.databaseError('getAddon', error),
      };
    }
  }

  /**
   * Get add-ons by group ID
   */
  async getAddonsByGroup(
    groupId: string
  ): Promise<ServiceResponse<AddonData[]>> {
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
    } catch (error) {
      return {
        success: false,
        error: AddonErrorFactory.databaseError('getAddonsByGroup', error),
      };
    }
  }

  /**
   * Get add-ons by category ID
   */
  async getAddonsByCategory(categoryId: string): Promise<
    ServiceResponse<{
      groups: AddonGroupData[];
      totalAddons: number;
    }>
  > {
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

      const totalAddons = addonGroups.reduce(
        (sum, group) => sum + group.addons.length,
        0
      );

      return {
        success: true,
        data: {
          groups: addonGroups.map(group => AddonGroupSchema.parse(group)),
          totalAddons,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: AddonErrorFactory.databaseError('getAddonsByCategory', error),
      };
    }
  }

  /**
   * Update add-on
   */
  async updateAddon(
    id: string,
    data: UpdateAddonData
  ): Promise<ServiceResponse<AddonData>> {
    try {
      const validatedData = UpdateAddonSchema.parse(data);

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
            error: AddonErrorFactory.addonNameExists(
              validatedData.name,
              existingAddon.addonGroupId
            ),
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
            updatedAt: new Date(),
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
            await Promise.all(
              inventoryItems.map(item =>
                tx.addonInventoryItem.create({
                  data: {
                    addonId: id,
                    inventoryId: item.inventoryId,
                    quantity: item.quantity ?? 0,
                  },
                })
              )
            );
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
    } catch (error) {
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
  async deleteAddon(
    id: string
  ): Promise<ServiceResponse<{ deleted: boolean }>> {
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
          error: new AddonError(
            AddonErrorCodes.ADDON_NOT_FOUND, // Using existing code, could add ADDON_IN_USE
            `Cannot delete add-on '${id}' because it is used in ${existingAddon._count.orderItemAddons} orders`,
            409,
            { addonId: id, orderCount: existingAddon._count.orderItemAddons }
          ),
        };
      }

      // Soft delete the add-on
      await this.prisma.addon.update({
        where: { id },
        data: {
          isActive: false,
          updatedAt: new Date(),
        },
      });

      return {
        success: true,
        data: { deleted: true },
      };
    } catch (error) {
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
  async addAddonsToOrderItem(
    orderItemId: string,
    addonSelections: AddonSelection[]
  ): Promise<ServiceResponse<OrderItemAddonData[]>> {
    try {
      // Validate input
      if (!addonSelections.length) {
        return {
          success: false,
          error: new AddonError(
            AddonErrorCodes.VALIDATION_FAILED,
            'At least one add-on selection is required',
            400
          ),
        };
      }

      // Transaction-safe operation
      const result = await this.prisma.$transaction(async tx => {
        // 1. Verify order item exists
        const orderItem = await tx.orderItem.findUnique({
          where: { id: orderItemId },
          include: {
            order: true,
          },
        });

        if (!orderItem) {
          throw AddonErrorFactory.orderItemNotFound(orderItemId);
        }

        // 2. Validate and prepare add-on selections
        const processedSelections: Array<AddonSelection & { addon: any }> = [];

        for (const selection of addonSelections) {
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

          if (!addon || !addon.isActive) {
            throw AddonErrorFactory.addonNotFound(selection.addonId);
          }

          // Check if already added
          const existing = await tx.orderItemAddon.findFirst({
            where: {
              orderItemId,
              addonId: selection.addonId,
            },
          });

          if (existing) {
            throw AddonErrorFactory.addonAlreadyAdded(
              orderItemId,
              selection.addonId
            );
          }

          // Check stock availability for all inventory items
          if (addon.inventoryItems && addon.inventoryItems.length > 0) {
            for (const addonInvItem of addon.inventoryItems) {
              if (addonInvItem.inventory && addonInvItem.quantity > 0) {
                const totalToDeduct = addonInvItem.quantity * selection.quantity;
                if (Number(addonInvItem.inventory.currentStock) < totalToDeduct) {
                  throw AddonErrorFactory.insufficientStock(
                    selection.addonId,
                    totalToDeduct,
                    Number(addonInvItem.inventory.currentStock)
                  );
                }
              }
            }
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

        const addonAssignments = await Promise.all(
          processedSelections.map(selection =>
            tx.orderItemAddon.create({
              data: {
                orderItemId,
                addonId: selection.addonId,
                addonName: selection.addon.name, // Store addon name for historical accuracy
                quantity: selection.quantity,
                unitPrice: selection.unitPrice!,
                totalPrice: new Decimal(
                  selection.quantity * selection.unitPrice!
                ),
              },
              include: {
                addon: true,
              },
            })
          )
        );

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
        for (const selection of processedSelections) {
          if (selection.addon.inventoryItems && selection.addon.inventoryItems.length > 0) {
            for (const addonInvItem of selection.addon.inventoryItems) {
              if (addonInvItem.inventory && addonInvItem.quantity > 0) {
                const totalToDeduct = addonInvItem.quantity * selection.quantity;
                await tx.inventory.update({
                  where: { id: addonInvItem.inventoryId },
                  data: {
                    currentStock: {
                      decrement: totalToDeduct,
                    },
                    updatedAt: new Date(),
                  },
                });
              }
            }
          }
        }

        // 5. Update order item total
        const totalAddonCost = processedSelections.reduce(
          (sum, selection) => sum + selection.quantity * selection.unitPrice!,
          0
        );

        // Get current totalPrice and add addon cost
        const currentOrderItem = await tx.orderItem.findUnique({
          where: { id: orderItemId },
        });
        const newItemTotal = Number(currentOrderItem.totalPrice || 0) + totalAddonCost;

        await tx.orderItem.update({
          where: { id: orderItemId },
          data: {
            totalPrice: newItemTotal,
            updatedAt: new Date(),
          },
        });

        // 6. Update order total
        const currentOrder = await tx.order.findUnique({
          where: { id: orderItem.orderId },
        });
        const newOrderTotal = Number(currentOrder.total || 0) + totalAddonCost;
        const newOrderSubtotal = Number(currentOrder.subtotal || 0) + totalAddonCost;

        await tx.order.update({
          where: { id: orderItem.orderId },
          data: {
            total: newOrderTotal,
            subtotal: newOrderSubtotal,
            updatedAt: new Date(),
          },
        });

        return addonAssignments;
      });

      return {
        success: true,
        data: result.map(assignment => OrderItemAddonSchema.parse(assignment)),
      };
    } catch (error) {
      if (isAddonError(error)) {
        return { success: false, error };
      }
      return {
        success: false,
        error: AddonErrorFactory.transactionFailed(
          'addAddonsToOrderItem',
          error
        ),
      };
    }
  }

  /**
   * Remove add-on from order item with transaction safety
   */
  async removeAddonFromOrderItem(
    orderItemId: string,
    addonId: string
  ): Promise<ServiceResponse<{ removed: boolean }>> {
    try {
      const result = await this.prisma.$transaction(async tx => {
        // Find the add-on assignment
        const assignment = await tx.orderItemAddon.findFirst({
          where: {
            orderItemId,
            addonId,
          },
          include: {
            addon: {
              include: {
                inventory: true,
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
          return false;
        }

        // Restore inventory
        if (assignment.addon.inventory) {
          await tx.inventory.update({
            where: { id: assignment.addon.inventory.id },
            data: {
              currentStock: {
                increment: assignment.quantity,
              },
              updatedAt: new Date(),
            },
          });
        }

        // Update order item total
        await tx.orderItem.update({
          where: { id: orderItemId },
          data: {
            totalPrice: {
              decrement: assignment.totalPrice,
            },
            updatedAt: new Date(),
          },
        });

        // Update order total
        await tx.order.update({
          where: { id: assignment.orderItem.orderId },
          data: {
            total: {
              decrement: assignment.totalPrice,
            },
            subtotal: {
              decrement: assignment.totalPrice,
            },
            updatedAt: new Date(),
          },
        });

        // Delete the assignment
        await tx.orderItemAddon.delete({
          where: { id: assignment.id },
        });

        return true;
      });

      return {
        success: true,
        data: { removed: result },
      };
    } catch (error) {
      if (isAddonError(error)) {
        return { success: false, error };
      }
      return {
        success: false,
        error: AddonErrorFactory.transactionFailed(
          'removeAddonFromOrderItem',
          error
        ),
      };
    }
  }

  /**
   * Update addon quantities proportionally when item quantity changes
   * This maintains the addon-to-item ratio
   */
  async scaleAddonQuantities(
    orderItemId: string,
    quantityToAdd: number
  ): Promise<ServiceResponse<{ updated: boolean }>> {
    try {
      const result = await this.prisma.$transaction(async tx => {
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
          // Calculate the quantity to add (same as item quantity change)
          const newQuantity = addonAssignment.quantity + quantityToAdd;

          // ✅ CRITICAL FIX: Only check stock if addon relation exists
          if (addonAssignment.addon) {
            // Check stock availability for the additional quantity
            if (addonAssignment.addon.inventoryItems && addonAssignment.addon.inventoryItems.length > 0) {
              for (const invItem of addonAssignment.addon.inventoryItems) {
                if (invItem.inventory && invItem.quantity > 0) {
                  const totalToDeduct = invItem.quantity * quantityToAdd;
                  if (Number(invItem.inventory.currentStock) < totalToDeduct) {
                    throw AddonErrorFactory.insufficientStock(
                      addonAssignment.addonId,
                      totalToDeduct,
                      Number(invItem.inventory.currentStock)
                    );
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
                      updatedAt: new Date(),
                    },
                  });
                }
              }
            }
          } else {
            console.warn(`Addon relation not loaded for assignment ${addonAssignment.id}, skipping stock operations`);
          }

          // Calculate price change
          const priceChange = addonAssignment.unitPrice * quantityToAdd;
          totalPriceChange += Number(priceChange);

          // Update addon assignment (always do this, even if stock check was skipped)
          await tx.orderItemAddon.update({
            where: { id: addonAssignment.id },
            data: {
              quantity: newQuantity,
              totalPrice: addonAssignment.unitPrice * newQuantity,
              updatedAt: new Date(),
            },
          });
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

        // Calculate total addon price (sum of all addon totalPrices after scaling)
        const allAddonPrices = await tx.orderItemAddon.findMany({
          where: { orderItemId },
          select: { totalPrice: true },
        });
        const totalAddonPrice = allAddonPrices.reduce(
          (sum, addon) => sum + Number(addon.totalPrice),
          0
        );

        // SET the correct total price (base + addons)
        const correctTotalPrice = basePrice + totalAddonPrice;

        await tx.orderItem.update({
          where: { id: orderItemId },
          data: {
            totalPrice: correctTotalPrice,
            updatedAt: new Date(),
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
            updatedAt: new Date(),
          },
        });

        return true;
      });

      return {
        success: true,
        data: { updated: result },
      };
    } catch (error) {
      if (isAddonError(error)) {
        return { success: false, error };
      }
      return {
        success: false,
        error: AddonErrorFactory.transactionFailed(
          'scaleAddonQuantities',
          error
        ),
      };
    }
  }

  /**
   * Get add-ons for an order item
   */
  async getOrderItemAddons(
    orderItemId: string
  ): Promise<ServiceResponse<OrderItemAddonData[]>> {
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
    } catch (error) {
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
  async assignGroupToCategory(
    categoryId: string,
    addonGroupId: string,
    sortOrder: number = 0
  ): Promise<ServiceResponse<any>> {
    try {
      // Check if category exists
      const category = await this.prisma.category.findUnique({
        where: { id: categoryId },
      });

      if (!category) {
        return {
          success: false,
          error: new AddonError(
            AddonErrorCodes.CATEGORY_NOT_FOUND,
            `Category with ID ${categoryId} not found`,
            404
          ),
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
            updatedAt: new Date(),
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
    } catch (error) {
      return {
        success: false,
        error: AddonErrorFactory.databaseError('assignGroupToCategory', error),
      };
    }
  }

  /**
   * Unassign add-on group from category
   */
  async unassignGroupFromCategory(
    categoryId: string,
    addonGroupId: string
  ): Promise<ServiceResponse<{ deleted: boolean }>> {
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
          error: new AddonError(
            AddonErrorCodes.ASSIGNMENT_NOT_FOUND,
            'Category-Group assignment not found',
            404
          ),
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
    } catch (error) {
      return {
        success: false,
        error: AddonErrorFactory.databaseError(
          'unassignGroupFromCategory',
          error
        ),
      };
    }
  }

  /**
   * Get all category assignments
   */
  async getCategoryAssignments(): Promise<ServiceResponse<any[]>> {
    try {
      // Get all assignments
      const assignments = await this.prisma.categoryAddonGroup.findMany({
        orderBy: { sortOrder: 'asc' },
      });

      // Manually fetch categories and addon groups
      const enrichedAssignments = await Promise.all(
        assignments.map(async (assignment: any) => {
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
            console.log(
              `[AddonService] No active addons found for group ${assignment.addonGroupId} (${addonGroup?.name})`
            );
            // Check if there are any addons (including inactive)
            const allAddons = await this.prisma.addon.findMany({
              where: { addonGroupId: assignment.addonGroupId },
            });
            console.log(
              `[AddonService] Total addons (including inactive): ${allAddons.length}`
            );
          }

          return {
            ...assignment,
            category: category ? {
              id: category.id,
              name: (category as any).name,
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
        })
      );

      return {
        success: true,
        data: enrichedAssignments,
      };
    } catch (error) {
      return {
        success: false,
        error: AddonErrorFactory.databaseError('getCategoryAssignments', error),
      };
    }
  }
}
