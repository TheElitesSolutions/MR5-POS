/**
 * Report Service for mr5-POS Electron Application
 * Handles report generation for sales and inventory
 */

import { Decimal } from 'decimal.js';
import { BaseService } from './baseService';
import { IPCResponse } from '../../shared/ipc-types';
import { decimalToNumber } from '../utils/decimal';
import { enhancedLogger, LogCategory } from '../utils/enhanced-logger';
import { getCurrentLocalDateTime } from '../utils/dateTime';

// Report Types
export interface SalesReportData {
  // Summary KPIs
  totalRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
  averageItemsPerOrder: number;

  // Order List
  orders: {
    id: string;
    orderNumber: string;
    createdAt: string;
    type: 'DINE_IN' | 'TAKEOUT' | 'DELIVERY';
    itemCount: number;
    total: number;
    tableName?: string;
  }[];
}

export interface InventoryReportData {
  // Summary KPIs
  totalItems: number;
  totalInventoryValue: number;
  lowStockCount: number;
  outOfStockCount: number;

  // Current Stock Details
  currentStock: {
    id: string;
    name: string;
    category: string;
    currentStock: number;
    minimumStock: number;
    unit: string;
    costPerUnit: number;
    totalValue: number;
    status: 'normal' | 'low' | 'out';
  }[];

  // Low Stock Alerts
  lowStockItems: {
    id: string;
    name: string;
    category: string;
    currentStock: number;
    minimumStock: number;
    unit: string;
    shortageAmount: number;
  }[];

  // Stock Usage (over time period)
  stockUsage: {
    itemId: string;
    itemName: string;
    category: string;
    totalUsed: number;
    unit: string;
    averageDaily: number;
  }[];
}

export interface DateRange {
  startDate: string; // ISO string
  endDate: string; // ISO string
}

export interface ProfitReportData {
  // Summary KPIs
  totalRevenue: number;
  totalFoodCost: number;
  totalExpenses: number;
  totalCost: number;
  grossProfit: number;
  profitMargin: number;
  
  // Per-Order Breakdown
  orderProfitability: {
    id: string;
    orderNumber: string;
    createdAt: string;
    type: string;
    revenue: number;
    foodCost: number;
    allocatedExpenses: number;
    totalCost: number;
    profit: number;
    margin: number;
  }[];
  
  // Per-Item Profitability
  itemProfitability: {
    itemId: string;
    itemName: string;
    category: string;
    unitsSold: number;
    revenue: number;
    foodCostPerUnit: number;
    totalFoodCost: number;
    profitPerUnit: number;
    totalProfit: number;
    margin: number;
  }[];
  
  // Time-based trends
  dailyTrends: {
    date: string;
    revenue: number;
    foodCost: number;
    expenses: number;
    totalCost: number;
    profit: number;
    margin: number;
  }[];
}

export class ReportService extends BaseService {
  /**
   * Generate comprehensive sales report
   */
  async getSalesReport(dateRange: DateRange): Promise<IPCResponse<SalesReportData>> {
    try {
      enhancedLogger.info(
        `Generating sales report from ${dateRange.startDate} to ${dateRange.endDate}`,
        LogCategory.BUSINESS,
        'ReportService'
      );

      // Get all completed orders in the date range
      // SQLite stores dates as TEXT, so we use ISO strings directly
      const orders = await this.prisma.order.findMany({
        where: {
          status: {
            in: ['COMPLETED', 'SERVED'],
          },
          createdAt: {
            gte: dateRange.startDate,
            lte: dateRange.endDate,
          },
        },
        include: {
          items: true,
          table: true,
        },
        orderBy: {
          createdAt: 'desc', // Most recent orders first
        },
      });

      // Calculate summary KPIs
      let totalRevenue = new Decimal(0);
      let totalItems = 0;
      let totalOrders = orders.length;

      // Build order list and calculate totals
      const orderList = orders.map(order => {
        const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
        totalItems += itemCount;
        totalRevenue = totalRevenue.add(new Decimal(order.total || 0));

        return {
          id: order.id,
          orderNumber: order.orderNumber,
          createdAt: order.createdAt,
          type: order.type as 'DINE_IN' | 'TAKEOUT' | 'DELIVERY',
          itemCount,
          total: decimalToNumber(new Decimal(order.total || 0)),
          tableName: order.table?.name || order.tableName,
        };
      });

      const totalRevenueNum = decimalToNumber(totalRevenue);
      const averageOrderValue = totalOrders > 0 
        ? totalRevenueNum / totalOrders
        : 0;
      const averageItemsPerOrder = totalOrders > 0
        ? totalItems / totalOrders
        : 0;

      const reportData: SalesReportData = {
        totalRevenue: totalRevenueNum,
        totalOrders,
        averageOrderValue,
        averageItemsPerOrder,
        orders: orderList,
      };

       enhancedLogger.info(
         `Sales report generated successfully. Total revenue: $${totalRevenueNum.toFixed(2)}, Orders: ${totalOrders}`,
         LogCategory.BUSINESS,
         'ReportService'
       );

       return this.createSuccessResponse(reportData);
     } catch (error) {
       enhancedLogger.error(
         `Failed to generate sales report: ${error}`,
         LogCategory.ERROR,
         'ReportService'
       );
       return this.createErrorResponse(error, 'Failed to generate sales report');
     }
   }

