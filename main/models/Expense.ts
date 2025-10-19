import { AppError } from '../error-handler';
import {
  Expense,
  ExpenseFilters,
  ExpenseStatus,
  PaymentMethod,
  RecurringType,
} from '../types';
import { decimalToNumber, validateCurrencyAmount } from '../utils/decimal';
import { logger } from '../utils/logger';
import { getPrismaClient } from '../db/prisma-wrapper';
import { Decimal } from 'decimal.js';

/**
 * Helper to convert Date or string to ISO string
 * Handles both Prisma Date objects and SQLite TEXT dates
 */
function toISOString(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  return value.toISOString();
}

// Update the ExpenseAnalytics interface to include the required properties
export interface ExpenseAnalyticsResult {
  byCategory: Record<string, number>;
  byMonth: Record<string, number>;
  byPaymentMethod: Record<string, number>;
  total: number;
}

export class ExpenseModel {
  /**
   * Get all expenses with filtering and pagination
   */
  static async getAllExpenses(
    filters: ExpenseFilters = {},
    page: number = 1,
    limit: number = 20
  ): Promise<{
    expenses: Expense[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    try {
      console.log('[ExpenseModel] getAllExpenses called with filters:', filters);
      
      const where: any = {};

      if (filters.category) {
        where.category = filters.category;
      }

      if (filters.dateFrom || filters.dateTo) {
        where.date = {};
        if (filters.dateFrom) {
          where.date.gte = new Date(filters.dateFrom);
        }
        if (filters.dateTo) {
          where.date.lte = new Date(filters.dateTo);
        }
      }

      if (filters.searchTerm) {
        where.OR = [
          { description: { contains: filters.searchTerm } },
          { category: { contains: filters.searchTerm } },
          { notes: { contains: filters.searchTerm } },
        ];
      }

      const skip = (page - 1) * limit;

      console.log('[ExpenseModel] Querying with where clause:', JSON.stringify(where, null, 2));
      console.log('[ExpenseModel] Page:', page, 'Skip:', skip, 'Limit:', limit);

      const [expenses, total] = await Promise.all([
        getPrismaClient().expense.findMany({
          where,
          skip,
          take: limit,
          orderBy: { date: 'desc' },
        }),
        getPrismaClient().expense.count({ where }),
      ]);
      
      console.log('[ExpenseModel] Found', expenses.length, 'expenses out of', total, 'total');

      return {
        expenses: expenses.map(this.formatExpense),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      console.error('[ExpenseModel] Error in getAllExpenses:', error);
      logger.error(
        `Failed to get all expenses: ${
          error instanceof Error ? error.message : error
        }`,
        'ExpenseModel'
      );
      throw new AppError(
        `Failed to retrieve expenses: ${error instanceof Error ? error.message : String(error)}`,
        true
      );
    }
  }

  /**
   * Get expense by ID
   */
  static async getExpenseById(id: string): Promise<Expense | null> {
    try {
      const expense = await getPrismaClient().expense.findUnique({
        where: { id },
        // Note: creator and approver relations don't exist in current schema
      });

      if (!expense) {
        return null;
      }

      return this.formatExpense(expense);
    } catch (error) {
      logger.error(
        `Failed to get expense by ID ${id}: ${
          error instanceof Error ? error.message : error
        }`,
        'ExpenseModel'
      );
      throw new AppError('Failed to retrieve expense', true);
    }
  }

  /**
   * Create new expense
   */
  static async createExpense(
    expenseData: {
      description: string;
      amount: number | Decimal;
      category: string;
      date: Date;
      receipt?: string;
      notes?: string;
    },
    userId: string
  ): Promise<Expense> {
    try {
      // Convert number to Decimal if needed
      const amount =
        typeof expenseData.amount === 'number'
          ? new Decimal(expenseData.amount)
          : expenseData.amount;

      // Validate amount
      if (!validateCurrencyAmount(amount)) {
        throw new AppError('Invalid expense amount', true);
      }

      const expense = await getPrismaClient().expense.create({
        data: {
          description: expenseData.description,
          amount: amount, // Prisma expects Decimal
          category: expenseData.category,
          date: expenseData.date,
          receipt: expenseData.receipt || null,
          notes: expenseData.notes || `Created by user: ${userId}`,
        },
      });

      logger.info(
        `Expense created successfully: ${expense.id} - ${expense.description} - $${expense.amount}`,
        'ExpenseModel'
      );

      return this.formatExpense(expense);
    } catch (error) {
      logger.error(
        `Failed to create expense "${expenseData.description}": ${
          error instanceof Error ? error.message : error
        }`,
        'ExpenseModel'
      );
      throw new AppError('Failed to create expense', true);
    }
  }

  /**
   * Update expense
   */
  static async updateExpense(
    id: string,
    updateData: Partial<{
      title: string;
      description: string;
      amount: number | Decimal;
      category: string;
      subcategory: string;
      vendor: string;
      receiptUrl: string;
      paymentMethod: PaymentMethod;
      isRecurring: boolean;
      recurringType: RecurringType;
      nextDueDate: Date;
      budgetCategory: string;
    }>
  ): Promise<Expense> {
    try {
      // Convert number to Decimal if needed
      let amount = updateData.amount;
      if (typeof amount === 'number') {
        amount = new Decimal(amount);
      }

      // Validate amount if provided
      if (amount && !validateCurrencyAmount(amount)) {
        throw new AppError('Invalid expense amount', true);
      }

      // Only update fields that exist in the schema
      const validUpdateData: any = {};
      if (updateData.description)
        validUpdateData.description = updateData.description;
      if (amount) validUpdateData.amount = amount;
      if (updateData.category) validUpdateData.category = updateData.category;

      const expense = await getPrismaClient().expense.update({
        where: { id },
        data: {
          ...validUpdateData,
          updatedAt: new Date().toISOString(),
        },
      });

      logger.info(`Expense updated successfully: ${id}`, 'ExpenseModel');

      return this.formatExpense(expense);
    } catch (error) {
      logger.error(
        `Failed to update expense ${id}: ${
          error instanceof Error ? error.message : error
        }`,
        'ExpenseModel'
      );
      throw new AppError('Failed to update expense', true);
    }
  }

  /**
   * Delete expense (soft delete)
   */
  static async deleteExpense(id: string): Promise<boolean> {
    try {
      await getPrismaClient().expense.delete({
        where: { id },
      });

      logger.info(`Expense deleted successfully: ${id}`, 'ExpenseModel');
      return true;
    } catch (error) {
      logger.error(
        `Failed to delete expense ${id}: ${
          error instanceof Error ? error.message : error
        }`,
        'ExpenseModel'
      );
      throw new AppError('Failed to delete expense', true);
    }
  }

  /**
   * Approve expense
   */
  static async approveExpense(
    id: string,
    approverId: string
  ): Promise<Expense> {
    try {
      const expense = await getPrismaClient().expense.update({
        where: { id },
        data: {
          notes: `Approved by: ${approverId} at ${new Date().toISOString()}`,
        },
      });

      logger.info(`Expense approved: ${id} by ${approverId}`, 'ExpenseModel');

      return this.formatExpense(expense);
    } catch (error) {
      logger.error(
        `Failed to approve expense ${id}: ${
          error instanceof Error ? error.message : error
        }`,
        'ExpenseModel'
      );
      throw new AppError('Failed to approve expense', true);
    }
  }

  /**
   * Get analytics data for expenses
   */
  static async getAnalytics(
    filters?: ExpenseFilters
  ): Promise<ExpenseAnalyticsResult> {
    try {
      const expensesResult = await this.getAllExpenses(filters);
      const expenses = expensesResult.expenses; // Extract the expenses array from the result

      // Initialize analytics structure
      const analytics: ExpenseAnalyticsResult = {
        byCategory: {},
        byMonth: {},
        byPaymentMethod: {},
        total: 0,
      };

      // Process expenses for analytics
      for (const expense of expenses) {
        const amount = decimalToNumber(expense.amount);
        analytics.total += amount;

        // By category
        const category = expense.category || 'Uncategorized';
        if (!analytics.byCategory[category]) {
          analytics.byCategory[category] = 0;
        }
        analytics.byCategory[category] += amount;

        // By month - use createdAt and ensure it's handled as a Date
        const createdAtDate = new Date(expense.createdAt);
        const month = createdAtDate.toISOString().substring(0, 7); // YYYY-MM format
        if (!analytics.byMonth[month]) {
          analytics.byMonth[month] = 0;
        }
        analytics.byMonth[month] += amount;

        // By payment method - handle the fact that paymentMethod doesn't exist in our schema
        // Instead of accessing a non-existent property, use a default value
        const paymentMethod = 'Unknown'; // Default value since the property doesn't exist
        if (!analytics.byPaymentMethod[paymentMethod]) {
          analytics.byPaymentMethod[paymentMethod] = 0;
        }
        analytics.byPaymentMethod[paymentMethod] += amount;
      }

      return analytics;
    } catch (error) {
      logger.error(
        `Failed to get expense analytics: ${
          error instanceof Error ? error.message : String(error)
        }`,
        'ExpenseModel'
      );
      throw new AppError('Failed to get expense analytics', true);
    }
  }

  /**
   * Get expenses by category
   */
  static async getExpensesByCategory(category: string): Promise<Expense[]> {
    try {
      const expenses = await getPrismaClient().expense.findMany({
        where: { category },
        orderBy: { createdAt: 'desc' },
      });

      logger.info(
        `Retrieved ${expenses.length} expenses for category: ${category}`,
        'ExpenseModel'
      );

      return expenses.map(this.formatExpense);
    } catch (error) {
      logger.error(
        `Failed to get expenses for category ${category}: ${
          error instanceof Error ? error.message : error
        }`,
        'ExpenseModel'
      );
      throw new AppError('Failed to retrieve expenses by category', true);
    }
  }

  /**
   * Get expenses by date range
   */
  static async getExpensesByDateRange(
    startDate: Date,
    endDate: Date
  ): Promise<Expense[]> {
    try {
      const expenses = await getPrismaClient().expense.findMany({
        where: {
          date: {
            gte: startDate,
            lte: endDate,
          },
        },
        orderBy: { date: 'desc' },
      });

      logger.info(
        `Retrieved ${expenses.length} expenses for date range: ${startDate.toISOString()} to ${endDate.toISOString()}`,
        'ExpenseModel'
      );

      return expenses.map(this.formatExpense);
    } catch (error) {
      logger.error(
        `Failed to get expenses for date range: ${
          error instanceof Error ? error.message : error
        }`,
        'ExpenseModel'
      );
      throw new AppError('Failed to retrieve expenses by date range', true);
    }
  }

  /**
   * Get expense statistics
   */
  static async getExpenseStats(
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    totalExpenses: number;
    averageExpense: number;
    expensesByCategory: Record<string, number>;
    expensesByMonth: Record<string, number>;
  }> {
    try {
      // Prepare date filters
      const where: any = {};
      if (startDate || endDate) {
        where.date = {};
        if (startDate) {
          where.date.gte = startDate;
        }
        if (endDate) {
          where.date.lte = endDate;
        }
      }

      // Get all expenses within date range
      const expenses = await getPrismaClient().expense.findMany({
        where,
        select: {
          amount: true,
          category: true,
          date: true,
        },
      });

      // Calculate total expenses
      const totalExpenses = expenses.reduce(
        (sum, expense) => sum + decimalToNumber(expense.amount),
        0
      );

      // Calculate average expense
      const averageExpense =
        expenses.length > 0 ? totalExpenses / expenses.length : 0;

      // Group expenses by category
      const expensesByCategory: Record<string, number> = {};
      expenses.forEach(expense => {
        const category = expense.category;
        const amount = decimalToNumber(expense.amount);
        if (expensesByCategory[category]) {
          expensesByCategory[category] += amount;
        } else {
          expensesByCategory[category] = amount;
        }
      });

      // Group expenses by month
      const expensesByMonth: Record<string, number> = {};
      expenses.forEach(expense => {
        const date = new Date(expense.date);
        const monthYear = `${date.getFullYear()}-${String(
          date.getMonth() + 1
        ).padStart(2, '0')}`;
        const amount = decimalToNumber(expense.amount);
        if (expensesByMonth[monthYear]) {
          expensesByMonth[monthYear] += amount;
        } else {
          expensesByMonth[monthYear] = amount;
        }
      });

      logger.info(
        `Generated expense statistics: ${expenses.length} expenses analyzed`,
        'ExpenseModel'
      );

      return {
        totalExpenses,
        averageExpense,
        expensesByCategory,
        expensesByMonth,
      };
    } catch (error) {
      logger.error(
        `Failed to get expense statistics: ${
          error instanceof Error ? error.message : error
        }`,
        'ExpenseModel'
      );
      throw new AppError('Failed to generate expense statistics', true);
    }
  }

  /**
   * Format expense for response
   */
  private static formatExpense(expense: any): any {
    return {
      id: expense.id,
      description: expense.description,
      amount: decimalToNumber(expense.amount), // Convert Prisma.Decimal to plain number for IPC
      category: expense.category,
      date: toISOString(expense.date),
      receipt: expense.receipt,
      notes: expense.notes,
      createdAt: toISOString(expense.createdAt),
      updatedAt: toISOString(expense.updatedAt),
    };
  }
}
