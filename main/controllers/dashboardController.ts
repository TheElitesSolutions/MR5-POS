import { IpcMainInvokeEvent } from 'electron';
import { BaseController } from './baseController';
import { DASHBOARD_CHANNELS } from '../../shared/ipc-channels';
import type {
  IPCResponse,
  DashboardData,
  DashboardDateRange,
  DashboardSalesData,
} from '../../shared/ipc-types';
import { OrderService } from '../services/orderService';
import { MenuItemService } from '../services/menuItemService';
import { TableService } from '../services/tableService';
import { enhancedLogger, LogCategory } from '../utils/enhanced-logger';
import { ServiceRegistry } from '../services/serviceRegistry';
import { prisma } from '../db/prisma-wrapper';
import { getCurrentLocalDateTime } from '../utils/dateTime';
// Removed unused import: Decimal

/**
 * Dashboard Controller handles IPC communication for dashboard analytics
 * Aggregates data from multiple services to provide comprehensive dashboard data
 */
export class DashboardController extends BaseController {
  private orderService: OrderService;
  private menuItemService: MenuItemService;
  private tableService: TableService;

  constructor() {
    super();

    // Use ServiceRegistry for proper service instantiation
    const registry = ServiceRegistry.getInstance(prisma as any);
    this.orderService = registry.registerService(OrderService);
    this.menuItemService = registry.registerService(MenuItemService);
    this.tableService = registry.registerService(TableService);

    // this.initialize(); // Removed: StartupManager calls initialize() explicitly
  }

  protected registerHandlers(): void {
    // Get consolidated dashboard data
    this.registerHandler(
      DASHBOARD_CHANNELS.GET_DATA,
      this.getDashboardData.bind(this)
    );

    enhancedLogger.info(
      'DashboardController initialized with data aggregation capabilities',
      LogCategory.SYSTEM,
      'DashboardController'
    );
  }

  /**
   * Get consolidated dashboard data from multiple services
   */
  private async getDashboardData(
    _event: IpcMainInvokeEvent,
    dateRange?: DashboardDateRange
  ): Promise<IPCResponse<DashboardData>> {
    try {
      enhancedLogger.info(
        'Fetching dashboard data',
        LogCategory.BUSINESS,
        'DashboardController'
      );

      // Set default date range to today if not provided
      const today = new Date();
      const defaultDateRange = {
        startDate: new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate()
        ).toISOString(),
        endDate: new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate(),
          23,
          59,
          59
        ).toISOString(),
      };

      const effectiveDateRange = dateRange || defaultDateRange;

      console.log('🔍 Dashboard Debug - Date Range:', {
        startDate: effectiveDateRange.startDate,
        endDate: effectiveDateRange.endDate,
        providedDateRange: dateRange,
      });

      // Fetch data from multiple services in parallel
      const [orderStatsResponse, menuStatsResponse, tablesResponse] =
        await Promise.all([
          this.orderService.getStats({
            startDate: effectiveDateRange.startDate,
            endDate: effectiveDateRange.endDate,
          }),
          this.menuItemService.getStats(),
          this.tableService.findAll(),
        ]);

      // Check if all responses are successful
      if (!orderStatsResponse.success) {
        throw new Error(
          orderStatsResponse.error || 'Failed to fetch order stats'
        );
      }
      if (!menuStatsResponse.success) {
        throw new Error(
          menuStatsResponse.error || 'Failed to fetch menu stats'
        );
      }
      if (!tablesResponse.success) {
        throw new Error(tablesResponse.error || 'Failed to fetch tables');
      }

      const orderStats = orderStatsResponse.data!;
      // const menuStats = menuStatsResponse.data!; // Currently unused but available for future use
      const tables = tablesResponse.data!;

      // Calculate KPIs
      const totalRevenue = Number(orderStats.sales.total) || 0;
      const totalOrders = orderStats.totalOrders || 0;
      const averageOrderValue = Number(orderStats.sales.average) || 0;

      console.log('🔍 Dashboard Debug - Order Stats:', {
        totalRevenue,
        totalOrders,
        averageOrderValue,
        rawOrderStats: orderStats,
        salesData: orderStats.sales,
        topItemsCount: orderStats.topItems?.length || 0,
        topItems: orderStats.topItems
      });

      // Simple profit calculation (you can enhance this with actual cost data)
      const estimatedCosts = totalRevenue * 0.65; // 65% cost ratio
      const netProfit = totalRevenue - estimatedCosts;

      const kpis = [
        {
          title: 'Total Revenue',
          value: totalRevenue,
          format: 'currency' as const,
          trend: 'up' as const,
          change: 8.2, // You can calculate this from historical data
        },
        {
          title: 'Total Orders',
          value: totalOrders,
          format: 'number' as const,
          trend: 'up' as const,
          change: 12.5,
        },
        {
          title: 'Average Order Value',
          value: averageOrderValue,
          format: 'currency' as const,
          trend: 'down' as const,
          change: -2.1,
        },
        {
          title: 'Net Profit',
          value: netProfit,
          format: 'currency' as const,
          trend: 'up' as const,
          change: 5.8,
        },
      ];

      // Generate sales data (you can enhance this with daily breakdowns)
      const salesData: DashboardSalesData[] = [
        {
          date: effectiveDateRange.startDate.split('T')[0]!,
          revenue: totalRevenue,
          orders: totalOrders,
          averageOrderValue: averageOrderValue,
        },
      ];

      // Get top menu items from existing data
      const topMenuItems =
        orderStats.topItems?.slice(0, 5).map((item: any, index: number) => {
          // Calculate profit margin based on revenue (using industry standard ~35% cost of goods)
          const revenue = Number(item.sales) || 0;
          const estimatedCost = revenue * 0.35; // 35% cost ratio
          const profit = revenue - estimatedCost;
          const profitMargin = revenue > 0 ? (profit / revenue) * 100 : 0;
          
          return {
            id: `item-${index}`,
            name: item.name || 'Unknown Item',
            totalSold: Number(item.quantity) || 0,
            revenue: revenue,
            category: item.category || 'Uncategorized',
            profitMargin: profitMargin,
          };
        }) || [];

      // Generate recent activity (you can enhance this with actual activity tracking)
      const recentActivity = [
        {
          id: '1',
          type: 'order_completed' as const,
          description: `Latest order completed - $${totalRevenue.toFixed(2)}`,
          timestamp: new Date(),
          metadata: { amount: totalRevenue },
        },
      ];

      // Count active tables
      const activeTables = tables.filter(
        (table: any) =>
          table.status === 'OCCUPIED' || table.status === 'RESERVED'
      ).length;

      const dashboardData: DashboardData = {
        kpis,
        salesData,
        topMenuItems,
        recentActivity,
        totalRevenue,
        totalOrders,
        averageOrderValue,
        activeTables,
      };

      enhancedLogger.info(
        `Dashboard data compiled successfully: ${totalOrders} orders, $${totalRevenue.toFixed(2)} revenue`,
        LogCategory.BUSINESS,
        'DashboardController'
      );

      return {
        success: true,
        data: dashboardData,
        timestamp: getCurrentLocalDateTime(),
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to fetch dashboard data';

      enhancedLogger.error(
        `Dashboard data fetch error: ${errorMessage}`,
        LogCategory.SYSTEM,
        'DashboardController',
        {
          stack: error instanceof Error ? error.stack : undefined,
        }
      );

      return {
        success: false,
        error: errorMessage,
        timestamp: getCurrentLocalDateTime(),
      };
    }
  }
}