  /**
   * Generate comprehensive inventory report
   */
  async getInventoryReport(dateRange: DateRange): Promise<IPCResponse<InventoryReportData>> {
    try {
      enhancedLogger.info(
        `Generating inventory report from ${dateRange.startDate} to ${dateRange.endDate}`,
        LogCategory.BUSINESS,
        'ReportService'
      );

      // Get all inventory items with their current stock
      // Filter out placeholder items
      const allInventoryItems = await this.prisma.inventory.findMany({
        orderBy: {
          itemName: 'asc',
        },
      });

      // Filter out items with "placeholder" in name or category (case insensitive)
      const inventoryItems = allInventoryItems.filter(item => {
        const nameCheck = !item.itemName?.toLowerCase().includes('placeholder');
        const categoryCheck = !item.category?.toLowerCase().includes('placeholder');
        return nameCheck && categoryCheck;
      });

      const filteredCount = allInventoryItems.length - inventoryItems.length;
      if (filteredCount > 0) {
        enhancedLogger.info(
          `Filtered out ${filteredCount} placeholder items from inventory report`,
          LogCategory.BUSINESS,
          'ReportService'
        );
      }

      // Calculate summary KPIs
      let totalInventoryValue = new Decimal(0);
      let lowStockCount = 0;
      let outOfStockCount = 0;

      const currentStock = inventoryItems.map(item => {
        const currentStockNum = decimalToNumber(new Decimal(item.currentStock || 0));
        const minimumStockNum = decimalToNumber(new Decimal(item.minimumStock || 0));
        const costPerUnitNum = decimalToNumber(new Decimal(item.costPerUnit || 0));
        const totalValue = currentStockNum * costPerUnitNum;
        
        totalInventoryValue = totalInventoryValue.add(new Decimal(totalValue));

        let status: 'normal' | 'low' | 'out' = 'normal';
        if (currentStockNum <= 0) {
          status = 'out';
          outOfStockCount++;
        } else if (currentStockNum < minimumStockNum) {
          status = 'low';
          lowStockCount++;
        }

        return {
          id: item.id,
          name: item.itemName,
          category: item.category || 'Uncategorized',
          currentStock: currentStockNum,
          minimumStock: minimumStockNum,
          unit: item.unit,
          costPerUnit: costPerUnitNum,
          totalValue,
          status,
        };
      });

      // Low Stock Items
      const lowStockItems = currentStock
        .filter(item => item.status === 'low' || item.status === 'out')
        .map(item => ({
          id: item.id,
          name: item.name,
          category: item.category,
          currentStock: item.currentStock,
          minimumStock: item.minimumStock,
          unit: item.unit,
          shortageAmount: Math.max(0, item.minimumStock - item.currentStock),
        }))
        .sort((a, b) => b.shortageAmount - a.shortageAmount);

      // Stock Usage - Get order items in date range to calculate usage
      // SQLite stores dates as TEXT, so we use ISO strings directly
      const orderItems = await this.prisma.orderItem.findMany({
        where: {
          order: {
            createdAt: {
              gte: dateRange.startDate,
              lte: dateRange.endDate,
            },
            status: {
              in: ['COMPLETED', 'SERVED'],
            },
          },
        },
        include: {
          menuItem: {
            include: {
              inventory: {
                include: {
                  inventory: true,
                },
              },
            },
          },
        },
      });

      // Calculate stock usage from menu item inventory requirements
      const usageMap = new Map<string, {
        itemId: string;
        itemName: string;
        category: string;
        totalUsed: number;
        unit: string;
      }>();

      orderItems.forEach(orderItem => {
        const menuItemInventories = orderItem.menuItem?.inventory || [];
        
        menuItemInventories.forEach(mii => {
          const invItem = mii.inventory;
          if (!invItem) return;

          // Filter out placeholder items from usage
          const isPlaceholder = 
            invItem.itemName?.toLowerCase().includes('placeholder') ||
            invItem.category?.toLowerCase().includes('placeholder');
          
          if (isPlaceholder) return;

          const itemId = invItem.id;
          const quantityUsed = decimalToNumber(new Decimal(mii.quantity || 0)) * orderItem.quantity;

          if (!usageMap.has(itemId)) {
            usageMap.set(itemId, {
              itemId,
              itemName: invItem.itemName,
              category: invItem.category || 'Uncategorized',
              totalUsed: 0,
              unit: invItem.unit,
            });
          }

          const usage = usageMap.get(itemId)!;
          usage.totalUsed += quantityUsed;
        });
      });

      // Calculate days in range for average daily calculation
      const startDate = new Date(dateRange.startDate);
      const endDate = new Date(dateRange.endDate);
      const daysInRange = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));

