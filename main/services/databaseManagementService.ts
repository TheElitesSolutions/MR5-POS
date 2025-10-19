import { PrismaClient } from '../db/prisma-wrapper';
import { logInfo, logError } from '../error-handler';
import bcrypt from 'bcrypt';

/**
 * Database Management Service
 * Handles dangerous database operations like clearing data
 */
export class DatabaseManagementService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Verify user password before allowing dangerous operations
   */
  async verifyAdminPassword(username: string, password: string): Promise<boolean> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { username },
      });

      if (!user || user.role !== 'ADMIN') {
        return false;
      }

      return await bcrypt.compare(password, user.password);
    } catch (error) {
      logError(error as Error, 'verifyAdminPassword');
      return false;
    }
  }

  /**
   * Clear all database data except the default admin user
   * WARNING: This is a destructive operation!
   */
  async clearDatabase(adminUsername: string = 'admin'): Promise<{
    success: boolean;
    deletedCounts?: {
      orders: number;
      orderItems: number;
      customers: number;
      menuItems: number;
      categories: number;
      addons: number;
      inventory: number;
      expenses: number;
      tables: number;
      users: number;
    };
    error?: string;
  }> {
    try {
      logInfo('🗑️ Starting database clear operation...');

      // Get admin user ID to preserve it
      const adminUser = await this.prisma.user.findUnique({
        where: { username: adminUsername },
      });

      if (!adminUser) {
        return {
          success: false,
          error: `Admin user '${adminUsername}' not found`,
        };
      }

      // Delete in correct order to respect foreign key constraints
      logInfo('Deleting orders and related data...');

      // Delete payments first (foreign key to orders)
      await this.prisma.payment.deleteMany({});

      // Delete order item addons
      await this.prisma.orderItemAddon.deleteMany({});

      // Delete order items
      const deletedOrderItems = await this.prisma.orderItem.deleteMany({});

      // Delete orders
      const deletedOrders = await this.prisma.order.deleteMany({});

      logInfo('Deleting customers...');
      const deletedCustomers = await this.prisma.customer.deleteMany({});

      logInfo('Deleting menu-related data...');
      // Delete addon category assignments
      await this.prisma.categoryAddonGroup.deleteMany({});

      // Delete menu item inventory links
      await this.prisma.menuItemInventory.deleteMany({});

      // Delete addons
      const deletedAddons = await this.prisma.addon.deleteMany({});

      // Delete addon groups
      await this.prisma.addonGroup.deleteMany({});

      // Delete menu items
      const deletedMenuItems = await this.prisma.menuItem.deleteMany({});

      // Delete categories
      const deletedCategories = await this.prisma.category.deleteMany({});

      logInfo('Deleting inventory and expenses...');
      const deletedInventory = await this.prisma.inventory.deleteMany({});
      const deletedExpenses = await this.prisma.expense.deleteMany({});

      logInfo('Deleting tables...');
      const deletedTables = await this.prisma.table.deleteMany({});

      logInfo('Deleting users (except admin)...');
      const deletedUsers = await this.prisma.user.deleteMany({
        where: {
          id: { not: adminUser.id },
        },
      });

      logInfo('Deleting audit logs...');
      await this.prisma.auditLog.deleteMany({});

      const deletedCounts = {
        orders: deletedOrders.count,
        orderItems: deletedOrderItems.count,
        customers: deletedCustomers.count,
        menuItems: deletedMenuItems.count,
        categories: deletedCategories.count,
        addons: deletedAddons.count,
        inventory: deletedInventory.count,
        expenses: deletedExpenses.count,
        tables: deletedTables.count,
        users: deletedUsers.count,
      };

      logInfo('✅ Database cleared successfully', deletedCounts);

      return {
        success: true,
        deletedCounts,
      };
    } catch (error) {
      logError(error as Error, 'clearDatabase');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

