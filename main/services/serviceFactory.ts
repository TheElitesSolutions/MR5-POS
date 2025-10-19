/**
 * Service Factory for mr5-POS Electron Application
 * Provides a convenient way to create and register services
 */

import { logInfo } from '../error-handler';
import { ExtendedPrismaClient } from '../prisma';
import { MenuItemService } from './menuItemService';
import { OrderService } from './orderService';
import { ServiceRegistry } from './serviceRegistry';
import { TableService } from './tableService';
import { InventoryService } from './inventoryService';

/**
 * Service Factory class
 * Provides static methods to create and register services
 */
export class ServiceFactory {
  /**
   * Initialize all services
   * @param prisma The Prisma client instance for database access
   * @returns The ServiceRegistry instance
   */
  public static initializeServices(
    prisma: ExtendedPrismaClient
  ): ServiceRegistry {
    logInfo('Initializing all services...', 'ServiceFactory');

    const registry = ServiceRegistry.getInstance(prisma);

    // Register all services
    // Note: AuthService is not registered here as AuthController uses UserModel directly
    this.registerMenuItemService(registry);
    this.registerTableService(registry);
    this.registerOrderService(registry);
    this.registerInventoryService(registry);
    // Add more service registrations here as needed

    logInfo('All services initialized', 'ServiceFactory');
    return registry;
  }

  /**
   * Register the MenuItemService
   * @param registry The ServiceRegistry instance
   * @returns The MenuItemService instance
   */
  public static registerMenuItemService(
    registry: ServiceRegistry
  ): MenuItemService {
    return registry.registerService(MenuItemService);
  }

  /**
   * Register the TableService
   * @param registry The ServiceRegistry instance
   * @returns The TableService instance
   */
  public static registerTableService(registry: ServiceRegistry): TableService {
    return registry.registerService(TableService);
  }

  /**
   * Register the OrderService
   * @param registry The ServiceRegistry instance
   * @returns The OrderService instance
   */
  public static registerOrderService(registry: ServiceRegistry): OrderService {
    return registry.registerService(OrderService);
  }

  /**
   * Register the InventoryService
   * @param registry The ServiceRegistry instance
   * @returns The InventoryService instance
   */
  public static registerInventoryService(registry: ServiceRegistry): InventoryService {
    return registry.registerService(InventoryService);
  }

  // Add more service registration methods here as needed
}