      const stockUsage = Array.from(usageMap.values())
        .map(usage => ({
          ...usage,
          averageDaily: usage.totalUsed / daysInRange,
        }))
        .sort((a, b) => b.totalUsed - a.totalUsed);

      const reportData: InventoryReportData = {
        totalItems: inventoryItems.length,
        totalInventoryValue: decimalToNumber(totalInventoryValue),
        lowStockCount,
        outOfStockCount,
        currentStock,
        lowStockItems,
        stockUsage,
      };

       enhancedLogger.info(
         `Inventory report generated successfully. Total items: ${inventoryItems.length}, Low stock: ${lowStockCount}`,
         LogCategory.BUSINESS,
         'ReportService'
       );

       return this.createSuccessResponse(reportData);
     } catch (error) {
       enhancedLogger.error(
         `Failed to generate inventory report: ${error}`,
         LogCategory.ERROR,
         'ReportService'
       );
      return this.createErrorResponse(error, 'Failed to generate inventory report');
    }
  }

  /**
   * Generate comprehensive profit report with revenue and cost analysis
   */
  async getProfitReport(dateRange: DateRange): Promise<IPCResponse<ProfitReportData>> {
    try {
      enhancedLogger.info(
        `Generating profit report from ${dateRange.startDate} to ${dateRange.endDate}`,
        LogCategory.BUSINESS,
        'ReportService'
      );

      // 1. Get all completed orders in date range with items and their inventory relationships
      const orders = await this.prisma.order.findMany({
        where: {
          status: {
            in: ['COMPLETED', 'SERVED'],
          },
          createdAt: {
            gte: dateRange.startDate,
            lte: dateRange.endDate,
          },
        },
        include: {
          items: {
            include: {
              menuItem: {
                include: {
                  inventory: {
                    include: {
                      inventory: true,
                    },
                  },
                  category: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'asc',
        },
      });

      // 2. Get all expenses in date range
      const expenses = await this.prisma.expense.findMany({
        where: {
          date: {
            gte: dateRange.startDate,
            lte: dateRange.endDate,
          },
        },
      });

      // Calculate total expenses
      let totalExpenses = new Decimal(0);
      expenses.forEach(expense => {
        totalExpenses = totalExpenses.add(new Decimal(expense.amount || 0));
      });

      // 3. Calculate revenue and food costs for each order
      let totalRevenue = new Decimal(0);
      let totalFoodCost = new Decimal(0);

      const orderProfitabilityData = orders.map(order => {
        const revenue = new Decimal(order.total || 0);
        totalRevenue = totalRevenue.add(revenue);

        // Calculate food cost for this order
        let orderFoodCost = new Decimal(0);

        order.items.forEach(orderItem => {
          const menuItemInventories = orderItem.menuItem?.inventory || [];
          
          menuItemInventories.forEach(mii => {
            const inventory = mii.inventory;
            if (!inventory) return;

            // Calculate cost: costPerUnit * quantity_per_item * order_quantity
            const costPerUnit = new Decimal(inventory.costPerUnit || 0);
            const quantityPerItem = new Decimal(mii.quantity || 0);
            const orderQuantity = new Decimal(orderItem.quantity || 0);
            
            const itemCost = costPerUnit.mul(quantityPerItem).mul(orderQuantity);
            orderFoodCost = orderFoodCost.add(itemCost);
          });
        });

        totalFoodCost = totalFoodCost.add(orderFoodCost);

        return {
          order,
          revenue: decimalToNumber(revenue),
          foodCost: decimalToNumber(orderFoodCost),
        };
      });

      // 4. Allocate expenses proportionally to orders based on revenue
      const totalRevenueNum = decimalToNumber(totalRevenue);
      const totalExpensesNum = decimalToNumber(totalExpenses);

      const orderProfitability = orderProfitabilityData.map(orderData => {
        const allocatedExpenses = totalRevenueNum > 0 
          ? (orderData.revenue / totalRevenueNum) * totalExpensesNum
          : 0;

        const totalCost = orderData.foodCost + allocatedExpenses;
        const profit = orderData.revenue - totalCost;
        const margin = orderData.revenue > 0 ? (profit / orderData.revenue) * 100 : 0;

        return {
          id: orderData.order.id,
          orderNumber: orderData.order.orderNumber,
          createdAt: orderData.order.createdAt,
          type: orderData.order.type,
          revenue: orderData.revenue,
          foodCost: orderData.foodCost,
          allocatedExpenses,
          totalCost,
          profit,
          margin,
        };
      });

      // 5. Build per-item profitability analysis
      const itemProfitabilityMap = new Map<string, {
        itemId: string;
        itemName: string;
        category: string;
        unitsSold: number;
        revenue: Decimal;
        totalFoodCost: Decimal;
      }>();

      orders.forEach(order => {
        order.items.forEach(orderItem => {
          const menuItem = orderItem.menuItem;
          if (!menuItem) return;

          const itemId = menuItem.id;
          const itemName = orderItem.name;
          const category = menuItem.category?.name || 'Uncategorized';
          const quantity = orderItem.quantity;
          const itemRevenue = new Decimal(orderItem.totalPrice || 0);

          // Calculate food cost for this item
          let itemFoodCost = new Decimal(0);
          const menuItemInventories = menuItem.inventory || [];
          
          menuItemInventories.forEach(mii => {
            const inventory = mii.inventory;
            if (!inventory) return;

            const costPerUnit = new Decimal(inventory.costPerUnit || 0);
            const quantityPerItem = new Decimal(mii.quantity || 0);
            const itemCost = costPerUnit.mul(quantityPerItem).mul(quantity);
            itemFoodCost = itemFoodCost.add(itemCost);
          });

          if (!itemProfitabilityMap.has(itemId)) {
            itemProfitabilityMap.set(itemId, {
              itemId,
              itemName,
              category,
              unitsSold: 0,
              revenue: new Decimal(0),
              totalFoodCost: new Decimal(0),
            });
          }

          const itemData = itemProfitabilityMap.get(itemId)!;
          itemData.unitsSold += quantity;
          itemData.revenue = itemData.revenue.add(itemRevenue);
          itemData.totalFoodCost = itemData.totalFoodCost.add(itemFoodCost);
        });
      });

      // Convert item profitability to final format
      const itemProfitability = Array.from(itemProfitabilityMap.values())
        .map(item => {
          const revenue = decimalToNumber(item.revenue);
          const totalFoodCost = decimalToNumber(item.totalFoodCost);
          const foodCostPerUnit = item.unitsSold > 0 ? totalFoodCost / item.unitsSold : 0;
          const profitPerUnit = item.unitsSold > 0 ? (revenue - totalFoodCost) / item.unitsSold : 0;
          const totalProfit = revenue - totalFoodCost;
          const margin = revenue > 0 ? (totalProfit / revenue) * 100 : 0;

          return {
            itemId: item.itemId,
            itemName: item.itemName,
            category: item.category,
            unitsSold: item.unitsSold,
            revenue,
            foodCostPerUnit,
            totalFoodCost,
            profitPerUnit,
            totalProfit,
            margin,
          };
        })
        .sort((a, b) => b.totalProfit - a.totalProfit); // Sort by total profit descending

      // 6. Build daily trends
      const dailyTrendsMap = new Map<string, {
        date: string;
        revenue: Decimal;
        foodCost: Decimal;
        orderCount: number;
      }>();

      // Group orders by date
      orderProfitabilityData.forEach(orderData => {
        const date = new Date(orderData.order.createdAt).toISOString().split('T')[0];
        
        if (!dailyTrendsMap.has(date)) {
          dailyTrendsMap.set(date, {
            date,
            revenue: new Decimal(0),
            foodCost: new Decimal(0),
            orderCount: 0,
          });
        }

        const dailyData = dailyTrendsMap.get(date)!;
        dailyData.revenue = dailyData.revenue.add(orderData.revenue);
        dailyData.foodCost = dailyData.foodCost.add(orderData.foodCost);
        dailyData.orderCount += 1;
      });

      // Group expenses by date
      const dailyExpensesMap = new Map<string, Decimal>();
      expenses.forEach(expense => {
        const date = new Date(expense.date).toISOString().split('T')[0];
        
        if (!dailyExpensesMap.has(date)) {
          dailyExpensesMap.set(date, new Decimal(0));
        }

        const currentExpenses = dailyExpensesMap.get(date)!;
        dailyExpensesMap.set(date, currentExpenses.add(expense.amount || 0));
      });

      // Combine into daily trends
      const dailyTrends = Array.from(dailyTrendsMap.entries())
        .map(([date, data]) => {
          const revenue = decimalToNumber(data.revenue);
          const foodCost = decimalToNumber(data.foodCost);
          const expenses = decimalToNumber(dailyExpensesMap.get(date) || new Decimal(0));
          const totalCost = foodCost + expenses;
          const profit = revenue - totalCost;
          const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

          return {
            date,
            revenue,
            foodCost,
            expenses,
            totalCost,
            profit,
            margin,
          };
        })
        .sort((a, b) => a.date.localeCompare(b.date)); // Sort by date ascending

      // 7. Calculate summary KPIs
      const totalFoodCostNum = decimalToNumber(totalFoodCost);
      const totalCost = totalFoodCostNum + totalExpensesNum;
      const grossProfit = totalRevenueNum - totalCost;
      const profitMargin = totalRevenueNum > 0 ? (grossProfit / totalRevenueNum) * 100 : 0;

      const reportData: ProfitReportData = {
        totalRevenue: totalRevenueNum,
        totalFoodCost: totalFoodCostNum,
        totalExpenses: totalExpensesNum,
        totalCost,
        grossProfit,
        profitMargin,
        orderProfitability,
        itemProfitability,
        dailyTrends,
      };

      enhancedLogger.info(
        `Profit report generated successfully. Revenue: $${totalRevenueNum.toFixed(2)}, Profit: $${grossProfit.toFixed(2)}, Margin: ${profitMargin.toFixed(2)}%`,
        LogCategory.BUSINESS,
        'ReportService'
      );

      return this.createSuccessResponse(reportData);
    } catch (error) {
      enhancedLogger.error(
        `Failed to generate profit report: ${error}`,
        LogCategory.ERROR,
        'ReportService'
      );
      return this.createErrorResponse(error, 'Failed to generate profit report');
    }
  }
}

